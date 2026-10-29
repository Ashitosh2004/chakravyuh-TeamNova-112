import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { DifficultyBadge, EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { CHALLENGES } from "@/content/challenges";
import { passedChallenges, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/coding/")({
  head: () => ({ meta: [{ title: "Coding Challenges — CHAKRAVYUH" }, { name: "description", content: "ENTC coding problems with Arduino-style C in a sandboxed evaluator." }, { property: "og:title", content: "Coding Challenges — CHAKRAVYUH" }, { property: "og:description", content: "Boolean logic, sensors, embedded and DSP coding practice." }] }),
  component: CodingIndex,
});

function CodingIndex() {
  const passed = passedChallenges(useProgress((s) => s.events));
  const cats = ["All", ...new Set(CHALLENGES.map((c) => c.category))];
  const [cat, setCat] = useState("All");
  const list = CHALLENGES.filter((c) => cat === "All" || c.category === cat);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Coding" title="Coding challenges" description="Write Arduino-style C. Code runs in ChakraScript — a restricted, sandboxed interpreter (no eval) supporting variables, if/else, loops, math helpers, digitalWrite, analogWrite and Serial.println." crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Coding" }]} />
      <div className="mb-5 flex flex-wrap gap-1" role="group" aria-label="Category filter">
        {cats.map((c) => <button key={c} aria-pressed={cat === c} onClick={() => setCat(c)} className={`rounded-md border px-3 py-1.5 text-xs ${cat === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{c}</button>)}
      </div>
      {list.length === 0 ? <EmptyState title="No challenges" description="Pick another category." /> : (
        <div className="panel divide-y">
          {list.map((c) => (
            <Link key={c.id} to="/coding/$challengeId" params={{ challengeId: c.id }} className="flex items-center gap-4 px-5 py-4 hover:bg-accent/40">
              {passed.has(c.id) ? <CheckCircle2 className="h-5 w-5 text-success" aria-label="Passed" /> : <span className="h-5 w-5 rounded-full border-2" aria-label="Not passed" />}
              <div className="min-w-0 flex-1"><div className="font-medium">{c.title}</div><div className="text-xs text-muted-foreground">{c.category} · {c.objective}</div></div>
              <DifficultyBadge level={c.difficulty} />
              <span className="w-14 text-right font-mono text-xs">{c.points} pts</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
