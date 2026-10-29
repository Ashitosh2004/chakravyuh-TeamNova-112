import { memo } from "react";

export interface Series {
  points: { t: number; v: number }[];
  className: string; // stroke color class e.g. "stroke-signal"
  label: string;
  dashed?: boolean;
  step?: boolean;
  dots?: boolean;
}

/** Lightweight SVG oscilloscope-style plot. */
export const Plot = memo(function Plot({ series, tMax, vMax, height = 220, ariaLabel }: { series: Series[]; tMax: number; vMax: number; height?: number; ariaLabel: string }) {
  const W = 800;
  const H = height;
  const x = (t: number) => (t / tMax) * W;
  const y = (v: number) => H / 2 - (v / vMax) * (H / 2 - 8);
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-md border bg-card" role="img" aria-label={ariaLabel} preserveAspectRatio="none">
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`v${i}`} x1={(i * W) / 10} x2={(i * W) / 10} y1={0} y2={H} className="stroke-grid" strokeWidth={1} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} y1={(i * H) / 8} y2={(i * H) / 8} x1={0} x2={W} className="stroke-grid" strokeWidth={1} />
        ))}
        <line x1={0} x2={W} y1={H / 2} y2={H / 2} className="stroke-muted-foreground/40" strokeWidth={1} />
        {series.map((s, si) => {
          let d = "";
          s.points.forEach((p, i) => {
            if (s.step && i > 0) d += ` L${x(p.t)},${y(s.points[i - 1].v)}`;
            d += `${i === 0 ? "M" : " L"}${x(p.t)},${y(p.v)}`;
          });
          return (
            <g key={si}>
              <path d={d} fill="none" strokeWidth={2} className={s.className} strokeDasharray={s.dashed ? "6 5" : undefined} vectorEffect="non-scaling-stroke" />
              {s.dots && s.points.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r={3.5} className={s.className.replace("stroke-", "fill-")} />)}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" strokeWidth="2" className={s.className} strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
});
