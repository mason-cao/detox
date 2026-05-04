"""Runtime configuration for the hosted API."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _env_or_none(key: str) -> str | None:
    value = os.getenv(key)
    return value.strip() if value and value.strip() else None


_VALID_AUTH_MODES = ("local", "supabase")


@dataclass(frozen=True)
class Settings:
    service_name: str = "Detox API"
    environment: str = "development"
    version: str = "0.1.0"
    cors_origins: tuple[str, ...] = ("http://localhost:5050", "http://127.0.0.1:5050")
    dev_token: str | None = None
    dev_user_id: str | None = None
    auth_mode: str = "local"
    supabase_url: str | None = None
    supabase_jwt_jwks_url: str | None = None
    supabase_jwt_audience: str = "authenticated"
    database_url: str | None = None
    db_pool_size: int = 5
    db_max_overflow: int = 5
    device_jwt_secret: str | None = None
    device_jwt_audience: str = "detox-device"
    pairing_code_ttl_seconds: int = 300
    ingest_max_batch_rows: int = 1000

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.getenv("API_CORS_ORIGINS")
        auth_mode = os.getenv("DETOX_AUTH_MODE", cls.auth_mode).strip().lower()
        if auth_mode not in _VALID_AUTH_MODES:
            raise ValueError(
                f"DETOX_AUTH_MODE must be one of {_VALID_AUTH_MODES}, got {auth_mode!r}"
            )
        return cls(
            service_name=os.getenv("API_SERVICE_NAME", cls.service_name),
            environment=os.getenv("API_ENV", cls.environment),
            version=os.getenv("API_VERSION", cls.version),
            cors_origins=tuple(_split_csv(origins)) if origins else cls.cors_origins,
            dev_token=_env_or_none("DETOX_DEV_TOKEN"),
            dev_user_id=_env_or_none("DETOX_DEV_USER_ID"),
            auth_mode=auth_mode,
            supabase_url=_env_or_none("SUPABASE_URL"),
            supabase_jwt_jwks_url=_env_or_none("SUPABASE_JWKS_URL"),
            supabase_jwt_audience=os.getenv(
                "SUPABASE_JWT_AUD", cls.supabase_jwt_audience
            ),
            database_url=_env_or_none("DETOX_DATABASE_URL"),
            db_pool_size=int(os.getenv("DETOX_DB_POOL_SIZE", cls.db_pool_size)),
            db_max_overflow=int(
                os.getenv("DETOX_DB_MAX_OVERFLOW", cls.db_max_overflow)
            ),
            device_jwt_secret=_env_or_none("DETOX_DEVICE_JWT_SECRET"),
            device_jwt_audience=os.getenv(
                "DETOX_DEVICE_JWT_AUD", cls.device_jwt_audience
            ),
            pairing_code_ttl_seconds=int(
                os.getenv(
                    "DETOX_PAIRING_CODE_TTL_SECONDS",
                    cls.pairing_code_ttl_seconds,
                )
            ),
            ingest_max_batch_rows=int(
                os.getenv(
                    "DETOX_INGEST_MAX_BATCH_ROWS",
                    cls.ingest_max_batch_rows,
                )
            ),
        )
