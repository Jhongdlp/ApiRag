from core.dependencies import get_supabase_client
from utils.logger import logger
from typing import List


class DocumentManager:
    """CRUD de documentos en Supabase."""

    def __init__(self):
        self._client = get_supabase_client()

    async def list_all(self) -> List[dict]:
        logger.info("Listando documentos...")
        response = self._client.table("documents").select("*").order("uploaded_at", desc=True).execute()
        return response.data

    async def delete(self, doc_id: str) -> None:
        logger.info(f"Eliminando documento: {doc_id}")
        # Los chunks se eliminan en cascada por la FK con ON DELETE CASCADE
        self._client.table("documents").delete().eq("id", doc_id).execute()

    async def create(self, doc_id: str, filename: str) -> dict:
        row = {"id": doc_id, "filename": filename, "status": "processing"}
        response = self._client.table("documents").insert(row).execute()
        return response.data[0]

    async def update_status(self, doc_id: str, status: str, chunk_count: int = 0) -> None:
        self._client.table("documents").update(
            {"status": status, "chunk_count": chunk_count}
        ).eq("id", doc_id).execute()
