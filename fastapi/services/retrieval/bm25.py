from rank_bm25 import BM25Okapi
from core.dependencies import get_supabase_client
from models.chunk import Chunk
from utils.logger import logger
from typing import List
import re


def _tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


class BM25Retriever:
    """Búsqueda léxica BM25 sobre el corpus de chunks almacenados."""

    def __init__(self):
        self._client = get_supabase_client()

    async def retrieve(self, query: str, top_k: int = 10) -> List[Chunk]:
        logger.info(f"Búsqueda BM25: '{query}'")
        response = self._client.table("document_chunks").select("id, doc_id, content, metadata").execute()
        rows = response.data
        if not rows:
            return []

        corpus = [_tokenize(r["content"]) for r in rows]
        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(_tokenize(query))

        ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:top_k]
        return [
            Chunk(
                id=rows[i]["id"],
                content=rows[i]["content"],
                metadata=rows[i]["metadata"],
                score=float(score),
            )
            for i, score in ranked
            if score > 0
        ]
