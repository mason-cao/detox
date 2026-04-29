"""FastAPI entrypoint for the hosted Detox API."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .routers.health import router as health_router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    app = FastAPI(
        title=settings.service_name,
        version=settings.version,
        summary="Hosted API for Detox's hybrid local-agent and web dashboard architecture.",
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    return app


app = create_app()

