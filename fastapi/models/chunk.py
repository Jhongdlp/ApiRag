from pydantic import BaseModel, Field
from typing import Optional, List


class Chunk(BaseModel):
    id: Optional[str] = None
    content: str
    embedding: Optional[List[float]] = None
    metadata: dict = Field(default_factory=dict)
    score: Optional[float] = None
