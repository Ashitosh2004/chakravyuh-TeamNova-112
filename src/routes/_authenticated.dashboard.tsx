import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Flame } from "lucide-react";
import { useMemo } from "react";

import { DifficultyBadge, EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getChallenge, CHALLENGES } from "@/content/challenges";
import { SIMULATIONS, getSimulation } from "@/content/catalog";
import { COURSES, courseLessons, courseProgress, getLesson } from "@/content/courses";
import { QUIZZES, getQuiz } from "@/content/quizzes";
import { activityByDay, completedLessons, computeAchievements, learningStreak, passedChallenges, quizAttempts, useProgress } from "@/stores/progress";
import { useSession } from "@/stores/session";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CHAKRAVYUH" }, { name: "description", content: "Your personalised ENTC learning dashboard." }, { property: "og:title", content: "Dashboard — CHAKRAVYUH" }, { property: "og:description", content: "Continue learning where you left off." }] }),
  component: Dashboard,
});

function Dashboard() {
  const user = useSession((s) => s.user);
  const events = useProgress((s) => s.events);
  const completed = useMemo(() => completedLessons(events), [events]);
  const attempts = quizAttempts(events).slice(-4).reverse();
  const passed = passedChallenges(events);
  const week = activityByDay(events, 7);
  const maxCount = Math.max(1, ...week.map((d) => d.count));
  const streak = learningStreak(events);
  const achievements = computeAchievements(events);
  const recentSims = [...new Set(events.filter((e) => e.type === "simulation_used").reverse().map((e) => (e as { simulationId: string }).simulationId))].slice(0, 3);
  const recentLessons = events.filter((e) => e.type === "lesson_completed").reverse().slice(0, 4) as { courseId: string; lessonId: string }[];

  // Continue learning: first course with partial progress, else first unfinished.
  const current = COURSES.find((c) => { const p = courseProgress(c, completed); return p.done > 0 && p.done < p.total; }) ?? COURSES.find((c) => courseProgress(c, completed).done < courseLessons(c).length) ?? COURSES[0];
  const nextLesson = courseLessons(current).find((l) => !completed.has(`${current.id}/${l.id}`));
  const isNew = events.length === 0;

  const recommendations = [
    nextLesson && { label: `Lesson: ${nextLesson.title}`, href: `/learn/${current.id}/lesson/${nextLesson.id}` },
    ...SIMULATIONS.filter((s) => !recentSims.includes(s.id)).slice(0, 1).map((s) => ({ label: `Lab: ${s.title}`, href: `/lab/${s.id}` })),
    ...CHALLENGES.filter((c) => !passed.has(c.id)).slice(0, 1).map((c) => ({ label: `Challenge: ${c.title}`, href: `/coding/${c.id}` })),
    ...QUIZZES.filter((q) => !quizAttempts(events).some((a) => a.quizId === q.id)).slice(0, 1).map((q) => ({ label: `Quiz: ${q.title}`, href: `/quizzes/${q.id}` })),
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Dashboard" title={`Welcome${isNew ? "" : " back"}, ${user?.displayName ?? "student"}`} description={isNew ? "You haven't started yet — pick your first lesson below." : "Here's where you left off."} actions={<Button variant="outline" asChild><Link to="/ai-assistant"><Bot /> Ask the AI assistant</Link></Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="panel p-5 lg:col-span-2" aria-labelledby="continue">
          <div className="eyebrow mb-1">{isNew ? "Start your first lesson" : "Continue learning"}</div>
          <h2 id="continue" className="text-xl font-semibold">{current.title}</h2>
          <p className="text-sm text-muted-foreground">{current.short}</p>
          <div className="mt-4 flex items-center gap-3">
            <Progress value={courseProgress(current, completed).pct} className="h-2 flex-1" aria-label="Course progress" />
            <span className="font-mono text-xs">{courseProgress(current, completed).done}/{courseProgress(current, completed).total}</span>
          </div>
          {nextLesson ? (
            <Button asChild className="mt-4"><Link to="/learn/$courseId/lesson/$lessonId" params={{ courseId: current.id, lessonId: nextLesson.id }}>{isNew ? "Start" : "Continue"}: {nextLesson.title} <ArrowRight /></Link></Button>
          ) : (
            <Button asChild className="mt-4" variant="outline"><Link to="/learn">Choose another course</Link></Button>
          )}
        </section>

        <section className="panel p-5" aria-labelledby="week">
          <div className="flex items-center justify-between">
            <h2 id="week" className="font-semibold">This week</h2>
            <span className="inline-flex items-center gap-1 font-mono text-xs"><Flame className="h-3.5 w-3.5 text-warning" /> {streak}-day streak</span>
          </div>
          <div className="mt-4 flex h-28 items-end gap-2" role="img" aria-label={`Activities per day: ${week.map((d) => `${d.day} ${d.count}`).join(", ")}`}>
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="w-full rounded-sm bg-signal/80" style={{ height: `${(d.count / maxCount) * 88}px`, minHeight: d.count ? 4 : 1 }} />
                <span className="font-mono text-[10px] text-muted-foreground">{d.day}</span>
              </div>
            ))}
          </div>
          {isNew && <p className="mt-2 text-xs text-muted-foreground">Activity appears here as you complete lessons, labs and quizzes.</p>}
        </section>

        <section className="panel p-5" aria-labelledby="path">
          <h2 id="path" className="mb-3 font-semibold">Course completion</h2>
          <ul className="space-y-3">
            {COURSES.slice(0, 5).map((c) => {
              const p = courseProgress(c, completed);
              return (
                <li key={c.id}>
                  <Link to="/learn/$courseId" params={{ courseId: c.id }} className="flex justify-between text-sm hover:underline"><span className="truncate">{c.title}</span><span className="font-mono text-xs">{p.pct}%</span></Link>
                  <Progress value={p.pct} className="mt-1 h-1.5" />
                </li>
              );
            })}
          </ul>
          <Link to="/learn" className="mt-3 inline-block text-xs font-medium text-signal hover:underline">All courses</Link>
        </section>

        <section className="panel p-5" aria-labelledby="quizzes">
          <h2 id="quizzes" className="mb-3 font-semibold">Recent quiz results</h2>
          {attempts.length === 0 ? <p className="text-sm text-muted-foreground">No quizzes yet. <Link to="/quizzes" className="text-signal hover:underline">Take one</Link>.</p> : (
            <ul className="space-y-2 text-sm">
              {attempts.map((a) => (
                <li key={a.at} className="flex justify-between"><span className="truncate">{getQuiz(a.quizId)?.title ?? a.quizId}</span><span className={`font-mono ${a.accuracy >= 70 ? "text-success" : "text-warning-foreground"}`}>{a.accuracy}%</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5" aria-labelledby="recommend">
          <h2 id="recommend" className="mb-3 font-semibold">Recommended next</h2>
          <ul className="space-y-2 text-sm">
            {recommendations.map((r) => (
              <li key={r.href}><Link to={r.href} className="flex items-center justify-between rounded-md border px-3 py-2 hover:border-primary"><span className="truncate">{r.label}</span><ArrowRight className="h-3.5 w-3.5" /></Link></li>
            ))}
          </ul>
        </section>

        <section className="panel p-5" aria-labelledby="labs">
          <h2 id="labs" className="mb-3 font-semibold">Recently used simulations</h2>
          {recentSims.length === 0 ? <p className="text-sm text-muted-foreground">You haven't opened the lab yet. <Link to="/lab" className="text-signal hover:underline">Explore it</Link>.</p> : (
            <ul className="space-y-2 text-sm">{recentSims.map((id) => <li key={id}><Link to="/lab/$simulationId" params={{ simulationId: id }} className="hover:underline">{getSimulation(id)?.title}</Link></li>)}</ul>
          )}
        </section>

        <section className="panel p-5" aria-labelledby="coding">
          <h2 id="coding" className="mb-3 font-semibold">Coding challenges</h2>
          <div className="flex items-baseline gap-2"><span className="font-display text-3xl font-bold">{passed.size}</span><span className="text-sm text-muted-foreground">of {CHALLENGES.length} passed</span></div>
          <Progress value={(passed.size / CHALLENGES.length) * 100} className="mt-2 h-1.5" />
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{[...passed].slice(-3).map((id) => <li key={id}>✓ {getChallenge(id)?.title}</li>)}</ul>
        </section>

        <section className="panel p-5" aria-labelledby="ach">
          <h2 id="ach" className="mb-3 font-semibold">Achievements</h2>
          <div className="flex flex-wrap gap-2">
            {achievements.map((a) => (
              <span key={a.id} title={a.description} className={`rounded border px-2 py-1 text-xs ${a.unlocked ? "border-success/50 bg-success/10" : "text-muted-foreground opacity-60"}`}>{a.title}</span>
            ))}
          </div>
        </section>

        <section className="panel p-5 lg:col-span-1" aria-labelledby="recent">
          <h2 id="recent" className="mb-3 font-semibold">Recently completed lessons</h2>
          {recentLessons.length === 0 ? <EmptyState title="Nothing completed yet" description="Mark a lesson complete to see it here." /> : (
            <ul className="space-y-2 text-sm">
              {recentLessons.map((r) => { const l = getLesson(r.courseId, r.lessonId); return l && <li key={`${r.courseId}/${r.lessonId}`} className="flex items-center justify-between gap-2"><Link to="/learn/$courseId/lesson/$lessonId" params={r} className="truncate hover:underline">{l.lesson.title}</Link><DifficultyBadge level={l.course.difficulty} /></li>; })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
