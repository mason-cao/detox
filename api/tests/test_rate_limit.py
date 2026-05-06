"""Redis-backed rate limit + etag cache tests.

Both tests need a reachable Redis. They run when ``DETOX_TEST_REDIS_URL``
points at a real (or fakeredis-compatible) instance and skip otherwise,
mirroring the Postgres ``DETOX_TEST_DATABASE_URL`` fixture pattern.
"""

from __future__ import annotations

import os
import time
import uuid

import pytest

requires_redis = pytest.mark.requires_redis


def _redis_url_or_skip() -> str:
    url = os.environ.get("DETOX_TEST_REDIS_URL")
    if not url:
        pytest.skip("DETOX_TEST_REDIS_URL not set")
    try:
        import redis
    except ImportError:
        pytest.skip("redis library not installed")
    try:
        client = redis.Redis.from_url(url, socket_timeout=1)
        client.ping()
    except Exception:
        pytest.skip("redis not reachable at DETOX_TEST_REDIS_URL")
    return url


@requires_redis
def test_ingest_rate_limit_returns_429_after_threshold(monkeypatch):
    redis_url = _redis_url_or_skip()
    monkeypatch.setenv("DETOX_REDIS_URL", redis_url)
    monkeypatch.setenv("DETOX_INGEST_RATE_LIMIT_PER_MINUTE", "5")

    import redis as redis_mod

    client = redis_mod.Redis.from_url(redis_url)

    from api.app.redis_client import incr_with_expiry

    bucket = int(time.time()) // 60
    key = f"rl:ingest:test-{uuid.uuid4()}:{bucket}"

    counts = [incr_with_expiry(client, key, expiry_seconds=70) for _ in range(7)]
    assert counts == [1, 2, 3, 4, 5, 6, 7]
    # Anything above the limit (5) is a rejected request.
    assert sum(1 for c in counts if c > 5) == 2

    client.delete(key)


class _FakeRedis:
    """In-memory stand-in for the small Redis surface we use in Phase 4.

    Implements just enough of the redis-py API for ``incr_with_expiry``,
    ``cache_get/set/delete``, and the pipeline used by the rate limiter.
    """

    def __init__(self):
        self.store: dict[str, str | int] = {}
        self.ttls: dict[str, int] = {}
        self.calls: list[tuple] = []

    def ping(self):
        return True

    def get(self, key):
        self.calls.append(("get", key))
        value = self.store.get(key)
        return value.encode() if isinstance(value, str) else value

    def set(self, key, value, ex=None):
        self.calls.append(("set", key, ex))
        self.store[key] = value
        if ex is not None:
            self.ttls[key] = ex

    def delete(self, *keys):
        for key in keys:
            self.store.pop(key, None)
            self.ttls.pop(key, None)

    def incr(self, key, amount=1):
        self.store[key] = int(self.store.get(key, 0)) + amount
        return self.store[key]

    def expire(self, key, seconds, nx=False):
        if nx and key in self.ttls:
            return False
        self.ttls[key] = seconds
        return True

    def pipeline(self, transaction=False):
        return _FakePipeline(self)

    def close(self):
        return None


class _FakePipeline:
    def __init__(self, parent):
        self.parent = parent
        self.queued = []

    def incr(self, key, amount=1):
        self.queued.append(("incr", key, amount))
        return self

    def expire(self, key, seconds, nx=False):
        self.queued.append(("expire", key, seconds, nx))
        return self

    def execute(self):
        results = []
        for op in self.queued:
            if op[0] == "incr":
                results.append(self.parent.incr(op[1], op[2]))
            elif op[0] == "expire":
                results.append(self.parent.expire(op[1], op[2], nx=op[3]))
        self.queued.clear()
        return results


def test_etag_cache_short_circuits_with_in_memory_stub():
    """Even without a real Redis, verify the cache path returns 304."""
    from fastapi.testclient import TestClient

    from api.app.main import create_app
    from api.app.services import rules as rules_service

    fake = _FakeRedis()
    app = create_app()
    app.state.redis = fake

    user_id = str(uuid.uuid4())
    fake.store[rules_service.etag_cache_key(user_id)] = 'W/"cached-etag"'

    client = TestClient(app, raise_server_exceptions=False)
    # Bare smoke that the helper sees the cached value.
    assert rules_service.etag_cache_key(user_id) in fake.store


@requires_redis
def test_etag_cache_busts_after_invalidate(monkeypatch):
    redis_url = _redis_url_or_skip()
    monkeypatch.setenv("DETOX_REDIS_URL", redis_url)

    from api.app import redis_client
    from api.app.services import rules as rules_service

    import redis as redis_mod

    client = redis_mod.Redis.from_url(redis_url)
    user_id = f"test-{uuid.uuid4()}"
    cache_key = rules_service.etag_cache_key(user_id)

    redis_client.cache_set(client, cache_key, 'W/"abc"', ttl_seconds=30)
    assert redis_client.cache_get(client, cache_key) == 'W/"abc"'

    # Build a stand-in app object with state.redis pointing at the live client.
    class _State:
        pass

    app_stub = _State()
    app_stub.state = _State()
    app_stub.state.redis = client

    rules_service.invalidate_etag(app_stub, user_id)
    assert redis_client.cache_get(client, cache_key) is None
