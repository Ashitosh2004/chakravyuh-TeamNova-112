import { ArrowRight } from "lucide-react";

import { GateSymbol } from "@/components/lab/GateSymbol";
import { Plot } from "@/components/lab/Plot";
import type { Diagram as D } from "@/content/types";
import { amAt, amEnvelope } from "@/engines/communication";
import { generateWave, samplePoints } from "@/engines/signals";

export function Diagram({ d }: { d: D }) {
  let content: React.ReactNode;
  if (d.kind === "blocks") {
    content = (
      <div className="flex flex-wrap items-center gap-2">
        {d.blocks.map((b, i) => (
          <div key={b} className="flex items-center gap-2">
            <div className="rounded-md border-2 border-primary/70 bg-card px-3 py-2 font-mono text-xs font-medium">{b}</div>
            {i < d.blocks.length - 1 && <ArrowRight className="h-4 w-4 text-signal" />}
          </div>
        ))}
      </div>
    );
  } else if (d.kind === "gate") {
    content = <div className="mx-auto max-w-xs"><GateSymbol type={d.gate} /></div>;
  } else if (d.kind === "wave") {
    content = <Plot ariaLabel={d.caption} tMax={2} vMax={1.2} height={160} series={[{ label: d.shape, className: "stroke-signal", points: generateWave({ shape: d.shape, amplitude: 1, frequency: 2, phase: 0 }, 2) }]} />;
  } else if (d.kind === "am") {
    const p = { Ac: 1, fc: 20, fm: 2, m: 0.6 };
    const pts = (f: (t: number) => number) => Array.from({ length: 800 }, (_, i) => ({ t: i / 799, v: f(i / 799) }));
    content = <Plot ariaLabel={d.caption} tMax={1} vMax={1.8} height={160} series={[{ label: "AM wave", className: "stroke-signal", points: pts((t) => amAt(p, t)) }, { label: "Envelope", className: "stroke-success", dashed: true, points: pts((t) => amEnvelope(p, t)) }]} />;
  } else {
    const w = { shape: "sine" as const, amplitude: 1, frequency: 2, phase: 0 };
    content = <Plot ariaLabel={d.caption} tMax={1} vMax={1.2} height={160} series={[{ label: "Continuous", className: "stroke-muted-foreground", points: generateWave(w, 1) }, { label: "Samples (fs = 16 Hz)", className: "stroke-signal", dots: true, points: samplePoints(w, 16, 1) }]} />;
  }
  return (
    <figure className="panel bg-blueprint p-4">
      {content}
      <figcaption className="mt-2 text-xs text-muted-foreground">Figure: {d.caption}</figcaption>
    </figure>
  );
}
