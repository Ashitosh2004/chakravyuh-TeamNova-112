"""Quiz schemas. Correct answers are never exposed before submission/review."""

from __future__ import annotations

from typing import Annotated, Any, Union

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import SafeId


def _check_answers(answers: dict[str, Any]) -> dict[str, Any]:
    if len(answers) > 200:
        raise ValueError("Too many answers")
    for qid, value in answers.items():
        SafeId(qid)  # key shape
        if value is None:
            continue
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
                raise ValueError(f"Answer for {qid} must be a finite number")
            continue
        if isinstance(value, list):
            if len(value) > 16:
                raise ValueError(f"Answer for {qid} is too long")
            for cell in value:
                if cell is None or cell in (0, 1) or cell in (True, False):
                    continue
                raise ValueError(f"Answer for {qid} must contain 0/1 cells")
            continue
        raise ValueError(f"Unsupported answer for {qid}")
    return answers


AnswersMap = Annotated[dict[str, Any], AfterValidator(_check_answers)]


class QuizSummary(BaseModel):
    id: str
    title: str
    category: str
    description: str
    difficulty: str
    timeLimitSec: int | None = None
    questionCount: int


class PublicQuestion(BaseModel):
    """Question as sent before submission — no answer, no explanation."""

    model_config = ConfigDict(extra="ignore")
    id: str
    type: str
    topic: str
    prompt: str
    options: list[str] | None = None
    inputs: list[str] | None = None
    tolerance: float | None = None
    unit: str | None = None
    figure: str | None = None


class QuizDetail(BaseModel):
    id: str
    title: str
    category: str
    description: str
    difficulty: str
    timeLimitSec: int | None = None
    questions: list[PublicQuestion]


class QuizSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    answers: AnswersMap
    timeTakenSec: int = Field(default=0, ge=0, le=24 * 3600)


class TopicScore(BaseModel):
    correct: int
    total: int


class PerQuestionResult(BaseModel):
    id: str
    correct: bool
    answered: bool


class QuizResultResponse(BaseModel):
    attemptId: str
    score: int
    total: int
    correct: int
    answered: int
    accuracy: int
    byTopic: dict[str, TopicScore]
    perQuestion: list[PerQuestionResult]
    timeTakenSec: int


class AttemptSummary(BaseModel):
    attemptId: str
    quizId: str
    quizTitle: str
    score: int
    accuracy: int
    total: int
    submittedAt: str
    started: bool = True


class ReviewQuestion(PerQuestionResult):
    prompt: str
    type: str
    topic: str
    yourAnswer: Any = None
    correctAnswer: Any = None
    explanation: str | None = None
    options: list[str] | None = None


class QuizReviewResponse(BaseModel):
    attemptId: str
    quizId: str
    quizTitle: str
    score: int
    accuracy: int
    timeTakenSec: int
    submitted: bool
    questions: list[ReviewQuestion]
    byTopic: dict[str, TopicScore]
