"""MongoDB connection management (pymongo AsyncMongoClient).

The client is created at startup; `/ready` performs a live ping. Endpoints that
need the database get a handle via `get_db`, which fails with a clear 503 when
the database is unreachable — the app never pretends a disconnected Mongo is
available and never falls back to an in-memory store.
"""

from __future__ import annotations

import logging
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.core.exceptions import ServiceUnavailableError

log = logging.getLogger("chakravyuh.db")

_client: AsyncMongoClient | None = None
_db: AsyncDatabase | None = None
_connected: bool = False


def connect() -> AsyncMongoClient:
    global _client, _db
    if _client is None:
        _client = AsyncMongoClient(
            settings.MONGODB_URI,
            tz_aware=True,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxPoolSize=50,
        )
        _db = _client[settings.MONGODB_DB]
    return _client


async def ping() -> bool:
    """Live connectivity check; also flips the cached connected flag."""
    global _connected
    if _client is None:
        connect()
    try:
        await _client.admin.command("ping")
        _connected = True
        return True
    except Exception as exc:  # noqa: BLE001 - driver raises many types
        _connected = False
        log.error("MongoDB ping failed: %s", type(exc).__name__)
        return False


def is_connected() -> bool:
    return _connected


def get_db() -> AsyncDatabase:
    if _db is None or not _connected:
        raise ServiceUnavailableError(
            "The database is not available. Check the MongoDB connection and try again.",
            code="database_unavailable",
        )
    return _db


async def close() -> None:
    global _client, _db, _connected
    if _client is not None:
        await _client.close()
    _client = None
    _db = None
    _connected = False
