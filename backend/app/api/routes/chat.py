import uuid
import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.services.rag_service import rag_service
from app.services.document_service import DocumentService
from app.services.auth_service import get_current_user
from app.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(get_current_user)])
doc_service = DocumentService()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Non-streaming endpoint (kept for compatibility)."""
    doc_service.get_pdf_path(request.doc_id)
    session_id = request.session_id or str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    try:
        response = await loop.run_in_executor(
            None, rag_service.ask, request.doc_id, request.question, session_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG error: {str(e)}")
    return response


@router.post("/stream")
async def chat_stream(request: ChatRequest):
    """
    Streaming endpoint via Server-Sent Events.
    Emits:
      data: {"type":"token","content":"..."}   — one per LLM token
      data: {"type":"sources","sources":[...],"session_id":"..."}
      data: [DONE]
    """
    doc_service.get_pdf_path(request.doc_id)
    session_id = request.session_id or str(uuid.uuid4())

    async def generate():
        # Phase 1 — retrieve relevant chunks (blocking, run in thread)
        try:
            loop = asyncio.get_event_loop()
            docs, context = await loop.run_in_executor(
                None,
                rag_service.retrieve_context,
                request.doc_id,
                request.question,
            )
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Retrieval error: {str(e)}'})}\n\n"
            return

        # Phase 2 — stream LLM tokens
        try:
            async for token in rag_service.stream_answer(
                request.doc_id, request.question, session_id, context
            ):
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Stream error: {str(e)}'})}\n\n"
            return

        # Phase 3 — send sources then close
        sources = rag_service.extract_sources(docs)
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'session_id': session_id})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.delete("/session/{session_id}/{doc_id}", status_code=204)
def clear_session(session_id: str, doc_id: str):
    """Resets the conversational memory of a session."""
    rag_service.clear_session(session_id, doc_id)