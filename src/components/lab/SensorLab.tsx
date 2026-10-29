import { useMemo, useState } from "react";

import type { Simulation } from "@/content/catalog";
import { proportionalPwm, runRules, SENSOR_META, ultrasonicDistance, type ActuatorId, type Readings, type Rule, type SensorId } from "@/engines/sensors";
import { LabWorkspace, SliderRow, Stat } from "./LabWorkspace";
import { ActuatorBoard, RuleEditor } from "./RuleEditor";

const SENSORS: SensorId[] = ["temperature", "light", "distance", "motion"];
const ACTS: ActuatorId[] = ["fan", "led", "buzzer", "lamp"];
const DEF_READ: Readings = { temperature: 26, light: 400, distance: 120, motion: 0 };
const DEF_RULES: Rule[] = [
  { id: "r1", sensor: "temperature", op: ">", threshold: 30, actuator: "fan", enabled: true },
  { id: "r2", sensor: "light", op: "<", threshold: 200, actuator: "lamp", enabled: true },
  { id: "r3", sensor: "distance", op: "<", threshold: 20, actuator: "buzzer", enabled: true },
  { id: "r4", sensor: "motion", op: "==", threshold: 1, actuator: "led", enabled: true },
];

export function SensorLab({ sim }: { sim: Simulation }) {
  const [read, setRead] = useState<Readings>(DEF_READ);
  const [rules, setRules] = useState<Rule[]>(DEF_RULES);
  const result = useMemo(() => runRules(rules, read), [rules, read]);
  const echo = ((read.distance ?? 0) * 2) / 0.0343;
  const challengeOk = result.actuators.fan && !result.actuators.buzzer && result.actuators.lamp;

  return (
    <LabWorkspace
      sim={sim}
      onReset={() => { setRead(DEF_READ); setRules(DEF_RULES); }}
      note="All sensors here are virtual: you set the readings with sliders. Nothing is read from real hardware."
      instructions={["Move the sliders to change virtual sensor readings.", "Edit thresholds, comparators and target actuators in the rules.", "Watch actuators and the event log respond instantly.", "Disable a rule to see its effect disappear."]}
      examples={[{ label: "Hot afternoon", apply: () => setRead({ temperature: 36, light: 800, distance: 150, motion: 0 }) }, { label: "Night intruder", apply: () => setRead({ temperature: 22, light: 50, distance: 15, motion: 1 }) }]}
      controls={
        <div>
          {SENSORS.map((s) => { const m = SENSOR_META[s]; return <SliderRow key={s} id={s} label={m.label} value={read[s] ?? 0} min={m.min} max={m.max} step={m.step} unit={m.unit} onChange={(v) => setRead((r) => ({ ...r, [s]: v }))} />; })}
        </div>
      }
      canvas={
        <div className="space-y-4">
          <div className="eyebrow">Rules (evaluated top to bottom; any matching rule turns its actuator ON)</div>
          <RuleEditor rules={rules} onChange={setRules} sensors={SENSORS} actuators={ACTS} />
          <ActuatorBoard states={result.actuators} actuators={ACTS} />
        </div>
      }
      outputs={
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="LM35 output" value={`${((read.temperature ?? 0) * 10).toFixed(0)} mV`} />
            <Stat label="10-bit ADC" value={Math.round(((read.temperature ?? 0) * 0.01 * 1023) / 5)} />
            <Stat label="Ultrasonic echo" value={`${echo.toFixed(0)} µs`} />
            <Stat label="Fan PWM (25–40 °C)" value={proportionalPwm(read.temperature ?? 0, 25, 40)} />
          </div>
          <ul className="space-y-1 font-mono text-xs">{result.events.map((e) => <li key={e.ruleId} className={e.fired ? "text-success" : "text-muted-foreground"}>{e.fired ? "▶" : "·"} {e.message}</li>)}</ul>
        </div>
      }
      explanation={<p>Each rule compares a reading with a threshold. The engine is deterministic: the same readings and rules always give the same actuator states. Sensor conversions shown use real transfer functions — LM35 at 10 mV/°C, HC-SR04 distance = echo × 0.0343/2 (check: {ultrasonicDistance(echo).toFixed(1)} cm), and a proportional PWM mapping for fan speed.</p>}
      challenge={<p className="text-sm">Make the fan and lamp ON but the buzzer OFF at the same time. {challengeOk ? <strong className="text-success">Solved!</strong> : <span className="text-muted-foreground">Adjust readings or rules.</span>}</p>}
    />
  );
}
