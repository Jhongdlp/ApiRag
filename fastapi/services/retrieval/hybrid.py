from services.retrieval.vector import VectorRetriever
from services.retrieval.bm25 import BM25Retriever
from models.chunk import Chunk
from utils.logger import logger
from typing import List


RRF_K = 60  # constante estándar de Reciprocal Rank Fusion


class HybridRetriever:
    """Fusiona resultados de búsqueda vectorial y BM25 usando RRF."""

    def __init__(self):
        self._vector = VectorRetriever()
        self._bm25 = BM25Retriever()

    async def retrieve(self, query: str, top_k: int = 5) -> List[Chunk]:
        logger.info(f"Búsqueda híbrida (RRF): '{query}'")
        vector_results, bm25_results = await self._vector.retrieve(query, top_k * 2), await self._bm25.retrieve(query, top_k * 2)

        scores: dict[str, float] = {}
        id_to_chunk: dict[str, Chunk] = {}

        for rank, chunk in enumerate(vector_results):
            scores[chunk.id] = scores.get(chunk.id, 0) + 1 / (RRF_K + rank + 1)
            id_to_chunk[chunk.id] = chunk

        for rank, chunk in enumerate(bm25_results):
            scores[chunk.id] = scores.get(chunk.id, 0) + 1 / (RRF_K + rank + 1)
            id_to_chunk[chunk.id] = chunk

        ranked_ids = sorted(scores, key=lambda x: scores[x], reverse=True)[:top_k]
        results = []
        for cid in ranked_ids:
            chunk = id_to_chunk[cid]
            chunk.score = scores[cid]
            results.append(chunk)
        return results
