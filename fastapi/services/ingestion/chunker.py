"""Chunker semántico tokenizer-aware basado en `HybridChunker` de Docling.

Decisiones de diseño:
- Tokenizer = mismo del modelo de embeddings (BAAI/bge-m3) → el límite de tokens
  es el del modelo real, no una heurística `chars / 6`.
- `merge_peers=True` une chunks hermanos pequeños bajo el mismo heading: evita
  chunks de 30 tokens que rompen el ranking semántico.
- `serialize(chunk)` prepende la ruta de headings al texto: el embedder recibe
  contexto jerárquico ("Capítulo III > Art. 47 > ...") y el RAG cita mejor.
- Cada chunk lleva:
    * `page_number` y `heading_path` (columnas reales de la tabla)
    * `content_hash` SHA-256 (dedup vía UNIQUE(doc_id, content_hash))
    * `token_count` (real, del tokenizer del modelo)
"""
from __future__ import annotations

import hashlib
from typing import List, Optional

from docling_core.transforms.chunker.hybrid_chunker import HybridChunker
from transformers import AutoTokenizer

from core.config import settings
from models.chunk import Chunk
from services.ingestion.extractor import ProcessedDocument
from utils.logger import logger


class DocumentChunker:
    """Aplica chunking semántico jerárquico sobre un `DoclingDocument`."""

    _tokenizer = None
    _chunker_instance = None

    def __init__(self) -> None:
        # Tokenizer y chunker se cachean a nivel de clase para no recargar
        # 500 MB en cada tarea Celery
        if DocumentChunker._tokenizer is None:
            logger.info(f"[chunker] Cargando tokenizer: {settings.EMBEDDING_MODEL}")
            DocumentChunker._tokenizer = AutoTokenizer.from_pretrained(
                settings.EMBEDDING_MODEL
            )
            DocumentChunker._chunker_instance = HybridChunker(
                tokenizer=DocumentChunker._tokenizer,
                max_tokens=settings.CHUNK_MAX_TOKENS,
                merge_peers=settings.CHUNK_MERGE_PEERS,
            )
        self._chunker = DocumentChunker._chunker_instance

    def chunk(self, processed: ProcessedDocument, metadata: dict) -> List[Chunk]:
        logger.info("[chunker] Dividiendo con HybridChunker (tokenizer-aware)...")
        seen_hashes: set[str] = set()
        chunks: List[Chunk] = []

        for raw_idx, doc_chunk in enumerate(self._chunker.chunk(processed.docling_doc)):
            content = self._serialize(doc_chunk).strip()
            if len(content) < 50:
                continue  # ruido: cabeceras sueltas, números de página

            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
            if content_hash in seen_hashes:
                continue  # dedup intra-doc antes de tocar la BD
            seen_hashes.add(content_hash)

            headings = _headings(doc_chunk)
            page = _first_page(doc_chunk)
            heading_path = " > ".join(headings) if headings else None
            section_level = f"h{len(headings)}" if headings else None
            token_count = _token_count(DocumentChunker._tokenizer, content)

            chunk_meta = {
                **metadata,
                "headings": headings,
                "page": page,
                "section_level": section_level,
                "token_count": token_count,
            }
            chunks.append(
                Chunk(
                    doc_id=metadata.get("doc_id"),
                    chunk_index=len(chunks),
                    content=content,
                    content_hash=content_hash,
                    token_count=token_count,
                    page_number=page,
                    heading_path=heading_path,
                    section_level=section_level,
                    metadata=chunk_meta,
                )
            )

        logger.info(f"[chunker] {len(chunks)} chunks únicos generados")
        return chunks

    def _serialize(self, doc_chunk) -> str:
        # Compat: distintas versiones de docling-core exponen serialize() con
        # firmas diferentes — probamos las más comunes
        try:
            return self._chunker.serialize(chunk=doc_chunk)
        except TypeError:
            try:
                return self._chunker.serialize(doc_chunk)
            except Exception:
                return getattr(doc_chunk, "text", "") or ""


def _headings(doc_chunk) -> List[str]:
    meta = getattr(doc_chunk, "meta", None)
    if meta is None:
        return []
    raw = getattr(meta, "headings", None) or []
    return [str(h) for h in raw if h]


def _first_page(doc_chunk) -> Optional[int]:
    meta = getattr(doc_chunk, "meta", None)
    if meta is None:
        return None
    items = getattr(meta, "doc_items", None) or []
    for item in items:
        for prov in getattr(item, "prov", None) or []:
            page = getattr(prov, "page_no", None)
            if page is not None:
                return int(page)
    return None


def _token_count(tokenizer, text: str) -> int:
    try:
        return len(tokenizer.encode(text, add_special_tokens=False))
    except Exception:
        return max(1, len(text) // 4)
