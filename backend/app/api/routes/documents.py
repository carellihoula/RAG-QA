import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, BackgroundTasks, Depends, UploadFile, File, HTTPException
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


async def _index_file_task(doc_id: str, file_path: Path, filename: str, user_id: str = "") -> None:
    from app.services import s3_service
    try:
        docs, source_type = await asyncio.to_thread(load_file, file_path)
        response = await rag_service.index_from_docs(doc_id, docs, filename, source_type=source_type)
        try:
            title = await rag_service.generate_title(doc_id)
        except Exception:
            title = None

        s3_key = None
        if s3_service.s3_enabled():
            try:
                s3_key = await asyncio.to_thread(
                    s3_service.upload_file, file_path, doc_id, filename, user_id
                )
            except Exception:
                pass

        file_path.unlink(missing_ok=True)
        doc_service.update_after_indexing(
            doc_id, title=title,
            page_count=response.page_count, chunk_count=response.chunk_count,
            source_type=source_type, status='ready', s3_key=s3_key,
        )
    except Exception as e:
        file_path.unlink(missing_ok=True)
        doc_service.update_after_indexing(doc_id, status='error', error=str(e))


async def _index_url_task(doc_id: str, url: str, source_type_input: str) -> None:
    try:
        docs, source_type, auto_title = await asyncio.to_thread(load_web, source_type_input, url)
        response = await rag_service.index_from_docs(doc_id, docs, auto_title, source_type=source_type)
        title = auto_title
        if source_type == 'pdf':
            try:
                title = await rag_service.generate_title(doc_id)
            except Exception:
                pass
        doc_service.update_after_indexing(
            doc_id, title=title, filename=auto_title,
            page_count=response.page_count, chunk_count=response.chunk_count,
            source_type=source_type, status='ready',
        )
    except Exception as e:
        doc_service.update_after_indexing(doc_id, status='error', error=str(e))


@router.post('/', response_model=DocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    billing_service.check_quota(current_user)
    doc_id, file_path = await doc_service.save_upload(file)
    now = datetime.now(tz=timezone.utc)
    doc_service.save_metadata(
        doc_id, file.filename, None, now,
        page_count=0, chunk_count=0, status='processing',
        user_id=str(current_user.id),
    )
    background_tasks.add_task(_index_file_task, doc_id, file_path, file.filename, str(current_user.id))
    return DocumentResponse(
        doc_id=doc_id, filename=file.filename, title=None,
        page_count=0, chunk_count=0, indexed_at=now, status='processing',
    )


@router.post('/from-url', response_model=DocumentResponse, status_code=202)
async def import_from_url(
    background_tasks: BackgroundTasks,
    body: DocumentUrlRequest,
    current_user: User = Depends(get_current_user),
):
    billing_service.check_quota(current_user)
    doc_id = str(uuid.uuid4())
    now = datetime.now(tz=timezone.utc)
    doc_service.save_metadata(
        doc_id, body.url, None, now,
        page_count=0, chunk_count=0, status='processing',
        source_type=body.source_type, source_url=body.url,
        user_id=str(current_user.id),
    )
    background_tasks.add_task(_index_url_task, doc_id, body.url, body.source_type)
    return DocumentResponse(
        doc_id=doc_id, filename=body.url, title=None,
        page_count=0, chunk_count=0, indexed_at=now, status='processing',
    )


@router.get('/{doc_id}/status')
def get_document_status(doc_id: str, current_user: User = Depends(get_current_user)):
    doc_service.require_doc(doc_id, user_id=str(current_user.id))
    meta = doc_service.load_metadata(doc_id)
    return {
        'doc_id': doc_id,
        'status': meta.get('status', 'ready'),
        'filename': meta.get('filename', ''),
        'title': meta.get('title'),
        'page_count': meta.get('page_count', 0),
        'chunk_count': meta.get('chunk_count', 0),
        'indexed_at': meta.get('indexed_at'),
        'source_type': meta.get('source_type', 'pdf'),
        'source_url': meta.get('source_url'),
        'in_library': meta.get('in_library', True),
        'error': meta.get('error'),
    }


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
