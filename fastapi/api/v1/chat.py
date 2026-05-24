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
import re
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import get_supabase_client
from core.security import verify_admin_token
from models.chat import ChatRequest, ChatResponse, DislikedMessage, FeedbackRequest, FeedbackStats, Source
from models.chunk import Chunk
from services.generation.llm import LLMService
from services.retrieval.hybrid import HybridRetriever
from utils.logger import logger

router = APIRouter()
retriever = HybridRetriever()
llm_service = LLMService()

_CONVERSATIONAL_RE = re.compile(
    r"^\s*(?:hola|buenos\s+(?:días|tardes|noches)|hi|hello|buenas|hey|saludos|"
    r"gracias|de\s+nada|perfecto|entendido|claro|ok|okay|bien|muy\s+bien|"
    r"genial|excelente|hasta\s+luego|adiós|adios|chao|bye)\s*[!?.,]*\s*$",
    re.IGNORECASE | re.UNICODE,
)

_CONVERSATIONAL_REPLY = (
    "¡Hola! ¿En qué puedo ayudarte hoy relacionado con la Universidad Tecnológica Indoamérica? "
    "Puedo responder preguntas sobre reglamentos, becas, prácticas pre-profesionales, "
    "calendario académico y más temas institucionales."
)


def _is_conversational(query: str) -> bool:
    return bool(_CONVERSATIONAL_RE.match(query.strip()))


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    t0 = time.perf_counter()
    try:
        if _is_conversational(request.query):
            return ChatResponse(
                answer=_CONVERSATIONAL_REPLY,
                sources=[],
                latency_ms=int((time.perf_counter() - t0) * 1000),
            )

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


# ── Feedback endpoints ────────────────────────────────────────────────────────

@router.patch("/{message_id}/feedback")
async def submit_feedback(message_id: str, body: FeedbackRequest) -> dict:
    """Guarda la valoración del usuario (like/dislike) en chat_messages."""
    client = get_supabase_client()
    try:
        client.table("chat_messages").update({"rating": body.rating}).eq("id", message_id).execute()
        return {"ok": True}
    except Exception as e:
        logger.warning(f"[feedback] No se pudo guardar rating para {message_id}: {e!r}")
        raise HTTPException(status_code=500, detail="Error al guardar valoración.")


@router.get("/admin/feedback", response_model=FeedbackStats)
async def get_feedback_stats(_admin=Depends(verify_admin_token)) -> FeedbackStats:
    """Devuelve contadores de likes/dislikes y lista de mensajes con dislike (admin)."""
    client = get_supabase_client()
    try:
        liked = client.table("chat_messages").select("id", count="exact").eq("rating", 1).execute()
        disliked_res = (
            client.table("chat_messages")
            .select("id, content, created_at, session_id")
            .eq("rating", -1)
            .eq("role", "assistant")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        disliked_messages: list[DislikedMessage] = []
        for row in disliked_res.data or []:
            prev = (
                client.table("chat_messages")
                .select("content")
                .eq("session_id", row["session_id"])
                .eq("role", "user")
                .lt("created_at", row["created_at"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            user_query = prev.data[0]["content"] if prev.data else None
            disliked_messages.append(
                DislikedMessage(
                    message_id=row["id"],
                    answer=row["content"],
                    user_query=user_query,
                    created_at=row.get("created_at"),
                )
            )
        return FeedbackStats(
            likes=liked.count or 0,
            dislikes=len(disliked_messages),
            disliked_messages=disliked_messages,
        )
    except Exception as e:
        logger.exception(f"[feedback] Error obteniendo stats: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener estadísticas.")
