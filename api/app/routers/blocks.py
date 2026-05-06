"""Blocks and category-blocks routes ported from the local Flask agent."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from ..dependencies import api_request_setup
from ..errors import ApiError
from ..services import blocks as blocks_service
from ..services import rules as rules_service
from ..validation import (
    optional_positive_int,
    require_json_object,
    require_text,
)

router = APIRouter(
    prefix="/api",
    tags=["blocks"],
    dependencies=[Depends(api_request_setup)],
)

_BLOCK_TYPES = {"blocked", "whitelisted"}


@router.get("/blocks", summary="List active app blocks")
async def list_blocks() -> list[dict]:
    return blocks_service.list_blocks()


@router.post("/blocks", status_code=201, summary="Add or update an app block")
async def add_block(request: Request) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)

    app_name = require_text(body, "app_name")
    block_type = body.get("block_type", "blocked")
    if block_type not in _BLOCK_TYPES:
        raise ApiError("Invalid block_type")
    daily_limit_minutes = optional_positive_int(body, "daily_limit_minutes")

    blocks_service.add_block(
        app_name=app_name,
        block_type=block_type,
        daily_limit_minutes=daily_limit_minutes,
    )
    rules_service.bust_for_request(request)
    return {"ok": True}


@router.delete("/blocks/{app_name}", summary="Remove an app block")
async def remove_block(app_name: str, request: Request) -> dict[str, bool]:
    blocks_service.remove_block(app_name)
    rules_service.bust_for_request(request)
    return {"ok": True}


@router.get("/category-blocks", summary="List active category blocks")
async def list_category_blocks() -> list[dict]:
    return blocks_service.list_category_blocks()


@router.post("/category-blocks", status_code=201, summary="Add a category block")
async def add_category_block(request: Request) -> dict[str, bool]:
    try:
        payload = await request.json()
    except ValueError:
        payload = None
    body = require_json_object(payload)
    category_name = require_text(body, "category_name")
    blocks_service.add_category_block(category_name)
    rules_service.bust_for_request(request)
    return {"ok": True}


@router.delete(
    "/category-blocks/{category_name}",
    summary="Remove a category block",
)
async def remove_category_block(
    category_name: str,
    request: Request,
) -> dict[str, bool]:
    blocks_service.remove_category_block(category_name)
    rules_service.bust_for_request(request)
    return {"ok": True}
