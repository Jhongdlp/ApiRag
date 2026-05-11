from langchain.text_splitter import MarkdownHeaderTextSplitter
from core.config import settings
from models.chunk import Chunk
from utils.logger import logger
from typing import List


HEADERS_TO_SPLIT = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
]


class DocumentChunker:
    """Divide el texto Markdown en chunks usando jerarquía de cabeceras."""

    def __init__(self):
        self._splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=HEADERS_TO_SPLIT,
            strip_headers=False,
        )

    def chunk(self, markdown_text: str, metadata: dict) -> List[Chunk]:
        logger.info("Dividiendo documento en chunks...")
        splits = self._splitter.split_text(markdown_text)
        chunks = []
        for i, doc in enumerate(splits):
            content = doc.page_content.strip()
            if len(content) < 50:
                continue
            # Truncar al límite configurado (en palabras aproximadas)
            if len(content) > settings.CHUNK_SIZE_LIMIT * 6:
                content = content[: settings.CHUNK_SIZE_LIMIT * 6]
            chunk_meta = {**metadata, **doc.metadata, "chunk_index": i}
            chunks.append(Chunk(content=content, metadata=chunk_meta))
        logger.info(f"Chunks generados: {len(chunks)}")
        return chunks
