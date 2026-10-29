export type Question =
  | { id: string; type: "mcq"; topic: string; prompt: string; options: string[]; answer: number; explanation: string; figure?: string }
  | { id: string; type: "tf"; topic: string; prompt: string; answer: boolean; explanation: string; figure?: string }
  | { id: string; type: "numeric"; topic: string; prompt: string; answer: number; tolerance?: number; unit?: string; explanation: string; figure?: string }
  | { id: string; type: "truthtable"; topic: string; prompt: string; inputs: string[]; answer: (0 | 1)[]; explanation: string; figure?: string };

export type AnswerValue = number | boolean | (0 | 1 | null)[] | null;

export function isAnswered(q: Question, a: AnswerValue | undefined): boolean {
  if (a === undefined || a === null) return false;
  if (q.type === "truthtable") return Array.isArray(a) && a.length === q.answer.length && a.every((x) => x === 0 || x === 1);
  if (q.type === "numeric") return typeof a === "number" && Number.isFinite(a);
  return true;
}

export function isCorrect(q: Question, a: AnswerValue | undefined): boolean {
  if (!isAnswered(q, a)) return false;
  switch (q.type) {
    case "mcq": return a === q.answer;
    case "tf": return a === q.answer;
    case "numeric": {
      const tol = q.tolerance ?? Math.max(1e-9, Math.abs(q.answer) * 0.01);
      return Math.abs((a as number) - q.answer) <= tol;
    }
    case "truthtable": return (a as (0 | 1)[]).every((v, i) => v === q.answer[i]);
  }
}

export interface QuizResult {
  total: number;
  correct: number;
  answered: number;
  accuracy: number; // 0..100 of total
  score: number; // points = correct * 10
  byTopic: Record<string, { correct: number; total: number }>;
  perQuestion: { id: string; correct: boolean; answered: boolean }[];
  timeTakenSec: number;
}

export function scoreQuiz(questions: Question[], answers: Record<string, AnswerValue>, timeTakenSec: number): QuizResult {
  const byTopic: QuizResult["byTopic"] = {};
  const perQuestion = questions.map((q) => {
    const answered = isAnswered(q, answers[q.id]);
    const correct = isCorrect(q, answers[q.id]);
    byTopic[q.topic] ??= { correct: 0, total: 0 };
    byTopic[q.topic].total++;
    if (correct) byTopic[q.topic].correct++;
    return { id: q.id, correct, answered };
  });
  const correct = perQuestion.filter((p) => p.correct).length;
  return {
    total: questions.length,
    correct,
    answered: perQuestion.filter((p) => p.answered).length,
    accuracy: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    score: correct * 10,
    byTopic,
    perQuestion,
    timeTakenSec,
  };
}

/** Remaining seconds of a countdown, never below zero. */
export function remainingSeconds(limitSec: number, startedAtMs: number, nowMs: number) {
  return Math.max(0, limitSec - Math.floor((nowMs - startedAtMs) / 1000));
}

export function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
