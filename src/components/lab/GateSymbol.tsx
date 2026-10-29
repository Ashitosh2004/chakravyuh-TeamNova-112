import type { GateType } from "@/engines/logic";
import { cn } from "@/lib/utils";

/** Distinctive-shape (ANSI) gate symbol drawn in a 100×60 box; inputs on left, output at (100,30). */
export function GatePath({ type }: { type: GateType }) {
  const base = type.replace(/^N(?=AND|OR)/, "").replace("XNOR", "XOR");
  const inverted = type === "NOT" || type === "NAND" || type === "NOR" || type === "XNOR";
  const bodyEnd = inverted ? 88 : 94;
  let body: string;
  if (type === "NOT") body = `M20,8 L20,52 L${bodyEnd - 4},30 Z`;
  else if (base === "AND") body = `M20,6 L64,6 A24,24 0 0 1 64,54 L20,54 Z`;
  else body = `M18,6 Q40,6 ${bodyEnd},30 Q40,54 18,54 Q32,30 18,6 Z`;
  return (
    <g>
      <path d={body} className="fill-card stroke-foreground" strokeWidth={2.2} strokeLinejoin="round" />
      {base === "XOR" && <path d="M10,6 Q24,30 10,54" fill="none" className="stroke-foreground" strokeWidth={2.2} />}
      {inverted && <circle cx={type === "NOT" ? 88 : 92} cy={30} r={5} className="fill-card stroke-foreground" strokeWidth={2.2} />}
    </g>
  );
}

export function GateSymbol({ type, inputs, output, className }: { type: GateType; inputs?: boolean[]; output?: boolean; className?: string }) {
  const n = type === "NOT" ? 1 : 2;
  const ys = n === 1 ? [30] : [18, 42];
  const wire = (on?: boolean) => (on === undefined ? "stroke-muted-foreground" : on ? "stroke-success" : "stroke-muted-foreground/50");
  return (
    <svg viewBox="-30 0 160 60" className={cn("h-auto w-full", className)} role="img" aria-label={`${type} gate symbol`}>
      {ys.map((yy, i) => (
        <line key={i} x1={-28} x2={type === "NOT" ? 20 : 26} y1={yy} y2={yy} strokeWidth={3} className={wire(inputs?.[i])} />
      ))}
      <line x1={type === "NOT" || type === "NAND" || type === "NOR" || type === "XNOR" ? 97 : type === "AND" ? 88 : 94} x2={128} y1={30} y2={30} strokeWidth={3} className={wire(output)} />
      <GatePath type={type} />
    </svg>
  );
}
