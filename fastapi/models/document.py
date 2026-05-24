from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DocumentOut(BaseModel):
    """Vista pública de un documento institucional."""

    id: str
    filename: str
    status: str
    category: Optional[str] = None
    description: Optional[str] = None
    language: str = "es"
    tags: List[str] = Field(default_factory=list)
    version: int = 1
    page_count: Optional[int] = None
    chunk_count: int = 0
    file_size_bytes: Optional[int] = None
    file_hash: Optional[str] = None
    uploaded_by: Optional[str] = None
    uploaded_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class IngestionJobOut(BaseModel):
    """Vista de un trabajo de ingesta para monitoreo."""

    id: str
    doc_id: str
    celery_task_id: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    steps_log: List[dict] = Field(default_factory=list)
    chunk_count: Optional[int] = None
    embedding_model: Optional[str] = None
    embedding_dim: Optional[int] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
