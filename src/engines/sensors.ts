/** Deterministic rule engine for simulated (virtual) sensors and actuators. */

export type SensorId = "temperature" | "light" | "distance" | "motion" | "humidity" | "airQuality" | "gas" | "smoke";
export type ActuatorId = "fan" | "led" | "buzzer" | "alarm" | "lamp" | "ventilation" | "notify";
export type Comparator = ">" | "<" | ">=" | "<=" | "==";

export interface Rule {
  id: string;
  sensor: SensorId;
  op: Comparator;
  threshold: number;
  actuator: ActuatorId;
  enabled: boolean;
}

export type Readings = Partial<Record<SensorId, number>>;

export interface RuleEvent {
  ruleId: string;
  fired: boolean;
  message: string;
}

export const SENSOR_META: Record<SensorId, { label: string; unit: string; min: number; max: number; step: number }> = {
  temperature: { label: "Temperature", unit: "°C", min: -10, max: 60, step: 0.5 },
  light: { label: "Light intensity", unit: "lux", min: 0, max: 1000, step: 10 },
  distance: { label: "Distance", unit: "cm", min: 2, max: 400, step: 1 },
  motion: { label: "Motion (PIR)", unit: "0/1", min: 0, max: 1, step: 1 },
  humidity: { label: "Humidity", unit: "%RH", min: 0, max: 100, step: 1 },
  airQuality: { label: "Air quality index", unit: "AQI", min: 0, max: 500, step: 5 },
  gas: { label: "Gas concentration", unit: "ppm", min: 0, max: 2000, step: 10 },
  smoke: { label: "Smoke density", unit: "%", min: 0, max: 100, step: 1 },
};

export const ACTUATOR_META: Record<ActuatorId, string> = {
  fan: "Fan", led: "LED", buzzer: "Buzzer", alarm: "Alarm siren", lamp: "Lamp", ventilation: "Ventilation", notify: "Notification",
};

export function compare(v: number, op: Comparator, t: number) {
  switch (op) {
    case ">": return v > t;
    case "<": return v < t;
    case ">=": return v >= t;
    case "<=": return v <= t;
    case "==": return v === t;
  }
}

export function runRules(rules: Rule[], readings: Readings) {
  const actuators: Partial<Record<ActuatorId, boolean>> = {};
  const events: RuleEvent[] = [];
  for (const r of rules) {
    if (!r.enabled) continue;
    actuators[r.actuator] ??= false;
    const v = readings[r.sensor];
    if (v === undefined) {
      events.push({ ruleId: r.id, fired: false, message: `${SENSOR_META[r.sensor].label} has no reading; rule skipped.` });
      continue;
    }
    const fired = compare(v, r.op, r.threshold);
    if (fired) actuators[r.actuator] = true;
    const m = SENSOR_META[r.sensor];
    events.push({
      ruleId: r.id,
      fired,
      message: `${m.label} = ${v}${m.unit} ${fired ? "satisfies" : "does not satisfy"} "${r.op} ${r.threshold}${m.unit}" → ${ACTUATOR_META[r.actuator]} ${fired ? "ON" : "unchanged"}.`,
    });
  }
  return { actuators, events };
}

/** Ultrasonic HC-SR04 style: distance (cm) = echo time (µs) × 0.0343 / 2. */
export function ultrasonicDistance(echoMicros: number) {
  return (echoMicros * 0.0343) / 2;
}

/** LM35: 10 mV per °C. ADC with 10-bit, 5 V reference. */
export function lm35AdcToCelsius(adc: number, vref = 5, bits = 10) {
  return ((adc * vref) / (2 ** bits - 1)) * 100;
}

/** Map sensor value to PWM duty (0–255) between two thresholds. */
export function proportionalPwm(v: number, low: number, high: number) {
  if (v <= low) return 0;
  if (v >= high) return 255;
  return Math.round(((v - low) / (high - low)) * 255);
}
