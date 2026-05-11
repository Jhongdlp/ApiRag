from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from core.security import verify_admin_token
from tasks.ingestion_tasks import process_document_task
from services.document.manager import DocumentManager
from utils.logger import logger
import aiofiles
import uuid
import os

router = APIRouter()
doc_manager = DocumentManager()

UPLOAD_DIR = "/app/uploads"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    admin=Depends(verify_admin_token),
):
    """Sube un PDF y lanza la tarea de ingesta asíncrona."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 50MB).")

    doc_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    task = process_document_task.delay(doc_id, file_path, file.filename)

    return {"doc_id": doc_id, "task_id": task.id, "status": "processing"}


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, admin=Depends(verify_admin_token)):
    """Elimina un documento y todos sus chunks del vector store."""
    await doc_manager.delete(doc_id)
    return {"status": "deleted", "doc_id": doc_id}


@router.get("/")
async def list_documents(admin=Depends(verify_admin_token)):
    """Lista todos los documentos indexados."""
    return await doc_manager.list_all()
