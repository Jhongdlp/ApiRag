"""CRUD de `documents` y `ingestion_jobs` en Supabase.

`DocumentManager` cubre el ciclo de vida del documento (creación, dedup por
file_hash, transición de estados). `IngestionJobManager` registra cada paso
del pipeline para auditoría y para alimentar el WebSocket de progreso.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, List, Optional

from core.dependencies import get_supabase_client
from utils.logger import logger


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DocumentManager:
    """CRUD de `documents`."""

    def __init__(self) -> None:
        self._client = get_supabase_client()

    async def list_all(self) -> List[dict]:
        response = (
            self._client.table("documents")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return response.data

    async def get(self, doc_id: str) -> Optional[dict]:
        response = (
            self._client.table("documents").select("*").eq("id", doc_id).limit(1).execute()
        )
        return response.data[0] if response.data else None

    async def find_by_hash(self, file_hash: str) -> Optional[dict]:
        response = (
            self._client.table("documents")
            .select("*")
            .eq("file_hash", file_hash)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    async def create(
        self,
        *,
        doc_id: str,
        filename: str,
        file_hash: str,
        file_size_bytes: int,
        mime_type: str = "application/pdf",
        category: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        language: str = "es",
        uploaded_by: Optional[str] = None,
        storage_path: Optional[str] = None,
    ) -> dict:
        row = {
            "id": doc_id,
            "filename": filename,
            "file_hash": file_hash,
            "file_size_bytes": file_size_bytes,
            "mime_type": mime_type,
            "category": category,
            "description": description,
            "tags": tags or [],
            "language": language,
            "uploaded_by": uploaded_by,
            "storage_path": storage_path,
            "status": "pending",
        }
        response = self._client.table("documents").insert(row).execute()
        return response.data[0]

    async def mark_processing(self, doc_id: str) -> None:
        self._client.table("documents").update(
            {"status": "processing"}
        ).eq("id", doc_id).execute()

    async def mark_ready(
        self,
        doc_id: str,
        *,
        chunk_count: int,
        page_count: Optional[int] = None,
    ) -> None:
        payload: dict[str, Any] = {"status": "ready", "chunk_count": chunk_count}
        if page_count is not None:
            payload["page_count"] = page_count
        self._client.table("documents").update(payload).eq("id", doc_id).execute()

    async def mark_error(self, doc_id: str) -> None:
        self._client.table("documents").update(
            {"status": "error"}
        ).eq("id", doc_id).execute()

    async def delete(self, doc_id: str) -> None:
        logger.info(f"[doc_manager] Eliminando documento {doc_id}")
        # chunks e ingestion_jobs caen por ON DELETE CASCADE
        self._client.table("documents").delete().eq("id", doc_id).execute()


class IngestionJobManager:
    """CRUD de `ingestion_jobs` para trazabilidad del pipeline."""

    def __init__(self) -> None:
        self._client = get_supabase_client()

    def create(
        self,
        *,
        doc_id: str,
        celery_task_id: str,
        triggered_by: Optional[str] = None,
    ) -> str:
        row = {
            "doc_id": doc_id,
            "celery_task_id": celery_task_id,
            "triggered_by": triggered_by,
            "status": "queued",
            "steps_log": [],
        }
        response = self._client.table("ingestion_jobs").insert(row).execute()
        return response.data[0]["id"]

    def set_status(self, job_id: str, status: str) -> None:
        payload: dict[str, Any] = {"status": status}
        if status in ("extracting", "converting", "chunking", "embedding", "indexing"):
            payload["started_at"] = payload.get("started_at") or _utc_now_iso()
        self._client.table("ingestion_jobs").update(payload).eq("id", job_id).execute()

    def append_step(
        self,
        job_id: str,
        *,
        step: str,
        message: str,
        duration_ms: Optional[int] = None,
        extra: Optional[dict] = None,
    ) -> None:
        # `steps_log` es JSONB; mantenemos una bitácora estructurada
        entry = {
            "step": step,
            "message": message,
            "ts": _utc_now_iso(),
        }
        if duration_ms is not None:
            entry["duration_ms"] = duration_ms
        if extra:
            entry["extra"] = extra
        # leer-modificar-escribir (volumen bajo por job)
        current = (
            self._client.table("ingestion_jobs")
            .select("steps_log")
            .eq("id", job_id)
            .limit(1)
            .execute()
        ).data
        steps = (current[0].get("steps_log") if current else None) or []
        steps.append(entry)
        self._client.table("ingestion_jobs").update({"steps_log": steps}).eq(
            "id", job_id
        ).execute()

    def mark_done(
        self,
        job_id: str,
        *,
        chunk_count: int,
        embedding_model: str,
        embedding_dim: int,
    ) -> None:
        self._client.table("ingestion_jobs").update(
            {
                "status": "done",
                "finished_at": _utc_now_iso(),
                "chunk_count": chunk_count,
                "embedding_model": embedding_model,
                "embedding_dim": embedding_dim,
            }
        ).eq("id", job_id).execute()

    def mark_failed(self, job_id: str, error_message: str) -> None:
        self._client.table("ingestion_jobs").update(
            {
                "status": "failed",
                "finished_at": _utc_now_iso(),
                "error_message": error_message[:2000],
            }
        ).eq("id", job_id).execute()
