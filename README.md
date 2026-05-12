# RAG Q&A

Chat with your documents and web sources in natural language. Upload files, import from the web, organize into Knowledge Bases, and get answers grounded in your content — with source references and streaming responses.

**Stack:** FastAPI · LangChain · FAISS · BM25 · OpenAI · React · TypeScript · Docker

---

## Features

- **Multi-format ingestion** — PDF, Word, PowerPoint, Excel, CSV, TXT, Markdown, HTML
- **Web sources** — scrape any public URL, Wikipedia articles, arXiv papers, RSS feeds
- **Knowledge Bases** — group documents into collections and chat across all of them at once
- **Hybrid retrieval** — BM25 + FAISS semantic search combined for better recall
- **Streaming chat** — answers stream token by token via Server-Sent Events
- **Conversational memory** — session history maintained per document / knowledge base
- **Auth** — JWT-based authentication (register / login)

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
┌─────────────────┐        ┌──────────────────────────────────────┐
│  React frontend │ :3000  │  FastAPI backend                :8000 │
│  (nginx)        │───────▶│                                      │
│                 │        │  ┌──────────┐   ┌────────────────┐   │
└─────────────────┘        │  │  FAISS   │   │   LangChain    │   │
                           │  │  index   │◀──│  RAG pipeline  │   │
                           │  └──────────┘   └───────┬────────┘   │
                           │  ┌──────────┐           │            │
                           │  │   BM25   │◀──────────┘            │
                           │  └──────────┘                        │
                           │  ┌──────────┐                        │
                           │  │ SQLite   │  users, knowledge bases │
                           │  └──────────┘                        │
                           └──────────────────────┬───────────────┘
                                                  │
                                            OpenAI API
                                     (embeddings + chat)
```

**Retrieval flow:** query → BM25 sparse retrieval + FAISS dense retrieval → EnsembleRetriever fusion → top-k chunks → LLM prompt + conversation history → streamed answer.

---

## API endpoints

### Documents
| Method   | Route                              | Description                          |
| -------- | ---------------------------------- | ------------------------------------ |
| `POST`   | `/api/v1/documents/`               | Upload and index a file              |
| `POST`   | `/api/v1/documents/from-url`       | Import from URL / Wikipedia / arXiv / RSS |
| `GET`    | `/api/v1/documents/`               | List all documents                   |
| `DELETE` | `/api/v1/documents/{id}`           | Delete a document                    |

### Chat
| Method   | Route                              | Description                          |
| -------- | ---------------------------------- | ------------------------------------ |
| `POST`   | `/api/v1/chat/stream`              | Streaming Q&A on a document (SSE)    |
| `POST`   | `/api/v1/chat/kb/stream`           | Streaming Q&A on a Knowledge Base    |
| `DELETE` | `/api/v1/chat/session/{sid}/{did}` | Clear a document session             |
| `DELETE` | `/api/v1/chat/kb/session/{kb}/{sid}` | Clear a KB session                 |

### Knowledge Bases
| Method   | Route                              | Description                          |
| -------- | ---------------------------------- | ------------------------------------ |
| `POST`   | `/api/v1/knowledge-bases/`         | Create a Knowledge Base              |
| `GET`    | `/api/v1/knowledge-bases/`         | List Knowledge Bases                 |
| `PATCH`  | `/api/v1/knowledge-bases/{id}`     | Rename / update a Knowledge Base     |
| `DELETE` | `/api/v1/knowledge-bases/{id}`     | Delete a Knowledge Base              |
| `POST`   | `/api/v1/knowledge-bases/{id}/docs` | Add a document to a KB             |
| `DELETE` | `/api/v1/knowledge-bases/{id}/docs/{doc_id}` | Remove a document from a KB |

### Auth
| Method   | Route                    | Description        |
| -------- | ------------------------ | ------------------ |
| `POST`   | `/api/v1/auth/register`  | Create an account  |
| `POST`   | `/api/v1/auth/login`     | Obtain a JWT token |

---

## Local development

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env   # then set OPENAI_API_KEY
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```

> Requires the backend running on port 8000 — Vite proxies `/api` requests automatically.

---

## Configuration

All RAG parameters can be tuned in `backend/app/config.py`:

| Parameter         | Default                  | Description                          |
| ----------------- | ------------------------ | ------------------------------------ |
| `chunk_size`      | 1000                     | Characters per chunk                 |
| `chunk_overlap`   | 200                      | Overlap between chunks               |
| `retriever_k`     | 4                        | Chunks retrieved per query           |
| `bm25_weight`     | 0.5                      | Weight of BM25 in hybrid retrieval   |
| `dense_weight`    | 0.5                      | Weight of FAISS in hybrid retrieval  |
| `embedding_model` | `text-embedding-3-small` | OpenAI embedding model               |
| `llm_model`       | `gpt-4o-mini`            | OpenAI chat model                    |