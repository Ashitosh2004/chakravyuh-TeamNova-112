"""Search schemas (SearchItem shape matches src/content/search.ts)."""

from __future__ import annotations

from pydantic import BaseModel


class SearchItem(BaseModel):
    id: str
    category: str  # Course | Lesson | Simulation | Challenge | Quiz | Scenario
    title: str
    description: str
    difficulty: str | None = None
    href: str
    keywords: str = ""
