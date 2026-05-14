import uuid
import json
import aiofiles
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from fastapi import UploadFile, HTTPException
from app.config import settings
from app.models.schemas import DocumentListItem
from app.loaders.file_loader import SUPPORTED_EXTENSIONS


class DocumentService:
    """Manages document files and metadata on disk."""

    # ── Upload ────────────────────────────────────────────────────────

    async def save_upload(self, file: UploadFile) -> tuple[str, Path]:
        """Saves an uploaded file to disk. Returns (doc_id, path)."""
        ext = Path(file.filename or '').suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            supported = ', '.join(sorted(SUPPORTED_EXTENSIONS))
            raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Supported: {supported}")

        doc_id = str(uuid.uuid4())
        file_path = settings.upload_dir / f"{doc_id}{ext}"

        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)

        return doc_id, file_path

    # ── Paths ─────────────────────────────────────────────────────────

    def get_index_path(self, doc_id: str) -> Path:
        return settings.index_dir / doc_id

    def doc_exists(self, doc_id: str) -> bool:
        return (self.get_index_path(doc_id) / 'metadata.json').exists()

    def get_source_file(self, doc_id: str) -> Optional[Path]:
        """Returns the uploaded file path (any extension) if it exists."""
        for path in settings.upload_dir.glob(f'{doc_id}.*'):
            return path
        return None

    def require_doc(self, doc_id: str, user_id: Optional[str] = None) -> None:
        if not self.doc_exists(doc_id):
            raise HTTPException(status_code=404, detail=f'Document {doc_id} not found')
        if user_id is not None:
            meta = self.load_metadata(doc_id)
            if meta.get('user_id') and meta['user_id'] != user_id:
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
        meta_path = self.get_index_path(doc_id) / 'metadata.json'
        meta_path.parent.mkdir(parents=True, exist_ok=True)
        meta_path.write_text(json.dumps({
            'filename': filename,
            'title': title,
            'indexed_at': indexed_at.isoformat(),
            'page_count': page_count,
            'chunk_count': chunk_count,
            'in_library': in_library,
            'source_type': source_type,
            'source_url': source_url,
            'user_id': user_id,
            'status': status,
        }))

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
    ) -> None:
        meta = self.load_metadata(doc_id)
        if not meta:
            return
        meta['status'] = status
        if title is not None:
            meta['title'] = title
        if filename is not None:
            meta['filename'] = filename
        if page_count:
            meta['page_count'] = page_count
        if chunk_count:
            meta['chunk_count'] = chunk_count
        if source_type:
            meta['source_type'] = source_type
        if error:
            meta['error'] = error
        meta_path = self.get_index_path(doc_id) / 'metadata.json'
        meta_path.write_text(json.dumps(meta))

    def load_metadata(self, doc_id: str) -> dict:
        meta_path = self.get_index_path(doc_id) / 'metadata.json'
        if meta_path.exists():
            return json.loads(meta_path.read_text())
        return {}

    def hide_from_library(self, doc_id: str) -> None:
        """Removes doc from library view but keeps files for KB use."""
        index_path = self.get_index_path(doc_id)
        meta_path = index_path / 'metadata.json'
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            meta['in_library'] = False
            meta_path.write_text(json.dumps(meta))

    # ── List / get ────────────────────────────────────────────────────

    def _meta_to_item(self, doc_id: str, meta: dict) -> DocumentListItem:
        return DocumentListItem(
            doc_id=doc_id,
            filename=meta.get('filename', doc_id),
            title=meta.get('title'),
            indexed_at=datetime.fromisoformat(meta['indexed_at'])
                if 'indexed_at' in meta else datetime.now(timezone.utc),
            page_count=meta.get('page_count'),
            chunk_count=meta.get('chunk_count'),
            in_library=meta.get('in_library', True),
            source_type=meta.get('source_type', 'pdf'),
            source_url=meta.get('source_url'),
            status=meta.get('status', 'ready'),
        )

    def list_documents(self, user_id: Optional[str] = None) -> list[DocumentListItem]:
        """Returns in-library documents. If user_id is given, only that user's docs."""
        docs = []
        if not settings.index_dir.exists():
            return []
        for index_path in settings.index_dir.iterdir():
            if not index_path.is_dir():
                continue
            meta_path = index_path / 'metadata.json'
            if not meta_path.exists():
                continue
            meta = json.loads(meta_path.read_text())
            if not meta.get('in_library', True):
                continue
            if user_id is not None and meta.get('user_id') and meta['user_id'] != user_id:
                continue
            docs.append(self._meta_to_item(index_path.name, meta))
        return sorted(docs, key=lambda d: d.indexed_at, reverse=True)

    def get_document_by_id(self, doc_id: str) -> Optional[DocumentListItem]:
        """Returns a document regardless of in_library status."""
        index_path = self.get_index_path(doc_id)
        if not index_path.exists():
            return None
        meta = self.load_metadata(doc_id)
        if not meta:
            return None
        return self._meta_to_item(doc_id, meta)

    # ── Delete ────────────────────────────────────────────────────────

    def delete_document(self, doc_id: str) -> None:
        """Permanently deletes the source file, metadata, and vector index."""
        import shutil
        from app.services.rag_service import rag_service

        src = self.get_source_file(doc_id)
        if src and src.exists():
            src.unlink()
        index_path = self.get_index_path(doc_id)
        if index_path.exists():
            shutil.rmtree(index_path)
        rag_service.delete_index(doc_id)