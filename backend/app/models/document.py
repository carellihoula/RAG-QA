from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Uuid
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    title = Column(String, nullable=True)
    indexed_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    page_count = Column(Integer, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    in_library = Column(Boolean, default=True, nullable=False)
    source_type = Column(String, default="pdf", nullable=False)
    source_url = Column(String, nullable=True)
    status = Column(String, default="ready", nullable=False)
    error = Column(String, nullable=True)
    s3_key = Column(String, nullable=True)
