"""Shared request validation helpers."""

from __future__ import annotations

import re
from datetime import datetime

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

