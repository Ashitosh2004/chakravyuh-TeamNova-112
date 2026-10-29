"""Course/lesson content schemas — shapes match the frontend's src/content/types.ts,
which the seeded curriculum and GET /api/v1/courses responses follow."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import SafeConfig

Difficulty = Literal["Beginner", "Intermediate", "Advanced"]


class CheckQuestionOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    q: str
    options: list[str]
    answer: int
    explanation: str


class LessonOut(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    title: str
    minutes: int
    summary: str
    sections: list[dict[str, Any]]
    terms: list[list[str]]
    equations: list[dict[str, Any]] | None = None
    steps: list[str] | None = None
    example: dict[str, Any] | None = None
    takeaways: list[str]
    check: list[CheckQuestionOut]
    simulations: list[str] | None = None
    diagram: dict[str, Any] | None = None


class ModuleOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    lessons: list[LessonOut]


class CourseOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    title: str
    short: str
    overview: str
    difficulty: Difficulty
    hours: float
    objectives: list[str]
    prerequisites: list[str]
    activities: list[dict[str, str]]
    quizIds: list[str]
    modules: list[ModuleOut]


class CourseSummary(BaseModel):
    id: str
    title: str
    short: str
    difficulty: str
    hours: float
    moduleCount: int
    lessonCount: int


class LessonCompleteResponse(BaseModel):
    lessonId: str
    courseId: str
    status: str
    completedAt: str | None = None


class SimulationOut(BaseModel):
    id: str
    title: str
    description: str
    difficulty: str
    lessons: list[dict[str, str]] = []


class ScenarioOut(BaseModel):
    id: str
    title: str
    problem: str
    objectives: list[str]
    difficulty: str


class SessionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    simulationId: str | None = None
    scenarioId: str | None = None
    configuration: SafeConfig = Field(default_factory=dict)


class SessionUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    configuration: SafeConfig | None = None
    resultsSummary: SafeConfig | None = None
    completed: bool | None = None


class SessionOut(BaseModel):
    id: str
    simulationId: str | None = None
    scenarioId: str | None = None
    configuration: dict[str, Any]
    resultsSummary: dict[str, Any] | None = None
    completed: bool
    createdAt: str
    updatedAt: str


class ScenarioRunResult(BaseModel):
    ok: bool
    summary: dict[str, Any]
