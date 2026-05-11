from sentence_transformers import SentenceTransformer
from core.config import settings
from models.chunk import Chunk
from utils.logger import logger
from typing import List


class EmbeddingService:
    """Genera embeddings vectoriales con sentence-transformers."""

    def __init__(self):
        logger.info(f"Cargando modelo de embeddings: {settings.EMBEDDING_MODEL}")
        self._model = SentenceTransformer(settings.EMBEDDING_MODEL)

    def embed(self, chunks: List[Chunk]) -> List[Chunk]:
        texts = [c.content for c in chunks]
        logger.info(f"Generando embeddings para {len(texts)} chunks...")
        vectors = self._model.encode(texts, show_progress_bar=False, batch_size=32)
        for chunk, vector in zip(chunks, vectors):
            chunk.embedding = vector.tolist()
        return chunks
