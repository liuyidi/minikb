from __future__ import annotations

from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """minikb 运行时配置。全部字段可用 `MINIKB_` 前缀 env 覆盖。"""

    model_config = SettingsConfigDict(
        env_prefix="MINIKB_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- 服务 ---
    host: str = "127.0.0.1"
    port: int = 8080
    env: Literal["dev", "test", "prod"] = "dev"
    log_level: str = "INFO"

    # --- 数据库 ---
    postgres_dsn: str = Field(
        default="postgresql+psycopg://minikb:minikb@127.0.0.1:5432/minikb",
        description="SQLAlchemy 风格 DSN；psycopg3 驱动。",
    )

    # --- Redis / RQ ---
    redis_url: str = "redis://127.0.0.1:6379/0"

    # --- 对象存储（MinIO / S3） ---
    s3_endpoint: str = "127.0.0.1:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "minikb"
    s3_secure: bool = False
    s3_region: str = "us-east-1"

    # --- Embedding / LLM 上游 ---
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    # openai | mock | auto（auto：DeepSeek 等无 embeddings 的上游走 mock）
    embedding_provider: Literal["openai", "mock", "auto"] = "auto"

    # --- Auth ---
    default_org_slug: str = "default"
    require_api_key: bool = False  # 开发默认关；prod 强制开
    jwt_secret: str = ""
    jwt_issuer: str = "https://auth.liuyidi.me"
    jwt_audience: str = "mini-auth"

    # --- Ingest ---
    ingest_queue_default: str = "cpu"
    ingest_queue_embed: str = "embed"
    max_upload_mb: int = 100


def get_settings() -> Settings:
    # 简单实例；后续可用 lru_cache
    return Settings()
