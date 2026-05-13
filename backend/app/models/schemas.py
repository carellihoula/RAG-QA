import uuid
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Literal, Optional
from datetime import datetime


class DocumentResponse(BaseModel):
    """Returned after a successful upload."""
    doc_id: str
    filename: str
    title: Optional[str] = None
    page_count: int
    chunk_count: int
    indexed_at: datetime


SourceType = Literal[
    'pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'html',
    'url', 'wikipedia', 'arxiv', 'rss',
]


class DocumentListItem(BaseModel):
    """Item in the list of available documents."""
    doc_id: str
    filename: str
    title: Optional[str] = None
    indexed_at: datetime
    page_count: Optional[int] = None
    chunk_count: Optional[int] = None
    in_library: bool = True
    source_type: str = 'pdf'
    source_url: Optional[str] = None


class DocumentUrlRequest(BaseModel):
    """Body of POST /documents/from-url."""
    url: str
    source_type: Literal['url', 'wikipedia', 'arxiv', 'rss']


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
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    display_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime

    @field_validator('id', mode='before')
    @classmethod
    def coerce_id(cls, v):
        return str(v)


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None


class ActivateRequest(BaseModel):
    token: str


class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str


class BillingStatus(BaseModel):
    plan: str
    doc_count: int
    doc_limit: int
    stripe_customer_id: Optional[str] = None


# ── Knowledge Base schemas ────────────────────────────────────────────────────

class KnowledgeBaseCreate(BaseModel):
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: str = "blue"


class KnowledgeBaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: str
    doc_ids: list[str]
    created_at: datetime


class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    color: Optional[str] = None


class KBChatRequest(BaseModel):
    kb_id: str
    question: str
    session_id: Optional[str] = None
