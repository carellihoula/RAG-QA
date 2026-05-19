import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.schemas import AdminUserOut, AdminUserUpdate
from app.services.auth_service import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    search: str = "",
    plan: str = "",
    status: str = "",
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            (User.email.ilike(term)) | (User.display_name.ilike(term))
        )
    if plan in ("free", "pro"):
        query = query.filter(User.plan == plan)
    if status == "active":
        query = query.filter(User.is_active == True)   # noqa: E712
    elif status == "inactive":
        query = query.filter(User.is_active == False)  # noqa: E712
    return query.order_by(User.created_at.desc()).all()


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: str,
    body: AdminUserUpdate,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.display_name is not None:
        user.display_name = body.display_name.strip() or None
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.plan is not None:
        user.plan = body.plan
    if body.is_admin is not None:
        if str(uid) == str(current_admin.id) and not body.is_admin:
            raise HTTPException(status_code=400, detail="Cannot remove your own admin privileges")
        user.is_admin = body.is_admin

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if str(uid) == str(current_admin.id):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
