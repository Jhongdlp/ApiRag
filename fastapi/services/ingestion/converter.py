"""DEPRECATED: la conversión a Markdown ahora ocurre dentro de `PDFProcessor`.

Mantenido solo para compatibilidad de imports. Importa `PDFProcessor` desde
`services.ingestion.extractor` y usa `ProcessedDocument.markdown`.
"""
from services.ingestion.extractor import PDFProcessor, ProcessedDocument

__all__ = ["PDFProcessor", "ProcessedDocument"]
