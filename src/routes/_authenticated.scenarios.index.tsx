import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { DifficultyBadge, PageHeader } from "@/components/layout/PageHeader";
import { SCENARIOS } from "@/content/catalog";
import { completedScenarios, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/scenarios/")({
  head: () => ({ meta: [{ title: "Real-World Scenarios — CHAKRAVYUH" }, { name: "description", content: "Smart home, safety, environmental monitoring and wireless network simulations." }, { property: "og:title", content: "Real-World Scenarios — CHAKRAVYUH" }, { property: "og:description", content: "Apply ENTC knowledge to practical systems." }] }),
  component: ScenarioIndex,
});

function ScenarioIndex() {
  const done = completedScenarios(useProgress((s) => s.events));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Scenarios" title="Real-world engineering scenarios" description="Configure virtual systems, run them and evaluate the results. All sensors and networks are simulated with deterministic, explainable rules." crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Scenarios" }]} />
      <div className="grid gap-4 sm:grid-cols-2">
        {SCENARIOS.map((s, i) => (
          <Link key={s.id} to="/scenarios/$scenarioId" params={{ scenarioId: s.id }} className="panel p-5 hover:shadow-lift">
            <div className="mb-2 flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">Scenario {String.fromCharCode(65 + i)}</span><DifficultyBadge level={s.difficulty} /></div>
            <h2 className="font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.problem}</p>
            {done.has(s.id) && <span className="mt-3 inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Completed</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
