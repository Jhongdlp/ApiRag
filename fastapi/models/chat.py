from pydantic import BaseModel, Field
from typing import List


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=1000, description="Pregunta del estudiante")


class ChatResponse(BaseModel):
    answer: str
    sources: List[dict] = Field(default_factory=list)
