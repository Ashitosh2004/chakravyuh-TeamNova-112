"""Coding challenge schemas. Hidden evaluation tests never leave the server."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TestCaseOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    inputs: dict[str, float]
    expectReturn: float | None = None
    expectPins: dict[str, float] | None = None
    expectOutput: list[str] | None = None
    tolerance: float | None = None


class ChallengeSummary(BaseModel):
    id: str
    title: str
    category: str
    difficulty: str
    points: int
    objective: str


class ChallengeDetail(ChallengeSummary):
    statement: str
    inputSpec: str
    outputSpec: str
    examples: list[dict[str, str]]
    constraints: list[str]
    starter: str
    tests: list[TestCaseOut]  # visible practice tests only
    hint: str
    supportedLanguage: str


class CodeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str = Field(min_length=1, max_length=20_000)


class TestResult(BaseModel):
    name: str
    passed: bool
    detail: str


class RunResponse(BaseModel):
    results: list[TestResult]


class SubmitResponse(BaseModel):
    passed: int
    total: int
    score: int


class SubmissionOut(BaseModel):
    id: str
    challengeId: str
    challengeTitle: str
    passedTestCount: int
    totalTestCount: int
    score: int
    executionStatus: str
    createdAt: str
    submittedCode: str
