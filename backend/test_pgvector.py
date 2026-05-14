"""Quick sanity check — run with: python test_pgvector.py"""
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path="../.env")

PGVECTOR_URL = os.getenv("PGVECTOR_URL", "")
if not PGVECTOR_URL:
    print("❌  PGVECTOR_URL not set in .env")
    raise SystemExit(1)

print("1. Testing raw psycopg connection...")
import psycopg
raw_url = PGVECTOR_URL.replace("postgresql+psycopg://", "postgresql://")
with psycopg.connect(raw_url) as conn:
    row = conn.execute("SELECT version()").fetchone()
    print(f"   ✅  Connected — {row[0][:40]}")
    row = conn.execute("SELECT installed_version FROM pg_available_extensions WHERE name = 'vector'").fetchone()
    if row and row[0]:
        print(f"   ✅  pgvector extension installed (v{row[0]})")
    else:
        print("   ❌  pgvector extension NOT found — enable it in Supabase Dashboard > Database > Extensions")
        raise SystemExit(1)

print("2. Testing LangChain PGVector write + search...")
from langchain_openai import OpenAIEmbeddings
from langchain_postgres.vectorstores import PGVector
from langchain_core.documents import Document

embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=os.getenv("OPENAI_API_KEY"),
)

vs = PGVector.from_documents(
    documents=[Document(page_content="pgvector test document", metadata={"page": 1})],
    embedding=embeddings,
    collection_name="_test_collection",
    connection=PGVECTOR_URL,
    use_jsonb=True,
    pre_delete_collection=True,
)
results = vs.similarity_search("test", k=1)
assert results and "test" in results[0].page_content.lower()
print("   ✅  Write + similarity search OK")

vs.delete_collection()
print("   ✅  Cleanup OK")

print("\n✅  All checks passed — PGVector is ready.")
