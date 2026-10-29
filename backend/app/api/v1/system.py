"""Health, readiness and public system info. No secrets or internals exposed."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import __version__
from app.core.config import settings
from app.db import mongo
from app.services.emailer import email_configured

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness: the process is running. Does not touch MongoDB."""
    return {"status": "ok", "app": settings.APP_NAME}


@router.get("/ready")
async def ready() -> JSONResponse:
    """Readiness: required dependencies (MongoDB) actually respond."""
    ok = await mongo.ping()
    if ok:
        return JSONResponse(status_code=200, content={"status": "ready", "database": "connected"})
    return JSONResponse(
        status_code=503,
        content={
            "status": "not_ready",
            "database": "unavailable",
            "message": "MongoDB is not reachable. Start the local MongoDB service or check MONGODB_URI in backend/.env.",
        },
    )


@router.get("/api/v1/system/info")
async def system_info() -> dict[str, Any]:
    provider = settings.AI_PROVIDER or None
    return {
        "app": settings.APP_NAME,
        "version": __version__,
        "environment": "production" if settings.is_production else "development",
        "aiConfigured": bool(settings.ai_configured),
        "aiProvider": provider,
        "emailConfigured": email_configured(),
        "database": settings.MONGODB_DB,
    }
