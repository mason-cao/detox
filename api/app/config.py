"""Runtime configuration for the hosted API."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    service_name: str = "Detox API"
    environment: str = "development"
    version: str = "0.1.0"
    cors_origins: tuple[str, ...] = ("http://localhost:5050", "http://127.0.0.1:5050")

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.getenv("API_CORS_ORIGINS")
        return cls(
            service_name=os.getenv("API_SERVICE_NAME", cls.service_name),
            environment=os.getenv("API_ENV", cls.environment),
            version=os.getenv("API_VERSION", cls.version),
            cors_origins=tuple(_split_csv(origins)) if origins else cls.cors_origins,
        )

