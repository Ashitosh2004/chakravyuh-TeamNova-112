"""Shared schema primitives."""

from __future__ import annotations

import re
from typing import Annotated, Any

from pydantic import AfterValidator

_SAFE_KEY = re.compile(r"^[A-Za-z0-9_.\-]{1,64}$")
_ID_KEY = re.compile(r"^[A-Za-z0-9_\-]{1,64}$")


def reject_unsafe_keys(value: dict[str, Any]) -> dict[str, Any]:
    """Guard against NoSQL operator injection via free-form mapping keys."""
    for key in value:
        if key.startswith("$") or "." in key and not _SAFE_KEY.match(key):
            if not _SAFE_KEY.match(key):
                raise ValueError(f"Invalid key: {key[:32]!r}")
    return value


def safe_id(value: str) -> str:
    if not _ID_KEY.match(value):
        raise ValueError("Invalid identifier")
    return value


SafeId = Annotated[str, AfterValidator(safe_id)]
SafeConfig = Annotated[dict[str, Any], AfterValidator(reject_unsafe_keys)]
