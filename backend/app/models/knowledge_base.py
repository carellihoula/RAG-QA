import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import relationship
from app.database import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    system_prompt = Column(Text, nullable=True)
    color = Column(String(20), default="blue", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    doc_links = relationship("KBDocument", back_populates="kb", cascade="all, delete-orphan")


class KBDocument(Base):
    __tablename__ = "kb_documents"

    kb_id = Column(Uuid(as_uuid=True), ForeignKey("knowledge_bases.id", ondelete="CASCADE"), primary_key=True)
    doc_id = Column(String, primary_key=True)
    added_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    kb = relationship("KnowledgeBase", back_populates="doc_links")