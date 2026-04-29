"""Shared request validation helpers."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from .errors import ApiError

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date(value: str, field_name: str = "date") -> str:
    if not isinstance(value, str) or not DATE_RE.match(value):
        raise ApiError(f"Invalid {field_name} format. Use YYYY-MM-DD")
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ApiError(f"Invalid {field_name}. Use a real calendar date") from exc
    return value


def require_json_object(body: Any, *, required: bool = True) -> dict:
    if body is None:
        if required:
            raise ApiError("Expected a JSON object")
        return {}
    if not isinstance(body, dict):
        raise ApiError("Expected a JSON object")
    return body


def require_text(data: dict, field_name: str) -> str:
    value = data.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(f"Missing or invalid field: {field_name}")
    return value.strip()


def optional_positive_int(data: dict, field_name: str) -> int | None:
    value = data.get(field_name)
    if value is None:
        return None
    try:
        coerced = int(value)
    except (TypeError, ValueError) as exc:
        raise ApiError(f"{field_name} must be a positive integer") from exc
    if coerced <= 0:
        raise ApiError(f"{field_name} must be a positive integer")
    return coerced
