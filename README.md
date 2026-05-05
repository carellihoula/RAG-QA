# RAG Document Q&A

Chat with your PDF documents in natural language. Upload a PDF, ask questions, and get answers grounded in the document's content — with source references.

**Stack:** FastAPI · LangChain · FAISS · OpenAI · React · Docker

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [OpenAI API key](https://platform.openai.com/api-keys)

---

## Quick start

```bash
# 1. Set up environment variables
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# 2. Start the app
docker compose up --build

# 3. Open in your browser
# Frontend : http://localhost:3000
# API docs : http://localhost:8000/docs
```

---

## Architecture

```
┌─────────────────┐        ┌──────────────────────────────────┐
│  React frontend │ :3000  │  FastAPI backend            :8000 │
│  (nginx)        │───────▶│                                   │
│                 │        │  ┌─────────┐   ┌──────────────┐  │
└─────────────────┘        │  │  FAISS  │   │  LangChain   │  │
                           │  │  index  │◀──│  RAG chain   │  │
                           │  └─────────┘   └──────┬───────┘  │
                           │                       │           │
                           └───────────────────────┼───────────┘
                                                   │
                                             OpenAI API
                                      (embeddings + chat)
```

**Flow:** PDF upload → text extraction → chunking → OpenAI embeddings → FAISS index. On each question, the top-k relevant chunks are retrieved and injected into the LLM prompt alongside the conversation history.

---

## API endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/v1/documents/` | Upload and index a PDF |
| `GET` | `/api/v1/documents/` | List all indexed documents |
| `DELETE` | `/api/v1/documents/{id}` | Delete a document and its index |
| `POST` | `/api/v1/chat/` | Ask a question about a document |
| `DELETE` | `/api/v1/chat/session/{sid}/{did}` | Clear a conversation session |

---

## Local development (backend only)

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # then set OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

## Local development (frontend only)

```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```

> Requires the backend to be running on port 8000 (Vite proxies `/api` requests automatically).

---

## Configuration

All RAG parameters can be tuned in `backend/app/config.py`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `chunk_size` | 1000 | Characters per chunk |
| `chunk_overlap` | 200 | Overlap between chunks |
| `retriever_k` | 4 | Number of chunks retrieved per query |
| `embedding_model` | `text-embedding-3-small` | OpenAI embedding model |
| `llm_model` | `gpt-4o-mini` | OpenAI chat model |
