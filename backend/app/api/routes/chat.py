import uuid
import json
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.services.rag_service import rag_service
from app.services.document_service import DocumentService
from app.services.auth_service import get_current_user
from app.database import get_db, SessionLocal
from app.models.user import User
from app.models.knowledge_base import KnowledgeBase
from app.models.conversation import Conversation, ConversationMessage
from app.models.schemas import ChatRequest, ChatResponse, KBChatRequest

router = APIRouter(prefix="/chat", tags=["chat"])
doc_service = DocumentService()

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _persist_exchange(
    conv_id: str,
    user_id: str,
    question: str,
    answer: str,
    sources: list,
    doc_id: str | None = None,
    kb_id: str | None = None,
) -> None:
    """Save a Q&A pair to the conversations table. Opens its own session."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        conv = db.query(Conversation).filter_by(id=conv_id).first()
        if not conv:
            conv = Conversation(
                id=conv_id,
                user_id=user_id,
                doc_id=doc_id,
                kb_id=kb_id,
                title=question[:120],
                created_at=now,
                updated_at=now,
            )
            db.add(conv)
            db.flush()
        else:
            conv.updated_at = now
        db.add(ConversationMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            role="user",
            content=question,
            created_at=now,
        ))
        db.add(ConversationMessage(
            id=str(uuid.uuid4()),
            conversation_id=conv_id,
            role="assistant",
            content=answer,
            sources=json.dumps(sources) if sources else None,
            created_at=now,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[chat] Failed to persist exchange: {exc}")
    finally:
        db.close()


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """Non-streaming endpoint (kept for compatibility)."""
    doc_service.require_doc(request.doc_id, user_id=str(current_user.id))
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
async def chat_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Streaming endpoint via Server-Sent Events.
    Emits:
      data: {"type":"token","content":"..."}   — one per LLM token
      data: {"type":"sources","sources":[...],"session_id":"...","conversation_id":"..."}
      data: [DONE]
    """
    doc_service.require_doc(request.doc_id, user_id=str(current_user.id))
    conv_id = request.conversation_id or request.session_id or str(uuid.uuid4())
    cache_key = f"{request.doc_id}:{conv_id}"
    user_id = str(current_user.id)

    # Restore in-memory history from DB when session cache is cold (e.g. after restart)
    if cache_key not in rag_service._histories:
        past = (
            db.query(ConversationMessage)
            .join(Conversation)
            .filter(
                Conversation.id == conv_id,
                Conversation.user_id == user_id,
            )
            .order_by(ConversationMessage.created_at)
            .all()
        )
        if past:
            rag_service.load_history(cache_key, [
                {"role": m.role, "content": m.content} for m in past
            ])

    doc_id = request.doc_id
    question = request.question

    async def generate():
        # Phase 1 — retrieve relevant chunks (blocking, run in thread)
        try:
            loop = asyncio.get_event_loop()
            docs, context = await loop.run_in_executor(
                None, rag_service.retrieve_context, doc_id, question
            )
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Retrieval error: {str(e)}'})}\n\n"
            return

        # Phase 2 — stream LLM tokens, collect full answer
        full_answer = ""
        try:
            async for token in rag_service.stream_answer(doc_id, question, conv_id, context):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Stream error: {str(e)}'})}\n\n"
            return

        # Phase 3 — persist Q&A pair, then send sources and close
        sources = rag_service.extract_sources(docs)
        _persist_exchange(conv_id, user_id, question, full_answer, sources, doc_id=doc_id)
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'session_id': conv_id, 'conversation_id': conv_id})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.delete("/session/{session_id}/{doc_id}", status_code=204)
def clear_session(session_id: str, doc_id: str):
    """Resets the conversational memory of a session."""
    rag_service.clear_session(session_id, doc_id)


# ── Knowledge Base streaming chat ─────────────────────────────────────────────

@router.post("/kb/stream")
async def kb_chat_stream(
    request: KBChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stream a RAG answer across all documents in a Knowledge Base."""
    kb = db.query(KnowledgeBase).filter_by(
        id=uuid.UUID(request.kb_id), user_id=current_user.id
    ).first()
    if not kb:
        raise HTTPException(status_code=404, detail="Knowledge base not found")

    doc_ids = [link.doc_id for link in kb.doc_links]
    if not doc_ids:
        raise HTTPException(status_code=400, detail="This knowledge base has no documents yet")

    conv_id = request.conversation_id or request.session_id or str(uuid.uuid4())
    cache_key = f"kb:{request.kb_id}:{conv_id}"
    user_id = str(current_user.id)
    kb_id = request.kb_id
    question = request.question
    system_prompt = kb.system_prompt

    # Restore in-memory history from DB when session cache is cold
    if cache_key not in rag_service._histories:
        past = (
            db.query(ConversationMessage)
            .join(Conversation)
            .filter(
                Conversation.id == conv_id,
                Conversation.user_id == user_id,
            )
            .order_by(ConversationMessage.created_at)
            .all()
        )
        if past:
            rag_service.load_history(cache_key, [
                {"role": m.role, "content": m.content} for m in past
            ])

    async def generate():
        try:
            loop = asyncio.get_event_loop()
            docs, context = await loop.run_in_executor(
                None, rag_service.retrieve_kb_context, doc_ids, question
            )
        except ValueError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Retrieval error: {str(e)}'})}\n\n"
            return

        full_answer = ""
        try:
            async for token in rag_service.stream_kb_answer(kb_id, question, conv_id, context, system_prompt):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Stream error: {str(e)}'})}\n\n"
            return

        sources = rag_service.extract_sources(docs)
        _persist_exchange(conv_id, user_id, question, full_answer, sources, kb_id=kb_id)
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'session_id': conv_id, 'conversation_id': conv_id})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.delete("/kb/session/{kb_id}/{session_id}", status_code=204)
def clear_kb_session(kb_id: str, session_id: str):
    rag_service.clear_kb_session(kb_id, session_id)