import { Link } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { AskAIButton } from "@/components/assistant/AskAIButton";
import { Button } from "@/components/ui/button";
import type { Simulation } from "@/content/catalog";

export function LabWorkspace({ sim, instructions, controls, canvas, outputs, explanation, examples, challenge, onReset, note }: {
  sim: Simulation;
  instructions: string[];
  controls: ReactNode;
  canvas: ReactNode;
  outputs: ReactNode;
  explanation: ReactNode;
  examples?: { label: string; apply: () => void }[];
  challenge?: ReactNode;
  onReset: () => void;
  note?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReset}><RotateCcw /> Reset</Button>
        {examples?.map((e) => <Button key={e.label} variant="secondary" size="sm" onClick={e.apply}>{e.label}</Button>)}
        <div className="ml-auto"><AskAIButton prompt={`Explain what I'm seeing in the ${sim.title}.`} context={`simulation:${sim.id}`} label="Explain with AI" /></div>
      </div>
      {note && <p className="rounded-md border border-signal/30 bg-signal/5 px-3 py-2 text-xs">{note}</p>}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="panel p-4" aria-label="Simulation canvas">{canvas}</section>
          <section className="panel p-4" aria-label="Live outputs" aria-live="polite">{outputs}</section>
          <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold">Explanation</h2><div className="text-sm text-muted-foreground">{explanation}</div></section>
        </div>
        <aside className="space-y-4">
          <section className="panel p-4" aria-label="Controls"><h2 className="mb-3 text-sm font-semibold">Controls</h2>{controls}</section>
          {challenge && <section className="panel border-warning/50 p-4"><h2 className="mb-2 text-sm font-semibold">Challenge mode</h2>{challenge}</section>}
          <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold">Instructions</h2><ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">{instructions.map((i) => <li key={i}>{i}</li>)}</ol></section>
          <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold">Related lessons</h2><ul className="space-y-1 text-sm">{sim.lessons.map((l) => <li key={l.href}><Link to={l.href} className="text-signal hover:underline">{l.label}</Link></li>)}</ul></section>
        </aside>
      </div>
    </div>
  );
}

export function SliderRow({ label, value, min, max, step, onChange, unit, id }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; id: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs"><label htmlFor={id}>{label}</label><span className="font-mono">{Number.isInteger(step) ? value : value.toFixed(2)}{unit ? ` ${unit}` : ""}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-primary)]" />
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "ok" ? "text-success" : tone === "warn" ? "text-warning-foreground" : tone === "bad" ? "text-destructive" : "";
  return <div className="rounded-md border px-3 py-2"><div className="eyebrow">{label}</div><div className={`font-mono text-lg font-medium ${c}`}>{value}</div></div>;
}
