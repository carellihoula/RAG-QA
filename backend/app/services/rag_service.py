from pathlib import Path
from datetime import datetime, timezone

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory

from app.config import settings
from app.models.schemas import DocumentResponse, ChatResponse, SourceChunk


class RAGService:
    """Indexes PDFs and answers questions via RAG."""

    def __init__(self):
        self._embeddings = OpenAIEmbeddings(
            model=settings.embedding_model,
            openai_api_key=settings.openai_api_key
        )
        # Active chain cache: {session_id: chain}
        # In production, replace with Redis
        self._chains: dict[str, ConversationalRetrievalChain] = {}

    # ── Indexing ──────────────────────────────────────────────────────

    def index_document(
        self,
        doc_id: str,
        pdf_path: Path,
        filename: str
    ) -> DocumentResponse:
        """Full pipeline: PDF → chunks → embeddings → FAISS on disk."""
        loader = PyPDFLoader(str(pdf_path))
        pages = loader.load()
        page_count = len(pages)

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_documents(pages)
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
            indexed_at=datetime.now(tz=timezone.utc)
        )

    def _load_vectorstore(self, doc_id: str) -> FAISS:
        """Loads a FAISS index from disk."""
        index_path = settings.index_dir / doc_id
        if not index_path.exists():
            raise ValueError(f"FAISS index not found for doc_id={doc_id}")

        return FAISS.load_local(
            str(index_path),
            self._embeddings,
            allow_dangerous_deserialization=True
        )

    # ── Chat ──────────────────────────────────────────────────────────

    def get_or_create_chain(
        self,
        doc_id: str,
        session_id: str
    ) -> ConversationalRetrievalChain:
        """Returns the existing chain or creates a new one."""
        cache_key = f"{doc_id}:{session_id}"

        if cache_key not in self._chains:
            vectorstore = self._load_vectorstore(doc_id)

            retriever = vectorstore.as_retriever(
                search_type="similarity",
                search_kwargs={"k": settings.retriever_k}
            )

            llm = ChatOpenAI(
                model=settings.llm_model,
                temperature=settings.llm_temperature,
                openai_api_key=settings.openai_api_key,
                streaming=False
            )

            memory = ConversationBufferMemory(
                memory_key="chat_history",
                return_messages=True,
                output_key="answer"
            )

            self._chains[cache_key] = ConversationalRetrievalChain.from_llm(
                llm=llm,
                retriever=retriever,
                memory=memory,
                return_source_documents=True,
                verbose=False
            )

        return self._chains[cache_key]

    def ask(
        self,
        doc_id: str,
        question: str,
        session_id: str
    ) -> ChatResponse:
        """Asks a question and returns the answer and sources."""
        chain = self.get_or_create_chain(doc_id, session_id)
        result = chain.invoke({"question": question})

        seen_pages: set[int] = set()
        sources = []
        for doc in result["source_documents"]:
            page = doc.metadata.get("page", 0) + 1
            if page not in seen_pages:
                seen_pages.add(page)
                sources.append(SourceChunk(
                    page=page,
                    content=doc.page_content[:300]
                ))

        return ChatResponse(
            answer=result["answer"],
            sources=sources,
            session_id=session_id
        )

    def clear_session(self, session_id: str, doc_id: str) -> None:
        """Clears the memory of a session."""
        cache_key = f"{doc_id}:{session_id}"
        self._chains.pop(cache_key, None)


# Shared singleton via FastAPI dependency injection
rag_service = RAGService()
