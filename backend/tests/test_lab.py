"""Virtual lab: simulation/scenario catalogs, session persistence, ownership,
deterministic scenario evaluation."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.usefixtures("seeded_app")


async def test_simulation_and_scenario_catalogs_public(client):
    sims = (await client.get("/api/v1/simulations")).json()
    assert len(sims) == 5
    assert {s["id"] for s in sims} >= {"logic-gates", "circuit-builder", "signals", "communication", "sensors"}
    scenarios = (await client.get("/api/v1/scenarios")).json()
    assert len(scenarios) == 4
    assert all("objectives" in s for s in scenarios)


async def test_simulation_session_lifecycle(user):
    client, _ = user
    created = await client.post(
        "/api/v1/simulations/sessions",
        json={"simulationId": "logic-gates", "configuration": {"gate": "xor", "inputs": {"a": 1, "b": 0}}},
    )
    assert created.status_code == 201
    session = created.json()
    assert session["simulationId"] == "logic-gates"
    assert session["completed"] is False
    sid = session["id"]

    # Simulate a debounced checkpoint save.
    updated = await client.patch(
        f"/api/v1/simulations/sessions/{sid}",
        json={"configuration": {"gate": "xor", "inputs": {"a": 1, "b": 1}}, "resultsSummary": {"output": 0}},
    )
    assert updated.status_code == 200
    assert updated.json()["configuration"]["inputs"]["b"] == 1

    # Reload the session and verify the saved configuration.
    reloaded = await client.get(f"/api/v1/simulations/sessions/{sid}")
    assert reloaded.json()["resultsSummary"] == {"output": 0}

    completed = await client.post(f"/api/v1/simulations/sessions/{sid}/complete", json={})
    assert completed.status_code == 200
    assert completed.json()["completed"] is True

    progress = (await client.get("/api/v1/progress")).json()
    assert progress["simulationsUsed"] == 1

    listing = (await client.get("/api/v1/simulations/sessions")).json()
    assert any(s["id"] == sid for s in listing)


async def test_simulation_session_requires_valid_simulation(user):
    client, _ = user
    resp = await client.post("/api/v1/simulations/sessions", json={"simulationId": "nope", "configuration": {}})
    assert resp.status_code == 404


async def test_session_ownership_enforced(user, second_user):
    client_a, _ = user
    client_b, _ = second_user
    sid = (
        await client_a.post("/api/v1/simulations/sessions", json={"simulationId": "signals", "configuration": {"shape": "sine"}})
    ).json()["id"]
    denied = await client_b.get(f"/api/v1/simulations/sessions/{sid}")
    assert denied.status_code == 403
    denied_patch = await client_b.patch(f"/api/v1/simulations/sessions/{sid}", json={"completed": True})
    assert denied_patch.status_code == 403


async def test_scenario_run_is_deterministic_and_explainable(user):
    client, _ = user
    sid = (
        await client.post(
            "/api/v1/scenarios/sessions",
            json={
                "scenarioId": "communication-network",
                "configuration": {"signalDbm": -60, "noiseDbm": -90, "bandwidthMHz": 20, "offeredLoadMbps": 10, "hops": 2, "perHopDelayMs": 5},
            },
        )
    ).json()["id"]
    run1 = await client.post(f"/api/v1/scenarios/sessions/{sid}/run")
    assert run1.status_code == 200
    summary = run1.json()["summary"]
    assert summary["snrDb"] == 30.0
    assert summary["explanations"], "results must be explainable"
    run2 = await client.post(f"/api/v1/scenarios/sessions/{sid}/run")
    assert run2.json()["summary"] == summary, "identical configuration must give identical results"


async def test_scenario_validation_rejects_bad_config(user):
    client, _ = user
    sid = (
        await client.post(
            "/api/v1/scenarios/sessions",
            json={"scenarioId": "safety-system", "configuration": {"gasWarn": 900, "gasAlarm": 500, "smokeAlarm": 30}},
        )
    ).json()["id"]
    resp = await client.post(f"/api/v1/scenarios/sessions/{sid}/run")
    assert resp.status_code == 422
    assert "gasWarn" in resp.json()["message"]


async def test_smart_home_rules_engine(user):
    client, _ = user
    sid = (
        await client.post(
            "/api/v1/scenarios/sessions",
            json={
                "scenarioId": "smart-home",
                "configuration": {
                    "rules": [
                        {"id": "r1", "sensor": "temperature", "op": ">", "threshold": 30, "actuator": "fan", "enabled": True},
                        {"id": "r2", "sensor": "motion", "op": "==", "threshold": 1, "actuator": "lamp", "enabled": True},
                    ]
                },
            },
        )
    ).json()["id"]
    run = await client.post(f"/api/v1/scenarios/sessions/{sid}/run")
    assert run.status_code == 200
    summary = run.json()["summary"]
    assert summary["simulatedHours"] == 24
    assert summary["actuatorOnHours"], "the temperature rule must fire during the day profile"
    completed = await client.post(f"/api/v1/scenarios/sessions/{sid}/complete", json={})
    assert completed.status_code == 200
    progress = (await client.get("/api/v1/progress")).json()
    assert progress["scenariosCompleted"] == 1
