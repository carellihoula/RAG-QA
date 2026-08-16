import boto3
import re
from pathlib import Path
from urllib.parse import quote
from app.config import settings


def _client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


def _content_disposition(filename: str) -> str:
    """RFC 6266-compliant header — percent-encodes the UTF-8 filename instead
    of interpolating it raw, so a name containing `"` or CR/LF can't break out
    of the quoted attribute or inject extra headers."""
    ascii_fallback = re.sub(r'[^\x20-\x7e]|["\\]', '_', filename) or "download"
    encoded = quote(filename, safe='')
    return f"attachment; filename=\"{ascii_fallback}\"; filename*=UTF-8''{encoded}"


def upload_file(file_path: Path, doc_id: str, filename: str, user_id: str = "") -> str:
    """Upload a file to S3 organised by user. Returns the S3 key."""
    ext = Path(filename).suffix
    # Path: documents/{user_id}/{doc_id}.ext
    folder = f"documents/{user_id}" if user_id else "documents/unknown"
    key = f"{folder}/{doc_id}{ext}"

    _client().upload_file(
        str(file_path),
        settings.s3_bucket,
        key,
        ExtraArgs={
            "ContentDisposition": _content_disposition(filename),
            # S3 object metadata — who uploaded it and when
            "Metadata": {
                "user_id": user_id,
                "doc_id": doc_id,
                # S3 metadata values must be ASCII with no control characters
                "original_filename": re.sub(r'[^\x20-\x7e]', '_', filename),
            },
        },
    )
    return key


def delete_file(s3_key: str) -> None:
    """Delete a file from S3."""
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=s3_key)
    except Exception:
        pass


def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    """Generate a presigned URL for temporary file download (1 hour by default)."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def s3_enabled() -> bool:
    return bool(settings.s3_bucket and settings.aws_access_key_id)