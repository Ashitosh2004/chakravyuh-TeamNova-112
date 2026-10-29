"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import ai, auth, challenges, courses, lab, progress, quizzes, search, users

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(courses.router)
api_router.include_router(quizzes.router)
api_router.include_router(challenges.router)
api_router.include_router(lab.router)
api_router.include_router(ai.router)
api_router.include_router(progress.router)
api_router.include_router(search.router)
