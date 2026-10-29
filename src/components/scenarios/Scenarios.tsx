import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { SliderRow, Stat } from "@/components/lab/LabWorkspace";
import { ActuatorBoard, RuleEditor } from "@/components/lab/RuleEditor";
import { Button } from "@/components/ui/button";
import { simulateNetwork, type NetworkParams } from "@/engines/network";
import { dayProfile, envStatus, evaluateSafety, safetyLevel, type EnvThresholds, type SafetyConfig } from "@/engines/scenarios";
import { runRules, type ActuatorId, type Rule, type SensorId } from "@/engines/sensors";
import { cn } from "@/lib/utils";

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return <section className={cn("panel p-4", className)}><h2 className="mb-3 text-sm font-semibold">{title}</h2>{children}</section>;
}

function useDayPlayer() {
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => { if (h >= 23) { setPlaying(false); setFinished(true); return 23; } return h + 1; }), 350);
    return () => clearInterval(t);
  }, [playing]);
  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => { if (hour >= 23) setHour(0); setPlaying(!playing); }}>{playing ? <><Pause /> Pause</> : <><Play /> {hour === 0 ? "Run scenario" : hour >= 23 ? "Replay" : "Resume"}</>}</Button>
      <Button size="sm" variant="outline" onClick={() => { setPlaying(false); setHour(0); setFinished(false); }}><RotateCcw /> Reset</Button>
      <input type="range" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="Hour of day" className="flex-1 accent-[var(--color-primary)]" />
      <span className="font-mono text-sm">{String(hour).padStart(2, "0")}:00</span>
    </div>
  );
  return { hour, controls, finished };
}

// ---------------- Smart home ----------------
const SH_SENSORS: SensorId[] = ["temperature", "light", "motion"];
const SH_ACTS: ActuatorId[] = ["fan", "lamp", "led", "buzzer"];
const SH_RULES: Rule[] = [
  { id: "a", sensor: "temperature", op: ">", threshold: 40, actuator: "fan", enabled: true },
  { id: "b", sensor: "light", op: "<", threshold: 100, actuator: "lamp", enabled: true },
];

export function SmartHome({ onComplete }: { onComplete: () => void }) {
  const [rules, setRules] = useState(SH_RULES);
  const { hour, controls, finished } = useDayPlayer();
  const profile = useMemo(dayProfile, []);
  const runs = useMemo(() => profile.map((p) => ({ hour: p.hour, readings: p.readings, ...runRules(rules, p.readings) })), [profile, rules]);
  const cur = runs[hour];
  const fanHours = runs.filter((r) => r.actuators.fan).length;
  const lampWaste = runs.filter((r) => r.actuators.lamp && !r.readings.motion).length;
  const goals = [
    { label: "Fan runs during the hottest hours (≥ 30 °C) — at least 4 hours", ok: runs.filter((r) => (r.readings.temperature ?? 0) >= 30).every((r) => r.actuators.fan) && fanHours >= 4 },
    { label: "Fan stays off when it's below 26 °C", ok: runs.filter((r) => (r.readings.temperature ?? 0) < 26).every((r) => !r.actuators.fan) },
    { label: "Lamp or LED is on whenever it is dark and someone is present", ok: runs.filter((r) => (r.readings.light ?? 0) < 100 && r.readings.motion).every((r) => r.actuators.lamp || r.actuators.led) },
  ];
  const allOk = goals.every((g) => g.ok);
  useEffect(() => { if (allOk && finished) onComplete(); }, [allOk, finished, onComplete]);

  return (
    <div className="space-y-4">
      <Panel title="1 · Configure rules">
        <RuleEditor rules={rules} onChange={setRules} sensors={SH_SENSORS} actuators={SH_ACTS} />
      </Panel>
      <Panel title="2 · Run a simulated 24-hour day">{controls}
        <div className="mt-4 grid grid-cols-3 gap-2"><Stat label="Temperature" value={`${cur.readings.temperature} °C`} /><Stat label="Light" value={`${cur.readings.light} lux`} /><Stat label="Motion" value={cur.readings.motion ? "Detected" : "None"} /></div>
        <div className="mt-4"><ActuatorBoard states={cur.actuators} actuators={SH_ACTS} /></div>
        <div className="mt-4 flex h-16 items-end gap-0.5" role="img" aria-label="Hours the fan was on">{runs.map((r) => <div key={r.hour} title={`${r.hour}:00 — ${r.readings.temperature} °C`} className={cn("flex-1 rounded-sm", r.actuators.fan ? "bg-signal" : "bg-muted", r.hour === hour && "ring-2 ring-ring")} style={{ height: `${((r.readings.temperature ?? 0) - 10) * 2.5}px` }} />)}</div>
        <p className="mt-1 text-xs text-muted-foreground">Bars: hourly temperature; blue = fan on.</p>
      </Panel>
      <Panel title="3 · Results & challenges">
        <div className="mb-3 grid grid-cols-2 gap-2"><Stat label="Fan hours" value={fanHours} /><Stat label="Lamp on with nobody home" value={`${lampWaste} h`} tone={lampWaste > 3 ? "warn" : "ok"} /></div>
        <ul className="space-y-1 text-sm">{goals.map((g) => <li key={g.label} className={g.ok ? "text-success" : "text-muted-foreground"}>{g.ok ? "✓" : "○"} {g.label}</li>)}</ul>
        <p className="mt-3 text-xs text-muted-foreground">{allOk ? (finished ? "All goals met — scenario completed." : "Goals met — run the full day to complete the scenario.") : "Tip: the default fan threshold of 40 °C is never reached; the lamp rule ignores occupancy."}</p>
        <ul className="mt-3 space-y-0.5 font-mono text-xs">{cur.events.map((e) => <li key={e.ruleId} className={e.fired ? "text-success" : "text-muted-foreground"}>{e.message}</li>)}</ul>
      </Panel>
    </div>
  );
}

// ---------------- Safety ----------------
export function SafetySystem({ onComplete }: { onComplete: () => void }) {
  const [c, setC] = useState<SafetyConfig>({ gasWarn: 300, gasAlarm: 600, smokeAlarm: 60 });
  const [gas, setGas] = useState(150);
  const [smoke, setSmoke] = useState(2);
  const results = useMemo(() => evaluateSafety(c), [c]);
  const level = safetyLevel(gas, smoke, c);
  const allOk = results.every((r) => r.kind === "correct");
  useEffect(() => { if (allOk) onComplete(); }, [allOk, onComplete]);
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-warning/60 bg-warning/10 p-3 text-xs"><strong>Educational simulation only.</strong> This is not a certified safety system; real installations must follow applicable standards.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="1 · Configure thresholds">
          <SliderRow id="gw" label="Gas warning at" value={c.gasWarn} min={100} max={1500} step={50} unit="ppm" onChange={(v) => setC({ ...c, gasWarn: v })} />
          <SliderRow id="ga" label="Gas alarm at" value={c.gasAlarm} min={100} max={2000} step={50} unit="ppm" onChange={(v) => setC({ ...c, gasAlarm: v })} />
          <SliderRow id="sa" label="Smoke alarm at" value={c.smokeAlarm} min={5} max={100} step={1} unit="%" onChange={(v) => setC({ ...c, smokeAlarm: v })} />
          {c.gasWarn >= c.gasAlarm && <p className="text-xs text-destructive" role="alert">Warning threshold should be below the alarm threshold.</p>}
        </Panel>
        <Panel title="2 · Live test">
          <SliderRow id="g" label="Gas reading" value={gas} min={0} max={2000} step={10} unit="ppm" onChange={setGas} />
          <SliderRow id="s" label="Smoke reading" value={smoke} min={0} max={100} step={1} unit="%" onChange={setSmoke} />
          <div className={cn("mt-2 rounded-md border-2 p-4 text-center font-display text-xl font-bold uppercase", level === "alarm" ? "border-destructive bg-destructive/10 text-destructive" : level === "warning" ? "border-warning bg-warning/15" : "border-success bg-success/10 text-success")} role="status">{level}</div>
          <p className="mt-2 text-xs text-muted-foreground">{level === "alarm" ? "Siren ON, ventilation ON, notification sent." : level === "warning" ? "Buzzer chirps, ventilation ON." : "All outputs idle."}</p>
        </Panel>
      </div>
      <Panel title="3 · Validate against reference situations">
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Situation</th><th>Gas</th><th>Smoke</th><th>Expected</th><th>Your system</th><th>Result</th></tr></thead>
          <tbody>{results.map((r) => <tr key={r.name} className="border-t"><td className="py-1.5">{r.name}</td><td className="font-mono">{r.gas}</td><td className="font-mono">{r.smoke}%</td><td>{r.expected}</td><td>{r.got}</td><td className={r.kind === "correct" ? "text-success" : "text-destructive"}>{r.kind === "correct" ? "✓" : r.kind === "missed" ? "Missed hazard" : "False alarm"}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-sm text-muted-foreground">{allOk ? "All situations handled correctly — scenario completed." : "Missed hazards are dangerous; false alarms erode trust so people disable alarms. Tune thresholds so both are zero."}</p>
      </Panel>
    </div>
  );
}

// ---------------- Environment ----------------
export function EnvironmentMonitoring({ onComplete }: { onComplete: () => void }) {
  const [t, setT] = useState<EnvThresholds>({ tempMax: 30, humidityMax: 70, aqiMax: 100 });
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ temperature: 26, humidity: 55, airQuality: 60 });
  const { hour, controls, finished } = useDayPlayer();
  const profile = useMemo(dayProfile, []);
  const readings = manual ? m : profile[hour].readings;
  const status = envStatus(readings, t);
  const alertHours = profile.filter((p) => envStatus(p.readings, t).alert).length;
  useEffect(() => { if (finished) onComplete(); }, [finished, onComplete]);
  return (
    <div className="space-y-4">
      <p className="rounded-md border border-signal/30 bg-signal/5 p-3 text-xs">Readings are simulated, not from connected sensors.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Alert thresholds">
          <SliderRow id="tm" label="Max comfortable temperature" value={t.tempMax} min={20} max={40} step={1} unit="°C" onChange={(v) => setT({ ...t, tempMax: v })} />
          <SliderRow id="hm" label="Max humidity" value={t.humidityMax} min={30} max={90} step={1} unit="%RH" onChange={(v) => setT({ ...t, humidityMax: v })} />
          <SliderRow id="am" label="Max AQI" value={t.aqiMax} min={50} max={300} step={10} unit="AQI" onChange={(v) => setT({ ...t, aqiMax: v })} />
        </Panel>
        <Panel title="Inputs">
          <div className="mb-3 flex gap-1">{["Simulated day", "Manual"].map((l, i) => <button key={l} aria-pressed={manual === (i === 1)} onClick={() => setManual(i === 1)} className={cn("rounded-md border px-3 py-1 text-xs", manual === (i === 1) && "border-primary bg-primary text-primary-foreground")}>{l}</button>)}</div>
          {manual ? <>
            <SliderRow id="mt" label="Temperature" value={m.temperature} min={10} max={45} step={0.5} unit="°C" onChange={(v) => setM({ ...m, temperature: v })} />
            <SliderRow id="mh" label="Humidity" value={m.humidity} min={0} max={100} step={1} unit="%RH" onChange={(v) => setM({ ...m, humidity: v })} />
            <SliderRow id="ma" label="Air quality index" value={m.airQuality} min={0} max={400} step={5} unit="AQI" onChange={(v) => setM({ ...m, airQuality: v })} />
          </> : controls}
        </Panel>
      </div>
      <Panel title="Readings & status">
        <div className="grid gap-2 sm:grid-cols-3">{status.checks.map((c) => <Stat key={c.key} label={`${c.key} (limit ${c.limit})`} value={`${c.value} ${c.unit} · ${c.band}`} tone={c.band === "good" ? "ok" : c.band === "moderate" ? "warn" : "bad"} />)}</div>
        <div role="status" className={cn("mt-3 rounded-md p-3 text-sm font-medium", status.alert ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>{status.alert ? "ALERT: one or more readings exceed limits — notify facility manager." : "All readings within limits."}</div>
        <p className="mt-3 text-xs text-muted-foreground">With these thresholds the simulated day triggers alerts for {alertHours} of 24 hours. “Moderate” means within 85–100% of the limit. AQI above 100 is generally considered unhealthy for sensitive groups.</p>
        <div className="mt-3 flex h-12 items-end gap-0.5" role="img" aria-label="Alert hours over the day">{profile.map((p) => <div key={p.hour} className={cn("flex-1 rounded-sm", envStatus(p.readings, t).alert ? "bg-destructive/70" : "bg-success/50", !manual && p.hour === hour && "ring-2 ring-ring")} style={{ height: `${(p.readings.airQuality ?? 0) / 3 + 6}px` }} />)}</div>
      </Panel>
    </div>
  );
}

// ---------------- Network ----------------
const NET_DEF: NetworkParams = { signalDbm: -70, noiseDbm: -95, bandwidthMHz: 20, offeredLoadMbps: 200, hops: 3, perHopDelayMs: 5 };
export function CommunicationNetwork({ onComplete }: { onComplete: () => void }) {
  const [p, setP] = useState(NET_DEF);
  const r = simulateNetwork(p);
  const goal = r.packetLoss < 0.01 && r.latencyMs < 50 && r.throughputMbps >= 25;
  useEffect(() => { if (goal) onComplete(); }, [goal, onComplete]);
  const set = (k: keyof NetworkParams) => (v: number) => setP({ ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Configuration">
          <SliderRow id="sig" label="Received signal" value={p.signalDbm} min={-110} max={-30} step={1} unit="dBm" onChange={set("signalDbm")} />
          <SliderRow id="noi" label="Noise floor" value={p.noiseDbm} min={-110} max={-60} step={1} unit="dBm" onChange={set("noiseDbm")} />
          <SliderRow id="bw" label="Channel bandwidth" value={p.bandwidthMHz} min={1} max={80} step={1} unit="MHz" onChange={set("bandwidthMHz")} />
          <SliderRow id="load" label="Offered load" value={p.offeredLoadMbps} min={1} max={400} step={1} unit="Mbps" onChange={set("offeredLoadMbps")} />
          <SliderRow id="hops" label="Hops" value={p.hops} min={1} max={8} step={1} onChange={set("hops")} />
          <SliderRow id="phd" label="Delay per hop" value={p.perHopDelayMs} min={1} max={30} step={1} unit="ms" onChange={set("perHopDelayMs")} />
          <Button size="sm" variant="outline" onClick={() => setP(NET_DEF)}><RotateCcw /> Reset</Button>
        </Panel>
        <Panel title="Results">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="SNR" value={`${r.snrDb.toFixed(1)} dB`} tone={r.snrDb > 20 ? "ok" : r.snrDb > 10 ? "warn" : "bad"} />
            <Stat label="Capacity" value={`${r.capacityMbps.toFixed(1)} Mbps`} />
            <Stat label="Throughput" value={`${r.throughputMbps.toFixed(1)} Mbps`} />
            <Stat label="Utilization" value={Number.isFinite(r.utilization) ? `${(r.utilization * 100).toFixed(0)}%` : "∞"} tone={r.utilization > 1 ? "bad" : r.utilization > 0.8 ? "warn" : "ok"} />
            <Stat label="Packet loss" value={`${(r.packetLoss * 100).toFixed(2)}%`} tone={r.packetLoss < 0.01 ? "ok" : r.packetLoss < 0.05 ? "warn" : "bad"} />
            <Stat label="Latency" value={`${r.latencyMs.toFixed(1)} ms`} tone={r.latencyMs < 50 ? "ok" : r.latencyMs < 120 ? "warn" : "bad"} />
          </div>
          <div className="mt-3 rounded-md border p-2 text-center text-sm">Link quality: <strong className="uppercase">{r.quality}</strong></div>
        </Panel>
      </div>
      <Panel title="Why — engineering principles"><ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{r.explanations.map((e) => <li key={e}>{e}</li>)}</ul></Panel>
      <Panel title="Challenge"><p className="text-sm">Deliver a video stream: throughput ≥ 25 Mbps, packet loss &lt; 1% and latency &lt; 50 ms. {goal ? <strong className="text-success">Achieved — scenario completed.</strong> : <span className="text-muted-foreground">Start state is congested — what can you change?</span>}</p></Panel>
    </div>
  );
}
