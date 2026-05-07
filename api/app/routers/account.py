"""Account-scoped privacy endpoints — full export and full delete.

Phase 5 (private beta) gives every user a one-click way to pull a full
JSON dump of their cloud data and a one-click way to wipe it. Both honor
the spec §10 privacy commitment: "GDPR- and CCPA-clean."

Implementation notes:

- Export reads every user-data table directly. RLS on ``app.current_user_id``
  scopes the SELECTs without explicit ``WHERE user_id = …`` clauses.
- Delete cascades from ``users`` — the FK constraints in migration 0002
  set ``ON DELETE CASCADE`` for every per-user table, so a single row
  removal in ``users`` empties the user's footprint. Deleting ``users``
  itself bypasses RLS because the table is not in the RLS set; the
  authenticated request is what authorizes it.
- The agent's JWT references the now-deleted user; subsequent ingest
  attempts will 401, which is the desired behavior — the device must
  re-pair against a fresh account.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import db_session
from ..dependencies import api_request_setup
from ..errors import ApiError
from ..validation import require_json_object


router = APIRouter(
    prefix="/api",
    tags=["account"],
    dependencies=[Depends(api_request_setup)],
)


_EXPORT_TABLES = (
    "app_usage",
    "sessions",
    "pickups",
    "app_categories",
    "goals",
    "app_blocks",
    "category_blocks",
    "settings",
    "rewards_ledger",
    "rewards_awards",
    "inventory",
    "milestones",
    "devices",
)


def _row_to_jsonable(row) -> dict:
    out: dict[str, object] = {}
    for key, value in row._mapping.items():
        if isinstance(value, datetime):
            out[key] = value.isoformat()
        else:
            out[key] = value
    return out


@router.get("/export/full", summary="Download every cloud row tied to this account")
async def export_full(
    request: Request,
    session: Session = Depends(db_session),
) -> dict:
    payload: dict = {
        "version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user_id": request.state.user_id,
        "tables": {},
    }
    for table in _EXPORT_TABLES:
        try:
            rows = session.execute(text(f"SELECT * FROM {table}")).all()
        except Exception:  # pragma: no cover - table may not exist yet on older deployments
            continue
        payload["tables"][table] = [_row_to_jsonable(row) for row in rows]
    return payload


@router.post("/data/delete", summary="Wipe every row tied to this account")
async def delete_account_data(
    request: Request,
    session: Session = Depends(db_session),
) -> dict:
    try:
        raw = await request.json()
    except ValueError:
        raise ApiError("Expected a JSON object", status_code=400)
    body = require_json_object(raw)
    if body.get("confirmation") != "DELETE":
        raise ApiError(
            'Type DELETE in confirmation to proceed',
            status_code=400,
        )
    user_id = request.state.user_id
    session.execute(
        text("DELETE FROM users WHERE id = :uid"),
        {"uid": user_id},
    )
    return {"ok": True}
