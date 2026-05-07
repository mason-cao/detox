"""Cross-cutting dependencies for ``/api`` routes.

Resolves the auth header onto ``request.state.user_id`` and validates any
date-shaped query parameters before the handler runs. The Postgres-side
rewards rollup happens on ``/v1/ingest`` writes (see services/rewards.py),
so there is no per-request SQLite call here.
"""

from __future__ import annotations

from fastapi import Request

from .auth import resolve_user_id
from .errors import ApiError
from .validation import validate_date


_DATE_QUERY_FIELDS = ("date", "week_start", "start", "end")


async def api_request_setup(request: Request) -> None:
    user_id = resolve_user_id(request)
    if not user_id:
        raise ApiError("authentication required", status_code=401)
    request.state.user_id = user_id
    for field_name in _DATE_QUERY_FIELDS:
        value = request.query_params.get(field_name)
        if value is not None:
            validate_date(value, field_name)
