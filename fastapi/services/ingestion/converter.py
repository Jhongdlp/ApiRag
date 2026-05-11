from docling.document_converter import DocumentConverter
from utils.logger import logger


class MarkdownConverter:
    """Convierte un PDF a Markdown estructurado usando Docling."""

    def __init__(self):
        self._converter = DocumentConverter()

    def convert(self, file_path: str) -> str:
        logger.info(f"Convirtiendo a Markdown: {file_path}")
        result = self._converter.convert(file_path)
        return result.document.export_to_markdown()
