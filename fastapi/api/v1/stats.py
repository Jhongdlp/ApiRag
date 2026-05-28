"""Estadísticas agregadas para el dashboard admin (Overview, Analytics, Bitácora)."""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from core.dependencies import get_supabase_client
from core.security import verify_admin_token
from utils.logger import logger

router = APIRouter()

_DAY_LABELS = {0: "Lun", 1: "Mar", 2: "Mié", 3: "Jue", 4: "Vie", 5: "Sáb", 6: "Dom"}

_RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}

_CATEGORY_PALETTE = [
    "#3B82F6", "#F5A623", "#10B981", "#8B5CF6", "#EC4899",
    "#22D3EE", "#F97316", "#EAB308", "#A3E635", "#F43F5E",
]


# ── Modelos ──────────────────────────────────────────────────────────────────

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


class TopDoc(BaseModel):
    doc_id: str
    filename: str
    hits: int


class CategorySlice(BaseModel):
    name: str
    value: int
    color: str


class SeriesPoint(BaseModel):
    day: int
    date: str
    queries: int
    ingestas: int


class AnalyticsStats(BaseModel):
    range: str
    total_queries: int
    queries_delta_pct: Optional[float] = None
    avg_latency_ms: Optional[float] = None
    latency_delta_pct: Optional[float] = None
    ingest_success_rate: Optional[float] = None
    ingest_breakdown: dict
    series: List[SeriesPoint]
    top_documents: List[TopDoc]
    category_distribution: List[CategorySlice]


class LogEntry(BaseModel):
    ts: str
    level: str  # "info" | "warn" | "error"
    text: str


class LogList(BaseModel):
    entries: List[LogEntry]


# ── Overview (legacy: usado por la pantalla de inicio) ───────────────────────

@router.get("", response_model=OverviewStats)
async def get_overview_stats(_admin=Depends(verify_admin_token)) -> OverviewStats:
    return await asyncio.to_thread(_fetch_stats)


def _fetch_stats() -> OverviewStats:
    client = get_supabase_client()
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_iso = today.isoformat()
    week_start_iso = (today - timedelta(days=6)).isoformat()

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

    sessions_res = (
        client.table("chat_sessions")
        .select("id", count="exact")
        .gte("created_at", today_iso)
        .execute()
    )
    sessions_today = sessions_res.count or 0

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


# ── Analytics (nuevo) ────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsStats)
async def get_analytics(
    range_: str = Query("30d", alias="range", description="7d, 30d o 90d"),
    _admin=Depends(verify_admin_token),
) -> AnalyticsStats:
    days = _RANGE_DAYS.get(range_, 30)
    return await asyncio.to_thread(_fetch_analytics, days, range_)


def _fetch_analytics(days: int, range_label: str) -> AnalyticsStats:
    client = get_supabase_client()
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = today - timedelta(days=days - 1)
    prev_start = start - timedelta(days=days)

    # ── Queries totales del rango actual + latencias
    msgs_curr = (
        client.table("chat_messages")
        .select("role,latency_ms,created_at")
        .gte("created_at", start.isoformat())
        .execute()
    )
    msgs_curr_data = msgs_curr.data or []
    total_queries = sum(1 for m in msgs_curr_data if m.get("role") == "user")
    latencies_curr = [
        m["latency_ms"]
        for m in msgs_curr_data
        if m.get("role") == "assistant" and m.get("latency_ms")
    ]
    avg_latency_curr = sum(latencies_curr) / len(latencies_curr) if latencies_curr else None

    # ── Periodo anterior (para deltas)
    msgs_prev = (
        client.table("chat_messages")
        .select("role,latency_ms,created_at")
        .gte("created_at", prev_start.isoformat())
        .lt("created_at", start.isoformat())
        .execute()
    )
    msgs_prev_data = msgs_prev.data or []
    total_queries_prev = sum(1 for m in msgs_prev_data if m.get("role") == "user")
    latencies_prev = [
        m["latency_ms"]
        for m in msgs_prev_data
        if m.get("role") == "assistant" and m.get("latency_ms")
    ]
    avg_latency_prev = sum(latencies_prev) / len(latencies_prev) if latencies_prev else None

    queries_delta_pct = _delta_pct(total_queries, total_queries_prev)
    latency_delta_pct = _delta_pct(avg_latency_curr, avg_latency_prev)

    # ── Ingestas: serie diaria + success rate
    ingestas_curr = (
        client.table("ingestion_jobs")
        .select("status,created_at,finished_at")
        .gte("created_at", start.isoformat())
        .execute()
    )
    ingestas_data = ingestas_curr.data or []
    done = sum(1 for j in ingestas_data if j.get("status") == "done")
    failed = sum(1 for j in ingestas_data if j.get("status") == "failed")
    in_progress = sum(
        1 for j in ingestas_data
        if j.get("status") not in ("done", "failed")
    )
    finished = done + failed
    ingest_success_rate = (done / finished * 100.0) if finished else None
    ingest_breakdown = {
        "done": done,
        "failed": failed,
        "in_progress": in_progress,
    }

    # ── Serie diaria
    queries_by_day: dict[str, int] = defaultdict(int)
    for m in msgs_curr_data:
        if m.get("role") != "user":
            continue
        day = (m.get("created_at") or "")[:10]
        if day:
            queries_by_day[day] += 1

    ingestas_by_day: dict[str, int] = defaultdict(int)
    for j in ingestas_data:
        day = (j.get("created_at") or "")[:10]
        if day:
            ingestas_by_day[day] += 1

    series: list[SeriesPoint] = []
    for i in range(days):
        d = start + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        series.append(
            SeriesPoint(
                day=i + 1,
                date=date_str,
                queries=queries_by_day.get(date_str, 0),
                ingestas=ingestas_by_day.get(date_str, 0),
            )
        )

    # ── Top documentos (vía retrieval_logs → document_chunks → documents)
    top_documents = _top_documents(client, start.isoformat(), limit=6)

    # ── Distribución por categoría
    category_distribution = _category_distribution(client)

    return AnalyticsStats(
        range=range_label,
        total_queries=total_queries,
        queries_delta_pct=queries_delta_pct,
        avg_latency_ms=avg_latency_curr,
        latency_delta_pct=latency_delta_pct,
        ingest_success_rate=ingest_success_rate,
        ingest_breakdown=ingest_breakdown,
        series=series,
        top_documents=top_documents,
        category_distribution=category_distribution,
    )


def _top_documents(client, since_iso: str, limit: int = 6) -> list[TopDoc]:
    """Cuenta cuántas veces fue recuperado cada documento desde `since_iso`."""
    try:
        logs_res = (
            client.table("retrieval_logs")
            .select("chunk_id")
            .gte("created_at", since_iso)
            .limit(50000)
            .execute()
        )
        chunk_ids = [r["chunk_id"] for r in (logs_res.data or []) if r.get("chunk_id")]
        if not chunk_ids:
            return []

        chunks_by_doc: dict[str, int] = defaultdict(int)
        # Supabase IN clauses cap a few miles; troceamos por seguridad
        unique_chunks = list(set(chunk_ids))
        chunk_to_doc: dict[str, str] = {}
        for i in range(0, len(unique_chunks), 500):
            batch = unique_chunks[i:i + 500]
            res = (
                client.table("document_chunks")
                .select("id,doc_id")
                .in_("id", batch)
                .execute()
            )
            for row in res.data or []:
                if row.get("doc_id"):
                    chunk_to_doc[row["id"]] = row["doc_id"]

        for cid in chunk_ids:
            doc_id = chunk_to_doc.get(cid)
            if doc_id:
                chunks_by_doc[doc_id] += 1

        if not chunks_by_doc:
            return []

        top_ids = sorted(chunks_by_doc.items(), key=lambda kv: kv[1], reverse=True)[:limit]
        doc_ids = [d for d, _ in top_ids]
        docs_res = (
            client.table("documents")
            .select("id,filename")
            .in_("id", doc_ids)
            .execute()
        )
        name_by_id = {r["id"]: r.get("filename") or "—" for r in docs_res.data or []}
        return [
            TopDoc(doc_id=d, filename=name_by_id.get(d, "—"), hits=h)
            for d, h in top_ids
            if d in name_by_id
        ]
    except Exception as e:
        logger.warning(f"[analytics] top_documents falló: {e!r}")
        return []


def _category_distribution(client) -> list[CategorySlice]:
    try:
        docs_res = (
            client.table("documents")
            .select("category,status")
            .neq("status", "archived")
            .execute()
        )
        buckets: dict[str, int] = defaultdict(int)
        for d in docs_res.data or []:
            cat = (d.get("category") or "Sin categoría").strip() or "Sin categoría"
            buckets[cat] += 1
        if not buckets:
            return []
        items = sorted(buckets.items(), key=lambda kv: kv[1], reverse=True)
        return [
            CategorySlice(
                name=name,
                value=value,
                color=_CATEGORY_PALETTE[i % len(_CATEGORY_PALETTE)],
            )
            for i, (name, value) in enumerate(items)
        ]
    except Exception as e:
        logger.warning(f"[analytics] category_distribution falló: {e!r}")
        return []


def _delta_pct(curr: Optional[float], prev: Optional[float]) -> Optional[float]:
    if curr is None or prev is None or prev == 0:
        return None
    return round(((curr - prev) / prev) * 100.0, 1)


# ── Bitácora del sistema ─────────────────────────────────────────────────────

@router.get("/logs", response_model=LogList)
async def get_system_logs(
    limit: int = Query(20, ge=1, le=100),
    _admin=Depends(verify_admin_token),
) -> LogList:
    return await asyncio.to_thread(_fetch_logs, limit)


def _fetch_logs(limit: int) -> LogList:
    client = get_supabase_client()
    entries: list[tuple[str, str, str]] = []  # (ts_iso, level, text)

    # ── Eventos de ingesta (último doble del limit para muestrear)
    try:
        jobs_res = (
            client.table("ingestion_jobs")
            .select("status,error_message,created_at,finished_at,doc_id,chunk_count")
            .order("created_at", desc=True)
            .limit(limit * 2)
            .execute()
        )
        jobs = jobs_res.data or []
        doc_ids = list({j["doc_id"] for j in jobs if j.get("doc_id")})
        names: dict[str, str] = {}
        if doc_ids:
            docs_res = (
                client.table("documents")
                .select("id,filename")
                .in_("id", doc_ids)
                .execute()
            )
            names = {d["id"]: d.get("filename") or "—" for d in docs_res.data or []}

        for j in jobs:
            status = j.get("status") or "unknown"
            ts = j.get("finished_at") or j.get("created_at") or ""
            fname = names.get(j.get("doc_id") or "", "documento")
            if status == "done":
                chunks = j.get("chunk_count") or 0
                entries.append((ts, "info", f'Ingesta completada · "{fname}" → {chunks} chunks'))
            elif status == "failed":
                msg = (j.get("error_message") or "fallo desconocido").strip()
                if len(msg) > 140:
                    msg = msg[:140] + "…"
                entries.append((ts, "error", f'Ingesta fallida · "{fname}" · {msg}'))
            else:
                entries.append((ts, "info", f'Ingesta {status} · "{fname}"'))
    except Exception as e:
        logger.warning(f"[logs] ingestion_jobs falló: {e!r}")

    # ── Documentos con error (snapshot del estado)
    try:
        err_docs_res = (
            client.table("documents")
            .select("filename,status,updated_at")
            .eq("status", "error")
            .order("updated_at", desc=True)
            .limit(5)
            .execute()
        )
        for d in err_docs_res.data or []:
            entries.append((
                d.get("updated_at") or "",
                "warn",
                f'Documento en estado error · "{d.get("filename") or "—"}"',
            ))
    except Exception as e:
        logger.warning(f"[logs] documents.error falló: {e!r}")

    # ── Mensajes con dislike (señal de calidad)
    try:
        disliked_res = (
            client.table("chat_messages")
            .select("created_at,content")
            .eq("rating", -1)
            .eq("role", "assistant")
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )
        for m in disliked_res.data or []:
            preview = (m.get("content") or "").strip().replace("\n", " ")
            if len(preview) > 80:
                preview = preview[:80] + "…"
            entries.append((
                m.get("created_at") or "",
                "warn",
                f"Respuesta valorada negativamente · «{preview}»",
            ))
    except Exception as e:
        logger.warning(f"[logs] disliked falló: {e!r}")

    # Ordenar por timestamp descendente y recortar
    entries.sort(key=lambda x: x[0] or "", reverse=True)
    entries = entries[:limit]

    return LogList(
        entries=[LogEntry(ts=ts, level=lvl, text=txt) for ts, lvl, txt in entries]
    )
