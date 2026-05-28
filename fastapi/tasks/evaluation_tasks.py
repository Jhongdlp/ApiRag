"""Tarea Celery: pipeline completo de evaluación RAGAS.

Pipeline:
    fetch chunks → generate QA (Ollama) → run RAG pipeline
    → ragas.evaluate() → generate PDF → persist results
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from typing import List, Optional

sys.path.insert(0, "/app")

import redis

from core.config import settings
from tasks.celery_app import celery_app

_redis = redis.from_url(settings.REDIS_URL)

_REPORT_DIR = "/app/uploads/reports"


def _publish(task_id: str, step: str, progress: int, message: str, extra: dict | None = None) -> None:
    payload = {"step": step, "progress": progress, "message": message}
    if extra:
        payload.update(extra)
    _redis.publish(
        f"task_eval_progress:{task_id}",
        json.dumps(payload),
    )


@celery_app.task(
    bind=True,
    name="run_evaluation",
    max_retries=0,
)
def run_evaluation_task(
    self,
    doc_ids: Optional[List[str]],
    n_samples: int = 5,
):
    """Ejecuta el pipeline de evaluación RAGAS completo."""
    from core.dependencies import get_supabase_client
    from services.evaluation.testset_generator import TestsetGenerator
    from services.evaluation.ragas_evaluator import EvalSample, RagasEvaluator
    from services.retrieval.hybrid import HybridRetriever
    from services.generation.llm import LLMService
    from utils.logger import logger

    task_id = self.request.id
    client = get_supabase_client()

    def _persist_status(status: str, **kwargs):
        update = {"status": status, **kwargs}
        client.table("evaluation_jobs").update(update).eq("task_id", task_id).execute()

    # Registra el job en Supabase
    client.table("evaluation_jobs").insert({
        "task_id": task_id,
        "status": "running",
        "doc_ids": doc_ids,
        "n_samples": n_samples,
    }).execute()

    try:
        # ── Paso 1: Cargar chunks ─────────────────────────────────────────────
        _publish(task_id, "fetch_chunks", 10, "Cargando chunks de documentos...")
        t0 = time.perf_counter()
        generator = TestsetGenerator()
        chunks = generator.fetch_chunks(doc_ids, n_per_doc=n_samples)
        if not chunks:
            raise RuntimeError("No hay documentos listos para evaluar. Sube e indexa documentos primero.")
        logger.info(f"[eval] {len(chunks)} chunks cargados en {int((time.perf_counter()-t0)*1000)} ms")

        # ── Paso 2: Generar preguntas QA ──────────────────────────────────────
        _publish(task_id, "generate_qa", 25, f"Generando preguntas de evaluación desde {len(chunks)} chunks...")
        t0 = time.perf_counter()
        qa_samples = generator.generate(doc_ids, n_per_doc=n_samples)
        if not qa_samples:
            raise RuntimeError("No se pudieron generar preguntas de evaluación. Verifica que Ollama esté disponible.")
        logger.info(f"[eval] {len(qa_samples)} pares QA generados en {int((time.perf_counter()-t0)*1000)} ms")

        # ── Paso 3: Ejecutar pipeline RAG ─────────────────────────────────────
        _publish(task_id, "run_rag", 50, f"Ejecutando pipeline RAG para {len(qa_samples)} preguntas...")
        t0 = time.perf_counter()
        retriever = HybridRetriever()
        llm = LLMService()

        eval_samples: List[EvalSample] = []
        for i, qa in enumerate(qa_samples):
            _publish(
                task_id, "run_rag",
                50 + int((i / len(qa_samples)) * 20),
                f"Procesando pregunta {i+1}/{len(qa_samples)}...",
            )
            try:
                retrieved = asyncio.run(retriever.retrieve(qa.question, top_k=5, filter_doc_ids=doc_ids))
                contexts = [c.content for c in retrieved]
                answer = asyncio.run(llm.generate(query=qa.question, context_chunks=retrieved))
                eval_samples.append(EvalSample(
                    question=qa.question,
                    answer=answer,
                    contexts=contexts if contexts else [qa.source_content],
                    ground_truth=qa.ground_truth,
                ))
            except Exception as e:
                logger.warning(f"[eval] Error en pregunta {i+1}: {e!r}")
                continue

        if not eval_samples:
            raise RuntimeError("El pipeline RAG no produjo respuestas válidas.")
        logger.info(f"[eval] {len(eval_samples)} respuestas RAG en {int((time.perf_counter()-t0)*1000)} ms")

        # ── Paso 4: Calcular métricas RAGAS ───────────────────────────────────
        _publish(task_id, "evaluate", 72, "Calculando métricas RAGAS (esto puede tardar varios minutos)...")
        t0 = time.perf_counter()
        evaluator = RagasEvaluator()
        result = evaluator.evaluate(eval_samples)
        logger.info(
            f"[eval] RAGAS OK en {int((time.perf_counter()-t0)*1000)} ms — "
            f"overall={result.overall:.3f}"
        )

        # ── Paso 5: Generar PDF ───────────────────────────────────────────────
        _publish(task_id, "generate_report", 92, "Generando reporte PDF...")
        os.makedirs(_REPORT_DIR, exist_ok=True)
        report_path = os.path.join(_REPORT_DIR, f"{task_id}.pdf")
        evaluator.generate_pdf(result, report_path)

        # ── Persistir resultado ───────────────────────────────────────────────
        metrics_dict = {
            "faithfulness": result.faithfulness,
            "answer_relevancy": result.answer_relevancy,
            "context_precision": result.context_precision,
            "context_recall": result.context_recall,
            "overall": result.overall,
        }
        samples_list = [
            {
                "question": s.question,
                "answer": s.answer[:500],
                "ground_truth": s.ground_truth,
                "faithfulness": s.faithfulness,
                "answer_relevancy": s.answer_relevancy,
                "context_precision": s.context_precision,
                "context_recall": s.context_recall,
            }
            for s in result.samples
        ]
        _persist_status(
            "done",
            metrics=metrics_dict,
            samples=samples_list,
            report_path=report_path,
            finished_at="now()",
        )

        _publish(
            task_id, "done", 100,
            f"Evaluación completada — Score global: {result.overall:.1%}",
            {"metrics": metrics_dict, "samples": samples_list},
        )
        logger.info(f"[eval] Tarea {task_id} completada con éxito")

    except Exception as e:
        logger.exception(f"[eval] Error en tarea {task_id}: {e}")
        _persist_status("error", error_msg=str(e))
        _publish(task_id, "error", 0, f"Error: {e}")
        raise
