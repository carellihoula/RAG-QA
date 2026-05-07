from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class DocumentResponse(BaseModel):
    """Returned after a successful upload."""
    doc_id: str
    filename: str
    title: Optional[str] = None
    page_count: int
    chunk_count: int
    indexed_at: datetime


class DocumentListItem(BaseModel):
    """Item in the list of available documents."""
    doc_id: str
    filename: str
    title: Optional[str] = None
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


class ChunkItem(BaseModel):
    page: int
    content: str


class UserCreate(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str


class ErrorResponse(BaseModel):
    detail: str
