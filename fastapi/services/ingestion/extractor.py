"""Extracción y conversión unificada de PDFs con Docling.

Reemplaza al antiguo flujo `PDFExtractor (PyMuPDF) → MarkdownConverter (Docling)`,
que cargaba el PDF dos veces y descartaba metadata de página.

Aquí Docling procesa el archivo UNA sola vez y expone:
- El `DoclingDocument` con estructura preservada (necesario para el chunker semántico)
- Markdown exportado (auditoría / debugging)
- Metadata global (número de páginas, hash de archivo)
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    AcceleratorDevice,
    AcceleratorOptions,
    PdfPipelineOptions,
)
from docling.document_converter import DocumentConverter, PdfFormatOption

from core.config import settings
from utils.logger import logger


_DEVICE_MAP = {
    "cpu": AcceleratorDevice.CPU,
    "cuda": AcceleratorDevice.CUDA,
    "auto": AcceleratorDevice.AUTO,
}


@dataclass
class ProcessedDocument:
    docling_doc: Any  # docling_core.types.doc.DoclingDocument
    markdown: str
    page_count: int
    file_hash: str
    file_size_bytes: int


class PDFProcessor:
    """Procesa un PDF con Docling y devuelve un DoclingDocument estructurado."""

    def __init__(self) -> None:
        device = _DEVICE_MAP.get(settings.DOCLING_DEVICE.lower(), AcceleratorDevice.CPU)
        pipeline_options = PdfPipelineOptions()
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=settings.DOCLING_NUM_THREADS, device=device
        )
        logger.info(
            f"[extractor] Docling accelerator={device.value} threads={settings.DOCLING_NUM_THREADS}"
        )
        self._converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )

    def process(self, file_path: str) -> ProcessedDocument:
        logger.info(f"[extractor] Procesando PDF con Docling: {file_path}")
        file_hash, size = _hash_file(file_path)

        result = self._converter.convert(file_path)
        doc = result.document

        page_count = len(getattr(doc, "pages", []) or []) or 0
        markdown = doc.export_to_markdown()
        logger.info(
            f"[extractor] OK ({page_count} páginas, {len(markdown)} chars md, sha256={file_hash[:12]}…)"
        )
        return ProcessedDocument(
            docling_doc=doc,
            markdown=markdown,
            page_count=page_count,
            file_hash=file_hash,
            file_size_bytes=size,
        )


def _hash_file(file_path: str, chunk: int = 1 << 20) -> tuple[str, int]:
    """SHA-256 streaming del archivo y tamaño en bytes."""
    h = hashlib.sha256()
    size = 0
    with open(file_path, "rb") as f:
        while True:
            block = f.read(chunk)
            if not block:
                break
            h.update(block)
            size += len(block)
    return h.hexdigest(), size
