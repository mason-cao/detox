"""Redis pool wrapper.

Used for two things in Phase 4: per-device rate limiting on
``/v1/ingest`` and a 30-second cache of the ``/v1/rules`` etag. Both
are best-effort — every helper degrades to "no Redis available" cleanly
so a Redis outage doesn't take the api down.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from fastapi import FastAPI

from .config import Settings

if TYPE_CHECKING:  # pragma: no cover
    import redis as redis_module


def install_redis(app: FastAPI) -> None:
    settings: Settings = app.state.settings
    app.state.redis = _build_client(settings.redis_url)


def dispose_redis(app: FastAPI) -> None:
    client = getattr(app.state, "redis", None)
    if client is not None:
        try:
            client.close()
        except Exception:
            pass
    app.state.redis = None


def _build_client(url: str | None):
    if not url:
        return None
    try:
        import redis  # type: ignore
    except ImportError:
        return None
    try:
        client = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        return client
    except Exception:
        return None


def get_redis(app: FastAPI):
    return getattr(app.state, "redis", None)


def incr_with_expiry(
    client,
    key: str,
    *,
    expiry_seconds: int,
) -> int | None:
    """Atomically INCR ``key`` and ensure a TTL is set. Returns count or None."""
    if client is None:
        return None
    try:
        pipe = client.pipeline(transaction=False)
        pipe.incr(key, 1)
        pipe.expire(key, expiry_seconds, nx=True)
        result = pipe.execute()
        return int(result[0])
    except Exception:
        return None


def cache_get(client, key: str) -> str | None:
    if client is None:
        return None
    try:
        value = client.get(key)
    except Exception:
        return None
    if value is None:
        return None
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return str(value)


def cache_set(
    client,
    key: str,
    value: str,
    *,
    ttl_seconds: int,
) -> None:
    if client is None:
        return
    try:
        client.set(key, value, ex=ttl_seconds)
    except Exception:
        pass


def cache_delete(client, *keys: str) -> None:
    if client is None or not keys:
        return
    try:
        client.delete(*keys)
    except Exception:
        pass
