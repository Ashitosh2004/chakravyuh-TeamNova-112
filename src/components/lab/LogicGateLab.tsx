import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Simulation } from "@/content/catalog";
import { evaluateGate, explainGate, GATE_INFO, GATE_TYPES, gateTruthTable, type GateType } from "@/engines/logic";
import { cn } from "@/lib/utils";
import { GateSymbol } from "./GateSymbol";
import { LabWorkspace } from "./LabWorkspace";

const STEPS = [
  "Step 1 — Read the gate's Boolean expression above the symbol.",
  "Step 2 — Set A = 0, B = 0 and note the output.",
  "Step 3 — Change one input at a time and predict the output before looking.",
  "Step 4 — Generate the truth table and compare with your predictions.",
];

export function LogicGateLab({ sim }: { sim: Simulation }) {
  const [gate, setGate] = useState<GateType>("AND");
  const [ins, setIns] = useState([false, false]);
  const [showTable, setShowTable] = useState(false);
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<{ gate: GateType; out: boolean } | null>(null);
  const n = GATE_INFO[gate].inputs;
  const inputs = ins.slice(0, n);
  const out = evaluateGate(gate, inputs);
  const table = useMemo(() => gateTruthTable(gate), [gate]);

  useEffect(() => { setShowTable(false); }, [gate]);

  const reset = () => { setGate("AND"); setIns([false, false]); setShowTable(false); setStep(0); setTarget(null); };
  const newChallenge = () => {
    const g = GATE_TYPES[Math.floor(Math.random() * GATE_TYPES.length)];
    setTarget({ gate: g, out: Math.random() > 0.5 });
    setGate(g);
    setIns([false, false]);
  };
  const solved = target && target.gate === gate && out === target.out;

  return (
    <LabWorkspace
      sim={sim}
      onReset={reset}
      instructions={["Choose a gate.", "Click the input switches to toggle 0/1.", "Watch the output LED and explanation update instantly.", "Generate the truth table for all combinations."]}
      examples={[{ label: "Example: XOR half-adder sum", apply: () => { setGate("XOR"); setIns([true, false]); } }, { label: "Example: NAND (universal)", apply: () => { setGate("NAND"); setIns([true, true]); } }]}
      controls={
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Gate type">
            {GATE_TYPES.map((g) => <button key={g} role="radio" aria-checked={g === gate} onClick={() => setGate(g)} className={cn("rounded-md border py-1.5 font-mono text-xs", g === gate ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}>{g}</button>)}
          </div>
          <div className="flex gap-2">
            {inputs.map((v, i) => (
              <button key={i} onClick={() => setIns((s) => s.map((x, j) => (j === i ? !x : x)))} aria-pressed={v} aria-label={`Input ${"AB"[i]} is ${v ? 1 : 0}`}
                className={cn("flex flex-1 items-center justify-between rounded-md border-2 px-3 py-2 font-mono", v ? "border-success bg-success/10" : "")}>
                <span>{"AB"[i]}</span><span className="text-lg font-bold">{v ? 1 : 0}</span>
              </button>
            ))}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setShowTable(true)}>Generate truth table</Button>
        </div>
      }
      canvas={
        <div className="bg-blueprint rounded-md p-4">
          <div className="mb-2 text-center font-mono text-sm">{GATE_INFO[gate].expr}</div>
          <div className="mx-auto max-w-md"><GateSymbol type={gate} inputs={inputs} output={out} /></div>
        </div>
      }
      outputs={
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className={cn("h-10 w-10 rounded-full border-2", out ? "border-success bg-success" : "border-muted-foreground/40")} aria-hidden="true" />
            <div><div className="eyebrow">Output Y</div><div className="font-mono text-2xl font-bold" data-testid="gate-output">{out ? 1 : 0}</div></div>
          </div>
          {showTable && (
            <table className="text-center font-mono text-sm" aria-label={`${gate} truth table`}>
              <thead><tr>{["A", "B"].slice(0, n).map((h) => <th key={h} className="border px-3 py-1">{h}</th>)}<th className="border bg-muted px-3 py-1">Y</th></tr></thead>
              <tbody>{table.map((r, i) => {
                const cur = r.inputs.every((v, j) => v === inputs[j]);
                return <tr key={i} className={cur ? "bg-signal/15" : ""}>{r.inputs.map((v, j) => <td key={j} className="border px-3 py-1">{v ? 1 : 0}</td>)}<td className="border px-3 py-1 font-bold">{r.output ? 1 : 0}</td></tr>;
              })}</tbody>
            </table>
          )}
        </div>
      }
      explanation={
        <div className="space-y-3">
          <p>{explainGate(gate, inputs)}</p>
          <p>{GATE_INFO[gate].description}</p>
          <div className="rounded-md border p-3">
            <div className="eyebrow mb-1">Step-by-step learning mode</div>
            <p className="text-foreground">{STEPS[step]}</p>
            <div className="mt-2 flex gap-2"><Button size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button><Button size="sm" variant="secondary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next step</Button></div>
          </div>
        </div>
      }
      challenge={
        target ? (
          <div className="space-y-2 text-sm">
            <p>Using the <strong>{target.gate}</strong> gate, set the inputs so that Y = <strong>{target.out ? 1 : 0}</strong>.</p>
            {solved ? <p className="font-medium text-success" role="status">Solved! Inputs {inputs.map((v) => (v ? 1 : 0)).join(",")} give Y = {out ? 1 : 0}.</p> : <p className="text-muted-foreground">Not yet — keep toggling.</p>}
            <Button size="sm" variant="outline" onClick={newChallenge}>New challenge</Button>
          </div>
        ) : <Button size="sm" onClick={newChallenge}>Start a challenge</Button>
      }
    />
  );
}
