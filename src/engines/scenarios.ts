import type { Readings } from "./sensors";

/** Deterministic 24-hour sensor profile for a room (hourly samples). */
export function dayProfile(): { hour: number; readings: Readings }[] {
  return Array.from({ length: 24 }, (_, h) => {
    const temperature = Math.round((24 + 9 * Math.sin(((h - 9) / 24) * 2 * Math.PI)) * 10) / 10; // peak ~33 °C at 15:00
    const light = h >= 6 && h <= 18 ? Math.round(900 * Math.sin(((h - 6) / 12) * Math.PI)) : 5;
    const motion = (h >= 7 && h <= 9) || (h >= 18 && h <= 23) ? 1 : 0;
    const humidity = Math.round(60 - 15 * Math.sin(((h - 9) / 24) * 2 * Math.PI));
    const airQuality = Math.round(40 + (h >= 8 && h <= 16 ? 90 * Math.sin(((h - 8) / 8) * Math.PI) : 0));
    return { hour: h, readings: { temperature, light, motion, humidity, airQuality, distance: 200 } };
  });
}

export type Band = "good" | "moderate" | "poor";

export interface EnvThresholds { tempMax: number; humidityMax: number; aqiMax: number }

export function envStatus(r: Readings, t: EnvThresholds) {
  const checks = [
    { key: "Temperature", value: r.temperature ?? 0, limit: t.tempMax, unit: "°C" },
    { key: "Humidity", value: r.humidity ?? 0, limit: t.humidityMax, unit: "%RH" },
    { key: "Air quality", value: r.airQuality ?? 0, limit: t.aqiMax, unit: "AQI" },
  ].map((c) => ({ ...c, band: (c.value <= c.limit * 0.85 ? "good" : c.value <= c.limit ? "moderate" : "poor") as Band }));
  const alert = checks.some((c) => c.band === "poor");
  return { checks, alert };
}

/** Safety system: graded response by severity. */
export interface SafetyConfig { gasWarn: number; gasAlarm: number; smokeAlarm: number }
export type SafetyLevel = "normal" | "warning" | "alarm";

export function safetyLevel(gas: number, smoke: number, c: SafetyConfig): SafetyLevel {
  if (gas >= c.gasAlarm || smoke >= c.smokeAlarm) return "alarm";
  if (gas >= c.gasWarn) return "warning";
  return "normal";
}

/** Reference test situations with the response a well-tuned system should give. */
export const SAFETY_CASES: { name: string; gas: number; smoke: number; expected: SafetyLevel }[] = [
  { name: "Normal air", gas: 150, smoke: 2, expected: "normal" },
  { name: "Cooking on gas stove", gas: 350, smoke: 8, expected: "normal" },
  { name: "Small LPG leak", gas: 700, smoke: 3, expected: "warning" },
  { name: "Major LPG leak", gas: 1400, smoke: 5, expected: "alarm" },
  { name: "Smouldering fire", gas: 300, smoke: 45, expected: "alarm" },
];

export function evaluateSafety(c: SafetyConfig) {
  return SAFETY_CASES.map((s) => {
    const got = safetyLevel(s.gas, s.smoke, c);
    const rank = { normal: 0, warning: 1, alarm: 2 };
    const kind = got === s.expected ? "correct" : rank[got] > rank[s.expected] ? "false-positive" : "missed";
    return { ...s, got, kind };
  });
}
