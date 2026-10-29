"""Deterministic educational scenario engines — Python ports of
src/engines/scenarios.ts, src/engines/sensors.ts (rule engine) and
src/engines/network.ts (communication-network model).

These are teaching simulations with fixed, explainable behaviour; they are not
real-world controllers and consume no live sensor data.
"""

from __future__ import annotations

import math
from typing import Any

SENSOR_META = {
    "temperature": {"label": "Temperature", "unit": "°C"},
    "light": {"label": "Light intensity", "unit": "lux"},
    "distance": {"label": "Distance", "unit": "cm"},
    "motion": {"label": "Motion (PIR)", "unit": "0/1"},
    "humidity": {"label": "Humidity", "unit": "%RH"},
    "airQuality": {"label": "Air quality index", "unit": "AQI"},
    "gas": {"label": "Gas concentration", "unit": "ppm"},
    "smoke": {"label": "Smoke density", "unit": "%"},
}

ACTUATOR_META = {
    "fan": "Fan", "led": "LED", "buzzer": "Buzzer", "alarm": "Alarm siren",
    "lamp": "Lamp", "ventilation": "Ventilation", "notify": "Notification",
}

_VALID_SENSORS = set(SENSOR_META)
_VALID_ACTUATORS = set(ACTUATOR_META)
_VALID_OPS = {">", "<", ">=", "<=", "=="}


def _compare(v: float, op: str, t: float) -> bool:
    return {">": v > t, "<": v < t, ">=": v >= t, "<=": v <= t, "==": v == t}[op]


def run_rules(rules: list[dict[str, Any]], readings: dict[str, float]) -> dict[str, Any]:
    actuators: dict[str, bool] = {}
    events: list[dict[str, Any]] = []
    for r in rules:
        if not r.get("enabled", True):
            continue
        actuator = r.get("actuator")
        sensor = r.get("sensor")
        if actuator not in _VALID_ACTUATORS or sensor not in _VALID_SENSORS or r.get("op") not in _VALID_OPS:
            events.append({"ruleId": str(r.get("id", "?")), "fired": False, "message": "Invalid rule; skipped."})
            continue
        actuators.setdefault(actuator, False)
        v = readings.get(sensor)
        if v is None:
            events.append({"ruleId": str(r.get("id", "?")), "fired": False, "message": f"{SENSOR_META[sensor]['label']} has no reading; rule skipped."})
            continue
        fired = _compare(float(v), r["op"], float(r["threshold"]))
        if fired:
            actuators[actuator] = True
        m = SENSOR_META[sensor]
        events.append({
            "ruleId": str(r.get("id", "?")),
            "fired": fired,
            "message": (
                f"{m['label']} = {v:g}{m['unit']} {'satisfies' if fired else 'does not satisfy'} "
                f'"{r["op"]} {r["threshold"]:g}{m["unit"]}" → {ACTUATOR_META[actuator]} {"ON" if fired else "unchanged"}.'
            ),
        })
    return {"actuators": actuators, "events": events}


def day_profile() -> list[dict[str, Any]]:
    """Deterministic 24-hour sensor profile (port of scenarios.ts dayProfile)."""
    out = []
    for h in range(24):
        temperature = round((24 + 9 * math.sin(((h - 9) / 24) * 2 * math.pi)) * 10) / 10
        light = round(900 * math.sin(((h - 6) / 12) * math.pi)) if 6 <= h <= 18 else 5
        motion = 1 if (7 <= h <= 9 or 18 <= h <= 23) else 0
        humidity = round(60 - 15 * math.sin(((h - 9) / 24) * 2 * math.pi))
        air_quality = round(40 + (90 * math.sin(((h - 8) / 8) * math.pi) if 8 <= h <= 16 else 0))
        out.append({"hour": h, "readings": {"temperature": temperature, "light": light, "motion": motion, "humidity": humidity, "airQuality": air_quality, "distance": 200}})
    return out


def env_status(r: dict[str, float], t: dict[str, float]) -> dict[str, Any]:
    checks = []
    for key, value, limit, unit in [
        ("Temperature", r.get("temperature", 0), t.get("tempMax", 30), "°C"),
        ("Humidity", r.get("humidity", 0), t.get("humidityMax", 60), "%RH"),
        ("Air quality", r.get("airQuality", 0), t.get("aqiMax", 100), "AQI"),
    ]:
        band = "good" if value <= limit * 0.85 else ("moderate" if value <= limit else "poor")
        checks.append({"key": key, "value": value, "limit": limit, "unit": unit, "band": band})
    alert = any(c["band"] == "poor" for c in checks)
    return {"checks": checks, "alert": alert}


SAFETY_CASES = [
    {"name": "Normal air", "gas": 150, "smoke": 2, "expected": "normal"},
    {"name": "Cooking on gas stove", "gas": 350, "smoke": 8, "expected": "normal"},
    {"name": "Small LPG leak", "gas": 700, "smoke": 3, "expected": "warning"},
    {"name": "Major LPG leak", "gas": 1400, "smoke": 5, "expected": "alarm"},
    {"name": "Smouldering fire", "gas": 300, "smoke": 45, "expected": "alarm"},
]


def safety_level(gas: float, smoke: float, c: dict[str, float]) -> str:
    if gas >= c.get("gasAlarm", 1000) or smoke >= c.get("smokeAlarm", 30):
        return "alarm"
    if gas >= c.get("gasWarn", 500):
        return "warning"
    return "normal"


_RANK = {"normal": 0, "warning": 1, "alarm": 2}


def evaluate_safety(c: dict[str, float]) -> dict[str, Any]:
    cases = []
    for s in SAFETY_CASES:
        got = safety_level(s["gas"], s["smoke"], c)
        kind = "correct" if got == s["expected"] else ("false-positive" if _RANK[got] > _RANK[s["expected"]] else "missed")
        cases.append({**s, "got": got, "kind": kind})
    return {"cases": cases, "wellTuned": all(x["kind"] == "correct" for x in cases)}


def _shannon_capacity_mhz(bandwidth_mhz: float, snr_db: float) -> float:
    snr = 10 ** (snr_db / 10)
    return bandwidth_mhz * math.log2(1 + snr)


def _packet_loss_from_snr(snr_db: float) -> float:
    return 1 / (1 + math.exp((snr_db - 5) / 1.5))


def simulate_network(p: dict[str, float]) -> dict[str, Any]:
    signal = float(p.get("signalDbm", -60))
    noise = float(p.get("noiseDbm", -90))
    bandwidth = max(0.1, float(p.get("bandwidthMHz", 20)))
    load = max(0.0, float(p.get("offeredLoadMbps", 10)))
    hops = max(1, min(10, int(p.get("hops", 2))))
    per_hop = max(0.0, float(p.get("perHopDelayMs", 5)))

    snr_db = signal - noise
    capacity = max(0.0, _shannon_capacity_mhz(bandwidth, snr_db))
    radio_loss = _packet_loss_from_snr(snr_db)
    utilization = load / capacity if capacity > 0 else math.inf
    congestion_loss = (1 - 1 / utilization) if utilization > 1 else 0.0
    packet_loss = min(1.0, 1 - (1 - radio_loss) * (1 - congestion_loss))
    throughput = min(load, capacity) * (1 - radio_loss)
    rho = min(utilization, 0.99) if capacity > 0 else 0.99
    queue_ms = hops * per_hop * (rho / (1 - rho)) if rho < 1 else float("inf")
    latency = hops * per_hop + queue_ms
    if packet_loss < 0.01 and latency < 50:
        quality = "excellent"
    elif packet_loss < 0.05 and latency < 120:
        quality = "good"
    elif packet_loss < 0.2:
        quality = "fair"
    else:
        quality = "poor"
    explanations = [
        f"SNR = signal − noise = {signal:g} − ({noise:g}) = {snr_db:.1f} dB.",
        f"Shannon capacity C = B·log₂(1+SNR) = {capacity:.1f} Mbps for {bandwidth:g} MHz.",
        f"Radio packet loss ≈ {radio_loss * 100:.2f}% (falls sharply once SNR exceeds ~10 dB).",
        (
            f"Offered load exceeds capacity (utilization {utilization * 100:.0f}%): queues overflow and {congestion_loss * 100:.0f}% of packets are dropped."
            if utilization > 1
            else f"Link utilization is {utilization * 100:.0f}%; queueing delay grows as utilization approaches 100%."
        ),
        f"Latency = {hops} hops × {per_hop:g} ms + queueing {queue_ms:.1f} ms = {latency:.1f} ms.",
    ]
    return {
        "snrDb": snr_db, "capacityMbps": capacity, "packetLoss": packet_loss, "throughputMbps": throughput,
        "utilization": None if math.isinf(utilization) else utilization, "latencyMs": None if math.isinf(latency) else latency,
        "quality": quality, "explanations": explanations,
    }


# ------------------------------------------------------------------ dispatch

def validate_configuration(scenario_id: str, config: dict[str, Any]) -> str | None:
    """Return an error message for invalid configurations, or None if acceptable."""
    if scenario_id == "smart-home":
        rules = config.get("rules")
        if not isinstance(rules, list) or not rules:
            return "Configuration must include a non-empty 'rules' list."
        if len(rules) > 50:
            return "Too many rules (max 50)."
        for r in rules:
            if not isinstance(r, dict):
                return "Each rule must be an object."
            if r.get("sensor") not in _VALID_SENSORS:
                return f"Unknown sensor: {str(r.get('sensor'))[:32]}"
            if r.get("actuator") not in _VALID_ACTUATORS:
                return f"Unknown actuator: {str(r.get('actuator'))[:32]}"
            if r.get("op") not in _VALID_OPS:
                return f"Invalid comparator: {str(r.get('op'))[:32]}"
            if not isinstance(r.get("threshold"), (int, float)) or isinstance(r.get("threshold"), bool):
                return "Each rule needs a numeric threshold."
        return None
    if scenario_id == "safety-system":
        for key in ("gasWarn", "gasAlarm", "smokeAlarm"):
            v = config.get(key)
            if not isinstance(v, (int, float)) or isinstance(v, bool) or not (0 <= float(v) <= 5000):
                return f"'{key}' must be a number between 0 and 5000."
        if float(config.get("gasWarn", 0)) >= float(config.get("gasAlarm", 0)):
            return "gasWarn must be below gasAlarm."
        return None
    if scenario_id == "environment-monitoring":
        for key in ("tempMax", "humidityMax", "aqiMax"):
            v = config.get(key)
            if not isinstance(v, (int, float)) or isinstance(v, bool) or float(v) <= 0:
                return f"'{key}' must be a positive number."
        return None
    if scenario_id == "communication-network":
        for key in ("signalDbm", "noiseDbm", "bandwidthMHz", "offeredLoadMbps", "hops", "perHopDelayMs"):
            v = config.get(key)
            if not isinstance(v, (int, float)) or isinstance(v, bool):
                return f"'{key}' must be a number."
        if float(config.get("signalDbm", 0)) <= float(config.get("noiseDbm", 0)):
            return "signalDbm must be greater than noiseDbm."
        return None
    return "Unknown scenario."


def run_scenario(scenario_id: str, config: dict[str, Any]) -> dict[str, Any]:
    """Execute a scenario deterministically and return an explainable summary."""
    error = validate_configuration(scenario_id, config)
    if error:
        return {"ok": False, "error": error, "summary": {}}

    if scenario_id == "smart-home":
        rules = config["rules"]
        hours = day_profile()
        fired_counts: dict[str, int] = {}
        actuator_hours: dict[str, int] = {}
        skipped = 0
        for h in hours:
            result = run_rules(rules, h["readings"])
            for ev in result["events"]:
                if "skipped" in ev["message"] or "Invalid" in ev["message"]:
                    skipped += 1
                elif ev["fired"]:
                    fired_counts[ev["ruleId"]] = fired_counts.get(ev["ruleId"], 0) + 1
            for act, on in result["actuators"].items():
                if on:
                    actuator_hours[act] = actuator_hours.get(act, 0) + 1
        return {
            "ok": True,
            "summary": {
                "kind": "smart-home",
                "simulatedHours": 24,
                "ruleFires": fired_counts,
                "actuatorOnHours": actuator_hours,
                "skippedRuleEvaluations": skipped,
                "advice": [
                    "Actuators that are ON almost all day usually mean the threshold is too aggressive.",
                    "Rules that never fire may have an unreachable threshold for this profile.",
                ],
            },
        }

    if scenario_id == "safety-system":
        result = evaluate_safety(config)
        return {"ok": True, "summary": {"kind": "safety-system", **result}}

    if scenario_id == "environment-monitoring":
        alerts = []
        worst_bands: dict[str, str] = {}
        for h in day_profile():
            status = env_status(h["readings"], config)
            if status["alert"]:
                alerts.append({"hour": h["hour"], "checks": [c for c in status["checks"] if c["band"] == "poor"]})
            for c in status["checks"]:
                if c["band"] == "poor" or c["key"] not in worst_bands:
                    if c["band"] == "poor":
                        worst_bands[c["key"]] = "poor"
                    else:
                        worst_bands.setdefault(c["key"], c["band"])
        return {
            "ok": True,
            "summary": {
                "kind": "environment-monitoring",
                "alertHours": len(alerts),
                "alerts": alerts[:8],
                "bandsByMetric": worst_bands,
                "note": "Status bands: good ≤ 85% of limit, moderate ≤ limit, poor > limit (educational model).",
            },
        }

    if scenario_id == "communication-network":
        result = simulate_network(config)
        return {"ok": True, "summary": {"kind": "communication-network", **result}}

    return {"ok": False, "error": "Unknown scenario.", "summary": {}}
