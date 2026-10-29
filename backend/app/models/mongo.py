"""Typed shapes of the MongoDB documents used by the repositories.

These describe storage only; API request/response contracts live in schemas/.
"""

from __future__ import annotations

from typing import Any, TypedDict


class UserDoc(TypedDict, total=False):
    _id: str
    email: str  # lowercased, trimmed — uniqueness key
    display_name: str
    password_hash: str
    role: str  # "student" (self-service role changes to admin are rejected)
    level: str  # beginner | intermediate | advanced
    preferences: dict[str, Any]
    is_active: bool
    created_at: Any
    updated_at: Any
    last_login_at: Any | None


class SessionDoc(TypedDict, total=False):
    _id: str
    user_id: str
    refresh_token_hash: str
    expires_at: Any
    revoked: bool
    created_at: Any
    last_used_at: Any
    user_agent: str
    ip: str


class CourseDoc(TypedDict, total=False):
    _id: str
    title: str
    short: str
    overview: str
    difficulty: str
    hours: float
    objectives: list[str]
    prerequisites: list[str]
    activities: list[dict[str, str]]
    quiz_ids: list[str]
    module_ids: list[str]
    published: bool
    created_at: Any
    updated_at: Any


class ModuleDoc(TypedDict, total=False):
    _id: str
    course_id: str
    title: str
    order: int
    lesson_ids: list[str]


class ChallengeDoc(TypedDict, total=False):
    _id: str
    title: str
    category: str
    difficulty: str
    points: int
    objective: str
    statement: str
    input_spec: str
    output_spec: str
    examples: list[dict[str, str]]
    constraints: list[str]
    starter: str
    tests: list[dict[str, Any]]  # visible practice tests
    hint: str
    supported_language: str
    published: bool


class QuizDoc(TypedDict, total=False):
    _id: str
    title: str
    category: str
    description: str
    difficulty: str
    time_limit_sec: int | None
    question_ids: list[str]
    published: bool


class QuizQuestionDoc(TypedDict, total=False):
    _id: str
    quiz_id: str
    order: int
    type: str  # mcq | tf | numeric | truthtable
    topic: str
    prompt: str
    options: list[str]
    inputs: list[str]  # truthtable input labels
    answer: Any
    tolerance: float | None
    unit: str
    explanation: str
    figure: str


class ActivityEventDoc(TypedDict, total=False):
    _id: str
    user_id: str
    type: str
    resource_id: str
    data: dict[str, Any]
    occurred_at: Any


class SubmissionDoc(TypedDict, total=False):
    _id: str
    user_id: str
    challenge_id: str
    submitted_code: str
    execution_status: str  # ok | error
    score: int
    passed_test_count: int
    total_test_count: int
    created_at: Any


class ConversationDoc(TypedDict, total=False):
    _id: str
    user_id: str
    title: str
    context: dict[str, Any]
    created_at: Any
    updated_at: Any


class MessageDoc(TypedDict, total=False):
    _id: str
    conversation_id: str
    user_id: str
    role: str  # user | assistant
    content: str
    created_at: Any
