from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.schemas import (
    UserCreate, Token, UserOut, MessageResponse,
    RefreshRequest, ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, UpdateProfileRequest, ActivateRequest,
)
from app.models.user import User
from app.services.auth_service import (
    register_user, login_user,
    create_access_token, create_refresh_token, verify_refresh_token, revoke_refresh_token,
    create_activation_token, activate_account,
    create_password_reset_token, reset_password_with_token,
    change_password, update_profile, get_current_user,
)
from app.services.email_service import send_activation_email, send_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse, status_code=201)
async def register(body: UserCreate, db: Session = Depends(get_db)):
    """Create a new account and send an activation email."""
    user = register_user(body.email, body.password, db)
    raw_token = create_activation_token(user, db)
    await send_activation_email(user.email, raw_token)
    return MessageResponse(message="Account created! Please check your email to activate your account.")


@router.post("/activate", response_model=MessageResponse)
def activate(body: ActivateRequest, db: Session = Depends(get_db)):
    """Activate an account using the token received by email."""
    activate_account(body.token, db)
    return MessageResponse(message="Account activated successfully. You can now log in.")


@router.post("/login", response_model=Token)
def login(body: UserCreate, db: Session = Depends(get_db)):
    """Authenticate and return access + refresh tokens."""
    user = login_user(body.email, body.password, db)
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user, db),
    )


@router.post("/refresh", response_model=Token)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a refresh token for a new access + refresh token pair (rotation)."""
    user = verify_refresh_token(body.refresh_token, db)
    return Token(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user, db),
    )


@router.post("/logout", status_code=204)
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke the current refresh token."""
    revoke_refresh_token(current_user, db)
    return Response(status_code=204)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a password-reset link by email."""
    user, raw_token = create_password_reset_token(body.email, db)
    await send_reset_email(user.email, raw_token)
    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_pwd(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset the password using a valid reset token."""
    reset_password_with_token(body.token, body.new_password, db)
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update profile information (display name)."""
    return update_profile(current_user, body.display_name, db)


@router.post("/change-password", status_code=204)
def change_pwd(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the password after verifying the current one. Revokes all sessions."""
    change_password(current_user, body.old_password, body.new_password, db)
    return Response(status_code=204)
