import fitz  # PyMuPDF
from utils.logger import logger


class PDFExtractor:
    """Extrae texto plano de un PDF usando PyMuPDF."""

    def extract(self, file_path: str) -> str:
        logger.info(f"Extrayendo texto de: {file_path}")
        doc = fitz.open(file_path)
        pages = []
        for page in doc:
            pages.append(page.get_text())
        doc.close()
        return "\n\n".join(pages)
