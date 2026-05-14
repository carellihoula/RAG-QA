import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import get_current_user
from app.models.user import User
from app.models.conversation import Conversation, ConversationMessage
from app.models.schemas import ConversationOut, ConversationMessageOut

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/", response_model=list[ConversationOut])
def list_conversations(
    doc_id: Optional[str] = Query(None),
    kb_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Conversation).filter_by(user_id=str(current_user.id))
    if doc_id:
        q = q.filter(Conversation.doc_id == doc_id)
    if kb_id:
        q = q.filter(Conversation.kb_id == kb_id)
    convs = q.order_by(Conversation.updated_at.desc()).all()
    return [
        ConversationOut(
            id=conv.id,
            doc_id=conv.doc_id,
            kb_id=conv.kb_id,
            title=conv.title,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            message_count=len(conv.messages),
        )
        for conv in convs
    ]


@router.get("/{conv_id}/messages", response_model=list[ConversationMessageOut])
def get_messages(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter_by(
        id=conv_id, user_id=str(current_user.id)
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return [
        ConversationMessageOut(
            id=msg.id,
            role=msg.role,
            content=msg.content,
            sources=json.loads(msg.sources) if msg.sources else None,
            created_at=msg.created_at,
        )
        for msg in conv.messages
    ]


@router.delete("/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter_by(
        id=conv_id, user_id=str(current_user.id)
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()