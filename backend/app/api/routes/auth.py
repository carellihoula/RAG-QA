from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.rate_limit import limiter
from app.models.schemas import (
    UserCreate, Token, UserOut, MessageResponse,
    ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, UpdateProfileRequest, ActivateRequest,
)
from app.models.user import User
from app.services.auth_service import (
    register_user, login_user,
    create_access_token, create_refresh_token, verify_refresh_token, revoke_refresh_token,
    create_activation_token, activate_account,
    create_password_reset_token, reset_password_with_token,
    change_password, update_profile, get_current_user,
    REFRESH_COOKIE, set_auth_cookies, clear_auth_cookies,
)
from app.services.email_service import send_activation_email, send_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, body: UserCreate, db: Session = Depends(get_db)):
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
@limiter.limit("5/minute")
def login(request: Request, body: UserCreate, response: Response, db: Session = Depends(get_db)):
    """Authenticate and set the access + refresh tokens as httpOnly cookies."""
    user = login_user(body.email, body.password, db)
    access = create_access_token(user.id)
    refresh_tok = create_refresh_token(user, db)
    set_auth_cookies(response, access, refresh_tok)
    return Token()


@router.post("/refresh", response_model=Token)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Exchange the refresh-token cookie for a new access + refresh pair (rotation)."""
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user = verify_refresh_token(raw, db)
    except HTTPException:
        clear_auth_cookies(response)
        raise
    access = create_access_token(user.id)
    refresh_tok = create_refresh_token(user, db)
    set_auth_cookies(response, access, refresh_tok)
    return Token()


@router.post("/logout", status_code=204)
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Revoke the current refresh token and clear auth cookies.
    Returns None (not a new Response) so FastAPI sends the injected `response`
    object — the one `clear_auth_cookies` actually set the delete-cookie
    headers on — instead of a fresh one that would silently drop them."""
    revoke_refresh_token(current_user, db)
    clear_auth_cookies(response)


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send a password-reset link by email."""
    user, raw_token = create_password_reset_token(body.email, db)
    if user and raw_token:
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
