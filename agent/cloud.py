"""HTTP client for the hosted Detox API.

Wraps a single ``requests.Session`` with retry on 502/503, JSON-only
encoding, and ``Authorization: Bearer <jwt>`` injection from the
keychain. The agent's puller (``agent.rules``) and flush (``agent.sync``)
both go through this module.
"""

from __future__ import annotations

import json as _json
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from agent import keychain
from agent.config import (
    APP_VERSION,
    CLOUD_API_BASE,
    CLOUD_HTTP_TIMEOUT_SECONDS,
)


class HTTPError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=(502, 503, 504),
        allowed_methods=frozenset({"GET", "POST"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(
        {
            "User-Agent": f"detox-agent/{APP_VERSION}",
            "Accept": "application/json",
        }
    )
    return session


_session = _build_session()


def is_paired() -> bool:
    return bool(keychain.load_jwt())


def _auth_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    token = keychain.load_jwt()
    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra:
        headers.update(extra)
    return headers


def _url(path: str) -> str:
    if path.startswith(("http://", "https://")):
        return path
    base = CLOUD_API_BASE.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def get(
    path: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = CLOUD_HTTP_TIMEOUT_SECONDS,
) -> requests.Response:
    try:
        resp = _session.get(
            _url(path),
            headers=_auth_headers(headers),
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise HTTPError(str(exc)) from exc
    if resp.status_code >= 500:
        raise HTTPError(
            f"server error {resp.status_code}",
            status_code=resp.status_code,
        )
    return resp


def post_json(
    path: str,
    body: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
    timeout: float = CLOUD_HTTP_TIMEOUT_SECONDS,
    require_auth: bool = True,
) -> dict[str, Any]:
    request_headers = _auth_headers(headers) if require_auth else dict(headers or {})
    request_headers.setdefault("Content-Type", "application/json")
    try:
        resp = _session.post(
            _url(path),
            data=_json.dumps(body),
            headers=request_headers,
            timeout=timeout,
        )
    except requests.RequestException as exc:
        raise HTTPError(str(exc)) from exc
    if resp.status_code >= 400:
        raise HTTPError(
            f"{resp.status_code}: {resp.text[:200]}",
            status_code=resp.status_code,
        )
    if not resp.content:
        return {}
    try:
        return resp.json()
    except ValueError as exc:
        raise HTTPError(f"non-JSON response: {exc}") from exc
