import { createFileRoute } from "@tanstack/react-router";
import { Award, Lock } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Progress } from "@/components/ui/progress";
import { computeAchievements, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Achievements — CHAKRAVYUH" }, { name: "description", content: "Milestones unlocked by your learning activity." }, { property: "og:title", content: "Achievements — CHAKRAVYUH" }, { property: "og:description", content: "Your ENTC learning milestones." }] }),
  component: AchievementsPage,
});

function AchievementsPage() {
  const list = computeAchievements(useProgress((s) => s.events));
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Milestones" title="Achievements" description={`${list.filter((a) => a.unlocked).length} of ${list.length} unlocked. Each unlocks only when its criteria are met.`} crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Achievements" }]} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((a) => (
          <div key={a.id} className={`panel p-5 ${a.unlocked ? "border-success/50" : ""}`}>
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${a.unlocked ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>{a.unlocked ? <Award className="h-5 w-5" /> : <Lock className="h-4 w-4" />}</div>
            <h2 className="font-semibold">{a.title}</h2>
            <p className="text-sm text-muted-foreground">{a.description}</p>
            <div className="mt-3 flex items-center gap-2"><Progress value={(a.progress / a.target) * 100} className="h-1.5 flex-1" /><span className="font-mono text-xs">{a.progress}/{a.target}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
