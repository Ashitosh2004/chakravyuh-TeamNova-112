import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Stat } from "@/components/lab/LabWorkspace";
import { Progress } from "@/components/ui/progress";
import { CHALLENGES } from "@/content/challenges";
import { SCENARIOS, SIMULATIONS } from "@/content/catalog";
import { COURSES, courseProgress } from "@/content/courses";
import { getQuiz } from "@/content/quizzes";
import { activityByDay, completedLessons, completedScenarios, passedChallenges, quizAttempts, topicPerformance, usedSimulations, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "Progress — CHAKRAVYUH" }, { name: "description", content: "Your lessons, quizzes, coding and lab activity over time." }, { property: "og:title", content: "Progress — CHAKRAVYUH" }, { property: "og:description", content: "Track your ENTC learning." }] }),
  component: ProgressPage,
});

function ProgressPage() {
  const events = useProgress((s) => s.events);
  const lessons = useMemo(() => completedLessons(events), [events]);
  const attempts = quizAttempts(events);
  const topics = topicPerformance(events);
  const activity = activityByDay(events, 14);
  const submissions = events.filter((e) => e.type === "challenge_run").length;
  if (events.length === 0) return (
    <div className="mx-auto max-w-5xl"><PageHeader eyebrow="Progress" title="Your progress" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Progress" }]} />
      <EmptyState title="No activity recorded yet" description="Complete a lesson, open a lab, run a challenge or take a quiz — your progress will appear here." action={<Link to="/learn" className="text-sm font-medium text-signal underline">Start your first lesson</Link>} /></div>
  );
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Progress" title="Your progress" description="Recorded on this device from your actual activity." crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Progress" }]} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Lessons" value={lessons.size} />
        <Stat label="Quiz attempts" value={attempts.length} />
        <Stat label="Code runs" value={submissions} />
        <Stat label="Challenges passed" value={`${passedChallenges(events).size}/${CHALLENGES.length}`} />
        <Stat label="Labs used" value={`${usedSimulations(events).size}/${SIMULATIONS.length}`} />
        <Stat label="Scenarios" value={`${completedScenarios(events).size}/${SCENARIOS.length}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5"><h2 className="mb-3 font-semibold">Course progress</h2>
          <ul className="space-y-3">{COURSES.map((c) => { const p = courseProgress(c, lessons); return <li key={c.id}><div className="flex justify-between text-sm"><span>{c.title}</span><span className="font-mono text-xs">{p.done}/{p.total}</span></div><Progress value={p.pct} className="mt-1 h-1.5" /></li>; })}</ul>
        </section>
        <section className="panel p-5"><h2 className="mb-3 font-semibold">Activity — last 14 days</h2>
          <div className="h-56"><ResponsiveContainer><BarChart data={activity}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" /><XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="count" name="Activities" fill="var(--color-chart-3)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="panel p-5"><h2 className="mb-3 font-semibold">Quiz performance</h2>
          {attempts.length === 0 ? <p className="text-sm text-muted-foreground">No quiz attempts yet.</p> : <div className="h-56"><ResponsiveContainer><LineChart data={attempts.map((a, i) => ({ n: `#${i + 1}`, accuracy: a.accuracy, quiz: getQuiz(a.quizId)?.title }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" /><XAxis dataKey="n" fontSize={11} /><YAxis domain={[0, 100]} fontSize={11} /><Tooltip /><Line dataKey="accuracy" name="Accuracy %" stroke="var(--color-chart-2)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>}
        </section>
        <section className="panel p-5"><h2 className="mb-3 font-semibold">Strengths & weaknesses by topic</h2>
          {topics.length === 0 ? <p className="text-sm text-muted-foreground">Take a quiz to see topic-wise accuracy.</p> : (
            <ul className="space-y-2">{topics.sort((a, b) => b.accuracy - a.accuracy).map((t) => <li key={t.topic}><div className="flex justify-between text-sm"><span>{t.topic}</span><span className={`font-mono text-xs ${t.accuracy >= 70 ? "text-success" : "text-destructive"}`}>{t.accuracy}% ({t.correct}/{t.total})</span></div><Progress value={t.accuracy} className="mt-1 h-1.5" /></li>)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
