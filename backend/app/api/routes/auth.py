from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import UserCreate, Token, UserOut
from app.models.user import User
from app.services.auth_service import register_user, login_user, create_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db)):
    """Register a new user and return a JWT token."""
    user = register_user(body.email, body.password, db)
    return Token(access_token=create_token(user.id))


@router.post("/login", response_model=Token)
def login(body: UserCreate, db: Session = Depends(get_db)):
    """Login and return a JWT token."""
    user = login_user(body.email, body.password, db)
    return Token(access_token=create_token(user.id))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user."""
    return current_user
