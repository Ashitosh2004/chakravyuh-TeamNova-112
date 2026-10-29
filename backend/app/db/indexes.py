"""Index creation. Called by the seed command and at startup when Mongo is reachable."""

from __future__ import annotations

from pymongo import ASCENDING, DESCENDING

from app.db.mongo import get_db

# Activity types that are idempotent per (user, type, resource): repeats must not
# inflate totals or duplicate achievements. Others (quiz_attempt, challenge_run,
# game_score) are append-only and excluded from the partial unique index.
IDEMPOTENT_ACTIVITY_TYPES = ["lesson_completed", "challenge_passed", "simulation_used", "scenario_completed"]


async def create_indexes() -> None:
    db = get_db()
    await db.users.create_index([("email", ASCENDING)], unique=True, name="uniq_email")

    s = db.token_sessions
    await s.create_index([("refresh_token_hash", ASCENDING)], unique=True, name="uniq_refresh_hash")
    await s.create_index([("expires_at", ASCENDING)], name="expiry", expireAfterSeconds=0)

    c = db.courses
    await c.create_index([("published", ASCENDING)], name="published")

    m = db.modules
    await m.create_index([("course_id", ASCENDING), ("order", ASCENDING)], name="course_order")

    l = db.lessons
    await l.create_index([("course_id", ASCENDING), ("module_id", ASCENDING), ("order", ASCENDING)], name="course_module_order")

    q = db.quizzes
    await q.create_index([("published", ASCENDING)], name="published")
    qq = db.quiz_questions
    await qq.create_index([("quiz_id", ASCENDING), ("order", ASCENDING)], name="quiz_order")

    qa = db.quiz_attempts
    await qa.create_index([("user_id", ASCENDING), ("quiz_id", ASCENDING), ("submitted_at", DESCENDING)], name="user_quiz_time")

    cs = db.coding_submissions
    await cs.create_index([("user_id", ASCENDING), ("challenge_id", ASCENDING), ("created_at", DESCENDING)], name="user_challenge_time")

    sim = db.simulation_sessions
    await sim.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_time")

    sc = db.scenario_sessions
    await sc.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_time")

    lp = db.lesson_progress
    await lp.create_index([("user_id", ASCENDING), ("lesson_id", ASCENDING)], unique=True, name="uniq_user_lesson")
    await lp.create_index([("user_id", ASCENDING), ("course_id", ASCENDING)], name="user_course")

    up = db.user_progress
    await up.create_index([("user_id", ASCENDING)], unique=True, name="uniq_user")

    ae = db.activity_events
    await ae.create_index([("user_id", ASCENDING), ("occurred_at", DESCENDING)], name="user_time")
    await ae.create_index(
        [("user_id", ASCENDING), ("type", ASCENDING), ("resource_id", ASCENDING)],
        unique=True,
        partialFilterExpression={"type": {"$in": IDEMPOTENT_ACTIVITY_TYPES}},
        name="uniq_user_type_resource_idempotent",
    )

    ach = db.achievements
    await ach.create_index([("code", ASCENDING)], unique=True, name="uniq_code")

    ua = db.user_achievements
    await ua.create_index([("user_id", ASCENDING), ("achievement_id", ASCENDING)], unique=True, name="uniq_user_achievement")

    conv = db.ai_conversations
    await conv.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)], name="user_time")

    msg = db.ai_messages
    await msg.create_index([("conversation_id", ASCENDING), ("created_at", ASCENDING)], name="conversation_time")

    si = db.search_items
    await si.create_index([("category", ASCENDING), ("difficulty", ASCENDING)], name="category_difficulty")
    await si.create_index([("title", ASCENDING)], name="title")
