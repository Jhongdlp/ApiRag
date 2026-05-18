"""Endpoint de health check liviano para el dashboard del frontend."""
from __future__ import annotations

import asyncio
import httpx

from fastapi import APIRouter
from pydantic import BaseModel

from core.config import settings
from core.dependencies import get_supabase_client
from utils.logger import logger

router = APIRouter()


class ServiceHealth(BaseModel):
    status: str  # "running" | "error"
    detail: str = ""


class HealthResponse(BaseModel):
    fastapi: ServiceHealth
    supabase: ServiceHealth
    ollama: ServiceHealth
    embeddings: ServiceHealth


async def _check_supabase() -> ServiceHealth:
    try:
        client = get_supabase_client()
        # Consulta mínima: cuenta de documentos (no falla si la tabla está vacía)
        client.table("documents").select("id", count="exact").limit(1).execute()
        return ServiceHealth(status="running")
    except Exception as exc:
        logger.warning(f"[health] Supabase error: {exc}")
        return ServiceHealth(status="error", detail=str(exc)[:120])


async def _check_ollama() -> ServiceHealth:
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                return ServiceHealth(status="running")
            return ServiceHealth(status="error", detail=f"HTTP {resp.status_code}")
    except Exception as exc:
        logger.warning(f"[health] Ollama error: {exc}")
        return ServiceHealth(status="error", detail=str(exc)[:120])


async def _check_embeddings() -> ServiceHealth:
    try:
        from services.ingestion.embedder import EmbeddingService
        # El singleton ya está cargado si el worker arrancó correctamente.
        # Solo verificamos que la clase exista y el modelo esté instanciado.
        if EmbeddingService._model is not None:
            return ServiceHealth(status="running")
        # Intentamos inicializarlo (costoso la primera vez, pero solo ocurre una vez)
        EmbeddingService()
        return ServiceHealth(status="running")
    except Exception as exc:
        logger.warning(f"[health] Embeddings error: {exc}")
        return ServiceHealth(status="error", detail=str(exc)[:120])


@router.get("", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    supabase, ollama, embeddings = await asyncio.gather(
        _check_supabase(),
        _check_ollama(),
        _check_embeddings(),
        return_exceptions=False,
    )
    return HealthResponse(
        fastapi=ServiceHealth(status="running"),
        supabase=supabase,
        ollama=ollama,
        embeddings=embeddings,
    )
