from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DocumentResponse(BaseModel):
    """Returned after a successful upload."""
    doc_id: str
    filename: str
    page_count: int
    chunk_count: int
    indexed_at: datetime


class DocumentListItem(BaseModel):
    """Item in the list of available documents."""
    doc_id: str
    filename: str
    indexed_at: datetime


class ChatRequest(BaseModel):
    """Body of the POST /chat request."""
    doc_id: str
    question: str
    session_id: Optional[str] = None


class SourceChunk(BaseModel):
    """A PDF excerpt used as context."""
    page: int
    content: str


class ChatResponse(BaseModel):
    """Response sent back to the frontend."""
    answer: str
    sources: list[SourceChunk]
    session_id: str


class ErrorResponse(BaseModel):
    detail: str
