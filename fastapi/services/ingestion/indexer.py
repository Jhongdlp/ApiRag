"""Indexador de chunks en Supabase pgvector.

Mejoras vs implementación previa:
- **Upsert por `(doc_id, content_hash)`**: re-ingestar el mismo documento es
  idempotente, no duplica filas.
- **Mapeo a columnas reales**: usa `page_number`, `heading_path`,
  `section_level`, `content_hash`, `token_count`, `job_id` (antes todo iba
  apelmazado dentro de `metadata` JSONB).
- **Validación de dimensiones**: rechaza vectores con `len != EMBEDDING_DIM`
  antes del round-trip, así no se entra un error opaco de Postgres.
- **Rollback transaccional por documento**: si un batch falla, se borran los
  chunks ya insertados del mismo `doc_id` (limpiar antes de re-encolar).
- **Estadísticas**: devuelve `IndexerStats` para que la tarea Celery actualice
  `documents.chunk_count` con valor real, no estimado.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

from core.config import settings
from core.dependencies import get_supabase_client
from models.chunk import Chunk
from utils.logger import logger


@dataclass
class IndexerStats:
    inserted: int
    failed_batches: int


class IndexerError(RuntimeError):
    pass


class SupabaseIndexer:
    """Inserta/upsertea chunks vectorizados en `document_chunks`."""

    def __init__(self) -> None:
        self._client = get_supabase_client()
        self._batch_size = settings.INDEXER_BATCH_SIZE
        self._dim = settings.EMBEDDING_DIM

    def index(
        self,
        chunks: List[Chunk],
        doc_id: str,
        job_id: Optional[str] = None,
    ) -> IndexerStats:
        if not chunks:
            logger.warning("[indexer] Sin chunks para indexar")
            return IndexerStats(inserted=0, failed_batches=0)

        rows = []
        for c in chunks:
            if c.embedding is None or len(c.embedding) != self._dim:
                raise IndexerError(
                    f"chunk {c.chunk_index}: embedding inválido "
                    f"(dim={None if c.embedding is None else len(c.embedding)}, "
                    f"esperado={self._dim})"
                )
            rows.append(
                {
                    "doc_id": doc_id,
                    "job_id": job_id,
                    "chunk_index": c.chunk_index,
                    "content": c.content,
                    "content_hash": c.content_hash,
                    "embedding": c.embedding,
                    "token_count": c.token_count,
                    "page_number": c.page_number,
                    "heading_path": c.heading_path,
                    "section_level": c.section_level,
                    "metadata": c.metadata,
                }
            )

        logger.info(
            f"[indexer] Upsert de {len(rows)} chunks "
            f"(batch={self._batch_size}, doc_id={doc_id})"
        )

        inserted = 0
        failed_batches = 0
        for i in range(0, len(rows), self._batch_size):
            batch = rows[i : i + self._batch_size]
            try:
                self._client.table("document_chunks").upsert(
                    batch,
                    on_conflict="doc_id,content_hash",
                ).execute()
                inserted += len(batch)
            except Exception as e:
                failed_batches += 1
                logger.error(
                    f"[indexer] batch {i // self._batch_size} falló: {e!r}"
                )
                self._rollback(doc_id)
                raise IndexerError(
                    f"Fallo en batch {i // self._batch_size}: {e}"
                ) from e

        logger.info(f"[indexer] OK — {inserted} chunks indexados")
        return IndexerStats(inserted=inserted, failed_batches=failed_batches)

    def _rollback(self, doc_id: str) -> None:
        """Borra todos los chunks de un documento. Usado tras fallo parcial
        para dejar el doc en estado limpio antes de reintentar."""
        try:
            self._client.table("document_chunks").delete().eq("doc_id", doc_id).execute()
            logger.warning(f"[indexer] rollback: chunks de {doc_id} eliminados")
        except Exception as e:
            logger.error(f"[indexer] rollback falló: {e!r}")
