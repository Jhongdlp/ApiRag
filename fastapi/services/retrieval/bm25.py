"""Búsqueda léxica via RPC `match_chunks_fts` (Postgres tsvector + spanish_unaccent).

Reemplaza al antiguo `BM25Okapi` en memoria que descargaba TODO el corpus por
cada consulta. Ahora:
- El índice GIN `idx_chunks_fts` vive en Postgres y es incremental.
- El dict `spanish_unaccent` hace stemming español + ignora tildes.
- `websearch_to_tsquery` soporta operadores naturales del usuario.
- Filtra automáticamente por `documents.status='ready'` (no se devuelven
  chunks de documentos en error o en proceso).
"""
from __future__ import annotations

from typing import List, Optional

from core.config import settings
from core.dependencies import get_supabase_client
from models.chunk import Chunk
from utils.logger import logger


class BM25Retriever:
    """Wrapper fino sobre la RPC `match_chunks_fts`."""

    def __init__(self) -> None:
        self._client = get_supabase_client()

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        filter_doc_ids: Optional[List[str]] = None,
    ) -> List[Chunk]:
        logger.info(f"[fts] '{query}' top_k={top_k}")
        params = {
            "query_text": query,
            "match_count": top_k,
            "filter_doc_ids": filter_doc_ids,
        }
        response = self._client.rpc("match_chunks_fts", params).execute()
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
