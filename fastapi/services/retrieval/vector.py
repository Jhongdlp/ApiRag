"""Búsqueda densa via RPC `match_chunks` (pgvector + HNSW).

Cambios vs versión previa:
- Usa el `EmbeddingService` singleton (no recarga el modelo en cada query).
- Soporta `filter_doc_ids` para restringir el espacio de búsqueda.
- Umbral de similitud configurable desde `settings` (no hardcoded 0.4).
- Mapea metadata enriquecida (page, heading_path) al `Chunk`.
"""
from __future__ import annotations

from typing import List, Optional

from core.config import settings
from core.dependencies import get_supabase_client
from models.chunk import Chunk
from services.ingestion.embedder import EmbeddingService
from utils.logger import logger


class VectorRetriever:
    def __init__(self) -> None:
        self._client = get_supabase_client()
        self._embedder = EmbeddingService()

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        filter_doc_ids: Optional[List[str]] = None,
        min_similarity: Optional[float] = None,
    ) -> List[Chunk]:
        logger.info(f"[vector] '{query}' top_k={top_k}")
        query_embedding = self._embedder.embed_query(query)
        params = {
            "query_embedding": query_embedding,
            "match_count": top_k,
            "min_similarity": min_similarity if min_similarity is not None else settings.RETRIEVAL_MIN_SIMILARITY,
            "filter_doc_ids": filter_doc_ids,
        }
        response = self._client.rpc("match_chunks", params).execute()
        return [_row_to_chunk(r) for r in (response.data or [])]


def _row_to_chunk(row: dict) -> Chunk:
    md = row.get("metadata") or {}
    return Chunk(
        id=row["id"],
        doc_id=row.get("doc_id"),
        content=row["content"],
        metadata=md,
        page_number=md.get("page"),
        heading_path=" > ".join(md.get("headings", [])) if md.get("headings") else None,
        score=float(row.get("similarity") or 0.0),
    )
