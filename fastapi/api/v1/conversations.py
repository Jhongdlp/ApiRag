"""Endpoints admin para inspeccionar conversaciones del chat."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.dependencies import get_supabase_client
from core.security import verify_admin_token
from utils.logger import logger

router = APIRouter()


# ── Modelos ──────────────────────────────────────────────────────────────────

class ConversationSummary(BaseModel):
    id: str
    session_token: Optional[str] = None
    last_query: Optional[str] = None
    message_count: int = 0
    created_at: Optional[str] = None
    last_active_at: Optional[str] = None
    has_dislike: bool = False


class MessageSource(BaseModel):
    chunk_id: str
    doc_id: str
    filename: str
    page_number: Optional[int] = None
    heading_path: Optional[str] = None
    score: Optional[float] = None
    rank: Optional[int] = None


class ConversationMessage(BaseModel):
    id: str
    role: str
    content: str
    created_at: Optional[str] = None
    latency_ms: Optional[int] = None
    rating: Optional[int] = None
    sources: List[MessageSource] = []


class ConversationDetail(BaseModel):
    id: str
    session_token: Optional[str] = None
    message_count: int = 0
    created_at: Optional[str] = None
    last_active_at: Optional[str] = None
    messages: List[ConversationMessage] = []


# ── Listado ──────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ConversationSummary])
async def list_conversations(
    limit: int = Query(50, ge=1, le=200),
    _admin=Depends(verify_admin_token),
) -> List[ConversationSummary]:
    return await asyncio.to_thread(_fetch_conversations, limit)


def _fetch_conversations(limit: int) -> List[ConversationSummary]:
    client = get_supabase_client()
    try:
        sessions_res = (
            client.table("chat_sessions")
            .select("id,session_token,message_count,created_at,last_active_at")
            .order("last_active_at", desc=True)
            .limit(limit)
            .execute()
        )
        sessions = sessions_res.data or []
        if not sessions:
            return []

        session_ids = [s["id"] for s in sessions]

        # Última pregunta del usuario por sesión: traemos los últimos N mensajes y
        # los agrupamos en memoria. Limitamos a un múltiplo razonable.
        msgs_res = (
            client.table("chat_messages")
            .select("session_id,role,content,created_at,rating")
            .in_("session_id", session_ids)
            .order("created_at", desc=True)
            .limit(limit * 30)
            .execute()
        )
        last_query_by_session: dict[str, str] = {}
        has_dislike: dict[str, bool] = defaultdict(bool)
        for m in msgs_res.data or []:
            sid = m["session_id"]
            if m.get("role") == "user" and sid not in last_query_by_session:
                last_query_by_session[sid] = m.get("content") or ""
            if m.get("rating") == -1:
                has_dislike[sid] = True

        return [
            ConversationSummary(
                id=s["id"],
                session_token=s.get("session_token"),
                last_query=last_query_by_session.get(s["id"]),
                message_count=s.get("message_count") or 0,
                created_at=s.get("created_at"),
                last_active_at=s.get("last_active_at"),
                has_dislike=has_dislike.get(s["id"], False),
            )
            for s in sessions
        ]
    except Exception as e:
        logger.exception(f"[conversations] list falló: {e}")
        raise HTTPException(status_code=500, detail="Error al listar conversaciones.")


# ── Detalle ──────────────────────────────────────────────────────────────────

@router.get("/{session_id}", response_model=ConversationDetail)
async def get_conversation(
    session_id: str,
    _admin=Depends(verify_admin_token),
) -> ConversationDetail:
    return await asyncio.to_thread(_fetch_conversation, session_id)


def _fetch_conversation(session_id: str) -> ConversationDetail:
    client = get_supabase_client()
    try:
        session_res = (
            client.table("chat_sessions")
            .select("id,session_token,message_count,created_at,last_active_at")
            .eq("id", session_id)
            .limit(1)
            .execute()
        )
        if not session_res.data:
            raise HTTPException(status_code=404, detail="Sesión no encontrada.")
        session = session_res.data[0]

        msgs_res = (
            client.table("chat_messages")
            .select("id,role,content,created_at,latency_ms,rating,retrieved_chunk_ids")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .execute()
        )
        messages = msgs_res.data or []

        # Reconstruir sources: id → (score, rank) desde retrieval_logs,
        #                     chunk_id → (doc_id, page_number, heading_path) desde document_chunks
        assistant_ids = [m["id"] for m in messages if m.get("role") == "assistant"]
        score_by_message_chunk: dict[tuple[str, str], tuple[float, int]] = {}
        if assistant_ids:
            logs_res = (
                client.table("retrieval_logs")
                .select("message_id,chunk_id,score,rank")
                .in_("message_id", assistant_ids)
                .execute()
            )
            for row in logs_res.data or []:
                key = (row["message_id"], row["chunk_id"])
                score_by_message_chunk[key] = (
                    row.get("score") or 0.0,
                    row.get("rank") or 0,
                )

        # Unión de chunk_ids a buscar
        all_chunk_ids: set[str] = set()
        for m in messages:
            for cid in m.get("retrieved_chunk_ids") or []:
                if cid:
                    all_chunk_ids.add(cid)
        for (_mid, cid) in score_by_message_chunk.keys():
            all_chunk_ids.add(cid)

        chunk_info: dict[str, dict] = {}
        if all_chunk_ids:
            chunk_ids_list = list(all_chunk_ids)
            for i in range(0, len(chunk_ids_list), 500):
                batch = chunk_ids_list[i:i + 500]
                ch_res = (
                    client.table("document_chunks")
                    .select("id,doc_id,page_number,heading_path")
                    .in_("id", batch)
                    .execute()
                )
                for row in ch_res.data or []:
                    chunk_info[row["id"]] = row

        # Documentos para resolver filename
        doc_ids = {info.get("doc_id") for info in chunk_info.values() if info.get("doc_id")}
        doc_names: dict[str, str] = {}
        if doc_ids:
            docs_res = (
                client.table("documents")
                .select("id,filename")
                .in_("id", list(doc_ids))
                .execute()
            )
            doc_names = {d["id"]: d.get("filename") or "—" for d in docs_res.data or []}

        out_messages: list[ConversationMessage] = []
        for m in messages:
            sources: list[MessageSource] = []
            if m.get("role") == "assistant":
                # Combina los chunk_ids declarados en retrieved_chunk_ids y los
                # provenientes de retrieval_logs (que también traen score y rank).
                seen: set[str] = set()
                ordered_chunks: list[tuple[str, Optional[float], Optional[int]]] = []
                for cid in (m.get("retrieved_chunk_ids") or []):
                    if cid in seen:
                        continue
                    seen.add(cid)
                    sc_rk = score_by_message_chunk.get((m["id"], cid))
                    ordered_chunks.append(
                        (cid, sc_rk[0] if sc_rk else None, sc_rk[1] if sc_rk else None)
                    )
                # Añadir cualquier chunk presente sólo en logs
                for (mid, cid), (sc, rk) in score_by_message_chunk.items():
                    if mid == m["id"] and cid not in seen:
                        seen.add(cid)
                        ordered_chunks.append((cid, sc, rk))

                for cid, score, rank in ordered_chunks:
                    info = chunk_info.get(cid)
                    if not info:
                        continue
                    doc_id = info.get("doc_id") or ""
                    sources.append(
                        MessageSource(
                            chunk_id=cid,
                            doc_id=doc_id,
                            filename=doc_names.get(doc_id, "—"),
                            page_number=info.get("page_number"),
                            heading_path=info.get("heading_path"),
                            score=score,
                            rank=rank,
                        )
                    )
                sources.sort(key=lambda s: (s.rank if s.rank is not None else 1_000))

            out_messages.append(
                ConversationMessage(
                    id=m["id"],
                    role=m.get("role") or "user",
                    content=m.get("content") or "",
                    created_at=m.get("created_at"),
                    latency_ms=m.get("latency_ms"),
                    rating=m.get("rating"),
                    sources=sources,
                )
            )

        return ConversationDetail(
            id=session["id"],
            session_token=session.get("session_token"),
            message_count=session.get("message_count") or len(out_messages),
            created_at=session.get("created_at"),
            last_active_at=session.get("last_active_at"),
            messages=out_messages,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"[conversations] detalle falló: {e}")
        raise HTTPException(status_code=500, detail="Error al cargar conversación.")
