"""Virtual laboratory: simulation catalog, session persistence, and the
deterministic real-world scenario engine (see services/scenarios_runtime.py).

Simulations compute on the client (deterministic engines bundled with the app);
the backend stores meaningful checkpoints — clients are expected to debounce
and save session checkpoints, not every slider move.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.api.deps import CurrentUser
from app.core.exceptions import ForbiddenError, NotFoundError, ValidationAppError
from app.core.security import utcnow
from app.db.mongo import get_db
from app.schemas.content import ScenarioOut, SessionCreate, SessionOut, SessionUpdate, SimulationOut
from app.services.activity import record_activity
from app.services.scenarios_runtime import run_scenario

router = APIRouter(tags=["lab"])


# ------------------------------------------------------------- simulations

@router.get("/simulations", response_model=list[SimulationOut])
async def list_simulations() -> list[dict[str, Any]]:
    db = get_db()
    sims = await db.simulations.find({"published": True}).to_list(50)
    return [{"id": s["_id"], "title": s["title"], "description": s["description"], "difficulty": s["difficulty"], "lessons": s.get("lessons", [])} for s in sims]


@router.get("/simulations/sessions", response_model=list[SessionOut])
async def my_simulation_sessions(
    limit: int = Query(default=20, ge=1, le=100), user: dict[str, Any] = CurrentUser
) -> list[dict[str, Any]]:
    db = get_db()
    sessions = await db.simulation_sessions.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit).to_list(limit)
    return [_session_out(s) for s in sessions]


@router.post("/simulations/sessions", status_code=201, response_model=SessionOut)
async def create_simulation_session(body: SessionCreate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    if not body.simulationId:
        raise ValidationAppError("simulationId is required.")
    sim = await db.simulations.find_one({"_id": body.simulationId, "published": True})
    if sim is None:
        raise NotFoundError("Simulation not found.")
    now = utcnow()
    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user["_id"],
        "simulation_type": body.simulationId,
        "configuration": body.configuration,
        "results_summary": None,
        "completed": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.simulation_sessions.insert_one(doc)
    return _session_out(doc)


@router.get("/simulations/sessions/{session_id}", response_model=SessionOut)
async def get_simulation_session(session_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    return _session_out(await _owned_simulation_session(session_id, user))


@router.patch("/simulations/sessions/{session_id}", response_model=SessionOut)
async def update_simulation_session(session_id: str, body: SessionUpdate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    session = await _owned_simulation_session(session_id, user)
    db = get_db()
    update: dict[str, Any] = {"updated_at": utcnow()}
    if body.configuration is not None:
        update["configuration"] = body.configuration
    if body.resultsSummary is not None:
        update["results_summary"] = body.resultsSummary
    if body.completed is not None:
        update["completed"] = body.completed
    await db.simulation_sessions.update_one({"_id": session["_id"]}, {"$set": update})
    return _session_out(await db.simulation_sessions.find_one({"_id": session["_id"]}))


@router.post("/simulations/sessions/{session_id}/complete", response_model=SessionOut)
async def complete_simulation_session(session_id: str, body: SessionUpdate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    session = await _owned_simulation_session(session_id, user)
    db = get_db()
    now = utcnow()
    await db.simulation_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"completed": True, "updated_at": now, **({"results_summary": body.resultsSummary} if body.resultsSummary is not None else {})}},
    )
    await record_activity(user["_id"], {"type": "simulation_used", "simulationId": session["simulation_type"]})
    return _session_out(await db.simulation_sessions.find_one({"_id": session["_id"]}))


async def _owned_simulation_session(session_id: str, user: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    session = await db.simulation_sessions.find_one({"_id": session_id})
    if session is None:
        raise NotFoundError("Session not found.")
    if session["user_id"] != user["_id"]:
        raise ForbiddenError()
    return session


def _session_out(s: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": s["_id"],
        "simulationId": s.get("simulation_type"),
        "scenarioId": s.get("scenario_id"),
        "configuration": s.get("configuration", {}),
        "resultsSummary": s.get("results_summary"),
        "completed": bool(s.get("completed")),
        "createdAt": s["created_at"].isoformat() if isinstance(s.get("created_at"), datetime) else str(s["created_at"]),
        "updatedAt": s["updated_at"].isoformat() if isinstance(s.get("updated_at"), datetime) else str(s["updated_at"]),
    }


# --------------------------------------------------------------- scenarios

@router.get("/scenarios", response_model=list[ScenarioOut])
async def list_scenarios() -> list[dict[str, Any]]:
    db = get_db()
    scenarios = await db.scenarios.find({"published": True}).to_list(50)
    return [{"id": s["_id"], "title": s["title"], "problem": s["problem"], "objectives": s["objectives"], "difficulty": s["difficulty"]} for s in scenarios]


@router.get("/scenarios/sessions", response_model=list[SessionOut])
async def my_scenario_sessions(
    limit: int = Query(default=20, ge=1, le=100), user: dict[str, Any] = CurrentUser
) -> list[dict[str, Any]]:
    db = get_db()
    sessions = await db.scenario_sessions.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit).to_list(limit)
    return [_session_out(s) for s in sessions]


@router.post("/scenarios/sessions", status_code=201, response_model=SessionOut)
async def create_scenario_session(body: SessionCreate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    db = get_db()
    if not body.scenarioId:
        raise ValidationAppError("scenarioId is required.")
    scenario = await db.scenarios.find_one({"_id": body.scenarioId, "published": True})
    if scenario is None:
        raise NotFoundError("Scenario not found.")
    now = utcnow()
    doc = {
        "_id": uuid.uuid4().hex,
        "user_id": user["_id"],
        "scenario_id": body.scenarioId,
        "configuration": body.configuration,
        "result_summary": None,
        "completed": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.scenario_sessions.insert_one(doc)
    return _session_out(doc)


@router.get("/scenarios/sessions/{session_id}", response_model=SessionOut)
async def get_scenario_session(session_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    return _session_out(await _owned_scenario_session(session_id, user))


@router.patch("/scenarios/sessions/{session_id}", response_model=SessionOut)
async def update_scenario_session(session_id: str, body: SessionUpdate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    session = await _owned_scenario_session(session_id, user)
    db = get_db()
    update: dict[str, Any] = {"updated_at": utcnow()}
    if body.configuration is not None:
        update["configuration"] = body.configuration
    if body.resultsSummary is not None:
        update["result_summary"] = body.resultsSummary
    if body.completed is not None:
        update["completed"] = body.completed
    await db.scenario_sessions.update_one({"_id": session["_id"]}, {"$set": update})
    return _session_out(await db.scenario_sessions.find_one({"_id": session["_id"]}))


@router.post("/scenarios/sessions/{session_id}/run")
async def run_scenario_session(session_id: str, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    """Deterministic, explainable server-side evaluation of the stored configuration."""
    session = await _owned_scenario_session(session_id, user)
    db = get_db()
    result = run_scenario(session["scenario_id"], session.get("configuration", {}))
    if not result["ok"]:
        raise ValidationAppError(result["error"], code="invalid_configuration")
    await db.scenario_sessions.update_one(
        {"_id": session["_id"]}, {"$set": {"result_summary": result["summary"], "updated_at": utcnow()}}
    )
    return {"sessionId": session["_id"], "scenarioId": session["scenario_id"], "summary": result["summary"]}


@router.post("/scenarios/sessions/{session_id}/complete", response_model=SessionOut)
async def complete_scenario_session(session_id: str, body: SessionUpdate, user: dict[str, Any] = CurrentUser) -> dict[str, Any]:
    session = await _owned_scenario_session(session_id, user)
    db = get_db()
    now = utcnow()
    await db.scenario_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"completed": True, "updated_at": now, **({"result_summary": body.resultsSummary} if body.resultsSummary is not None else {})}},
    )
    await record_activity(user["_id"], {"type": "scenario_completed", "scenarioId": session["scenario_id"]})
    return _session_out(await db.scenario_sessions.find_one({"_id": session["_id"]}))


async def _owned_scenario_session(session_id: str, user: dict[str, Any]) -> dict[str, Any]:
    db = get_db()
    session = await db.scenario_sessions.find_one({"_id": session_id})
    if session is None:
        raise NotFoundError("Session not found.")
    if session["user_id"] != user["_id"]:
        raise ForbiddenError()
    return session
