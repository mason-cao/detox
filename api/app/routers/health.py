"""Health and service metadata routes."""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/healthz", summary="Health check")
async def healthz(request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    return {
        "ok": True,
        "service": settings.service_name,
        "environment": settings.environment,
        "version": settings.version,
    }

