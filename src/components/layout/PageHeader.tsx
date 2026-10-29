import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface Crumb { label: string; to?: string }

export function PageHeader({ title, description, crumbs, actions, eyebrow }: { title: string; description?: string; crumbs?: Crumb[]; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {c.to ? <Link to={c.to} className="hover:text-foreground hover:underline">{c.label}</Link> : <span aria-current="page" className="text-foreground">{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-2 border-dashed p-6">
      <div className="font-display font-semibold">{title}</div>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function DifficultyBadge({ level }: { level?: string }) {
  if (!level) return null;
  const tone = level === "Beginner" ? "border-success/40 text-success" : level === "Intermediate" ? "border-signal/40 text-signal" : "border-warning/60 text-warning-foreground bg-warning/15";
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${tone}`}>{level}</span>;
}
