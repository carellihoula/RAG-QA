import uuid
import asyncio
from fastapi import APIRouter, HTTPException
from app.services.rag_service import rag_service
from app.services.document_service import DocumentService
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])
doc_service = DocumentService()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Asks a question about an indexed document."""
    doc_service.get_pdf_path(request.doc_id)

    session_id = request.session_id or str(uuid.uuid4())

    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None,
            rag_service.ask,
            request.doc_id,
            request.question,
            session_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")

    return response


@router.delete("/session/{session_id}/{doc_id}", status_code=204)
def clear_session(session_id: str, doc_id: str):
    """Resets the conversational memory of a session."""
    rag_service.clear_session(session_id, doc_id)
