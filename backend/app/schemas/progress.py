"""Progress, activity and achievement schemas (shapes follow docs/API_CONTRACT.md)."""

from __future__ import annotations

from typing import Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

ActivityType = Literal[
    "lesson_completed", "quiz_attempt", "challenge_run", "challenge_passed",
    "simulation_used", "scenario_completed", "game_score",
]

_ExtraIgnore = ConfigDict(extra="ignore")


class _Base(BaseModel):
    model_config = _ExtraIgnore


class LessonCompletedEvent(_Base):
    type: Literal["lesson_completed"]
    courseId: str = Field(max_length=64)
    lessonId: str = Field(max_length=64)


class QuizAttemptEvent(_Base):
    type: Literal["quiz_attempt"]
    quizId: str = Field(max_length=64)
    score: int = Field(ge=0, le=10_000)
    accuracy: int = Field(ge=0, le=100)
    byTopic: dict[str, Any] = Field(default_factory=dict)
    timeTakenSec: int = Field(default=0, ge=0, le=86400)


class ChallengeRunEvent(_Base):
    type: Literal["challenge_run"]
    challengeId: str = Field(max_length=64)
    passed: int = Field(ge=0, le=10_000)
    total: int = Field(ge=0, le=10_000)


class ChallengePassedEvent(_Base):
    type: Literal["challenge_passed"]
    challengeId: str = Field(max_length=64)
    points: int = Field(ge=0, le=10_000)


class SimulationUsedEvent(_Base):
    type: Literal["simulation_used"]
    simulationId: str = Field(max_length=64)


class ScenarioCompletedEvent(_Base):
    type: Literal["scenario_completed"]
    scenarioId: str = Field(max_length=64)


class GameScoreEvent(_Base):
    type: Literal["game_score"]
    game: str = Field(max_length=64)
    score: int = Field(ge=0, le=1_000_000)


ActivityEvent = Union[
    LessonCompletedEvent, QuizAttemptEvent, ChallengeRunEvent, ChallengePassedEvent,
    SimulationUsedEvent, ScenarioCompletedEvent, GameScoreEvent,
]
ActivityEventAdapter: TypeAdapter = TypeAdapter(ActivityEvent)


class ActivityRecorded(BaseModel):
    id: str


class ProgressSummary(BaseModel):
    lessonsCompleted: list[str]
    quizAttempts: int
    challengesPassed: int
    simulationsUsed: int
    scenariosCompleted: int
    totalPoints: int


class ActivityDay(BaseModel):
    date: str
    count: int


class CourseProgress(BaseModel):
    courseId: str
    totalLessons: int
    completedLessons: int
    percent: int


class AchievementOut(BaseModel):
    id: str
    title: str
    description: str
    unlocked: bool
    progress: int
    target: int


class UnlockedAchievement(BaseModel):
    id: str
    title: str
    description: str
    unlockedAt: str
