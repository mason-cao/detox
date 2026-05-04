"""Cross-cutting dependencies for ``/api`` routes.

Mirrors the Flask agent's ``@api_route`` decorator behaviour: resolve the
optional dev-token auth header onto ``request.state.user_id``, validate any
date-shaped query parameters that are present, and run the rewards rollup
before each handler executes.
"""

from __future__ import annotations

from fastapi import Request

from agent import database as db

from .auth import resolve_user_id
from .validation import validate_date


_DATE_QUERY_FIELDS = ("date", "week_start", "start", "end")


async def api_request_setup(request: Request) -> None:
    request.state.user_id = resolve_user_id(request)
    for field_name in _DATE_QUERY_FIELDS:
        value = request.query_params.get(field_name)
        if value is not None:
            validate_date(value, field_name)
    db.run_rollup_if_needed()
