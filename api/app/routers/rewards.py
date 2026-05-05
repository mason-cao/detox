"""Server-authoritative rewards endpoints.

The agent reads ``GET /v1/rewards/balances`` for its HUD, the web Market
calls ``POST /v1/rewards/spend`` and ``POST /v1/rewards/refund``, and the
Hall of Honor pulls ``GET /v1/milestones``.

Every mutating route runs inside the ``db_session`` transaction so the
``rewards_balances`` row lock taken inside ``services.rewards`` covers the
whole request.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..auth import resolve_user_id
from ..db import db_session
from ..errors import ApiError
from ..services import rewards as rewards_service
from ..validation import require_json_object, require_text

router = APIRouter(prefix="/v1", tags=["rewards"])


def _require_any_user(request: Request) -> str:
    user_id = resolve_user_id(request)
    if not user_id:
        raise ApiError("authentication required", status_code=401)
    request.state.user_id = user_id
    return user_id


@router.get("/rewards/balances", summary="Current Sunlight + Starshard balances")
async def get_balances(
    user_id: str = Depends(_require_any_user),
    session: Session = Depends(db_session),
) -> dict:
    balance = rewards_service.get_balances(session, user_id=user_id)
    return balance.as_dict()


@router.post("/rewards/spend", summary="Buy a market item")
async def post_spend(
    request: Request,
    user_id: str = Depends(_require_any_user),
    session: Session = Depends(db_session),
) -> dict:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    item_key = require_text(body, "item_key")

    balance = rewards_service.spend_item(
        session, user_id=user_id, item_key=item_key
    )
    return {"balance": balance.as_dict()}


@router.post("/rewards/refund", summary="Refund a previously bought item")
async def post_refund(
    request: Request,
    user_id: str = Depends(_require_any_user),
    session: Session = Depends(db_session),
) -> dict:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    inventory_id = require_text(body, "inventory_id")

    balance = rewards_service.refund_inventory(
        session, user_id=user_id, inventory_id=inventory_id
    )
    return {"balance": balance.as_dict()}


@router.get("/rewards/inventory", summary="Items currently owned by the user")
async def get_inventory(
    user_id: str = Depends(_require_any_user),
    session: Session = Depends(db_session),
) -> list[dict]:
    return rewards_service.list_inventory(session, user_id=user_id)


@router.get("/rewards/catalog", summary="Market catalog")
async def get_catalog() -> list[dict]:
    return rewards_service.get_catalog()


@router.get("/milestones", summary="Hall of Honor — milestones in reverse order")
async def get_milestones(
    user_id: str = Depends(_require_any_user),
    session: Session = Depends(db_session),
) -> list[dict]:
    return rewards_service.list_milestones(session, user_id=user_id)
