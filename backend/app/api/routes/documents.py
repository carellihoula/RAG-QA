import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.services.document_service import DocumentService
from app.services.rag_service import rag_service
from app.services.auth_service import get_current_user
from app.models.schemas import DocumentResponse, DocumentListItem, ChunkItem, DocumentUrlRequest
from app.models.knowledge_base import KBDocument
from app.models.user import User
from app.database import get_db
from app.loaders.file_loader import load_file
from app.loaders.web_loader import load_web
from app.services import billing_service

router = APIRouter(prefix='/documents', tags=['documents'])
doc_service = DocumentService()


@router.post('/', response_model=DocumentResponse, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Uploads any supported file, indexes it, then generates an AI title."""
    billing_service.check_quota(current_user)
    doc_id, file_path = await doc_service.save_upload(file)

    loop = asyncio.get_event_loop()
    try:
        docs, source_type = await loop.run_in_executor(None, load_file, file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f'Loading error: {e}')

    try:
        response = await loop.run_in_executor(
            None, rag_service.index_from_docs, doc_id, docs, file.filename
        )
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f'Indexing error: {e}')

    try:
        title = await rag_service.generate_title(doc_id)
    except Exception:
        title = None

    doc_service.save_metadata(
        doc_id, file.filename, title, response.indexed_at,
        response.page_count, response.chunk_count,
        source_type=source_type,
        user_id=str(current_user.id),
    )
    return response.model_copy(update={'title': title})


@router.post('/from-url', response_model=DocumentResponse, status_code=201)
async def import_from_url(
    body: DocumentUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """Imports a web source (URL, YouTube, Wikipedia, arXiv, RSS) and indexes it."""
    billing_service.check_quota(current_user)
    loop = asyncio.get_event_loop()
    try:
        docs, source_type, auto_title = await loop.run_in_executor(
            None, load_web, body.source_type, body.url
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f'Could not load source: {e}')

    doc_id = str(uuid.uuid4())

    # Ensure index dir exists (no physical file for web sources)
    (doc_service.get_index_path(doc_id)).mkdir(parents=True, exist_ok=True)

    try:
        response = await loop.run_in_executor(
            None, rag_service.index_from_docs, doc_id, docs, auto_title
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Indexing error: {e}')

    # Use LLM title only for short auto-titles; keep scraped title otherwise
    title = auto_title
    if source_type == 'pdf':
        try:
            title = await rag_service.generate_title(doc_id)
        except Exception:
            pass

    doc_service.save_metadata(
        doc_id, auto_title, title, response.indexed_at,
        response.page_count, response.chunk_count,
        source_type=source_type,
        source_url=body.url,
        user_id=str(current_user.id),
    )
    return response.model_copy(update={'title': title, 'filename': auto_title})


@router.get('/', response_model=list[DocumentListItem])
def list_documents(current_user: User = Depends(get_current_user)):
    return doc_service.list_documents(user_id=str(current_user.id))


@router.get('/{doc_id}/chunks', response_model=list[ChunkItem])
def get_document_chunks(doc_id: str, current_user: User = Depends(get_current_user)):
    doc_service.require_doc(doc_id, user_id=str(current_user.id))
    try:
        return rag_service.get_chunks(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete('/{doc_id}', status_code=204)
def delete_document(
    doc_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc_service.require_doc(doc_id, user_id=str(current_user.id))
    in_kb = db.query(KBDocument).filter_by(doc_id=doc_id).first() is not None
    if in_kb:
        doc_service.hide_from_library(doc_id)
    else:
        doc_service.delete_document(doc_id)