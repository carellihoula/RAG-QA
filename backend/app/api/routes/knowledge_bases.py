import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth_service import get_current_user
from app.services.document_service import DocumentService
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase, KBDocument
from app.models.schemas import KnowledgeBaseCreate, KnowledgeBaseOut, KnowledgeBaseUpdate, DocumentListItem

doc_service = DocumentService()

router = APIRouter(prefix="/kb", tags=["knowledge-bases"])


def find_owned_kb(db: Session, kb_id: uuid.UUID, user_id) -> KnowledgeBase:
    """Looks up a KB by id, scoped to its owner. Raises 404 if missing or not owned."""
    kb = db.query(KnowledgeBase).filter_by(id=kb_id, user_id=user_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    return kb


def get_owned_kb(
    kb_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> KnowledgeBase:
    """FastAPI dependency for routes where kb_id is a path parameter."""
    return find_owned_kb(db, kb_id, current_user.id)


def _to_out(kb: KnowledgeBase) -> KnowledgeBaseOut:
    return KnowledgeBaseOut(
        id=str(kb.id),
        name=kb.name,
        description=kb.description,
        system_prompt=kb.system_prompt,
        color=kb.color,
        doc_ids=[link.doc_id for link in kb.doc_links],
        created_at=kb.created_at,
    )


@router.get("/", response_model=list[KnowledgeBaseOut])
def list_knowledge_bases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kbs = (
        db.query(KnowledgeBase)
        .filter_by(user_id=current_user.id)
        .order_by(KnowledgeBase.created_at)
        .all()
    )
    return [_to_out(kb) for kb in kbs]


@router.post("/", response_model=KnowledgeBaseOut, status_code=201)
def create_knowledge_base(
    body: KnowledgeBaseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    kb = KnowledgeBase(
        user_id=current_user.id,
        name=body.name.strip(),
        description=body.description,
        system_prompt=body.system_prompt,
        color=body.color,
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return _to_out(kb)


@router.patch("/{kb_id}", response_model=KnowledgeBaseOut)
def update_knowledge_base(
    body: KnowledgeBaseUpdate,
    kb: KnowledgeBase = Depends(get_owned_kb),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        kb.name = body.name.strip()
    if body.description is not None:
        kb.description = body.description
    if body.system_prompt is not None:
        kb.system_prompt = body.system_prompt
    if body.color is not None:
        kb.color = body.color
    db.commit()
    db.refresh(kb)
    return _to_out(kb)


@router.delete("/{kb_id}", status_code=204)
def delete_knowledge_base(
    kb: KnowledgeBase = Depends(get_owned_kb),
    db: Session = Depends(get_db),
):
    db.delete(kb)
    db.commit()


@router.post("/{kb_id}/docs/{doc_id}", status_code=204)
def add_document_to_kb(
    doc_id: str,
    kb: KnowledgeBase = Depends(get_owned_kb),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc_service.require_doc(doc_id, user_id=str(current_user.id))
    exists = db.query(KBDocument).filter_by(kb_id=kb.id, doc_id=doc_id).first()
    if not exists:
        db.add(KBDocument(kb_id=kb.id, doc_id=doc_id))
        db.commit()


@router.get("/{kb_id}/docs", response_model=list[DocumentListItem])
def get_kb_documents(kb: KnowledgeBase = Depends(get_owned_kb)):
    """Returns all documents linked to a KB, including those hidden from the library."""
    docs = []
    for link in kb.doc_links:
        doc = doc_service.get_document_by_id(link.doc_id)
        if doc:
            docs.append(doc)
    return docs


@router.delete("/{kb_id}/docs/{doc_id}", status_code=204)
def remove_document_from_kb(
    doc_id: str,
    kb: KnowledgeBase = Depends(get_owned_kb),
    db: Session = Depends(get_db),
):
    link = db.query(KBDocument).filter_by(kb_id=kb.id, doc_id=doc_id).first()
    if link:
        db.delete(link)
        db.commit()
