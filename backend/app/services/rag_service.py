from pathlib import Path
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import psycopg

from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_postgres.vectorstores import PGVector
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers.merger_retriever import MergerRetriever
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.documents import Document

from app.config import settings
from app.models.schemas import DocumentResponse, ChatResponse, SourceChunk


class RAGService:
    """Indexes documents and answers questions via RAG (streaming + non-streaming)."""

    def __init__(self):
        self._embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key,
        )
        self._chains: dict[str, ConversationalRetrievalChain] = {}
        self._histories: dict[str, list] = {}
        self._retrievers: dict[str, EnsembleRetriever] = {}

    # ── Helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _psycopg_url() -> str:
        """Strip SQLAlchemy dialect prefix for raw psycopg connections."""
        return settings.pgvector_url.replace("postgresql+psycopg://", "postgresql://")

    def _get_vectorstore(self, collection_name: str) -> PGVector:
        return PGVector(
            embeddings=self._embeddings,
            collection_name=collection_name,
            connection=settings.pgvector_url,
            use_jsonb=True,
        )

    def _get_all_docs(self, collection_name: str) -> list[Document]:
        """Fetches every chunk stored in a PGVector collection."""
        with psycopg.connect(self._psycopg_url()) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT lpe.document, lpe.cmetadata
                    FROM langchain_pg_embedding lpe
                    JOIN langchain_pg_collection lpc ON lpe.collection_id = lpc.uuid
                    WHERE lpc.name = %s
                    """,
                    (collection_name,),
                )
                rows = cur.fetchall()
        return [Document(page_content=row[0], metadata=row[1] or {}) for row in rows]

    # ── Indexing ──────────────────────────────────────────────────────

    async def index_from_docs(self, doc_id: str, docs: list, filename: str, source_type: str = 'pdf') -> DocumentResponse:
        """Pipeline: pre-loaded LangChain documents → chunks → PGVector (async)."""
        from app.services.chunking_service import chunking_service

        page_count = len(docs)
        chunks = chunking_service.chunk(docs, source_type)
        chunk_count = len(chunks)

        await PGVector.afrom_documents(
            documents=chunks,
            embedding=self._embeddings,
            collection_name=doc_id,
            connection=settings.pgvector_url,
            use_jsonb=True,
            pre_delete_collection=True,
        )

        return DocumentResponse(
            doc_id=doc_id,
            filename=filename,
            page_count=page_count,
            chunk_count=chunk_count,
            indexed_at=datetime.now(tz=timezone.utc),
        )

    def index_document(self, doc_id: str, pdf_path: Path, filename: str) -> DocumentResponse:
        loader = PyPDFLoader(str(pdf_path))
        pages = loader.load()
        return self.index_from_docs(doc_id, pages, filename)

    def delete_index(self, doc_id: str) -> None:
        """Drops the PGVector collection for a document and clears in-memory caches."""
        try:
            self._get_vectorstore(doc_id).delete_collection()
        except Exception:
            pass
        self._retrievers.pop(doc_id, None)

    # ── AI title generation ───────────────────────────────────────────

    async def generate_title(self, doc_id: str) -> str:
        sample_docs = self._get_all_docs(doc_id)[:4]
        context = "\n\n".join(doc.page_content[:400] for doc in sample_docs)

        llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=0.3,
            openai_api_key=settings.openai_api_key,
        )
        messages = [
            SystemMessage(content=(
                "You are a document title generator. "
                "Given a short extract from a document, respond with ONLY a concise, "
                "descriptive title (5-10 words). No quotes, no punctuation at the end, "
                "no explanation — just the title."
            )),
            HumanMessage(content=f"Document extract:\n\n{context}"),
        ]
        response = await llm.ainvoke(messages)
        return response.content.strip()

    # ── Hybrid retriever ──────────────────────────────────────────────

    def _get_hybrid_retriever(self, doc_id: str) -> EnsembleRetriever:
        """Builds (and caches) a BM25 + PGVector ensemble retriever for a document."""
        if doc_id not in self._retrievers:
            vectorstore = self._get_vectorstore(doc_id)
            dense = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": settings.retriever_k},
            )
            all_docs = self._get_all_docs(doc_id)
            if not all_docs:
                raise ValueError(
                    "Document has no indexed content — please delete and re-upload it."
                )
            sparse = BM25Retriever.from_documents(all_docs, k=settings.retriever_k)
            self._retrievers[doc_id] = EnsembleRetriever(
                retrievers=[sparse, dense],
                weights=[settings.bm25_weight, settings.dense_weight],
            )
        return self._retrievers[doc_id]

    # ── Legacy chat (non-streaming, kept for compatibility) ───────────

    def get_or_create_chain(self, doc_id: str, session_id: str) -> ConversationalRetrievalChain:
        cache_key = f"{doc_id}:{session_id}"
        if cache_key not in self._chains:
            retriever = self._get_hybrid_retriever(doc_id)
            llm = ChatOpenAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                openai_api_key=settings.openai_api_key,
                streaming=False,
            )
            memory = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                output_key="answer",
            )
            self._chains[cache_key] = ConversationalRetrievalChain.from_llm(
                llm=llm,
                retriever=retriever,
                memory=memory,
                return_source_documents=True,
                verbose=False,
            )
        return self._chains[cache_key]

    def ask(self, doc_id: str, question: str, session_id: str) -> ChatResponse:
        chain = self.get_or_create_chain(doc_id, session_id)
        result = chain.invoke({"question": question})
        seen_pages: set[int] = set()
        sources = []
        for doc in result["source_documents"]:
            page = doc.metadata.get("page", 0) + 1
            if page not in seen_pages:
                seen_pages.add(page)
                sources.append(SourceChunk(page=page, content=doc.page_content[:300]))
        return ChatResponse(answer=result["answer"], sources=sources, session_id=session_id)

    # ── Streaming chat ────────────────────────────────────────────────

    def retrieve_context(self, doc_id: str, question: str) -> tuple[list, str]:
        retriever = self._get_hybrid_retriever(doc_id)
        docs = retriever.invoke(question)
        parts = [
            f"[Page {doc.metadata.get('page', 0) + 1}]\n{doc.page_content}"
            for doc in docs
        ]
        return docs, "\n\n---\n\n".join(parts)

    async def stream_answer(
        self,
        doc_id: str,
        question: str,
        session_id: str,
        context: str,
    ) -> AsyncGenerator[str, None]:
        cache_key = f"{doc_id}:{session_id}"
        history = self._histories.get(cache_key, [])

        messages = [
            SystemMessage(
                content=(
                    "You are a helpful assistant. Answer the user's question based solely "
                    "on the context below. Be concise and accurate. "
                    "If the answer is not in the context, say so clearly.\n\n"
                    f"Context:\n{context}"
                )
            ),
            *history,
            HumanMessage(content=question),
        ]

        llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            openai_api_key=settings.openai_api_key,
            streaming=True,
        )

        full_answer = ""
        async for chunk in llm.astream(messages):
            token: str = chunk.content  # type: ignore[assignment]
            if token:
                full_answer += token
                yield token

        self._histories[cache_key] = history + [
            HumanMessage(content=question),
            AIMessage(content=full_answer),
        ]

    @staticmethod
    def extract_sources(docs: list) -> list[dict]:
        seen: set[int] = set()
        sources = []
        for doc in docs:
            page = doc.metadata.get("page", 0) + 1
            if page not in seen:
                seen.add(page)
                sources.append({"page": page, "content": doc.page_content[:300]})
        return sources

    # ── Chunks & session ──────────────────────────────────────────────

    def get_chunks(self, doc_id: str) -> list[dict]:
        chunks = [
            {"page": doc.metadata.get("page", 0) + 1, "content": doc.page_content}
            for doc in self._get_all_docs(doc_id)
        ]
        return sorted(chunks, key=lambda c: c["page"])

    def load_history(self, cache_key: str, messages: list[dict]) -> None:
        if cache_key not in self._histories:
            self._histories[cache_key] = [
                HumanMessage(content=m["content"]) if m["role"] == "user"
                else AIMessage(content=m["content"])
                for m in messages
            ]

    def clear_session(self, session_id: str, doc_id: str) -> None:
        cache_key = f"{doc_id}:{session_id}"
        self._chains.pop(cache_key, None)
        self._histories.pop(cache_key, None)

    # ── Knowledge Base retrieval ───────────────────────────────────────

    def get_kb_retriever(self, doc_ids: list[str]):
        retrievers = []
        for doc_id in doc_ids:
            try:
                retrievers.append(self._get_hybrid_retriever(doc_id))
            except Exception:
                continue
        if not retrievers:
            raise ValueError("No valid documents found in this knowledge base")
        if len(retrievers) == 1:
            return retrievers[0]
        return MergerRetriever(retrievers=retrievers)

    def retrieve_kb_context(self, doc_ids: list[str], question: str) -> tuple[list, str]:
        retriever = self.get_kb_retriever(doc_ids)
        docs = retriever.invoke(question)
        parts = [
            f"[Page {doc.metadata.get('page', 0) + 1}]\n{doc.page_content}"
            for doc in docs
        ]
        return docs, "\n\n---\n\n".join(parts)

    async def stream_kb_answer(
        self,
        kb_id: str,
        question: str,
        session_id: str,
        context: str,
        system_prompt: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        cache_key = f"kb:{kb_id}:{session_id}"
        history = self._histories.get(cache_key, [])

        base = (
            system_prompt.rstrip()
            if system_prompt
            else (
                "You are a helpful assistant. Answer the user's question based solely "
                "on the context below. Be concise and accurate. "
                "If the answer is not in the context, say so clearly."
            )
        )
        messages = [
            SystemMessage(content=f"{base}\n\nContext:\n{context}"),
            *history,
            HumanMessage(content=question),
        ]

        llm = ChatOpenAI(
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            openai_api_key=settings.openai_api_key,
            streaming=True,
        )

        full_answer = ""
        async for chunk in llm.astream(messages):
            token: str = chunk.content  # type: ignore[assignment]
            if token:
                full_answer += token
                yield token

        self._histories[cache_key] = history + [
            HumanMessage(content=question),
            AIMessage(content=full_answer),
        ]

    def clear_kb_session(self, kb_id: str, session_id: str) -> None:
        self._histories.pop(f"kb:{kb_id}:{session_id}", None)


rag_service = RAGService()