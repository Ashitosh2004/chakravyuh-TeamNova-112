import { Link, createFileRoute } from "@tanstack/react-router";

import { DifficultyBadge, PageHeader } from "@/components/layout/PageHeader";
import { SIMULATIONS } from "@/content/catalog";
import { usedSimulations, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/lab/")({
  head: () => ({ meta: [{ title: "Virtual Electronics Lab — CHAKRAVYUH" }, { name: "description", content: "Browser-based logic, circuit, signal, communication and sensor simulations." }, { property: "og:title", content: "Virtual Electronics Lab — CHAKRAVYUH" }, { property: "og:description", content: "Simulations that actually compute." }] }),
  component: LabIndex,
});

function LabIndex() {
  const used = usedSimulations(useProgress((s) => s.events));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Virtual Lab" title="Simulation gallery" description="Interactive workspaces with live outputs, explanations, examples and challenge modes. Complex circuit editing works best on a larger screen." crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Virtual Lab" }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATIONS.map((s) => (
          <Link key={s.id} to="/lab/$simulationId" params={{ simulationId: s.id }} className="panel group flex flex-col p-5 hover:shadow-lift">
            <div className="mb-4 flex items-center justify-between"><s.icon className="h-6 w-6 text-signal" /><DifficultyBadge level={s.difficulty} /></div>
            <h2 className="font-semibold group-hover:text-signal">{s.title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <span className="mt-3 text-xs text-muted-foreground">{used.has(s.id) ? "✓ Explored" : "Not opened yet"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
