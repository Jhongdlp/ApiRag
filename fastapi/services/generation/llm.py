"""Cliente Ollama para generación de respuestas RAG."""
from __future__ import annotations

from typing import List

import ollama

from core.config import settings
from models.chunk import Chunk
from services.generation.prompt import build_prompt
from utils.logger import logger


class LLMService:
    def __init__(self) -> None:
        self._client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        self._model = settings.OLLAMA_MODEL

    async def generate(self, query: str, context_chunks: List[Chunk]) -> str:
        prompt = build_prompt(query, context_chunks)
        logger.info(f"[llm] {self._model} ({len(context_chunks)} chunks de contexto)")
        response = await self._client.generate(
            model=self._model,
            prompt=prompt,
            options={
                "temperature": settings.LLM_TEMPERATURE,
                "num_predict": settings.LLM_NUM_PREDICT,
            },
        )
        return response["response"].strip()
