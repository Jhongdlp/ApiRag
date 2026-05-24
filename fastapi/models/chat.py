from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1000, description="Pregunta del estudiante")
    session_token: Optional[str] = Field(None, description="Token opcional para hilo de conversación")
    top_k: int = Field(5, ge=1, le=20, description="Número de chunks a recuperar")
    filter_doc_ids: Optional[List[str]] = Field(None, description="Limitar búsqueda a estos documentos")


class Source(BaseModel):
    """Cita de fuente devuelta al cliente, suficiente para mostrar referencia y abrir el PDF."""

    doc_id: str
    chunk_id: str
    filename: str
    page_number: Optional[int] = None
    heading_path: Optional[str] = None
    snippet: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source] = Field(default_factory=list)
    latency_ms: Optional[int] = None
    message_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    rating: Optional[Literal[1, -1]] = Field(None, description="1=útil, -1=no útil, null=quitar valoración")


class DislikedMessage(BaseModel):
    message_id: str
    answer: str
    user_query: Optional[str] = None
    created_at: Optional[str] = None


class FeedbackStats(BaseModel):
    likes: int = 0
    dislikes: int = 0
    disliked_messages: List[DislikedMessage] = Field(default_factory=list)
