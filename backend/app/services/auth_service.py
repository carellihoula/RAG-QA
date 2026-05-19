import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# ── Passwords ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Token helpers ─────────────────────────────────────────────────────────────

def _sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _as_utc(dt: datetime) -> datetime:
    """Make a naive datetime timezone-aware (assumes UTC, as SQLite stores it)."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(user: User, db: Session) -> str:
    """Generate a new refresh token, rotate the stored hash, return the raw token."""
    raw = secrets.token_urlsafe(48)
    user.refresh_token_hash = _sha256(raw)
    user.refresh_token_expires = datetime.now(tz=timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    db.commit()
    return raw


def verify_refresh_token(raw: str, db: Session) -> User:
    hashed = _sha256(raw)
    user = db.query(User).filter(User.refresh_token_hash == hashed).first()
    if not user or not user.refresh_token_expires:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if datetime.now(tz=timezone.utc) > _as_utc(user.refresh_token_expires):
        raise HTTPException(status_code=401, detail="Refresh token expired")
    return user


def revoke_refresh_token(user: User, db: Session) -> None:
    user.refresh_token_hash = None
    user.refresh_token_expires = None
    db.commit()


# ── Register / Login ──────────────────────────────────────────────────────────

def register_user(email: str, password: str, db: Session) -> User:
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=email, hashed_password=hash_password(password), is_active=False)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_activation_token(user: User, db: Session) -> str:
    """Generate a one-time activation token. Returns the raw (unhashed) token."""
    raw = secrets.token_urlsafe(32)
    user.activation_token = _sha256(raw)
    db.commit()
    return raw


def activate_account(raw_token: str, db: Session) -> User:
    hashed = _sha256(raw_token)
    user = db.query(User).filter(User.activation_token == hashed).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid activation link")
    if user.is_active:
        raise HTTPException(status_code=400, detail="Account is already activated")
    # Check 10-day window
    if user.created_at:
        from datetime import timedelta
        deadline = user.created_at.replace(tzinfo=timezone.utc) + timedelta(days=10)
        if datetime.now(tz=timezone.utc) > deadline:
            raise HTTPException(
                status_code=410,
                detail="Activation link has expired. Your account has been removed — please register again.",
            )
    user.is_active = True
    user.activation_token = None
    db.commit()
    db.refresh(user)
    return user


def login_user(email: str, password: str, db: Session) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is not activated")
    return user


# ── Password reset ────────────────────────────────────────────────────────────

def create_password_reset_token(email: str, db: Session) -> tuple[User, str]:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")
    raw = secrets.token_urlsafe(32)
    user.reset_token = _sha256(raw)
    user.reset_token_expires = datetime.now(tz=timezone.utc) + timedelta(hours=settings.reset_token_expire_hours)
    db.commit()
    return user, raw


def reset_password_with_token(token: str, new_password: str, db: Session) -> None:
    hashed = _sha256(token)
    user = db.query(User).filter(User.reset_token == hashed).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if datetime.now(tz=timezone.utc) > _as_utc(user.reset_token_expires):
        raise HTTPException(status_code=400, detail="Reset token has expired")
    user.hashed_password = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expires = None
    # Revoke all refresh tokens on password change
    user.refresh_token_hash = None
    user.refresh_token_expires = None
    db.commit()


# ── Profile updates ───────────────────────────────────────────────────────────

def change_password(user: User, old_password: str, new_password: str, db: Session) -> None:
    if not verify_password(old_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.hashed_password = hash_password(new_password)
    # Revoke refresh token so other sessions are invalidated
    user.refresh_token_hash = None
    user.refresh_token_expires = None
    db.commit()


def update_profile(user: User, display_name: Optional[str], db: Session) -> User:
    if display_name is not None:
        user.display_name = display_name.strip() or None
    db.commit()
    db.refresh(user)
    return user


# ── Current user dependency ───────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise credentials_exception
    user = db.get(User, user_id)
    if not user:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user