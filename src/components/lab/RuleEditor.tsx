import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ACTUATOR_META, SENSOR_META, type ActuatorId, type Comparator, type Rule, type SensorId } from "@/engines/sensors";

export function RuleEditor({ rules, onChange, sensors, actuators }: { rules: Rule[]; onChange: (r: Rule[]) => void; sensors: SensorId[]; actuators: ActuatorId[] }) {
  const upd = (id: string, p: Partial<Rule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const sel = "h-8 rounded-md border bg-background px-1.5 text-xs";
  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={r.id} className="flex flex-wrap items-center gap-1.5 rounded-md border p-2 text-xs">
          <Switch checked={r.enabled} onCheckedChange={(v) => upd(r.id, { enabled: v })} aria-label={`Enable rule ${i + 1}`} />
          <span>IF</span>
          <select aria-label="Sensor" className={sel} value={r.sensor} onChange={(e) => upd(r.id, { sensor: e.target.value as SensorId })}>{sensors.map((s) => <option key={s} value={s}>{SENSOR_META[s].label}</option>)}</select>
          <select aria-label="Comparator" className={sel} value={r.op} onChange={(e) => upd(r.id, { op: e.target.value as Comparator })}>{([">", "<", ">=", "<=", "=="] as Comparator[]).map((o) => <option key={o}>{o}</option>)}</select>
          <input aria-label="Threshold" type="number" className={`${sel} w-20`} value={r.threshold} onChange={(e) => upd(r.id, { threshold: Number(e.target.value) })} />
          <span>{SENSOR_META[r.sensor].unit} THEN</span>
          <select aria-label="Actuator" className={sel} value={r.actuator} onChange={(e) => upd(r.id, { actuator: e.target.value as ActuatorId })}>{actuators.map((a) => <option key={a} value={a}>{ACTUATOR_META[a]}</option>)}</select>
          <span>ON</span>
          <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label={`Delete rule ${i + 1}`} onClick={() => onChange(rules.filter((x) => x.id !== r.id))}><Trash2 /></Button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...rules, { id: `r${Date.now()}`, sensor: sensors[0], op: ">", threshold: 0, actuator: actuators[0], enabled: true }])}><Plus /> Add rule</Button>
    </div>
  );
}

export function ActuatorBoard({ states, actuators }: { states: Partial<Record<ActuatorId, boolean>>; actuators: ActuatorId[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {actuators.map((a) => {
        const on = !!states[a];
        return (
          <div key={a} className={`rounded-md border-2 p-3 text-center transition-colors ${on ? (a === "alarm" || a === "buzzer" ? "border-destructive bg-destructive/10" : "border-success bg-success/10") : ""}`}>
            <div className={`mx-auto mb-1 h-4 w-4 rounded-full ${on ? (a === "alarm" || a === "buzzer" ? "bg-destructive" : "bg-success") : "bg-muted"}`} aria-hidden="true" />
            <div className="text-xs font-medium">{ACTUATOR_META[a]}</div>
            <div className="font-mono text-xs">{on ? "ON" : "OFF"}</div>
          </div>
        );
      })}
    </div>
  );
}
