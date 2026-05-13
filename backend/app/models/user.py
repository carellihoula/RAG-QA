import uuid
from datetime import datetime
from sqlalchemy import Column, String, Uuid, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False, server_default="0")
    activation_token = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Password reset
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Refresh token (stored as hash)
    refresh_token_hash = Column(String, nullable=True, index=True)
    refresh_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Billing
    plan = Column(String, nullable=False, default="free", server_default="free")
    stripe_customer_id = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True)
