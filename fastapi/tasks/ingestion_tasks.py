"""Tarea Celery: pipeline completo de ingesta de un PDF.

Pipeline:
    extraction → conversion (Docling unificado) → chunking (HybridChunker)
    → embedding (bge-m3 en GPU) → indexing (upsert idempotente)

Garantías nuevas:
- `documents.status` siempre converge a `ready` o `error` (antes quedaba en
  `processing` para siempre si fallaba la tarea).
- Cada fase registra un step en `ingestion_jobs.steps_log` con duración.
- El PDF temporal SIEMPRE se borra al final (éxito o fallo).
- Reintentos con backoff exponencial para fallos transitorios.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from typing import Optional

sys.path.insert(0, "/app")

import redis
from celery import Celery

from core.config import settings


celery_app = Celery(
    "uti_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Guayaquil",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_track_started=True,
)

_redis = redis.from_url(settings.REDIS_URL)


def publish_progress(task_id: str, step: str, progress: int, message: str) -> None:
    _redis.publish(
        f"task_progress:{task_id}",
        json.dumps({"step": step, "progress": progress, "message": message}),
    )


@celery_app.task(
    bind=True,
    name="process_document",
    autoretry_for=(ConnectionError, TimeoutError),
    retry_backoff=settings.CELERY_RETRY_BACKOFF,
    retry_backoff_max=600,
    retry_jitter=True,
    max_retries=settings.CELERY_RETRY_MAX,
)
def process_document_task(
    self,
    doc_id: str,
    file_path: str,
    filename: str,
    triggered_by: Optional[str] = None,
):
    """Ejecuta el pipeline RAG de ingesta. Idempotente vía `UNIQUE(doc_id, content_hash)`."""
    # Imports diferidos: la carga de Docling + transformers + sentence-transformers
    # toma ~5s. Mantenerlos fuera del módulo evita penalizar el arranque del worker
    # y permite que las importaciones fallidas no rompan el broker.
    from services.document.manager import DocumentManager, IngestionJobManager
    from services.ingestion.extractor import PDFProcessor
    from services.ingestion.chunker import DocumentChunker
    from services.ingestion.embedder import EmbeddingService
    from services.ingestion.indexer import SupabaseIndexer
    from utils.logger import logger

    task_id = self.request.id
    jobs = IngestionJobManager()
    docs = DocumentManager()

    job_id = jobs.create(doc_id=doc_id, celery_task_id=task_id, triggered_by=triggered_by)
    asyncio.run(docs.mark_processing(doc_id))

    def step(status_db: str, name: str, progress: int, message: str, fn):
        publish_progress(task_id, name, progress, message)
        jobs.set_status(job_id, status_db)
        t0 = time.perf_counter()
        try:
            result = fn()
        except Exception:
            raise
        dt = int((time.perf_counter() - t0) * 1000)
        jobs.append_step(job_id, step=name, message=message, duration_ms=dt)
        logger.info(f"[task] {name} OK en {dt} ms")
        return result

    try:
        processed = step(
            "extracting",
            "extraction",
            15,
            f"Procesando PDF '{filename}' con Docling...",
            lambda: PDFProcessor().process(file_path),
        )

        chunks = step(
            "chunking",
            "chunking",
            40,
            "Generando chunks semánticos (tokenizer-aware)...",
            lambda: DocumentChunker().chunk(
                processed,
                metadata={"doc_id": doc_id, "filename": filename},
            ),
        )

        if not chunks:
            raise RuntimeError("El documento no produjo chunks válidos (¿PDF vacío o escaneado sin OCR?)")

        embedder = EmbeddingService()
        chunks = step(
            "embedding",
            "embedding",
            70,
            f"Embeddings ({len(chunks)} chunks, device={embedder.device})...",
            lambda: embedder.embed_chunks(chunks),
        )

        stats = step(
            "indexing",
            "indexing",
            90,
            "Upsert en pgvector con dedup por hash...",
            lambda: SupabaseIndexer().index(chunks, doc_id=doc_id, job_id=job_id),
        )

        asyncio.run(
            docs.mark_ready(
                doc_id,
                chunk_count=stats.inserted,
                page_count=processed.page_count,
            )
        )
        jobs.mark_done(
            job_id,
            chunk_count=stats.inserted,
            embedding_model=settings.EMBEDDING_MODEL,
            embedding_dim=settings.EMBEDDING_DIM,
        )
        publish_progress(
            task_id,
            "done",
            100,
            f"'{filename}' indexado: {stats.inserted} chunks, {processed.page_count} páginas.",
        )
        return {
            "status": "success",
            "doc_id": doc_id,
            "job_id": job_id,
            "chunks": stats.inserted,
            "pages": processed.page_count,
        }

    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        logger.exception(f"[task] Falló ingesta de {filename}: {msg}")
        try:
            jobs.mark_failed(job_id, msg)
            asyncio.run(docs.mark_error(doc_id))
        finally:
            publish_progress(task_id, "error", 0, msg)
        raise

    finally:
        # Limpieza incondicional del PDF temporal
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except OSError as e:
            logger.warning(f"[task] No se pudo borrar tmp {file_path}: {e}")
