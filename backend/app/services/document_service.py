import uuid
import aiofiles
from pathlib import Path
from datetime import datetime, timezone

from fastapi import UploadFile, HTTPException
from app.config import settings
from app.models.schemas import DocumentListItem


class DocumentService:
    """Manages PDF files on disk. Has no knowledge of LangChain."""

    async def save_upload(self, file: UploadFile) -> tuple[str, Path]:
        """Saves the uploaded file to disk. Returns (doc_id, path)."""
        if not file.filename.endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are accepted"
            )

        doc_id = str(uuid.uuid4())
        file_path = settings.upload_dir / f"{doc_id}.pdf"

        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)

        return doc_id, file_path

    def get_pdf_path(self, doc_id: str) -> Path:
        """Returns the PDF path or raises a 404."""
        path = settings.upload_dir / f"{doc_id}.pdf"
        if not path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Document {doc_id} not found"
            )
        return path

    def get_index_path(self, doc_id: str) -> Path:
        """Returns the FAISS index directory for this document."""
        return settings.index_dir / doc_id

    def list_documents(self) -> list[DocumentListItem]:
        """Lists all indexed documents."""
        docs = []
        for pdf_path in settings.upload_dir.glob("*.pdf"):
            doc_id = pdf_path.stem
            index_path = self.get_index_path(doc_id)
            if index_path.exists():
                stat = pdf_path.stat()
                docs.append(DocumentListItem(
                    doc_id=doc_id,
                    filename=pdf_path.name,
                    indexed_at=datetime.fromtimestamp(
                        stat.st_mtime, tz=timezone.utc
                    )
                ))
        return sorted(docs, key=lambda d: d.indexed_at, reverse=True)

    def delete_document(self, doc_id: str) -> None:
        """Deletes the PDF and its FAISS index."""
        import shutil

        pdf_path = settings.upload_dir / f"{doc_id}.pdf"
        index_path = self.get_index_path(doc_id)

        if pdf_path.exists():
            pdf_path.unlink()
        if index_path.exists():
            shutil.rmtree(index_path)
