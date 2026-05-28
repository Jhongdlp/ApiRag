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


@router.get("")
async def list_evaluations(
    _admin=Depends(verify_admin_token),
) -> list:
    """Devuelve las últimas 20 evaluaciones con nombres de documentos."""
    client = get_supabase_client()
    rows = (
        client.table("evaluation_jobs")
        .select("task_id,status,n_samples,metrics,doc_ids,created_at,finished_at,error_msg")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    jobs = rows.data or []

    # Recopila todos los doc_ids únicos para obtener sus nombres en una sola query
    all_doc_ids: list[str] = []
    for j in jobs:
        if j.get("doc_ids"):
            all_doc_ids.extend(j["doc_ids"])
    all_doc_ids = list(set(all_doc_ids))

    doc_names: dict[str, str] = {}
    if all_doc_ids:
        docs_rows = (
            client.table("documents")
            .select("id,filename")
            .in_("id", all_doc_ids)
            .execute()
        )
        doc_names = {d["id"]: d["filename"] for d in (docs_rows.data or [])}

    for j in jobs:
        if j.get("doc_ids"):
            j["doc_names"] = [doc_names.get(did, did[:8]) for did in j["doc_ids"]]
        else:
            j["doc_names"] = []  # vacío = todos los documentos listos

    return jobs


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
