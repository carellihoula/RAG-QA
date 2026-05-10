from pathlib import Path
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain.retrievers import EnsembleRetriever
from langchain.retrievers.merger_retriever import MergerRetriever
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from app.config import settings
from app.models.schemas import DocumentResponse, ChatResponse, SourceChunk


class RAGService:
    """Indexes PDFs and answers questions via RAG (streaming + non-streaming)."""

    def __init__(self):
        self._embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key,
        )
        # Legacy non-streaming chains cache
        self._chains: dict[str, ConversationalRetrievalChain] = {}
        # Streaming conversation history: {cache_key: [HumanMessage|AIMessage, ...]}
        self._histories: dict[str, list] = {}
        # Hybrid retriever cache: {doc_id: EnsembleRetriever}
        self._retrievers: dict[str, EnsembleRetriever] = {}

    # ── Indexing ──────────────────────────────────────────────────────

    def index_from_docs(self, doc_id: str, docs: list, filename: str) -> DocumentResponse:
        """Pipeline: pre-loaded LangChain documents → chunks → FAISS on disk."""
        page_count = len(docs)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", " ", ""],
        )
        chunks = splitter.split_documents(docs)
        chunk_count = len(chunks)

        vectorstore = FAISS.from_documents(chunks, self._embeddings)

        index_path = settings.index_dir / doc_id
        index_path.mkdir(parents=True, exist_ok=True)
        vectorstore.save_local(str(index_path))

        return DocumentResponse(
            doc_id=doc_id,
            filename=filename,
            page_count=page_count,
            chunk_count=chunk_count,
            indexed_at=datetime.now(tz=timezone.utc),
        )

    def index_document(self, doc_id: str, pdf_path: Path, filename: str) -> DocumentResponse:
        """Backward-compat: loads a PDF then calls index_from_docs."""
        loader = PyPDFLoader(str(pdf_path))
        pages = loader.load()
        return self.index_from_docs(doc_id, pages, filename)

    def _load_vectorstore(self, doc_id: str) -> FAISS:
        """Loads a FAISS index from disk."""
        index_path = settings.index_dir / doc_id
        if not index_path.exists():
            raise ValueError(f"FAISS index not found for doc_id={doc_id}")
        return FAISS.load_local(
            str(index_path), self._embeddings, allow_dangerous_deserialization=True
        )

    # ── AI title generation ───────────────────────────────────────────

    async def generate_title(self, doc_id: str) -> str:
        """Asks the LLM to produce a short descriptive title for the document."""
        vectorstore = self._load_vectorstore(doc_id)
        sample_docs = list(vectorstore.docstore._dict.values())[:4]
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
        """Builds (and caches) a BM25 + FAISS ensemble retriever for a document."""
        if doc_id not in self._retrievers:
            vectorstore = self._load_vectorstore(doc_id)
            dense = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": settings.retriever_k},
            )
            all_docs = list(vectorstore.docstore._dict.values())
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
        """Retrieves relevant chunks and builds the context string. Run in executor."""
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
        """Async generator: yields LLM tokens one by one, then persists the turn."""
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
        vectorstore = self._load_vectorstore(doc_id)
        chunks = [
            {"page": doc.metadata.get("page", 0) + 1, "content": doc.page_content}
            for doc in vectorstore.docstore._dict.values()
        ]
        return sorted(chunks, key=lambda c: c["page"])

    def clear_session(self, session_id: str, doc_id: str) -> None:
        cache_key = f"{doc_id}:{session_id}"
        self._chains.pop(cache_key, None)
        self._histories.pop(cache_key, None)

    # ── Knowledge Base retrieval ───────────────────────────────────────

    def get_kb_retriever(self, doc_ids: list[str]):
        """Merged hybrid retriever across all documents of a Knowledge Base."""
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