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
    chunk_size: int = 1000
    chunk_overlap: int = 200
    retriever_k: int = 4
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.0

    # Hybrid search weights (must sum to 1.0)
    bm25_weight: float = 0.4   # sparse  — exact keyword matching
    dense_weight: float = 0.6  # dense   — semantic similarity

    # JWT
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60 * 24 * 7  # 7 days

    # CORS
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.index_dir.mkdir(parents=True, exist_ok=True)
