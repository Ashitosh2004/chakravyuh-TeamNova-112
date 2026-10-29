import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState, type PointerEvent as RPE } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Simulation } from "@/content/catalog";
import { circuitTruthTable, evaluateCircuit, GATE_TYPES, inputPortCount, validateCircuit, validateConnection, type Circuit, type NodeKind } from "@/engines/logic";
import { cn } from "@/lib/utils";
import { GatePath } from "./GateSymbol";
import { LabWorkspace } from "./LabWorkspace";

const W = 110, H = 60;
const STORAGE = "chakravyuh-circuit-v1";

function portPos(n: { x: number; y: number; kind: NodeKind }, port: number | "out") {
  if (port === "out") return { x: n.x + (n.kind === "INPUT" ? 70 : W), y: n.y + H / 2 };
  const count = inputPortCount(n.kind);
  const ys = count === 1 ? [H / 2] : [18, 42];
  return { x: n.x, y: n.y + ys[port] };
}

const HALF_ADDER: Circuit = {
  nodes: [
    { id: "a", kind: "INPUT", label: "A", x: 20, y: 40, value: true },
    { id: "b", kind: "INPUT", label: "B", x: 20, y: 180, value: false },
    { id: "x", kind: "XOR", label: "XOR1", x: 230, y: 50 },
    { id: "n", kind: "AND", label: "AND1", x: 230, y: 170 },
    { id: "s", kind: "OUTPUT", label: "SUM", x: 450, y: 50 },
    { id: "c", kind: "OUTPUT", label: "CARRY", x: 450, y: 170 },
  ],
  wires: [
    { id: "w1", from: "a", to: "x", toPort: 0 }, { id: "w2", from: "b", to: "x", toPort: 1 },
    { id: "w3", from: "a", to: "n", toPort: 0 }, { id: "w4", from: "b", to: "n", toPort: 1 },
    { id: "w5", from: "x", to: "s", toPort: 0 }, { id: "w6", from: "n", to: "c", toPort: 0 },
  ],
};
const EMPTY: Circuit = { nodes: [], wires: [] };

export function CircuitBuilder({ sim }: { sim: Simulation }) {
  const [c, setC] = useState<Circuit>(HALF_ADDER);
  const [pending, setPending] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [table, setTable] = useState<ReturnType<typeof circuitTruthTable> | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const counter = useRef(100);

  const issues = useMemo(() => validateCircuit(c), [c]);
  const values = useMemo(() => { try { return issues.length ? null : evaluateCircuit(c); } catch { return null; } }, [c, issues]);

  const change = (next: Circuit) => { setC(next); setTable(null); };
  const add = (kind: NodeKind) => {
    const id = `n${counter.current++}`;
    const count = c.nodes.filter((n) => n.kind === kind).length + 1;
    const label = kind === "INPUT" ? String.fromCharCode(65 + c.nodes.filter((n) => n.kind === "INPUT").length) : kind === "OUTPUT" ? `Y${count}` : `${kind}${count}`;
    const x = kind === "INPUT" ? 20 : kind === "OUTPUT" ? 470 : 240;
    change({ ...c, nodes: [...c.nodes, { id, kind, label, x, y: 20 + ((c.nodes.length * 70) % 300), value: false }] });
  };
  const remove = (id: string) => { change({ nodes: c.nodes.filter((n) => n.id !== id), wires: c.wires.filter((w) => w.from !== id && w.to !== id) }); setSelected(null); };
  const connect = (to: string, port: number) => {
    if (!pending) return;
    const err = validateConnection(c, pending, to, port);
    if (err) { toast.error(err); setPending(null); return; }
    change({ ...c, wires: [...c.wires, { id: `w${counter.current++}`, from: pending, to, toPort: port }] });
    setPending(null);
  };
  const toPoint = (e: RPE) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };

  return (
    <LabWorkspace
      sim={sim}
      onReset={() => { change(EMPTY); setPending(null); }}
      note="Supported: combinational digital logic (7 gate types, switches, LEDs). Feedback loops, timing and analog components are not simulated."
      instructions={["Add switches, gates and output LEDs.", "Click a component's output port (right dot), then an input port (left dot) to wire them.", "Drag components to rearrange; click a component then Delete to remove it.", "Click a switch body to toggle it; outputs update when the circuit is valid.", "Generate a truth table for all input combinations."]}
      examples={[{ label: "Load half adder", apply: () => change(HALF_ADDER) }]}
      controls={
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1">
            <Button size="sm" variant="secondary" onClick={() => add("INPUT")}>+ Switch</Button>
            <Button size="sm" variant="secondary" onClick={() => add("OUTPUT")}>+ LED</Button>
            {GATE_TYPES.map((g) => <Button key={g} size="sm" variant="outline" className="font-mono" onClick={() => add(g)}>{g}</Button>)}
          </div>
          <Button size="sm" variant="destructive" className="w-full" disabled={!selected} onClick={() => selected && remove(selected)}><Trash2 /> Delete selected</Button>
          <Button size="sm" className="w-full" onClick={() => { try { setTable(circuitTruthTable(c)); } catch (e) { toast.error((e as Error).message); } }} disabled={issues.length > 0}>Generate truth table</Button>
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" onClick={() => { localStorage.setItem(STORAGE, JSON.stringify(c)); toast.success("Circuit saved in this browser"); }}>Save locally</Button>
            <Button size="sm" variant="outline" onClick={() => { const s = localStorage.getItem(STORAGE); if (s) { change(JSON.parse(s)); toast.success("Circuit loaded"); } else toast.error("No saved circuit in this browser"); }}>Load</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Saving to your account will be available once the backend is connected.</p>
        </div>
      }
      canvas={
        <div className="overflow-x-auto">
          {pending && <p className="mb-2 text-xs text-signal">Now click an input port to complete the wire (Esc/click canvas to cancel).</p>}
          <svg ref={svgRef} viewBox="0 0 600 360" className="bg-blueprint h-auto w-full min-w-[560px] touch-none rounded-md border" role="application" aria-label="Circuit editor canvas"
            onPointerMove={(e) => { if (!drag.current) return; const p = toPoint(e); const d = drag.current; setC((s) => ({ ...s, nodes: s.nodes.map((n) => (n.id === d.id ? { ...n, x: Math.max(0, Math.min(490, p.x - d.dx)), y: Math.max(0, Math.min(300, p.y - d.dy)) } : n)) })); }}
            onPointerUp={() => { drag.current = null; }}
            onClick={(e) => { if (e.target === svgRef.current) { setPending(null); setSelected(null); } }}
            onKeyDown={(e) => { if (e.key === "Escape") setPending(null); if ((e.key === "Delete" || e.key === "Backspace") && selected) remove(selected); }} tabIndex={0}>
            {c.wires.map((w) => {
              const a = c.nodes.find((n) => n.id === w.from)!; const b = c.nodes.find((n) => n.id === w.to)!;
              const p1 = portPos(a, "out"), p2 = portPos(b, w.toPort); const mx = (p1.x + p2.x) / 2;
              const on = values?.[w.from];
              return <path key={w.id} d={`M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`} fill="none" strokeWidth={3} className={on ? "stroke-success" : "stroke-muted-foreground/60"}
                onDoubleClick={() => change({ ...c, wires: c.wires.filter((x) => x.id !== w.id) })}><title>Double-click to remove wire</title></path>;
            })}
            {c.nodes.map((n) => {
              const v = values?.[n.id] ?? (n.kind === "INPUT" ? n.value : undefined);
              const sel = selected === n.id;
              return (
                <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                  <g className="cursor-grab"
                    onPointerDown={(e) => { const p = toPoint(e); drag.current = { id: n.id, dx: p.x - n.x, dy: p.y - n.y }; setSelected(n.id); }}
                    onClick={() => { if (n.kind === "INPUT") change({ ...c, nodes: c.nodes.map((x) => (x.id === n.id ? { ...x, value: !x.value } : x)) }); }}>
                    {n.kind === "INPUT" ? (
                      <><rect x={0} y={12} width={70} height={36} rx={6} className={cn("stroke-2", v ? "fill-success/20 stroke-success" : "fill-card stroke-foreground")} /><text x={10} y={35} className="fill-foreground font-mono text-[13px]">{n.label}={v ? 1 : 0}</text></>
                    ) : n.kind === "OUTPUT" ? (
                      <><circle cx={22} cy={30} r={16} className={cn("stroke-2", values ? (v ? "fill-success stroke-success" : "fill-card stroke-foreground") : "fill-muted stroke-warning")} /><text x={44} y={35} className="fill-foreground font-mono text-[12px]">{n.label}{values ? `=${v ? 1 : 0}` : "=?"}</text></>
                    ) : (
                      <><line x1={95} x2={W} y1={30} y2={30} strokeWidth={3} className={v ? "stroke-success" : "stroke-muted-foreground/60"} /><g transform="translate(5,0)"><GatePath type={n.kind} /></g><text x={30} y={72} className="fill-muted-foreground font-mono text-[10px]">{n.label}</text></>
                    )}
                    {sel && <rect x={-4} y={-2} width={n.kind === "INPUT" ? 78 : W + 8} height={H + 4} fill="none" strokeDasharray="4 3" className="stroke-signal" />}
                  </g>
                  {Array.from({ length: inputPortCount(n.kind) }, (_, p) => { const pp = portPos({ ...n, x: 0, y: 0 }, p); return (
                    <circle key={p} cx={pp.x} cy={pp.y} r={7} className={cn("cursor-pointer stroke-2 stroke-signal", pending ? "fill-signal/40" : "fill-card")} onClick={(e) => { e.stopPropagation(); connect(n.id, p); }} aria-label={`${n.label} input ${p + 1}`} />
                  ); })}
                  {n.kind !== "OUTPUT" && (() => { const pp = portPos({ ...n, x: 0, y: 0 }, "out"); return (
                    <circle cx={pp.x} cy={pp.y} r={7} className={cn("cursor-pointer stroke-2 stroke-primary", pending === n.id ? "fill-primary" : "fill-card")} onClick={(e) => { e.stopPropagation(); setPending(n.id); }} aria-label={`${n.label} output`} />
                  ); })()}
                </g>
              );
            })}
          </svg>
        </div>
      }
      outputs={
        <div className="space-y-3">
          {issues.length ? (
            <div role="alert" className="rounded-md border border-warning/60 bg-warning/10 p-3 text-sm"><strong>Circuit incomplete — not evaluated.</strong><ul className="mt-1 list-disc pl-5">{issues.slice(0, 5).map((i, k) => <li key={k}>{i.message}</li>)}</ul></div>
          ) : (
            <div className="flex flex-wrap gap-3">{c.nodes.filter((n) => n.kind === "OUTPUT").map((o) => <div key={o.id} className="rounded-md border px-3 py-2 font-mono"><span className="eyebrow block">{o.label}</span><span className={cn("text-xl font-bold", values?.[o.id] && "text-success")}>{values?.[o.id] ? 1 : 0}</span></div>)}</div>
          )}
          {table && (
            <div className="overflow-x-auto"><table className="text-center font-mono text-sm" aria-label="Circuit truth table">
              <thead><tr>{table.inputLabels.map((l) => <th key={l} className="border px-3 py-1">{l}</th>)}{table.outputLabels.map((l) => <th key={l} className="border bg-muted px-3 py-1">{l}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.inputs.map((v, j) => <td key={j} className="border px-3 py-1">{v ? 1 : 0}</td>)}{r.outputs.map((v, j) => <td key={j} className="border px-3 py-1 font-bold">{v ? 1 : 0}</td>)}</tr>)}</tbody>
            </table></div>
          )}
        </div>
      }
      explanation={<p>The engine evaluates each gate after resolving its inputs (a topological walk of the wiring graph). Connections are validated: an input port accepts one wire, outputs can fan out, and loops are rejected because sequential feedback isn't supported here. Green wires carry logic 1.</p>}
      challenge={<p className="text-sm">Build a circuit where Y = 1 only when exactly one of three switches is on? Start with two XOR gates (A⊕B⊕C) — then check its truth table: it's 1 for an odd count. Can you fix it with extra gates so the 1-1-1 row is 0?</p>}
    />
  );
}
