import ollama
from core.config import settings
from services.generation.prompt import build_prompt
from models.chunk import Chunk
from utils.logger import logger
from typing import List


class LLMService:
    """Cliente para generación de respuestas con Llama vía Ollama."""

    def __init__(self):
        self._client = ollama.AsyncClient(host=settings.OLLAMA_BASE_URL)
        self._model = settings.OLLAMA_MODEL

    async def generate(self, query: str, context_chunks: List[Chunk]) -> str:
        prompt = build_prompt(query, context_chunks)
        logger.info(f"Generando respuesta con {self._model}...")
        response = await self._client.generate(
            model=self._model,
            prompt=prompt,
            options={"temperature": 0.1, "num_predict": 512},
        )
        return response["response"].strip()
