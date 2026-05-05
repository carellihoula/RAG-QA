import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.document_service import DocumentService
from app.services.rag_service import rag_service
from app.models.schemas import DocumentResponse, DocumentListItem

router = APIRouter(prefix="/documents", tags=["documents"])
doc_service = DocumentService()


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(file: UploadFile = File(...)):
    """Uploads a PDF and triggers RAG indexing."""
    doc_id, pdf_path = await doc_service.save_upload(file)

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            rag_service.index_document,
            doc_id,
            pdf_path,
            file.filename
        )
    except Exception as e:
        pdf_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Indexing error: {str(e)}")

    return response


@router.get("/", response_model=list[DocumentListItem])
def list_documents():
    """Returns the list of all indexed documents."""
    return doc_service.list_documents()


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str):
    """Deletes a document and its FAISS index."""
    doc_service.get_pdf_path(doc_id)
    doc_service.delete_document(doc_id)
