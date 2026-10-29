"""Cross-content search over the published curriculum (database-backed)."""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser
from app.core.exceptions import ValidationAppError
from app.db.mongo import get_db
from app.schemas.search import SearchItem

router = APIRouter(tags=["search"])

CATEGORIES = {"Course", "Lesson", "Simulation", "Challenge", "Quiz", "Scenario"}


@router.get("/search", response_model=list[SearchItem])
async def search(
    q: str = Query(min_length=1, max_length=100),
    category: str | None = None,
    difficulty: str | None = None,
    limit: int = Query(default=30, ge=1, le=100),
    user: dict[str, Any] = CurrentUser,
) -> list[dict[str, Any]]:
    if category and category not in CATEGORIES:
        raise ValidationAppError(f"Unknown category '{category}'.", details={"allowed": sorted(CATEGORIES)})
    db = get_db()
    query: dict[str, Any] = {}
    rx = {"$regex": re.escape(q.strip()), "$options": "i"}
    query["$or"] = [{"title": rx}, {"description": rx}, {"keywords": rx}]
    if category:
        query["category"] = category
    if difficulty:
        query["difficulty"] = difficulty
    items = await db.search_items.find(query).limit(limit).to_list(limit)
    return [
        {"id": i["_id"], "category": i["category"], "title": i["title"], "description": i["description"], "difficulty": i.get("difficulty"), "href": i["href"], "keywords": i.get("keywords", "")}
        for i in items
    ]
