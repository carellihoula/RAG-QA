"""One-off migration: backfill app.models.document.Document rows in Postgres
from the legacy backend/data/indexes/<doc_id>/metadata.json files.

Idempotent — safe to re-run (uses db.merge(), keyed on doc_id).

Usage (from the backend/ directory, inside the venv or the backend container):
    python -m scripts.migrate_metadata_to_db
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.database import SessionLocal, init_db
from app.models.document import Document


def main() -> None:
    init_db()  # ensures the documents table exists before we insert into it

    if not settings.index_dir.exists():
        print(f"No index directory at {settings.index_dir} — nothing to migrate.")
        return

    db = SessionLocal()
    migrated, skipped = 0, 0
    try:
        for index_path in sorted(settings.index_dir.iterdir()):
            if not index_path.is_dir():
                continue
            meta_path = index_path / "metadata.json"
            if not meta_path.exists():
                continue

            doc_id = index_path.name
            try:
                meta = json.loads(meta_path.read_text())
            except (json.JSONDecodeError, OSError) as e:
                print(f"[skip] {doc_id}: could not read metadata.json ({e})")
                skipped += 1
                continue

            indexed_at = (
                datetime.fromisoformat(meta["indexed_at"])
                if meta.get("indexed_at")
                else datetime.now(timezone.utc)
            )

            db.merge(Document(
                id=doc_id,
                user_id=meta.get("user_id"),
                filename=meta.get("filename", doc_id),
                title=meta.get("title"),
                indexed_at=indexed_at,
                page_count=meta.get("page_count"),
                chunk_count=meta.get("chunk_count"),
                in_library=meta.get("in_library", True),
                source_type=meta.get("source_type", "pdf"),
                source_url=meta.get("source_url"),
                status=meta.get("status", "ready"),
                error=meta.get("error"),
                s3_key=meta.get("s3_key"),
            ))
            migrated += 1
            print(f"[ok] {doc_id} — {meta.get('filename', '?')}")

        db.commit()
    finally:
        db.close()

    print(f"\nDone. Migrated {migrated} document(s), skipped {skipped}.")


if __name__ == "__main__":
    main()
