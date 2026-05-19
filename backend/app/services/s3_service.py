import boto3
from pathlib import Path
from app.config import settings


def _client():
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )


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
            "ContentDisposition": f'attachment; filename="{filename}"',
            # S3 object metadata — who uploaded it and when
            "Metadata": {
                "user_id": user_id,
                "doc_id": doc_id,
                "original_filename": filename,
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