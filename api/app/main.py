"""FastAPI entrypoint for the hosted Detox API."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import Settings
from .db import dispose_engine, install_engine
from .errors import ApiError, api_error_handler
from .routers.apps import router as apps_router
from .routers.blocks import router as blocks_router
from .routers.dashboard import router as dashboard_router
from .routers.devices import router as devices_router
from .routers.goals import router as goals_router
from .routers.health import router as health_router
from .routers.ingest import router as ingest_router
from .routers.rewards import router as rewards_router
from .routers.rules import router as rules_router
from .routers.settings import router as settings_router


@asynccontextmanager
async def _lifespan(app: FastAPI):
    install_engine(app)
    try:
        yield
    finally:
        dispose_engine(app)


async def unexpected_error_handler(_request, exc: Exception) -> JSONResponse:
    return JSONResponse({"error": str(exc)}, status_code=500)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    app = FastAPI(
        title=settings.service_name,
        version=settings.version,
        summary="Hosted API for Detox's hybrid local-agent and web dashboard architecture.",
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=_lifespan,
    )
    app.state.settings = settings
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(Exception, unexpected_error_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router)
    app.include_router(dashboard_router)
    app.include_router(apps_router)
    app.include_router(goals_router)
    app.include_router(blocks_router)
    app.include_router(settings_router)
    app.include_router(devices_router)
    app.include_router(ingest_router)
    app.include_router(rules_router)
    app.include_router(rewards_router)
    return app


app = create_app()
