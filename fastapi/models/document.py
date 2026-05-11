from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentOut(BaseModel):
    id: str
    filename: str
    uploaded_at: Optional[datetime] = None
    status: str
    chunk_count: int = 0
