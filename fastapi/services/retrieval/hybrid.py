"""Recuperación híbrida via RPC `match_chunks_hybrid` (RRF nativo en Postgres).

La fusión RRF ocurre dentro de Postgres en una sola llamada — un FULL OUTER
JOIN entre los rankings vector y FTS. Beneficios vs RRF en Python:
- Una sola ida y vuelta a la BD (antes: 2 SELECT + cómputo en Python).
- Aprovecha el planner de Postgres y los índices HNSW + GIN simultáneamente.
- `rrf_k` parametrizable, no hardcoded a 60.
"""
from __future__ import annotations

from typing import List, Optional

from core.config import settings
from core.dependencies import get_supabase_client
from models.chunk import Chunk
from services.ingestion.embedder import EmbeddingService
from utils.logger import logger


class HybridRetriever:
    """Wrapper sobre la RPC `match_chunks_hybrid`."""

    def __init__(self) -> None:
        self._client = None
        self._embedder = EmbeddingService()

    def _get_client(self):
        """Lazy initialization de Supabase client."""
        if self._client is None:
            self._client = get_supabase_client()
        return self._client

    async def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        filter_doc_ids: Optional[List[str]] = None,
        rrf_k: Optional[int] = None,
    ) -> List[Chunk]:
        top_k = top_k or settings.RETRIEVAL_TOP_K
        rrf_k = rrf_k or settings.RETRIEVAL_RRF_K
        logger.info(f"[hybrid] '{query}' top_k={top_k} rrf_k={rrf_k}")

        query_embedding = self._embedder.embed_query(query)
        params = {
            "query_embedding": query_embedding,
            "query_text": query,
            "match_count": top_k,
            "rrf_k": rrf_k,
            "filter_doc_ids": filter_doc_ids,
        }
        client = self._get_client()
        response = client.rpc("match_chunks_hybrid", params).execute()
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
        score=float(row.get("score") or 0.0),
    )
