from pydantic import BaseModel, Field
from typing import Optional, List


class Chunk(BaseModel):
    """Unidad atómica indexable.

    Refleja las columnas reales de `document_chunks` en Supabase para que el
    indexador pueda insertar/upsertear sin mapeos extra.
    """

    id: Optional[str] = None
    doc_id: Optional[str] = None
    job_id: Optional[str] = None
    chunk_index: int = 0
    content: str
    content_hash: Optional[str] = None
    embedding: Optional[List[float]] = None
    token_count: Optional[int] = None
    page_number: Optional[int] = None
    heading_path: Optional[str] = None
    section_level: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    score: Optional[float] = None
