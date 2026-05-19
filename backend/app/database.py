from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────

def _make_engine():
    url = settings.database_url
    if url and url.startswith("postgresql"):
        return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)
    # Fallback to SQLite for local dev
    sqlite_url = f"sqlite:///{settings.base_dir}/data/users.db"
    return create_engine(sqlite_url, connect_args={"check_same_thread": False})

engine = _make_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

_IS_PG = engine.dialect.name == "postgresql"

# ── Base ──────────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Init & migrations ─────────────────────────────────────────────────────────

def init_db():
    from app.models.user import User  # noqa: F401
    from app.models.knowledge_base import KnowledgeBase, KBDocument  # noqa: F401
    from app.models.conversation import Conversation, ConversationMessage  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def _migrate_db():
    """Add missing columns to existing tables — works with SQLite and PostgreSQL."""

    # Column definitions: (name, sqlite_type, pg_type)
    user_columns = [
        ("display_name",           "VARCHAR",                          "VARCHAR"),
        ("is_active",              "BOOLEAN NOT NULL DEFAULT 1",       "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("created_at",             "DATETIME DEFAULT (datetime('now'))","TIMESTAMP WITH TIME ZONE DEFAULT NOW()"),
        ("activation_token",       "VARCHAR",                          "VARCHAR"),
        ("reset_token",            "VARCHAR",                          "VARCHAR"),
        ("reset_token_expires",    "DATETIME",                         "TIMESTAMP WITH TIME ZONE"),
        ("refresh_token_hash",     "VARCHAR",                          "VARCHAR"),
        ("refresh_token_expires",  "DATETIME",                         "TIMESTAMP WITH TIME ZONE"),
        ("plan",                   "VARCHAR NOT NULL DEFAULT 'free'",  "VARCHAR NOT NULL DEFAULT 'free'"),
        ("stripe_customer_id",     "VARCHAR",                          "VARCHAR"),
        ("stripe_subscription_id", "VARCHAR",                          "VARCHAR"),
        ("is_admin",               "BOOLEAN NOT NULL DEFAULT 0",       "BOOLEAN NOT NULL DEFAULT FALSE"),
    ]

    with engine.connect() as conn:
        if _IS_PG:
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = 'users' AND table_schema = 'public'"
            ))
            existing = {row[0] for row in result.fetchall()}
        else:
            existing = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
            }

        for col, sqlite_def, pg_def in user_columns:
            if col not in existing:
                typedef = pg_def if _IS_PG else sqlite_def
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
                conn.commit()
                print(f"[migrate] Added column users.{col}")
