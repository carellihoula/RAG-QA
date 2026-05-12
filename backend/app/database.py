from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import settings

engine = create_engine(
    f"sqlite:///{settings.base_dir}/data/users.db",
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models.user import User  # noqa: F401
    from app.models.knowledge_base import KnowledgeBase, KBDocument  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _migrate_db()


def _migrate_db():
    """Add missing columns to users table. Uses PRAGMA to skip already-present columns."""
    needed = [
        ("display_name",          "VARCHAR"),
        ("is_active",             "BOOLEAN NOT NULL DEFAULT 1"),
        ("created_at",            "DATETIME DEFAULT (datetime('now'))"),
        ("activation_token",      "VARCHAR"),
        ("reset_token",           "VARCHAR"),
        ("reset_token_expires",   "DATETIME"),
        ("refresh_token_hash",    "VARCHAR"),
        ("refresh_token_expires", "DATETIME"),
    ]
    with engine.connect() as conn:
        existing = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
        }
        for col, typedef in needed:
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typedef}"))
                conn.commit()
                print(f"[migrate] Added column users.{col}")