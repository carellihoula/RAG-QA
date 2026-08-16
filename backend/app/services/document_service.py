import uuid
import aiofiles
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile, HTTPException
from app.config import settings
from app.database import SessionLocal
from app.models.document import Document
from app.models.schemas import DocumentListItem
from app.loaders.file_loader import SUPPORTED_EXTENSIONS


class DocumentService:
    """Manages document files on disk/S3 and their metadata in Postgres."""

    # ── Upload ────────────────────────────────────────────────────────

    async def save_upload(self, file: UploadFile) -> tuple[str, Path]:
        """Saves an uploaded file to disk, streamed in chunks so an oversized
        upload is rejected early instead of being fully buffered first.
        Returns (doc_id, path)."""
        ext = Path(file.filename or '').suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            supported = ', '.join(sorted(SUPPORTED_EXTENSIONS))
            raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Supported: {supported}")

        doc_id = str(uuid.uuid4())
        file_path = settings.upload_dir / f"{doc_id}{ext}"
        max_bytes = settings.max_upload_mb * 1024 * 1024
        chunk_size = 1024 * 1024

        written = 0
        try:
            async with aiofiles.open(file_path, 'wb') as f:
                while chunk := await file.read(chunk_size):
                    written += len(chunk)
                    if written > max_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"File exceeds the {settings.max_upload_mb}MB limit",
                        )
                    await f.write(chunk)
        except HTTPException:
            file_path.unlink(missing_ok=True)
            raise

        return doc_id, file_path

    # ── Paths ─────────────────────────────────────────────────────────

    def get_index_path(self, doc_id: str) -> Path:
        return settings.index_dir / doc_id

    def doc_exists(self, doc_id: str) -> bool:
        db = SessionLocal()
        try:
            return db.query(Document.id).filter_by(id=doc_id).first() is not None
        finally:
            db.close()

    def get_source_file(self, doc_id: str) -> Optional[Path]:
        """Returns the uploaded file path (any extension) if it exists."""
        for path in settings.upload_dir.glob(f'{doc_id}.*'):
            return path
        return None

    def require_doc(self, doc_id: str, user_id: Optional[str] = None) -> None:
        meta = self.load_metadata(doc_id)
        if not meta:
            raise HTTPException(status_code=404, detail=f'Document {doc_id} not found')
        if user_id is not None and meta.get('user_id') != user_id:
            raise HTTPException(status_code=404, detail=f'Document {doc_id} not found')

    # ── Metadata ──────────────────────────────────────────────────────

    def save_metadata(
        self,
        doc_id: str,
        filename: str,
        title: Optional[str],
        indexed_at: datetime,
        page_count: int = 0,
        chunk_count: int = 0,
        in_library: bool = True,
        source_type: str = 'pdf',
        source_url: Optional[str] = None,
        user_id: Optional[str] = None,
        status: str = 'ready',
    ) -> None:
        db = SessionLocal()
        try:
            db.merge(Document(
                id=doc_id,
                user_id=user_id,
                filename=filename,
                title=title,
                indexed_at=indexed_at,
                page_count=page_count,
                chunk_count=chunk_count,
                in_library=in_library,
                source_type=source_type,
                source_url=source_url,
                status=status,
            ))
            db.commit()
        finally:
            db.close()

    def update_after_indexing(
        self,
        doc_id: str,
        title: Optional[str] = None,
        filename: Optional[str] = None,
        page_count: int = 0,
        chunk_count: int = 0,
        source_type: Optional[str] = None,
        status: str = 'ready',
        error: Optional[str] = None,
        s3_key: Optional[str] = None,
    ) -> None:
        db = SessionLocal()
        try:
            doc = db.query(Document).filter_by(id=doc_id).first()
            if not doc:
                return
            doc.status = status
            if title is not None:
                doc.title = title
            if filename is not None:
                doc.filename = filename
            if page_count:
                doc.page_count = page_count
            if chunk_count:
                doc.chunk_count = chunk_count
            if source_type:
                doc.source_type = source_type
            if error:
                doc.error = error
            if s3_key:
                doc.s3_key = s3_key
            db.commit()
        finally:
            db.close()

    def load_metadata(self, doc_id: str) -> dict:
        db = SessionLocal()
        try:
            doc = db.query(Document).filter_by(id=doc_id).first()
            return self._doc_to_meta(doc) if doc else {}
        finally:
            db.close()

    def hide_from_library(self, doc_id: str) -> None:
        """Removes doc from library view but keeps files for KB use."""
        db = SessionLocal()
        try:
            doc = db.query(Document).filter_by(id=doc_id).first()
            if doc:
                doc.in_library = False
                db.commit()
        finally:
            db.close()

    @staticmethod
    def _doc_to_meta(doc: Document) -> dict:
        return {
            'filename': doc.filename,
            'title': doc.title,
            'indexed_at': doc.indexed_at.isoformat() if doc.indexed_at else None,
            'page_count': doc.page_count,
            'chunk_count': doc.chunk_count,
            'in_library': doc.in_library,
            'source_type': doc.source_type,
            'source_url': doc.source_url,
            'user_id': str(doc.user_id) if doc.user_id else None,
            'status': doc.status,
            'error': doc.error,
            's3_key': doc.s3_key,
        }

    # ── List / get ────────────────────────────────────────────────────

    def _meta_to_item(self, doc_id: str, meta: dict) -> DocumentListItem:
        return DocumentListItem(
            doc_id=doc_id,
            filename=meta.get('filename', doc_id),
            title=meta.get('title'),
            indexed_at=datetime.fromisoformat(meta['indexed_at'])
                if meta.get('indexed_at') else datetime.now(timezone.utc),
            page_count=meta.get('page_count'),
            chunk_count=meta.get('chunk_count'),
            in_library=meta.get('in_library', True),
            source_type=meta.get('source_type', 'pdf'),
            source_url=meta.get('source_url'),
            status=meta.get('status', 'ready'),
        )

    def list_documents(self, user_id: Optional[str] = None) -> list[DocumentListItem]:
        """Returns in-library documents. If user_id is given, only that user's docs."""
        db = SessionLocal()
        try:
            query = db.query(Document).filter_by(in_library=True)
            if user_id is not None:
                query = query.filter_by(user_id=user_id)
            docs = query.order_by(Document.indexed_at.desc()).all()
            return [self._meta_to_item(doc.id, self._doc_to_meta(doc)) for doc in docs]
        finally:
            db.close()

    def get_document_by_id(self, doc_id: str) -> Optional[DocumentListItem]:
        """Returns a document regardless of in_library status."""
        meta = self.load_metadata(doc_id)
        if not meta:
            return None
        return self._meta_to_item(doc_id, meta)

    # ── Delete ────────────────────────────────────────────────────────

    def delete_document(self, doc_id: str) -> None:
        """Permanently deletes the source file, metadata, and vector index."""
        import shutil
        from app.services.rag_service import rag_service
        from app.services import s3_service

        src = self.get_source_file(doc_id)
        if src and src.exists():
            src.unlink()

        meta = self.load_metadata(doc_id)
        if s3_key := meta.get('s3_key'):
            s3_service.delete_file(s3_key)

        index_path = self.get_index_path(doc_id)
        if index_path.exists():
            shutil.rmtree(index_path)
        rag_service.delete_index(doc_id)

        db = SessionLocal()
        try:
            db.query(Document).filter_by(id=doc_id).delete()
            db.commit()
        finally:
            db.close()
