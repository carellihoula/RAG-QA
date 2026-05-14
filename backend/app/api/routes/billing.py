from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import get_current_user
from app.services import billing_service
from app.models.user import User
from app.models.schemas import BillingStatus

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/status", response_model=BillingStatus)
def billing_status(current_user: User = Depends(get_current_user)):
    return billing_service.get_billing_status(current_user)


@router.post("/checkout")
def create_checkout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = billing_service.create_checkout_session(current_user, db)
    return {"url": url}


@router.post("/portal")
def customer_portal(current_user: User = Depends(get_current_user)):
    url = billing_service.create_portal_session(current_user)
    return {"url": url}


@router.get("/verify")
def verify_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Called after Stripe redirects back with ?session_id=. Activates Pro plan."""
    return billing_service.verify_checkout_session(session_id, current_user, db)


@router.post("/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    billing_service.handle_webhook(payload, sig, db)
    return {"received": True}
