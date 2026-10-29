import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { CheckCircle2, Lightbulb, Play, RotateCcw, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AskAIButton } from "@/components/assistant/AskAIButton";
import { CodeEditor } from "@/components/coding/CodeEditor";
import { DifficultyBadge, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { getChallenge } from "@/content/challenges";
import { runTests, type TestOutcome } from "@/engines/challenge";
import { runScript, type RunResult } from "@/engines/interpreter";
import { ApiError, challengeApi, isBackendConfigured } from "@/services/api";
import { useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/coding/$challengeId")({
  loader: ({ params }) => {
    const c = getChallenge(params.challengeId);
    if (!c) throw notFound();
    return { title: c.title, objective: c.objective };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Challenge"} — CHAKRAVYUH` }, { name: "description", content: loaderData?.objective ?? "Coding challenge" }, { property: "og:title", content: `${loaderData?.title ?? "Challenge"} — CHAKRAVYUH` }, { property: "og:description", content: loaderData?.objective ?? "Coding challenge" }] }),
  notFoundComponent: () => <div className="p-6">Challenge not found. <Link to="/coding" className="text-signal underline">Back</Link></div>,
  component: ChallengePage,
});

function ChallengePage() {
  const { challengeId } = Route.useParams();
  const ch = getChallenge(challengeId)!;
  const key = `chakravyuh-code-${ch.id}`;
  const [code, setCode] = useState(() => (typeof window !== "undefined" && localStorage.getItem(key)) || ch.starter);
  const [run, setRun] = useState<RunResult | null>(null);
  const [tests, setTests] = useState<TestOutcome[] | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const record = useProgress((s) => s.record);
  const passedBefore = useProgress((s) => s.events.some((e) => e.type === "challenge_passed" && e.challengeId === ch.id));

  const update = (v: string) => { setCode(v); localStorage.setItem(key, v); };
  const doRun = () => {
    setRun(runScript(code, ch.tests[0].inputs));
    const t = runTests(code, ch.tests);
    setTests(t);
    record({ type: "challenge_run", challengeId: ch.id, passed: t.filter((x) => x.passed).length, total: t.length });
  };
  const submit = async () => {
    const t = runTests(code, ch.tests);
    setTests(t);
    const allPass = t.every((x) => x.passed);
    if (isBackendConfigured()) {
      setSubmitting(true);
      try {
        const r = await challengeApi.submit(ch.id, code);
        toast.success(`Server graded: ${r.passed}/${r.total} tests, ${r.score} points`);
        if (r.passed === r.total && !passedBefore) record({ type: "challenge_passed", challengeId: ch.id, points: r.score });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : "Submission failed");
      } finally { setSubmitting(false); }
      return;
    }
    if (allPass) {
      if (!passedBefore) record({ type: "challenge_passed", challengeId: ch.id, points: ch.points });
      toast.success("All practice tests passed — recorded on this device (not server-verified).");
    } else toast.error(`${t.filter((x) => !x.passed).length} test(s) failing. Review the feedback below.`);
  };

  const passCount = tests?.filter((t) => t.passed).length ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow={ch.category} title={ch.title} crumbs={[{ label: "Coding", to: "/coding" }, { label: ch.title }]}
        actions={<><DifficultyBadge level={ch.difficulty} /><span className="font-mono text-sm">{ch.points} pts</span>{passedBefore && <span className="inline-flex items-center gap-1 text-sm text-success"><CheckCircle2 className="h-4 w-4" /> Completed</span>}</>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="panel space-y-4 p-5 text-sm">
          <div><div className="eyebrow mb-1">Learning objective</div><p>{ch.objective}</p></div>
          <div><div className="eyebrow mb-1">Problem</div><p>{ch.statement}</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className="eyebrow mb-1">Input</div><p className="font-mono text-xs">{ch.inputSpec}</p></div>
            <div><div className="eyebrow mb-1">Output</div><p className="font-mono text-xs">{ch.outputSpec}</p></div>
          </div>
          <div><div className="eyebrow mb-1">Examples</div>{ch.examples.map((e) => <div key={e.input} className="mb-1 rounded bg-muted px-2 py-1 font-mono text-xs">{e.input} → {e.output}</div>)}</div>
          {ch.constraints.length > 0 && <div><div className="eyebrow mb-1">Constraints</div><ul className="list-disc pl-5">{ch.constraints.map((c) => <li key={c}>{c}</li>)}</ul></div>}
          <div className="rounded-md border p-3 text-xs text-muted-foreground"><strong className="text-foreground">How evaluation works:</strong> inputs are pre-defined variables. Your code runs in a sandboxed interpreter with a step limit. “Run” checks the practice tests in your browser. {isBackendConfigured() ? "“Submit” sends your code to the server for authoritative grading." : "Authoritative server grading will be available when the backend is connected; local results are practice only."}</div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowHint((h) => !h)}><Lightbulb /> {showHint ? "Hide hint" : "Show hint"}</Button>
            <AskAIButton prompt={`Help me debug my solution for "${ch.title}".`} context={`challenge:${ch.id}`} label="Debug with AI" />
          </div>
          {showHint && <p className="rounded-md bg-warning/15 p-3 text-xs">{ch.hint}</p>}
        </section>

        <section className="space-y-3">
          <CodeEditor value={code} onChange={update} label="Solution code" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={doRun}><Play /> Run</Button>
            <Button variant="success" onClick={submit} disabled={submitting}><Send /> Submit</Button>
            <Button variant="outline" onClick={() => { update(ch.starter); setRun(null); setTests(null); }}><RotateCcw /> Reset code</Button>
          </div>
          <div className="panel p-4" aria-live="polite">
            <div className="eyebrow mb-2">Output panel</div>
            {!run ? <p className="text-sm text-muted-foreground">Press Run to execute your code against the practice tests.</p> : (
              <div className="space-y-1 font-mono text-xs">
                <div className="text-muted-foreground">Sample run with {Object.entries(ch.tests[0].inputs).map(([k, v]) => `${k}=${v}`).join(", ")} · {run.steps} steps</div>
                {run.error ? <div className="text-destructive">Error: {run.error}</div> : <>
                  {run.returnValue !== undefined && <div>return → {run.returnValue}</div>}
                  {Object.keys(run.pins).length > 0 && <div>pins → {Object.entries(run.pins).map(([p, v]) => `pin ${p} = ${v}`).join(", ")}</div>}
                  {run.output.map((o, i) => <div key={i}>serial → {o}</div>)}
                  {run.returnValue === undefined && !Object.keys(run.pins).length && !run.output.length && <div className="text-muted-foreground">(no output)</div>}
                </>}
              </div>
            )}
          </div>
          {tests && (
            <div className="panel p-4">
              <div className="mb-2 flex items-center justify-between"><span className="eyebrow">Test cases</span><span className={`font-mono text-sm ${passCount === tests.length ? "text-success" : "text-warning-foreground"}`}>{passCount}/{tests.length} passed</span></div>
              <ul className="space-y-1.5 text-sm">{tests.map((t) => (
                <li key={t.name} className="flex gap-2">{t.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}<span><span className="font-mono text-xs">{t.name}</span> — <span className="text-muted-foreground">{t.detail}</span></span></li>
              ))}</ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
