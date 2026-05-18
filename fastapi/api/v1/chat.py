"""Endpoint público de chat RAG.

Diferencias vs versión previa:
- Devuelve `sources: List[Source]` con `chunk_id`, `page_number`, `heading_path`
  y `snippet` — suficiente para que el frontend muestre citas clickeables.
- Mide latencia y la incluye en la respuesta (útil para evaluación).
- Registra cada interacción en `chat_messages` + `retrieval_logs` para
  observabilidad y futuras métricas (precision@k, MRR, etc.).
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

from fastapi import APIRouter, HTTPException

from core.dependencies import get_supabase_client
from models.chat import ChatRequest, ChatResponse, Source
from models.chunk import Chunk
from services.generation.llm import LLMService
from services.retrieval.hybrid import HybridRetriever
from utils.logger import logger

router = APIRouter()
retriever = HybridRetriever()
llm_service = LLMService()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()
    try:
        chunks = await retriever.retrieve(
            request.query,
            top_k=request.top_k,
            filter_doc_ids=request.filter_doc_ids,
        )
        if not chunks:
            return ChatResponse(
                answer=(
                    "No encontré información relacionada en los documentos institucionales. "
                    "Te sugiero consultar directamente con Secretaría Académica."
                ),
                sources=[],
                latency_ms=int((time.perf_counter() - t0) * 1000),
            )

        answer = await llm_service.generate(query=request.query, context_chunks=chunks)
        latency_ms = int((time.perf_counter() - t0) * 1000)

        sources = [_to_source(c) for c in chunks]

        message_id = await asyncio.to_thread(
            _log_interaction,
            request=request,
            chunks=chunks,
            answer=answer,
            latency_ms=latency_ms,
        )

        return ChatResponse(
            answer=answer,
            sources=sources,
            latency_ms=latency_ms,
            message_id=message_id,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error en chat: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor.")


def _to_source(c: Chunk) -> Source:
    md = c.metadata or {}
    return Source(
        doc_id=c.doc_id or md.get("doc_id", ""),
        chunk_id=c.id or "",
        filename=md.get("filename", "Documento institucional"),
        page_number=c.page_number,
        heading_path=c.heading_path,
        snippet=(c.content[:240] + "…") if len(c.content) > 240 else c.content,
        score=c.score or 0.0,
    )


def _log_interaction(
    *,
    request: ChatRequest,
    chunks: list[Chunk],
    answer: str,
    latency_ms: int,
) -> Optional[str]:
    """Persiste turno conversacional + chunks recuperados en background.

    No bloquea la respuesta al usuario si la BD falla; solo loggea.
    """
    client = get_supabase_client()
    try:
        session_id = _ensure_session(client, request.session_token)
        # Mensaje del usuario
        client.table("chat_messages").insert(
            {
                "session_id": session_id,
                "role": "user",
                "content": request.query,
            }
        ).execute()
        # Respuesta del asistente
        asst = (
            client.table("chat_messages")
            .insert(
                {
                    "session_id": session_id,
                    "role": "assistant",
                    "content": answer,
                    "retrieved_chunk_ids": [c.id for c in chunks if c.id],
                    "latency_ms": latency_ms,
                }
            )
            .execute()
        )
        message_id = asst.data[0]["id"] if asst.data else None
        # Logs de retrieval
        if message_id and chunks:
            client.table("retrieval_logs").insert(
                [
                    {
                        "message_id": message_id,
                        "chunk_id": c.id,
                        "retrieval_method": "hybrid",
                        "score": c.score,
                        "rank": rank,
                    }
                    for rank, c in enumerate(chunks, 1)
                    if c.id
                ]
            ).execute()
        return message_id
    except Exception as e:
        logger.warning(f"[chat] No se pudo persistir interacción: {e!r}")
        return None


def _ensure_session(client, session_token: Optional[str]) -> str:
    """Devuelve session_id de una sesión existente o crea una nueva anónima."""
    if session_token:
        found = (
            client.table("chat_sessions")
            .select("id")
            .eq("session_token", session_token)
            .limit(1)
            .execute()
        )
        if found.data:
            return found.data[0]["id"]
    created = (
        client.table("chat_sessions")
        .insert({"session_token": session_token})
        .execute()
    )
    return created.data[0]["id"]
