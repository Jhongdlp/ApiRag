"""Endpoints de evaluación RAGAS (admin-only)."""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from core.dependencies import get_supabase_client
from core.security import verify_admin_token
from utils.logger import logger

router = APIRouter()


class EvaluationRequest(BaseModel):
    doc_ids: Optional[List[str]] = Field(None, description="IDs de documentos a evaluar; None = todos los listos")
    n_samples: int = Field(5, ge=1, le=15, description="Preguntas a generar por documento")


class EvaluationStarted(BaseModel):
    task_id: str


@router.post("", response_model=EvaluationStarted)
async def start_evaluation(
    body: EvaluationRequest,
    _admin=Depends(verify_admin_token),
) -> EvaluationStarted:
    """Lanza una evaluación RAGAS en background y devuelve el task_id."""
    from tasks.evaluation_tasks import run_evaluation_task

    task = run_evaluation_task.delay(
        doc_ids=body.doc_ids,
        n_samples=body.n_samples,
    )
    logger.info(f"[eval] Tarea {task.id} encolada (n_samples={body.n_samples})")
    return EvaluationStarted(task_id=task.id)


@router.get("/{task_id}")
async def get_evaluation(
    task_id: str,
    _admin=Depends(verify_admin_token),
) -> dict:
    """Devuelve el estado y resultados de una evaluación."""
    client = get_supabase_client()
    row = (
        client.table("evaluation_jobs")
        .select("*")
        .eq("task_id", task_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    job = row.data[0]
    return {
        "task_id": job["task_id"],
        "status": job["status"],
        "n_samples": job.get("n_samples"),
        "metrics": job.get("metrics"),
        "samples": job.get("samples"),
        "error_msg": job.get("error_msg"),
        "created_at": job.get("created_at"),
        "finished_at": job.get("finished_at"),
    }


@router.get("/{task_id}/report")
async def download_report(
    task_id: str,
    _admin=Depends(verify_admin_token),
):
    """Descarga el reporte PDF de una evaluación completada."""
    client = get_supabase_client()
    row = (
        client.table("evaluation_jobs")
        .select("status, report_path")
        .eq("task_id", task_id)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    job = row.data[0]
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail="La evaluación aún no ha finalizado.")
    report_path = job.get("report_path")
    if not report_path or not os.path.exists(report_path):
        raise HTTPException(status_code=404, detail="Reporte PDF no disponible.")
    return FileResponse(
        path=report_path,
        media_type="application/pdf",
        filename=f"ragas_report_{task_id[:8]}.pdf",
    )
