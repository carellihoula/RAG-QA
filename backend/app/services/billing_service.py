import json
import uuid

import stripe
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User

stripe.api_key = settings.stripe_secret_key

PLAN_LIMITS = {
    "free": settings.free_doc_limit,
    "pro":  settings.pro_doc_limit,
}


def get_doc_count(user_id: str) -> int:
    """Count on-disk documents belonging to user_id (in_library or not)."""
    if not settings.index_dir.exists():
        return 0
    count = 0
    for index_path in settings.index_dir.iterdir():
        if not index_path.is_dir():
            continue
        meta_path = index_path / "metadata.json"
        if not meta_path.exists():
            continue
        try:
            meta = json.loads(meta_path.read_text())
        except Exception:
            continue
        if meta.get("user_id") == user_id:
            count += 1
    return count


def check_quota(user: User) -> None:
    """Raise 402 if user has reached their plan's document limit. Admins are unlimited."""
    if user.is_admin:
        return
    limit = PLAN_LIMITS.get(user.plan, settings.free_doc_limit)
    count = get_doc_count(str(user.id))
    if count >= limit:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "quota_exceeded",
                "doc_count": count,
                "doc_limit": limit,
                "plan": user.plan,
                "message": f"Document limit reached ({count}/{limit}). Upgrade to Pro for more.",
            },
        )


def get_billing_status(user: User) -> dict:
    count = get_doc_count(str(user.id))
    if user.is_admin:
        return {
            "plan": "admin",
            "doc_count": count,
            "doc_limit": -1,
            "stripe_customer_id": user.stripe_customer_id,
        }
    limit = PLAN_LIMITS.get(user.plan, settings.free_doc_limit)
    return {
        "plan": user.plan,
        "doc_count": count,
        "doc_limit": limit,
        "stripe_customer_id": user.stripe_customer_id,
    }


def create_checkout_session(user: User, db: Session) -> str:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing not configured")
    if not settings.stripe_pro_price_id:
        raise HTTPException(status_code=503, detail="Stripe price ID not configured")

    if user.plan == "pro":
        raise HTTPException(status_code=400, detail="Already on Pro plan")

    # Get or create Stripe customer
    if user.stripe_customer_id:
        customer_id = user.stripe_customer_id
    else:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.commit()
        customer_id = customer.id

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/app?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.frontend_url}/app",
        metadata={"user_id": str(user.id)},
        allow_promotion_codes=True,
    )
    return session.url


def create_portal_session(user: User) -> str:
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing not configured")
    if not user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found")
    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.frontend_url}/app",
    )
    return session.url


def verify_checkout_session(session_id: str, user: User, db: Session) -> dict:
    """Called from success_url redirect — activates Pro without needing a webhook."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing not configured")
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if session.get("payment_status") != "paid":
        raise HTTPException(status_code=402, detail="Payment not completed")

    stored_user_id = session.get("metadata", {}).get("user_id")
    if stored_user_id != str(user.id):
        raise HTTPException(status_code=403, detail="Session does not belong to this user")

    user.plan = "pro"
    user.stripe_subscription_id = session.get("subscription")
    if session.get("customer"):
        user.stripe_customer_id = session["customer"]
    db.commit()
    return get_billing_status(user)


def handle_webhook(payload: bytes, sig: str, db: Session) -> None:
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        if user_id:
            user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
            if user:
                user.plan = "pro"
                user.stripe_subscription_id = data.get("subscription")
                db.commit()

    elif event_type in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub_id = data.get("id")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            user.plan = "free"
            user.stripe_subscription_id = None
            db.commit()

    elif event_type == "customer.subscription.updated":
        sub_id = data.get("id")
        status = data.get("status", "")
        user = db.query(User).filter(User.stripe_subscription_id == sub_id).first()
        if user:
            if status in ("active", "trialing"):
                user.plan = "pro"
            elif status in ("canceled", "unpaid", "past_due"):
                user.plan = "free"
            db.commit()
