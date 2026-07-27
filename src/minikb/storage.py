"""MinIO / S3 storage client."""
from __future__ import annotations

import hashlib
import uuid
from io import BytesIO
from typing import BinaryIO

from minio import Minio
from minio.error import S3Error

from minikb.config.settings import Settings, get_settings


_client: Minio | None = None


def get_minio_client(settings: Settings | None = None) -> Minio:
    """Get or create the MinIO client."""
    global _client
    if _client is None:
        s = settings or get_settings()
        _client = Minio(
            s.s3_endpoint,
            access_key=s.s3_access_key,
            secret_key=s.s3_secret_key,
            secure=s.s3_secure,
            region=s.s3_region,
        )
    return _client


def close_minio() -> None:
    """Close the MinIO client."""
    global _client
    _client = None


def ensure_bucket(settings: Settings | None = None) -> None:
    """Ensure the default bucket exists."""
    s = settings or get_settings()
    client = get_minio_client(s)
    if not client.bucket_exists(s.s3_bucket):
        client.make_bucket(s.s3_bucket)


def upload_file(
    data: BinaryIO,
    filename: str,
    content_type: str | None = None,
    size: int | None = None,
    settings: Settings | None = None,
) -> tuple[str, str, int]:
    """Upload a file to MinIO.

    Returns:
        (object_key, sha256, size_bytes)
    """
    s = settings or get_settings()
    client = get_minio_client(s)

    # Read data to compute hash
    content = data.read()
    sha256 = hashlib.sha256(content).hexdigest()
    size_bytes = len(content)

    # Generate object key with hash prefix for dedup
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    object_key = f"docs/{sha256[:2]}/{sha256}.{ext}"

    # Upload
    data_stream = BytesIO(content)
    client.put_object(
        s.s3_bucket,
        object_key,
        data_stream,
        length=size_bytes,
        content_type=content_type or "application/octet-stream",
    )

    return object_key, sha256, size_bytes


def download_file(object_key: str, settings: Settings | None = None) -> bytes:
    """Download a file from MinIO."""
    s = settings or get_settings()
    client = get_minio_client(s)

    response = client.get_object(s.s3_bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_file(object_key: str, settings: Settings | None = None) -> None:
    """Delete a file from MinIO."""
    s = settings or get_settings()
    client = get_minio_client(s)
    client.remove_object(s.s3_bucket, object_key)


def file_exists(object_key: str, settings: Settings | None = None) -> bool:
    """Check if a file exists in MinIO."""
    s = settings or get_settings()
    client = get_minio_client(s)
    try:
        client.stat_object(s.s3_bucket, object_key)
        return True
    except S3Error:
        return False
