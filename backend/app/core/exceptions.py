"""Centralized API errors. Every response body is {"message", "code", "details"?}.

Frontend mapping (src/services/api.ts): 400/422 -> validation, 401/403 -> unauthorized,
404 -> not_found, 429 -> rate_limited, other -> server.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("chakravyuh.errors")


class AppError(Exception):
    status = 500
    code = "server"
    default_message = "The server encountered an unexpected error."

    def __init__(self, message: str | None = None, *, status: int | None = None, code: str | None = None, details: dict | None = None):
        self.message = message or self.default_message
        if status is not None:
            self.status = status
        if code is not None:
            self.code = code
        self.details = details
        super().__init__(self.message)


class ValidationAppError(AppError):
    status = 422
    code = "validation"
    default_message = "Some of the submitted information is invalid."


class NotFoundError(AppError):
    status = 404
    code = "not_found"
    default_message = "The requested resource was not found."


class UnauthorizedError(AppError):
    status = 401
    code = "unauthorized"
    default_message = "Your session has expired. Please sign in again."


class ForbiddenError(AppError):
    status = 403
    code = "forbidden"
    default_message = "You do not have access to this resource."


class ConflictError(AppError):
    status = 409
    code = "conflict"
    default_message = "This resource already exists."


class RateLimitError(AppError):
    status = 429
    code = "rate_limited"
    default_message = "Too many requests. Please wait a moment and try again."


class ServiceUnavailableError(AppError):
    status = 503
    code = "unavailable"
    default_message = "The service is temporarily unavailable. Please try again later."


def _body(message: str, code: str, details: dict | None = None) -> dict:
    out: dict = {"message": message, "code": code}
    if details:
        out["details"] = details
    return out


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_body(exc.message, exc.code, exc.details))

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for e in exc.errors()[:20]:
            errors.append({"loc": [str(x) for x in e.get("loc", [])], "msg": e.get("msg", "invalid"), "type": e.get("type", "value_error")})
        return JSONResponse(status_code=422, content=_body("Some of the submitted information is invalid.", "validation", {"errors": errors}))

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        status = exc.status_code
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 429: "rate_limited"}.get(status, "server" if status >= 500 else "validation")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return JSONResponse(status_code=status, content=_body(message, code))

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        # Never leak tracebacks, paths or connection strings to clients.
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content=_body("The server encountered an unexpected error.", "server"))
