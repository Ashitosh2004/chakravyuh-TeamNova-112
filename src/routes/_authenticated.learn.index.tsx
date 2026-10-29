import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";

import { DifficultyBadge, EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { COURSES, courseLessons, courseProgress } from "@/content/courses";
import { completedLessons, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/learn/")({
  head: () => ({ meta: [{ title: "Learning Center — CHAKRAVYUH" }, { name: "description", content: "Ten ENTC courses from digital electronics to AI for engineers." }, { property: "og:title", content: "Learning Center — CHAKRAVYUH" }, { property: "og:description", content: "Structured ENTC courses with lessons and practical activities." }] }),
  component: LearnIndex,
});

const LEVELS = ["All", "Beginner", "Intermediate", "Advanced"] as const;

function LearnIndex() {
  const events = useProgress((s) => s.events);
  const completed = useMemo(() => completedLessons(events), [events]);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("All");
  const list = COURSES.filter((c) => (level === "All" || c.difficulty === level) && `${c.title} ${c.short}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Learning Center" title="Courses" description="Structured ENTC courses — each with lessons, worked examples, knowledge checks and linked lab activities." crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Learning Center" }]} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter courses…" className="max-w-xs" aria-label="Filter courses" />
        <div className="flex gap-1" role="group" aria-label="Difficulty">
          {LEVELS.map((l) => <button key={l} onClick={() => setLevel(l)} aria-pressed={level === l} className={`rounded-md border px-3 py-1.5 text-xs ${level === l ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{l}</button>)}
        </div>
      </div>
      {list.length === 0 ? <EmptyState title="No courses match" description="Try a different filter." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c, i) => {
            const p = courseProgress(c, completed);
            return (
              <Link key={c.id} to="/learn/$courseId" params={{ courseId: c.id }} className="panel group flex flex-col p-5 transition-shadow hover:shadow-lift">
                <div className="mb-3 flex items-center justify-between"><span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><DifficultyBadge level={c.difficulty} /></div>
                <h2 className="font-semibold group-hover:text-signal">{c.title}</h2>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.short}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.hours} h</span><span>{courseLessons(c).length} lessons</span><span className="ml-auto font-mono">{p.pct}%</span></div>
                <Progress value={p.pct} className="mt-2 h-1.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
