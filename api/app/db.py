"""Postgres engine, per-request session, and RLS GUC propagation.

Phase 4 introduces a SQLAlchemy engine for the new Phase-4 tables (devices,
ingest, rewards balances, inventory, milestones). Existing Phase-2 services
kept talking to the local SQLite agent database until the Postgres port;
this module is the shared seam new routers plug into.

The migration in ``0002_user_scoping_and_rls.py`` set RLS policies that filter
on ``current_setting('app.current_user_id', true)``. Every request that has a
resolved ``user_id`` runs ``SET LOCAL app.current_user_id = '<uuid>'`` inside
its session's transaction, so RLS sees the right tenant for the duration of
the request and reverts on commit/rollback.
"""

from __future__ import annotations

import re
from typing import Iterator

from fastapi import FastAPI, Request
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings
from .errors import ApiError


_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_postgres(url: str) -> bool:
    return make_url(url).get_backend_name().startswith("postgres")


def create_engine_from_settings(settings: Settings) -> Engine | None:
    """Build a SQLAlchemy engine for the configured ``DETOX_DATABASE_URL``.

    Returns ``None`` when no URL is configured — callers should treat that as
    "Postgres path disabled, fall back to SQLite agent.database".
    """
    if not settings.database_url:
        return None

    from sqlalchemy import create_engine

    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        future=True,
    )
    return engine


def install_engine(app: FastAPI) -> None:
    """Attach an engine + session factory to ``app.state`` if configured."""
    settings: Settings = app.state.settings
    engine = create_engine_from_settings(settings)
    app.state.engine = engine
    app.state.session_factory = (
        sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
        if engine
        else None
    )


def dispose_engine(app: FastAPI) -> None:
    engine: Engine | None = getattr(app.state, "engine", None)
    if engine is not None:
        engine.dispose()
    app.state.engine = None
    app.state.session_factory = None


def set_user_guc(session: Session, user_id: str) -> None:
    """Set the per-transaction RLS variable ``app.current_user_id``.

    No-ops on non-Postgres backends so unit tests against SQLite stay green.
    The UUID format is validated before interpolation — Postgres ``SET LOCAL``
    does not accept bind parameters, so we intentionally inline the value
    after a strict whitelist check.
    """
    if not user_id:
        return
    if not _UUID_RE.match(user_id):
        raise ApiError("user_id must be a UUID for RLS scoping", status_code=500)
    if not session.bind or not session.bind.dialect.name.startswith("postgres"):
        return
    session.execute(text(f"SET LOCAL app.current_user_id = '{user_id}'"))


def db_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: yield a session with the GUC set for this request.

    Routers that need Postgres declare ``session: Session = Depends(db_session)``.
    The dependency commits on success, rolls back on exception, and always
    closes. ``api_request_setup`` must run first so ``request.state.user_id``
    is populated.
    """
    factory = getattr(request.app.state, "session_factory", None)
    if factory is None:
        raise ApiError(
            "database is not configured (set DETOX_DATABASE_URL)",
            status_code=503,
        )

    session: Session = factory()
    try:
        # Open the implicit transaction so SET LOCAL is scoped to it.
        session.begin()
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            set_user_guc(session, user_id)
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
