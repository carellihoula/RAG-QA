import asyncio
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.services.document_service import DocumentService
from app.services.rag_service import rag_service
from app.services.auth_service import get_current_user
from app.models.schemas import DocumentResponse, DocumentListItem, ChunkItem

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(get_current_user)])
doc_service = DocumentService()


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(file: UploadFile = File(...)):
    """Uploads a PDF, indexes it, then generates an AI title."""
    doc_id, pdf_path = await doc_service.save_upload(file)

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None, rag_service.index_document, doc_id, pdf_path, file.filename
        )
    except Exception as e:
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Indexing error: {str(e)}")

    try:
        title = await rag_service.generate_title(doc_id)
    except Exception:
        title = None  # graceful fallback — filename is still displayed

    doc_service.save_metadata(doc_id, file.filename, title, response.indexed_at)

    return response.model_copy(update={"title": title})


@router.get("/", response_model=list[DocumentListItem])
def list_documents():
    """Returns the list of all indexed documents."""
    return doc_service.list_documents()


@router.get("/{doc_id}/chunks", response_model=list[ChunkItem])
def get_document_chunks(doc_id: str):
    """Returns all indexed chunks for a document."""
    doc_service.get_pdf_path(doc_id)
    try:
        return rag_service.get_chunks(doc_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    """Deletes a document and its FAISS index."""
    doc_service.get_pdf_path(doc_id)
    doc_service.delete_document(doc_id)
