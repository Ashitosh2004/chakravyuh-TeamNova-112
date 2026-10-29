import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useCallback } from "react";
import { toast } from "sonner";

import { AskAIButton } from "@/components/assistant/AskAIButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { CommunicationNetwork, EnvironmentMonitoring, SafetySystem, SmartHome } from "@/components/scenarios/Scenarios";
import { getScenario } from "@/content/catalog";
import { useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/scenarios/$scenarioId")({
  loader: ({ params }) => {
    const s = getScenario(params.scenarioId);
    if (!s) throw notFound();
    return { title: s.title, problem: s.problem };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Scenario"} — CHAKRAVYUH` }, { name: "description", content: loaderData?.problem ?? "Scenario" }, { property: "og:title", content: `${loaderData?.title ?? "Scenario"} — CHAKRAVYUH` }, { property: "og:description", content: loaderData?.problem ?? "Scenario" }] }),
  notFoundComponent: () => <div className="p-6">Scenario not found. <Link to="/scenarios" className="text-signal underline">Back</Link></div>,
  component: ScenarioPage,
});

function ScenarioPage() {
  const { scenarioId } = Route.useParams();
  const s = getScenario(scenarioId)!;
  const record = useProgress((st) => st.record);
  const onComplete = useCallback(() => {
    const already = useProgress.getState().events.some((e) => e.type === "scenario_completed" && e.scenarioId === scenarioId);
    if (!already) { record({ type: "scenario_completed", scenarioId }); toast.success("Scenario completed!"); }
  }, [record, scenarioId]);
  const Comp = { "smart-home": SmartHome, "safety-system": SafetySystem, "environment-monitoring": EnvironmentMonitoring, "communication-network": CommunicationNetwork }[scenarioId]!;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Scenario" title={s.title} description={s.problem} crumbs={[{ label: "Scenarios", to: "/scenarios" }, { label: s.title }]} actions={<AskAIButton prompt={`Explain the engineering principles behind the ${s.title} scenario.`} context={`scenario:${s.id}`} />} />
      <div className="panel mb-4 p-4"><div className="eyebrow mb-1">Learning objectives</div><ul className="list-disc pl-5 text-sm">{s.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
      <Comp onComplete={onComplete} />
    </div>
  );
}
