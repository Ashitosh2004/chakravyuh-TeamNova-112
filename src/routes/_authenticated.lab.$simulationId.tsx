import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getSimulation, type Simulation } from "@/content/catalog";
import { useProgress } from "@/stores/progress";

const LABS: Record<string, React.LazyExoticComponent<(p: { sim: Simulation }) => React.ReactElement>> = {
  "logic-gates": lazy(() => import("@/components/lab/LogicGateLab").then((m) => ({ default: m.LogicGateLab }))),
  "circuit-builder": lazy(() => import("@/components/lab/CircuitBuilder").then((m) => ({ default: m.CircuitBuilder }))),
  signals: lazy(() => import("@/components/lab/SignalLab").then((m) => ({ default: m.SignalLab }))),
  communication: lazy(() => import("@/components/lab/CommLab").then((m) => ({ default: m.CommLab }))),
  sensors: lazy(() => import("@/components/lab/SensorLab").then((m) => ({ default: m.SensorLab }))),
};

export const Route = createFileRoute("/_authenticated/lab/$simulationId")({
  loader: ({ params }) => {
    const s = getSimulation(params.simulationId);
    if (!s) throw notFound();
    return { title: s.title, description: s.description };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Simulation"} — CHAKRAVYUH Lab` }, { name: "description", content: loaderData?.description ?? "Virtual lab" }, { property: "og:title", content: `${loaderData?.title ?? "Simulation"} — CHAKRAVYUH` }, { property: "og:description", content: loaderData?.description ?? "Virtual lab" }] }),
  notFoundComponent: () => <div className="p-6">Simulation not found. <Link to="/lab" className="text-signal underline">Back to the lab</Link></div>,
  component: SimPage,
});

function SimPage() {
  const { simulationId } = Route.useParams();
  const sim = getSimulation(simulationId)!;
  const record = useProgress((s) => s.record);
  useEffect(() => { record({ type: "simulation_used", simulationId }); }, [simulationId, record]);
  const Lab = LABS[simulationId];
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="Virtual Lab" title={sim.title} description={sim.description} crumbs={[{ label: "Virtual Lab", to: "/lab" }, { label: sim.title }]} />
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}><Lab sim={sim} /></Suspense>
    </div>
  );
}
