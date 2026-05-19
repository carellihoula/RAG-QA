from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # API keys
    openai_api_key: str

    # Storage paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    upload_dir: Path = base_dir / "data" / "uploads"
    index_dir: Path = base_dir / "data" / "indexes"

    # RAG parameters
    chunk_size: int = 1500
    chunk_overlap: int = 150
    retriever_k: int = 4
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.0

    # Hybrid search weights (must sum to 1.0)
    bm25_weight: float = 0.4   # sparse  — exact keyword matching
    dense_weight: float = 0.6  # dense   — semantic similarity

    # Database (defaults to local SQLite for dev)
    database_url: str = ""

    # PGVector (used for document embeddings) — set via PGVECTOR_URL in .env
    pgvector_url: str = ""

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15          # short-lived access token
    refresh_token_expire_days: int = 30            # long-lived refresh token
    reset_token_expire_hours: int = 1              # password reset window
    # Keep legacy alias so existing code still works
    jwt_expiry_minutes: int = 15

    # Email / SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_from_name: str = "RAG Q&A"

    # Base URL of the frontend (used in email links)
    frontend_url: str = "http://localhost:3000"

    # AWS S3
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "eu-west-3"
    s3_bucket: str = ""

    # Stripe
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""   # Price ID from Stripe dashboard (price_xxx)

    # Plan limits
    free_doc_limit: int = 5
    pro_doc_limit: int = 100

    # CORS — add your production domain via ALLOWED_ORIGINS env var (comma-separated)
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    extra_origins: str = ""  # e.g. "https://yourdomain.com,https://www.yourdomain.com"

    @property
    def cors_origins(self) -> list[str]:
        extra = [o.strip() for o in self.extra_origins.split(",") if o.strip()]
        return self.allowed_origins + extra

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.index_dir.mkdir(parents=True, exist_ok=True)
