import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, SessionLocal


async def _cleanup_loop() -> None:
    """Delete unactivated accounts older than 10 days. Runs every hour."""
    while True:
        await asyncio.sleep(3600)
        try:
            from app.models.user import User
            cutoff = datetime.now(tz=timezone.utc) - timedelta(days=10)
            with SessionLocal() as db:
                count = (
                    db.query(User)
                    .filter(User.is_active == False, User.created_at < cutoff)  # noqa: E712
                    .delete(synchronize_session=False)
                )
                db.commit()
            if count:
                print(f"[cleanup] Deleted {count} unactivated account(s) older than 10 days")
        except Exception as exc:
            print(f"[cleanup] Error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="RAG Document Q&A API",
    description="API for querying documents via RAG",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.routes import documents, chat, auth, knowledge_bases  # noqa: E402

app.include_router(auth.router,            prefix="/api/v1")
app.include_router(documents.router,       prefix="/api/v1")
app.include_router(chat.router,            prefix="/api/v1")
app.include_router(knowledge_bases.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}