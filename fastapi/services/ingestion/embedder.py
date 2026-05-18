"""Generación de embeddings con `sentence-transformers`.

Mejoras vs implementación previa:
- **Singleton**: el modelo (~1 GB para bge-m3) se carga UNA vez por proceso,
  no en cada tarea Celery.
- **GPU automática**: usa CUDA si está disponible (V100 reservada en compose);
  cae a CPU sin fallar.
- **Normalización**: `normalize_embeddings=True` produce vectores unitarios →
  cosine == dot product, métrica esperada por pgvector con `vector_cosine_ops`.
- **Validación de dimensión**: aborta antes de tocar la BD si el modelo
  devuelve dim ≠ `EMBEDDING_DIM` (defensa contra cambios accidentales de modelo).
"""
from __future__ import annotations

from typing import List

from sentence_transformers import SentenceTransformer

from core.config import settings
from models.chunk import Chunk
from utils.logger import logger


def _resolve_device() -> str:
    if settings.EMBEDDING_DEVICE != "auto":
        return settings.EMBEDDING_DEVICE
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


class EmbeddingService:
    """Cliente singleton para embeddings densos."""

    _model: SentenceTransformer | None = None
    _device: str | None = None

    def __init__(self) -> None:
        if EmbeddingService._model is None:
            device = _resolve_device()
            logger.info(
                f"[embedder] Cargando {settings.EMBEDDING_MODEL} en {device}..."
            )
            EmbeddingService._model = SentenceTransformer(
                settings.EMBEDDING_MODEL, device=device
            )
            EmbeddingService._device = device
            dim = EmbeddingService._model.get_sentence_embedding_dimension()
            if dim != settings.EMBEDDING_DIM:
                raise RuntimeError(
                    f"Modelo {settings.EMBEDDING_MODEL} devuelve {dim} dims, "
                    f"pero settings.EMBEDDING_DIM={settings.EMBEDDING_DIM}. "
                    "Ajusta el schema (vector(N)) o la configuración."
                )
            logger.info(f"[embedder] Listo. dim={dim} device={device}")
        self._model = EmbeddingService._model

    @property
    def device(self) -> str:
        return EmbeddingService._device or "cpu"

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        vectors = self._model.encode(
            texts,
            batch_size=settings.EMBEDDING_BATCH_SIZE,
            normalize_embeddings=settings.EMBEDDING_NORMALIZE,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]

    def embed_chunks(self, chunks: List[Chunk]) -> List[Chunk]:
        if not chunks:
            return chunks
        logger.info(f"[embedder] Embeddings para {len(chunks)} chunks...")
        vectors = self.embed_texts([c.content for c in chunks])
        for chunk, vec in zip(chunks, vectors):
            chunk.embedding = vec
        return chunks
