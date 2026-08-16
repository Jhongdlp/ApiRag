"""Cliente Ollama para generación de respuestas RAG."""
from __future__ import annotations

from typing import List

import ollama

from core.config import settings
from models.chunk import Chunk
from services.generation.prompt import build_prompt
from utils.logger import logger


def _parse_keep_alive(raw: str) -> int | str:
    """Ollama acepta el keep_alive como número de segundos (-1 = indefinido) o
    como duración con unidad ("24h"). Un "-1" enviado como string se interpreta
    como duración y la API responde 400, así que los enteros van como enteros."""
    try:
        return int(raw)
    except ValueError:
        return raw


class LLMService:
    def __init__(self) -> None:
        self._client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        self._model = settings.OLLAMA_MODEL
        self._keep_alive = _parse_keep_alive(settings.OLLAMA_KEEP_ALIVE)

    async def generate(self, query: str, context_chunks: List[Chunk]) -> str:
        prompt = build_prompt(query, context_chunks)
        logger.info(f"[llm] {self._model} ({len(context_chunks)} chunks de contexto)")
        response = await self._client.generate(
            model=self._model,
            prompt=prompt,
            keep_alive=self._keep_alive,
            options={
                "temperature": settings.LLM_TEMPERATURE,
                "num_predict": settings.LLM_NUM_PREDICT,
            },
        )
        return response.response.strip()

    async def warmup(self) -> None:
        """Precarga el modelo en VRAM para que la primera consulta real no
        pague la carga desde disco (~9 GB). Un prompt vacío basta: Ollama
        carga el modelo y devuelve de inmediato."""
        try:
            await self._client.generate(
                model=self._model,
                prompt="",
                keep_alive=self._keep_alive,
            )
            logger.info(f"[llm] modelo {self._model} precargado en memoria")
        except Exception as exc:
            # El warmup es best-effort: si Ollama aún no está listo, la
            # primera consulta lo cargará igualmente.
            logger.warning(f"[llm] warmup de {self._model} falló: {exc}")
