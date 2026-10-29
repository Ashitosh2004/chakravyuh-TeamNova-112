"""In-process sliding-window rate limiter.

Suitable for the single-process local deployment; swap for a Redis-backed
implementation when running multiple workers in production.
"""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque

from app.core.exceptions import RateLimitError

_BUCKETS: dict[str, deque] = defaultdict(deque)
_LOCK = asyncio.Lock()


async def enforce_rate_limit(key: str, limit_per_minute: int) -> None:
    now = time.monotonic()
    window = 60.0
    async with _LOCK:
        bucket = _BUCKETS[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        if len(bucket) >= limit_per_minute:
            raise RateLimitError("Too many requests. Please wait a moment and try again.")
        bucket.append(now)


def reset_rate_limits() -> None:
    """Test helper."""
    _BUCKETS.clear()
