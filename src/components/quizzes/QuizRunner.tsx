import { Link } from "@tanstack/react-router";
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Timer, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AskAIButton } from "@/components/assistant/AskAIButton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { Quiz } from "@/content/quizzes";
import { formatClock, isAnswered, isCorrect, remainingSeconds, scoreQuiz, type AnswerValue, type Question, type QuizResult } from "@/engines/quiz";
import { inputCombinations } from "@/engines/logic";
import { cn } from "@/lib/utils";
import { ApiError, isBackendConfigured, quizApi } from "@/services/api";
import { useProgress } from "@/stores/progress";

function QuestionInput({ q, value, onChange, disabled }: { q: Question; value: AnswerValue | undefined; onChange: (v: AnswerValue) => void; disabled?: boolean }) {
  if (q.type === "mcq") return (
    <div className="grid gap-2" role="radiogroup">
      {q.options.map((o, i) => <button key={i} role="radio" aria-checked={value === i} disabled={disabled} onClick={() => onChange(i)} className={cn("rounded-md border px-4 py-3 text-left text-sm", value === i ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/50")}>{String.fromCharCode(65 + i)}. {o}</button>)}
    </div>
  );
  if (q.type === "tf") return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup">
      {[true, false].map((b) => <button key={String(b)} role="radio" aria-checked={value === b} disabled={disabled} onClick={() => onChange(b)} className={cn("rounded-md border px-4 py-3 text-sm", value === b ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/50")}>{b ? "True" : "False"}</button>)}
    </div>
  );
  if (q.type === "numeric") return (
    <div className="flex max-w-xs items-center gap-2">
      <Input type="number" inputMode="decimal" aria-label="Numeric answer" disabled={disabled} value={typeof value === "number" ? value : ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      {q.unit && <span className="text-sm text-muted-foreground">{q.unit}</span>}
    </div>
  );
  const rows = inputCombinations(q.inputs.length);
  const arr = (Array.isArray(value) ? value : new Array(rows.length).fill(null)) as (0 | 1 | null)[];
  return (
    <table className="text-center font-mono text-sm">
      <thead><tr>{q.inputs.map((i) => <th key={i} className="border px-3 py-1">{i}</th>)}<th className="border bg-muted px-3 py-1">Y</th></tr></thead>
      <tbody>{rows.map((r, ri) => (
        <tr key={ri}>{r.map((v, j) => <td key={j} className="border px-3 py-1">{v ? 1 : 0}</td>)}
          <td className="border p-1"><button disabled={disabled} aria-label={`Row ${ri + 1} output: ${arr[ri] ?? "unset"}`} onClick={() => { const n = [...arr]; n[ri] = arr[ri] === 1 ? 0 : 1; onChange(n); }} className={cn("h-7 w-10 rounded border", arr[ri] === 1 ? "bg-success/20" : arr[ri] === 0 ? "bg-muted" : "")}>{arr[ri] ?? "?"}</button></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [phase, setPhase] = useState<"intro" | "active" | "done">("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [review, setReview] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const started = useRef(0);
  const record = useProgress((s) => s.record);
  const q = quiz.questions[idx];
  const answeredCount = quiz.questions.filter((x) => isAnswered(x, answers[x.id])).length;
  const remaining = quiz.timeLimitSec ? remainingSeconds(quiz.timeLimitSec, started.current, now) : null;

  useEffect(() => {
    if (phase !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const finish = async () => {
    setConfirm(false);
    const r = scoreQuiz(quiz.questions, answers, Math.round((Date.now() - started.current) / 1000));
    setResult(r);
    setPhase("done");
    record({ type: "quiz_attempt", quizId: quiz.id, score: r.score, accuracy: r.accuracy, byTopic: r.byTopic, timeTakenSec: r.timeTakenSec });
    if (isBackendConfigured()) {
      try { await quizApi.submit(quiz.id, answers, r.timeTakenSec); setRemoteStatus("Saved to your account."); }
      catch (e) { setRemoteStatus(`Not saved to server: ${e instanceof ApiError ? e.message : "error"}. Your result is kept on this device.`); }
    } else setRemoteStatus("Saved on this device only (backend not connected).");
  };

  useEffect(() => {
    if (phase === "active" && remaining === 0) { toast.warning("Time's up — quiz submitted automatically."); finish(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  const start = () => { setAnswers({}); setReview(new Set()); setIdx(0); setResult(null); started.current = Date.now(); setNow(Date.now()); setPhase("active"); };

  if (phase === "intro") return (
    <div className="panel max-w-2xl p-6">
      <p className="text-muted-foreground">{quiz.description}</p>
      <ul className="mt-4 space-y-1 text-sm"><li>{quiz.questions.length} questions · multiple choice, true/false, numeric and truth-table</li><li>{quiz.timeLimitSec ? `Time limit: ${formatClock(quiz.timeLimitSec)} (auto-submits)` : "Untimed"}</li><li>Mark questions for review and jump using the palette.</li></ul>
      <Button className="mt-6" onClick={start}>Start quiz</Button>
    </div>
  );

  if (phase === "done" && result) return (
    <div className="space-y-6">
      <div className="panel grid gap-4 p-6 sm:grid-cols-4">
        <div><div className="eyebrow">Score</div><div className="font-display text-3xl font-bold">{result.correct}/{result.total}</div></div>
        <div><div className="eyebrow">Accuracy</div><div className={cn("font-display text-3xl font-bold", result.accuracy >= 70 ? "text-success" : "text-warning-foreground")}>{result.accuracy}%</div></div>
        <div><div className="eyebrow">Time taken</div><div className="font-display text-3xl font-bold">{formatClock(result.timeTakenSec)}</div></div>
        <div><div className="eyebrow">Points</div><div className="font-display text-3xl font-bold">{result.score}</div></div>
        <p className="text-xs text-muted-foreground sm:col-span-4" role="status">{remoteStatus}</p>
      </div>
      <div className="panel p-5"><h2 className="mb-3 font-semibold">Topic-wise performance</h2>
        <div className="space-y-2">{Object.entries(result.byTopic).map(([t, v]) => <div key={t}><div className="flex justify-between text-sm"><span>{t}</span><span className="font-mono">{v.correct}/{v.total}</span></div><Progress value={(v.correct / v.total) * 100} className="h-1.5" /></div>)}</div>
      </div>
      <div className="space-y-3"><h2 className="font-semibold">Review answers</h2>
        {quiz.questions.map((qq, i) => {
          const ok = isCorrect(qq, answers[qq.id]);
          const correctText = qq.type === "mcq" ? qq.options[qq.answer] : qq.type === "tf" ? String(qq.answer) : qq.type === "numeric" ? `${qq.answer}${qq.unit ? ` ${qq.unit}` : ""}` : qq.answer.join(" ");
          return (
            <div key={qq.id} className={cn("panel border-l-4 p-4", ok ? "border-l-success" : "border-l-destructive")}>
              <div className="flex items-start gap-2">{ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 text-destructive" />}<div className="flex-1"><p className="font-medium">Q{i + 1}. {qq.prompt}</p>
                {!isAnswered(qq, answers[qq.id]) && <p className="text-xs text-muted-foreground">Not answered.</p>}
                <p className="mt-1 text-sm"><span className="text-muted-foreground">Correct answer:</span> <span className="font-mono">{correctText}</span></p>
                <p className="mt-1 text-sm text-muted-foreground">{qq.explanation}</p>
                {!ok && <div className="mt-2"><AskAIButton prompt={`Explain why the answer to "${qq.prompt}" is ${correctText}.`} context={`quiz:${quiz.id}/${qq.id}`} label="Explain my mistake" /></div>}
              </div></div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2"><Button onClick={start}>Retry quiz</Button><Button variant="outline" asChild><Link to="/quizzes">All quizzes</Link></Button></div>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="panel p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="eyebrow">Question {idx + 1} of {quiz.questions.length} · {q.topic}</span>
          <Button size="sm" variant={review.has(q.id) ? "secondary" : "ghost"} aria-pressed={review.has(q.id)} onClick={() => setReview((s) => { const n = new Set(s); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}><Bookmark /> {review.has(q.id) ? "Marked" : "Mark for review"}</Button>
        </div>
        <Progress value={(answeredCount / quiz.questions.length) * 100} className="mb-5 h-1.5" aria-label="Answered progress" />
        <h2 className="mb-3 text-lg font-semibold">{q.prompt}</h2>
        {q.figure && <pre className="mb-4 overflow-x-auto rounded-md bg-ink p-3 font-mono text-sm text-ink-foreground">{q.figure}</pre>}
        <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        <div className="mt-6 flex justify-between">
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft /> Previous</Button>
          {idx < quiz.questions.length - 1 ? <Button onClick={() => setIdx(idx + 1)}>Next <ChevronRight /></Button> : <Button variant="success" onClick={() => setConfirm(true)}>Submit quiz</Button>}
        </div>
      </div>
      <aside className="panel h-fit p-4">
        {remaining !== null && <div className={cn("mb-4 flex items-center gap-2 font-mono text-xl", remaining < 60 && "text-destructive")} aria-live="off"><Timer className="h-5 w-5" /> {formatClock(remaining)}</div>}
        <div className="eyebrow mb-2">Question palette</div>
        <div className="grid grid-cols-5 gap-1.5">
          {quiz.questions.map((x, i) => <button key={x.id} onClick={() => setIdx(i)} aria-label={`Question ${i + 1}${isAnswered(x, answers[x.id]) ? ", answered" : ""}${review.has(x.id) ? ", marked" : ""}`} aria-current={i === idx}
            className={cn("relative h-9 rounded-md border font-mono text-xs", i === idx && "ring-2 ring-ring", isAnswered(x, answers[x.id]) && "border-primary bg-primary text-primary-foreground")}>{i + 1}{review.has(x.id) && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning" />}</button>)}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{answeredCount}/{quiz.questions.length} answered · {review.size} marked</p>
        <Button className="mt-4 w-full" variant="success" onClick={() => setConfirm(true)}>Submit</Button>
      </aside>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Submit quiz?</AlertDialogTitle><AlertDialogDescription>You've answered {answeredCount} of {quiz.questions.length} questions{review.size ? ` and marked ${review.size} for review` : ""}. Unanswered questions count as incorrect.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Keep working</AlertDialogCancel><AlertDialogAction onClick={finish}>Submit</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

