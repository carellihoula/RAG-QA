import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey, Uuid
from app.database import Base


class UploadLog(Base):
    """Append-only record of every accepted upload (file or URL import).

    Used solely to enforce the rolling 24h upload quota — deliberately never
    touched by document deletion, so a user can't reset their quota by
    deleting and re-uploading."""
    __tablename__ = "upload_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
