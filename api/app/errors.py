"""API error helpers with the same JSON shape as the local Flask agent."""

from __future__ import annotations


class ApiError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def api_error_handler(_request, exc: ApiError):
    from fastapi.responses import JSONResponse

    return JSONResponse({"error": exc.message}, status_code=exc.status_code)
