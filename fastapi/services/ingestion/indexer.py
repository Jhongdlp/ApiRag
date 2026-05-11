from core.dependencies import get_supabase_client
from models.chunk import Chunk
from utils.logger import logger
from typing import List


class SupabaseIndexer:
    """Sube chunks con embeddings a Supabase pgvector."""

    def __init__(self):
        self._client = get_supabase_client()

    def index(self, chunks: List[Chunk]) -> None:
        logger.info(f"Indexando {len(chunks)} chunks en Supabase...")
        rows = [
            {
                "doc_id": c.metadata["doc_id"],
                "content": c.content,
                "embedding": c.embedding,
                "metadata": c.metadata,
            }
            for c in chunks
        ]
        # Insertar en lotes de 100 para evitar payloads grandes
        batch_size = 100
        for i in range(0, len(rows), batch_size):
            self._client.table("document_chunks").insert(rows[i : i + batch_size]).execute()
        logger.info("Indexación completada.")
