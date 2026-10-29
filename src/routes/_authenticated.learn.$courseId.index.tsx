import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { useMemo } from "react";

import { DifficultyBadge, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { courseLessons, courseProgress, getCourse } from "@/content/courses";
import { getGame, getQuiz } from "@/content/quizzes";
import { completedLessons, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/learn/$courseId/")({
  loader: ({ params }) => {
    const course = getCourse(params.courseId);
    if (!course) throw notFound();
    return { title: course.title, short: course.short };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Course"} — CHAKRAVYUH` }, { name: "description", content: loaderData?.short ?? "ENTC course" }, { property: "og:title", content: `${loaderData?.title ?? "Course"} — CHAKRAVYUH` }, { property: "og:description", content: loaderData?.short ?? "ENTC course" }] }),
  notFoundComponent: () => <div className="p-6">Course not found. <Link to="/learn" className="text-signal underline">Back to courses</Link></div>,
  component: CoursePage,
});

function CoursePage() {
  const { courseId } = Route.useParams();
  const course = getCourse(courseId)!;
  const events = useProgress((s) => s.events);
  const completed = useMemo(() => completedLessons(events), [events]);
  const p = courseProgress(course, completed);
  const next = courseLessons(course).find((l) => !completed.has(`${course.id}/${l.id}`)) ?? courseLessons(course)[0];
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Course" title={course.title} description={course.overview} crumbs={[{ label: "Learning Center", to: "/learn" }, { label: course.title }]}
        actions={<Button asChild><Link to="/learn/$courseId/lesson/$lessonId" params={{ courseId, lessonId: next.id }}>{p.done ? "Continue" : "Start course"}</Link></Button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {course.modules.map((m, mi) => (
            <section key={m.id} className="panel" aria-labelledby={`m-${m.id}`}>
              <div className="border-b px-5 py-3"><span className="eyebrow">Module {mi + 1}</span><h2 id={`m-${m.id}`} className="font-semibold">{m.title}</h2></div>
              <ol>
                {m.lessons.map((l) => {
                  const done = completed.has(`${course.id}/${l.id}`);
                  return (
                    <li key={l.id} className="border-b last:border-0">
                      <Link to="/learn/$courseId/lesson/$lessonId" params={{ courseId, lessonId: l.id }} className="flex items-center gap-3 px-5 py-3 hover:bg-accent/40">
                        {done ? <CheckCircle2 className="h-4 w-4 text-success" aria-label="Completed" /> : <Circle className="h-4 w-4 text-muted-foreground" aria-label="Not completed" />}
                        <div className="min-w-0 flex-1"><div className="font-medium">{l.title}</div><div className="truncate text-xs text-muted-foreground">{l.summary}</div></div>
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"><Clock className="h-3 w-3" />{l.minutes}m</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          <div className="panel p-4">
            <div className="mb-2 flex items-center justify-between"><DifficultyBadge level={course.difficulty} /><span className="font-mono text-xs">{course.hours} h</span></div>
            <div className="text-sm">{p.done} of {p.total} lessons complete</div>
            <Progress value={p.pct} className="mt-2 h-2" />
          </div>
          <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold">Learning objectives</h3><ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">{course.objectives.map((o) => <li key={o}>{o}</li>)}</ul></div>
          <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold">Prerequisites</h3><p className="text-sm text-muted-foreground">{course.prerequisites.length ? course.prerequisites.join(", ") : "None — start here."}</p></div>
          <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold">Practical activities</h3><ul className="space-y-1 text-sm">{course.activities.map((a) => <li key={a.href}><Link to={a.href} className="text-signal hover:underline">{a.label}</Link></li>)}</ul></div>
          {course.quizIds.length > 0 && <div className="panel p-4"><h3 className="mb-2 text-sm font-semibold">Related quizzes</h3><ul className="space-y-1 text-sm">{course.quizIds.map((id) => <li key={id}><Link to="/quizzes/$quizId" params={{ quizId: id }} className="text-signal hover:underline">{getQuiz(id)?.title ?? getGame(id)?.title}</Link></li>)}</ul></div>}
        </aside>
      </div>
    </div>
  );
}
