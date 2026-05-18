"""Endpoints admin para gestión de documentos institucionales.

Cambios vs versión previa:
- `POST /upload` acepta metadatos opcionales (`category`, `tags`, `description`,
  `language`) como form fields, no solo el PDF.
- Dedup temprano: si el `file_hash` ya existe en `documents`, responde 409 con
  el `doc_id` existente — evita reprocesar el mismo PDF.
- Validación real del MIME (no solo extensión) via `magic`.
- Nuevo `POST /{doc_id}/reindex`: re-encola la ingesta de un documento ya
  registrado, útil tras cambios en el chunker o el modelo de embeddings.
- Nuevo `GET /{doc_id}/jobs`: histórico de ingestiones del documento.
"""
from __future__ import annotations

import hashlib
import os
import uuid
from typing import List, Optional

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.config import settings
from core.security import verify_admin_token
from models.document import DocumentOut, IngestionJobOut
from services.document.manager import DocumentManager
from tasks.ingestion_tasks import process_document_task
from utils.logger import logger
from utils.validators import validate_pdf

router = APIRouter()
doc_manager = DocumentManager()


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    category: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    tags: Optional[str] = Form(None, description="CSV: 'reglamento,grado,tesis'"),
    language: str = Form("es"),
    admin=Depends(verify_admin_token),
):
    content = await file.read()
    validate_pdf(content, file.filename)

    file_hash = hashlib.sha256(content).hexdigest()
    existing = await doc_manager.find_by_hash(file_hash)
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Este PDF ya está indexado",
                "doc_id": existing["id"],
                "status": existing["status"],
            },
        )

    doc_id = str(uuid.uuid4())
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(settings.UPLOAD_DIR, f"{doc_id}.pdf")
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    tags_list = [t.strip() for t in tags.split(",")] if tags else []
    uploaded_by = None

    await doc_manager.create(
        doc_id=doc_id,
        filename=file.filename,
        file_hash=file_hash,
        file_size_bytes=len(content),
        category=category,
        description=description,
        tags=tags_list,
        language=language,
        uploaded_by=uploaded_by,
        storage_path=file_path,
    )

    task = process_document_task.delay(doc_id, file_path, file.filename, uploaded_by)
    logger.info(f"[upload] doc={doc_id} task={task.id}")
    return {
        "doc_id": doc_id,
        "task_id": task.id,
        "status": "pending",
        "filename": file.filename,
        "file_hash": file_hash,
        "file_size_bytes": len(content),
    }


@router.post("/{doc_id}/reindex")
async def reindex_document(doc_id: str, admin=Depends(verify_admin_token)):
    """Re-encola un documento existente. Borra sus chunks viejos primero."""
    from core.dependencies import get_supabase_client

    doc = await doc_manager.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    storage_path = doc.get("storage_path")
    if not storage_path or not os.path.exists(storage_path):
        raise HTTPException(
            status_code=410,
            detail="El PDF original ya no está en disco; vuelve a subirlo.",
        )

    client = get_supabase_client()
    client.table("document_chunks").delete().eq("doc_id", doc_id).execute()
    await doc_manager.mark_processing(doc_id)

    task = process_document_task.delay(doc_id, storage_path, doc["filename"], None)
    return {"doc_id": doc_id, "task_id": task.id, "status": "queued"}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, admin=Depends(verify_admin_token)):
    doc = await doc_manager.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    storage_path = doc.get("storage_path")
    await doc_manager.delete(doc_id)
    if storage_path and os.path.exists(storage_path):
        try:
            os.remove(storage_path)
        except OSError as e:
            logger.warning(f"[delete] no se pudo borrar {storage_path}: {e}")
    return {"status": "deleted", "doc_id": doc_id}


@router.get("/", response_model=List[DocumentOut])
async def list_documents(admin=Depends(verify_admin_token)):
    rows = await doc_manager.list_all()
    return [DocumentOut(**_clean(r)) for r in rows]


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: str, admin=Depends(verify_admin_token)):
    row = await doc_manager.get(doc_id)
    if not row:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return DocumentOut(**_clean(row))


@router.get("/{doc_id}/jobs", response_model=List[IngestionJobOut])
async def list_jobs(doc_id: str, admin=Depends(verify_admin_token)):
    from core.dependencies import get_supabase_client

    client = get_supabase_client()
    response = (
        client.table("ingestion_jobs")
        .select("*")
        .eq("doc_id", doc_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [IngestionJobOut(**_clean(r)) for r in (response.data or [])]


def _clean(row: dict) -> dict:
    """Filtra columnas que no están en el modelo Pydantic correspondiente."""
    return {k: v for k, v in row.items() if v is not None or k in ("tags", "steps_log")}
