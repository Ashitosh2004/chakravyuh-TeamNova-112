"""CHAKRAVYUH FastAPI application entry point.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000   (from backend/)
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import configure_logging
from app.db import indexes as db_indexes
from app.db import mongo
from app.api.v1.router import api_router
from app.api.v1.system import router as system_router

log = logging.getLogger("chakravyuh.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    for problem in settings.validate_environment():
        log.warning("Configuration: %s", problem)
    mongo.connect()
    connected = await mongo.ping()
    if connected:
        log.info("MongoDB connected (db=%s)", settings.MONGODB_DB)
        try:
            await db_indexes.create_indexes()
            log.info("Database indexes verified/created")
        except Exception:  # noqa: BLE001
            log.exception("Index creation failed — run `python -m app.seed` to initialize the database")
    else:
        log.error(
            "MongoDB is NOT reachable at the configured URI. Start the MongoDB service "
            "(e.g. `net start MongoDB`) or fix MONGODB_URI in backend/.env. The API will "
            "report readiness failures on /ready until the database responds."
        )
    yield
    await mongo.close()
    log.info("Shutdown complete")


app = FastAPI(
    title="CHAKRAVYUH API",
    version=__version__,
    description="Smart ENTC Learning & Innovation Platform — backend API.",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.middleware("http")
async def request_body_limit(request: Request, call_next):
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > settings.REQUEST_BODY_LIMIT_BYTES:
        return JSONResponse(status_code=413, content={"message": "Request body too large.", "code": "payload_too_large"})
    return await call_next(request)


app.include_router(api_router)
# Health/readiness live at the root (/health, /ready) per the launcher contract.
app.include_router(system_router)
