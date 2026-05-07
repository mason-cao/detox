"""FastAPI entrypoint for the hosted Detox API."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from .config import Settings
from .db import dispose_engine, install_engine
from .errors import ApiError, api_error_handler
from .redis_client import dispose_redis, install_redis
from .routers.account import router as account_router
from .routers.apps import router as apps_router
from .routers.blocks import router as blocks_router
from .routers.compat import router as compat_router
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
    install_redis(app)
    try:
        yield
    finally:
        dispose_redis(app)
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
    app.include_router(account_router)
    app.include_router(compat_router)

    _mount_web(app)
    return app


def _mount_web(app: FastAPI) -> None:
    """Serve the static dashboard from the same origin as the api.

    Without a custom domain there's no reason to split web and api into
    separate hosts — same-origin kills CORS, and ``/config.js`` only needs
    to render the env once. The api still owns ``/v1/*``, ``/api/*``, etc.
    via the routers above; this mount only covers the leftover paths.
    """
    web_dir = _find_web_dir()
    if web_dir is None:
        return

    @app.get("/config.js", include_in_schema=False)
    async def config_js() -> PlainTextResponse:
        body = (
            f'window.DETOX_SUPABASE_URL = {_js_str("DETOX_SUPABASE_URL")};\n'
            f'window.DETOX_SUPABASE_ANON_KEY = {_js_str("DETOX_SUPABASE_ANON_KEY")};\n'
            f'window.DETOX_API_BASE = {_js_str("DETOX_API_BASE")};\n'
        )
        return PlainTextResponse(
            body,
            media_type="application/javascript; charset=utf-8",
        )

    # html=True makes /<path> fall back to /<path>.html and /<dir>/ to /index.html.
    app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")


def _find_web_dir() -> Path | None:
    """Locate ``web/`` from common run roots — repo root in dev, /srv/web in Docker."""
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "web",   # api/app/main.py → repo root → web/
        Path.cwd() / "web",
        Path("/srv/web"),
    ]
    for path in candidates:
        if path.is_dir():
            return path
    return None


def _js_str(env_key: str) -> str:
    raw = os.environ.get(env_key, "") or ""
    safe = raw.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "")
    return f'"{safe}"'


app = create_app()
