import { describe, expect, it } from "vitest";

import { runTests } from "@/engines/challenge";
import { amEfficiency, amStatus, carsonBandwidth, snrDb } from "@/engines/communication";
import { evalPuzzle, makePuzzle, puzzleSolutions, rapidScore } from "@/engines/games";
import { runScript } from "@/engines/interpreter";
import { circuitTruthTable, evaluateCircuit, evaluateGate, gateTruthTable, validateConnection, type Circuit } from "@/engines/logic";
import { simulateNetwork } from "@/engines/network";
import { formatClock, isCorrect, remainingSeconds, scoreQuiz, type Question } from "@/engines/quiz";
import { evaluateSafety, safetyLevel } from "@/engines/scenarios";
import { runRules, ultrasonicDistance } from "@/engines/sensors";
import { aliasFrequency, nyquistRate, quantize, samplePoints, waveAt } from "@/engines/signals";
import { CHALLENGES } from "@/content/challenges";
import { activityByDay, computeAchievements, learningStreak, type ActivityEvent } from "@/stores/progress";
import { passwordStrength, registerSchema } from "@/schemas/auth";
import { ApiError, apiRequest, errorFromStatus } from "@/services/api";

describe("logic gates", () => {
  it("produce correct truth tables", () => {
    const col = (g: Parameters<typeof gateTruthTable>[0]) => gateTruthTable(g).map((r) => (r.output ? 1 : 0)).join("");
    expect(col("AND")).toBe("0001");
    expect(col("OR")).toBe("0111");
    expect(col("NAND")).toBe("1110");
    expect(col("NOR")).toBe("1000");
    expect(col("XOR")).toBe("0110");
    expect(col("XNOR")).toBe("1001");
    expect(col("NOT")).toBe("10");
  });
  it("XOR over 3 inputs is odd parity", () => expect(evaluateGate("XOR", [true, true, true])).toBe(true));
});

const halfAdder: Circuit = {
  nodes: [
    { id: "a", kind: "INPUT", label: "A", x: 0, y: 0 }, { id: "b", kind: "INPUT", label: "B", x: 0, y: 0 },
    { id: "x", kind: "XOR", label: "X", x: 0, y: 0 }, { id: "n", kind: "AND", label: "N", x: 0, y: 0 },
    { id: "s", kind: "OUTPUT", label: "S", x: 0, y: 0 }, { id: "c", kind: "OUTPUT", label: "C", x: 0, y: 0 },
  ],
  wires: [
    { id: "1", from: "a", to: "x", toPort: 0 }, { id: "2", from: "b", to: "x", toPort: 1 },
    { id: "3", from: "a", to: "n", toPort: 0 }, { id: "4", from: "b", to: "n", toPort: 1 },
    { id: "5", from: "x", to: "s", toPort: 0 }, { id: "6", from: "n", to: "c", toPort: 0 },
  ],
};

describe("circuit engine", () => {
  it("evaluates a half adder truth table", () => {
    const t = circuitTruthTable(halfAdder);
    expect(t.rows.map((r) => r.outputs.map(Number).join(""))).toEqual(["00", "10", "10", "01"]);
  });
  it("refuses to evaluate incomplete circuits", () => {
    expect(() => evaluateCircuit({ ...halfAdder, wires: halfAdder.wires.slice(1) })).toThrow(/not connected/);
  });
  it("rejects double-connected ports, loops and wrong directions", () => {
    expect(validateConnection(halfAdder, "b", "x", 0)).toMatch(/already connected/);
    expect(validateConnection(halfAdder, "s", "x", 0)).toMatch(/no output/);
    const loop: Circuit = { nodes: [{ id: "g1", kind: "NOT", label: "g1", x: 0, y: 0 }, { id: "g2", kind: "NOT", label: "g2", x: 0, y: 0 }], wires: [{ id: "w", from: "g1", to: "g2", toPort: 0 }] };
    expect(validateConnection(loop, "g2", "g1", 0)).toMatch(/feedback loop/);
  });
});

describe("signals", () => {
  it("generates waveform values", () => {
    expect(waveAt({ shape: "sine", amplitude: 2, frequency: 1, phase: 0 }, 0.25)).toBeCloseTo(2);
    expect(waveAt({ shape: "square", amplitude: 1, frequency: 1, phase: 0 }, 0.75)).toBe(-1);
    expect(waveAt({ shape: "triangle", amplitude: 1, frequency: 1, phase: 0 }, 0.25)).toBeCloseTo(0);
  });
  it("computes sampling, aliasing and quantization", () => {
    expect(nyquistRate(3.4)).toBeCloseTo(6.8);
    expect(aliasFrequency(9, 12)).toBe(3);
    expect(samplePoints({ shape: "sine", amplitude: 1, frequency: 1, phase: 0 }, 10, 1)).toHaveLength(11);
    expect(quantize(0.3, 1, 1)).toBe(1);
  });
});

describe("modulation", () => {
  it("AM efficiency and status", () => {
    expect(amEfficiency(1)).toBeCloseTo(1 / 3);
    expect(amStatus(1.3)).toBe("over");
  });
  it("Carson's rule and SNR", () => {
    expect(carsonBandwidth(5, 10)).toBe(120);
    expect(snrDb(100, 1)).toBeCloseTo(20);
  });
});

describe("sensor rules & scenarios", () => {
  it("fires rules above threshold only", () => {
    const rules = [{ id: "r", sensor: "temperature" as const, op: ">" as const, threshold: 30, actuator: "fan" as const, enabled: true }];
    expect(runRules(rules, { temperature: 30 }).actuators.fan).toBe(false);
    expect(runRules(rules, { temperature: 30.5 }).actuators.fan).toBe(true);
  });
  it("ultrasonic conversion", () => expect(ultrasonicDistance(580)).toBeCloseTo(9.947, 2));
  it("safety system detects missed hazards and false alarms", () => {
    expect(safetyLevel(700, 0, { gasWarn: 500, gasAlarm: 1000, smokeAlarm: 30 })).toBe("warning");
    const bad = evaluateSafety({ gasWarn: 300, gasAlarm: 600, smokeAlarm: 60 });
    expect(bad.find((r) => r.name === "Cooking on gas stove")!.kind).toBe("false-positive");
    expect(bad.find((r) => r.name === "Smouldering fire")!.kind).toBe("missed");
    expect(evaluateSafety({ gasWarn: 500, gasAlarm: 1000, smokeAlarm: 30 }).every((r) => r.kind === "correct")).toBe(true);
  });
  it("network congestion increases loss", () => {
    const base = { signalDbm: -70, noiseDbm: -95, bandwidthMHz: 20, hops: 3, perHopDelayMs: 5 };
    expect(simulateNetwork({ ...base, offeredLoadMbps: 60 }).packetLoss).toBeLessThan(0.01);
    expect(simulateNetwork({ ...base, offeredLoadMbps: 400 }).packetLoss).toBeGreaterThan(0.5);
  });
});

describe("quiz scoring & timer", () => {
  const qs: Question[] = [
    { id: "1", type: "mcq", topic: "A", prompt: "", options: ["x", "y"], answer: 1, explanation: "" },
    { id: "2", type: "numeric", topic: "B", prompt: "", answer: 45, tolerance: 0, explanation: "" },
    { id: "3", type: "truthtable", topic: "A", prompt: "", inputs: ["A", "B"], answer: [0, 1, 1, 0], explanation: "" },
  ];
  it("scores answers by topic", () => {
    const r = scoreQuiz(qs, { "1": 1, "2": 44, "3": [0, 1, 1, 0] }, 30);
    expect(r.correct).toBe(2);
    expect(r.accuracy).toBe(67);
    expect(r.byTopic.A).toEqual({ correct: 2, total: 2 });
    expect(isCorrect(qs[1], 45)).toBe(true);
  });
  it("timer counts down and stops at zero", () => {
    expect(remainingSeconds(60, 0, 15_500)).toBe(45);
    expect(remainingSeconds(60, 0, 120_000)).toBe(0);
    expect(formatClock(125)).toBe("02:05");
  });
});

describe("sandboxed interpreter & challenges", () => {
  it("runs Arduino-style code", () => {
    const r = runScript("int s = 0; for (int i = 0; i < 4; i++) { s += i; } if (s == 6) digitalWrite(13, HIGH); return s;");
    expect(r.returnValue).toBe(6);
    expect(r.pins[13]).toBe(1);
  });
  it("stops infinite loops and blocks unknown functions", () => {
    expect(runScript("while (1) {}").error).toMatch(/Step limit/);
    expect(runScript("eval(1);").error).toMatch(/not available/);
  });
  it("every challenge has a reference solution that passes", () => {
    const solutions: Record<string, string> = {
      "xor-gate": "return (a && !b) || (!a && b);",
      "binary-to-decimal": "return b3*8 + b2*4 + b1*2 + b0;",
      "count-ones": "int c = 0; for (int i = 0; i < 8; i++) { c += (n >> i) & 1; } return c;",
      "fan-threshold": "digitalWrite(9, temp > 30); digitalWrite(13, temp >= 45);",
      hysteresis: "int s = prev; if (temp < 18) s = 1; if (temp > 22) s = 0; return s;",
      "pwm-brightness": "analogWrite(5, map(constrain(lux, 100, 800), 100, 800, 255, 0));",
      "moving-average": "return (x0 + x1 + x2 + x3) / 4;",
      "snr-db": "return 10 * log10(S / N);",
      "seven-segment-even": "if (n % 2 == 0) Serial.println(1); else Serial.println(0);",
      "gray-code": "return n ^ (n >> 1);",
    };
    for (const c of CHALLENGES) expect(runTests(solutions[c.id], c.tests).every((t) => t.passed), c.id).toBe(true);
    expect(runTests(CHALLENGES[0].starter, CHALLENGES[0].tests).every((t) => t.passed)).toBe(false);
  });
});

describe("games", () => {
  it("puzzles always have 1–3 solutions that evaluate to 1", () => {
    for (let s = 0; s < 20; s++) {
      const p = makePuzzle(s);
      const sols = puzzleSolutions(p);
      expect(sols.length).toBeGreaterThanOrEqual(1);
      expect(sols.length).toBeLessThanOrEqual(3);
      sols.forEach(([a, b, c]) => expect(evalPuzzle(p, a, b, c)).toBe(true));
    }
  });
  it("rapid score: +10 correct, -5 wrong, floor 0", () => {
    expect(rapidScore(3, 2)).toBe(20);
    expect(rapidScore(0, 4)).toBe(0);
  });
});

describe("progress & achievements", () => {
  const day = 86_400_000;
  const now = Date.UTC(2026, 9, 29, 12);
  const ev: ActivityEvent[] = [
    { type: "lesson_completed", courseId: "digital-electronics", lessonId: "binary-numbers", at: now - 2 * day },
    { type: "lesson_completed", courseId: "digital-electronics", lessonId: "logic-gates", at: now - day },
    { type: "simulation_used", simulationId: "logic-gates", at: now },
  ];
  it("unlocks achievements only when criteria are met", () => {
    const a = Object.fromEntries(computeAchievements(ev).map((x) => [x.id, x.unlocked]));
    expect(a["first-lesson"]).toBe(true);
    expect(a["logic-explorer"]).toBe(false);
    expect(a["quiz-starter"]).toBe(false);
    expect(computeAchievements([]).some((x) => x.unlocked)).toBe(false);
  });
  it("computes streak and activity", () => {
    expect(learningStreak(ev, now)).toBe(3);
    expect(activityByDay(ev, 7, now).reduce((s, d) => s + d.count, 0)).toBe(3);
  });
});

describe("forms & API errors", () => {
  it("validates registration", () => {
    expect(registerSchema.safeParse({ displayName: "Ana", email: "a@b.co", password: "Abcdefg1", confirm: "Abcdefg1" }).success).toBe(true);
    expect(registerSchema.safeParse({ displayName: "Ana", email: "a@b.co", password: "Abcdefg1", confirm: "x" }).success).toBe(false);
    expect(registerSchema.safeParse({ displayName: "Ana", email: "bad", password: "short", confirm: "short" }).success).toBe(false);
    expect(passwordStrength("Abcdefg1!").label).toBe("Strong");
  });
  it("maps HTTP errors", () => {
    expect(errorFromStatus(429, {}).kind).toBe("rate_limited");
    expect(errorFromStatus(401, {}).kind).toBe("unauthorized");
    expect(errorFromStatus(503, {}).retryable).toBe(true);
  });
  it("refuses when backend not configured, and reports network failure", async () => {
    await expect(apiRequest("/x", { baseUrl: "" })).rejects.toMatchObject({ kind: "not_configured" });
    const failing = (() => Promise.reject(new TypeError("fail"))) as unknown as typeof fetch;
    await expect(apiRequest("/x", { baseUrl: "http://x", fetchImpl: failing })).rejects.toBeInstanceOf(ApiError);
  });
});
