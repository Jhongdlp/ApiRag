from core.dependencies import get_supabase_client
from services.ingestion.embedder import EmbeddingService
from models.chunk import Chunk
from utils.logger import logger
from typing import List


class VectorRetriever:
    """Búsqueda semántica por similitud coseno en pgvector."""

    def __init__(self):
        self._client = get_supabase_client()
        self._embedder = EmbeddingService()

    async def retrieve(self, query: str, top_k: int = 10) -> List[Chunk]:
        logger.info(f"Búsqueda vectorial: '{query}'")
        query_embedding = self._embedder._model.encode([query])[0].tolist()
        response = self._client.rpc(
            "match_chunks",
            {"query_embedding": query_embedding, "match_count": top_k, "min_similarity": 0.4},
        ).execute()
        chunks = []
        for row in response.data:
            chunks.append(
                Chunk(
                    id=row["id"],
                    content=row["content"],
                    metadata=row["metadata"],
                    score=row["similarity"],
                )
            )
        return chunks
