"""Estadísticas agregadas para el panel Overview del dashboard admin."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.dependencies import get_supabase_client
from core.security import verify_admin_token
from utils.logger import logger

router = APIRouter()

_DAY_LABELS = {0: "Lun", 1: "Mar", 2: "Mié", 3: "Jue", 4: "Vie", 5: "Sáb", 6: "Dom"}


class DayActivity(BaseModel):
    date: str
    day_label: str
    queries: int
    ingestas: int


class RecentDoc(BaseModel):
    id: str
    filename: str
    status: str
    uploaded_at: Optional[str] = None


class OverviewStats(BaseModel):
    documents_total: int
    documents_ready: int
    documents_processing: int
    documents_error: int
    chunks_total: int
    sessions_today: int
    queries_today: int
    avg_latency_ms: Optional[float] = None
    activity_7d: List[DayActivity]
    recent_documents: List[RecentDoc]


@router.get("", response_model=OverviewStats)
async def get_overview_stats(_admin=Depends(verify_admin_token)) -> OverviewStats:
    return await asyncio.to_thread(_fetch_stats)


def _fetch_stats() -> OverviewStats:
    client = get_supabase_client()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today.isoformat()
    week_start_iso = (today - timedelta(days=6)).isoformat()

    # ── Documents (una sola query, todo en memoria)
    docs_res = (
        client.table("documents")
        .select("id,status,chunk_count,created_at,filename")
        .order("created_at", desc=True)
        .execute()
    )
    docs_data = docs_res.data or []
    documents_total = len(docs_data)
    documents_ready = sum(1 for d in docs_data if d.get("status") == "ready")
    documents_processing = sum(1 for d in docs_data if d.get("status") == "processing")
    documents_error = sum(1 for d in docs_data if d.get("status") == "error")
    chunks_total = sum(d.get("chunk_count") or 0 for d in docs_data)

    # ── Sesiones de hoy
    sessions_res = (
        client.table("chat_sessions")
        .select("id", count="exact")
        .gte("created_at", today_iso)
        .execute()
    )
    sessions_today = sessions_res.count or 0

    # ── Mensajes de hoy (queries + latencias de respuestas)
    messages_today_res = (
        client.table("chat_messages")
        .select("role,latency_ms")
        .gte("created_at", today_iso)
        .execute()
    )
    messages_today = messages_today_res.data or []
    queries_today = sum(1 for m in messages_today if m.get("role") == "user")
    latencies = [
        m["latency_ms"]
        for m in messages_today
        if m.get("role") == "assistant" and m.get("latency_ms")
    ]
    avg_latency_ms = sum(latencies) / len(latencies) if latencies else None

    # ── Actividad 7 días (2 queries en lugar de 14)
    messages_7d_res = (
        client.table("chat_messages")
        .select("role,created_at")
        .eq("role", "user")
        .gte("created_at", week_start_iso)
        .execute()
    )
    ingestas_7d_res = (
        client.table("ingestion_jobs")
        .select("created_at")
        .gte("created_at", week_start_iso)
        .execute()
    )

    queries_by_day: dict[str, int] = defaultdict(int)
    for msg in (messages_7d_res.data or []):
        day = (msg.get("created_at") or "")[:10]
        if day:
            queries_by_day[day] += 1

    ingestas_by_day: dict[str, int] = defaultdict(int)
    for job in (ingestas_7d_res.data or []):
        day = (job.get("created_at") or "")[:10]
        if day:
            ingestas_by_day[day] += 1

    activity_7d: list[DayActivity] = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        activity_7d.append(
            DayActivity(
                date=date_str,
                day_label=_DAY_LABELS[d.weekday()],
                queries=queries_by_day[date_str],
                ingestas=ingestas_by_day[date_str],
            )
        )

    # ── Últimos 5 documentos
    recent_documents = [
        RecentDoc(
            id=r["id"],
            filename=r["filename"],
            status=r.get("status", "unknown"),
            uploaded_at=r.get("created_at"),
        )
        for r in docs_data[:5]
    ]

    return OverviewStats(
        documents_total=documents_total,
        documents_ready=documents_ready,
        documents_processing=documents_processing,
        documents_error=documents_error,
        chunks_total=chunks_total,
        sessions_today=sessions_today,
        queries_today=queries_today,
        avg_latency_ms=avg_latency_ms,
        activity_7d=activity_7d,
        recent_documents=recent_documents,
    )
