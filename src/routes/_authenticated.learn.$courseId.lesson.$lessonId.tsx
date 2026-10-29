import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AskAIButton } from "@/components/assistant/AskAIButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { Diagram } from "@/components/learning/Diagram";
import { Button } from "@/components/ui/button";
import { getSimulation } from "@/content/catalog";
import { getLesson } from "@/content/courses";
import type { CheckQuestion } from "@/content/types";
import { cn } from "@/lib/utils";
import { useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/learn/$courseId/lesson/$lessonId")({
  loader: ({ params }) => {
    const r = getLesson(params.courseId, params.lessonId);
    if (!r) throw notFound();
    return { title: r.lesson.title, summary: r.lesson.summary, course: r.course.title };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Lesson"} — CHAKRAVYUH` }, { name: "description", content: loaderData?.summary ?? "ENTC lesson" }, { property: "og:title", content: `${loaderData?.title ?? "Lesson"} · ${loaderData?.course ?? ""}` }, { property: "og:description", content: loaderData?.summary ?? "ENTC lesson" }] }),
  notFoundComponent: () => <div className="p-6">Lesson not found. <Link to="/learn" className="text-signal underline">Back to courses</Link></div>,
  component: LessonPage,
});

function KnowledgeCheck({ q, idx }: { q: CheckQuestion; idx: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const answered = sel !== null;
  return (
    <fieldset className="rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Q{idx + 1}. {q.q}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => (
          <button key={i} disabled={answered} onClick={() => setSel(i)}
            className={cn("rounded-md border px-3 py-2 text-left text-sm", answered && i === q.answer && "border-success bg-success/10", answered && sel === i && i !== q.answer && "border-destructive bg-destructive/10", !answered && "hover:border-primary")}>{o}</button>
        ))}
      </div>
      {answered && (
        <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span><strong className={sel === q.answer ? "text-success" : "text-destructive"}>{sel === q.answer ? "Correct." : "Not quite."}</strong> {q.explanation}</span>
          <Button size="sm" variant="ghost" onClick={() => setSel(null)}>Try again</Button>
        </div>
      )}
    </fieldset>
  );
}

function LessonPage() {
  const { courseId, lessonId } = Route.useParams();
  const { course, lesson, prev, next, index, total } = getLesson(courseId, lessonId)!;
  const done = useProgress((s) => s.events.some((e) => e.type === "lesson_completed" && e.courseId === courseId && e.lessonId === lessonId));
  const record = useProgress((s) => s.record);
  const uncomplete = useProgress((s) => s.uncompleteLesson);

  const toggle = () => {
    if (done) { uncomplete(courseId, lessonId); toast("Lesson marked as not complete"); }
    else { record({ type: "lesson_completed", courseId, lessonId }); toast.success("Lesson completed — progress updated on this device"); }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={`${course.title} · Lesson ${index + 1} of ${total}`} title={lesson.title} description={lesson.summary}
        crumbs={[{ label: "Learning Center", to: "/learn" }, { label: course.title, to: `/learn/${courseId}` }, { label: lesson.title }]}
        actions={<AskAIButton prompt={`Explain "${lesson.title}" step by step.`} context={`lesson:${courseId}/${lessonId}`} />} />

      <article className="prose-lesson space-y-8">
        {lesson.diagram && <Diagram d={lesson.diagram} />}
        {lesson.sections.map((s) => (
          <section key={s.heading}><h2 className="text-xl font-semibold">{s.heading}</h2>{s.body.map((p, i) => <p key={i}>{p}</p>)}</section>
        ))}

        {lesson.equations && (
          <section><h2 className="mb-3 text-xl font-semibold">Equations</h2>
            <div className="space-y-2">{lesson.equations.map((e) => (
              <div key={e.label} className="panel bg-blueprint px-4 py-3"><div className="eyebrow">{e.label}</div><div className="mt-1 font-mono text-lg">{e.expr}</div>{e.vars && <div className="mt-1 text-xs text-muted-foreground">{e.vars}</div>}</div>
            ))}</div>
          </section>
        )}

        {lesson.steps && (
          <section><h2 className="mb-2 text-xl font-semibold">Step by step</h2><ol className="list-decimal space-y-1 pl-5">{lesson.steps.map((s) => <li key={s}>{s}</li>)}</ol></section>
        )}

        {lesson.example && (
          <section className="panel border-l-4 border-l-signal p-5"><div className="eyebrow mb-1">Worked example</div><p className="font-medium">{lesson.example.problem}</p><ol className="mt-2 list-decimal space-y-1 pl-5 font-mono text-sm">{lesson.example.solution.map((s) => <li key={s}>{s}</li>)}</ol></section>
        )}

        <section><h2 className="mb-3 text-xl font-semibold">Key terms</h2>
          <dl className="grid gap-2 sm:grid-cols-2">{lesson.terms.map(([t, d]) => <div key={t} className="rounded-md border p-3"><dt className="font-mono text-sm font-medium">{t}</dt><dd className="text-sm text-muted-foreground">{d}</dd></div>)}</dl>
        </section>

        <section className="rounded-md bg-success/10 p-5"><h2 className="mb-2 text-lg font-semibold">Key takeaways</h2><ul className="list-disc space-y-1 pl-5">{lesson.takeaways.map((t) => <li key={t}>{t}</li>)}</ul></section>

        <section><h2 className="mb-3 text-xl font-semibold">Knowledge check</h2><div className="space-y-3">{lesson.check.map((q, i) => <KnowledgeCheck key={i} q={q} idx={i} />)}</div></section>

        {lesson.simulations && (
          <section><h2 className="mb-3 text-xl font-semibold">Try it in the lab</h2><div className="flex flex-wrap gap-2">{lesson.simulations.map((id) => (
            <Button key={id} variant="outline" asChild><Link to="/lab/$simulationId" params={{ simulationId: id }}><FlaskConical /> {getSimulation(id)?.title}</Link></Button>
          ))}</div></section>
        )}
      </article>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        {prev ? <Button variant="ghost" asChild><Link to="/learn/$courseId/lesson/$lessonId" params={{ courseId, lessonId: prev.id }}><ArrowLeft /> {prev.title}</Link></Button> : <span />}
        <Button variant={done ? "success" : "default"} onClick={toggle} aria-pressed={done}><CheckCircle2 /> {done ? "Completed" : "Mark as complete"}</Button>
        {next ? <Button variant="ghost" asChild><Link to="/learn/$courseId/lesson/$lessonId" params={{ courseId, lessonId: next.id }}>{next.title} <ArrowRight /></Link></Button> : <Button variant="ghost" asChild><Link to="/learn/$courseId" params={{ courseId }}>Back to course</Link></Button>}
      </div>
    </div>
  );
}
