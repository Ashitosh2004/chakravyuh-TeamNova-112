import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isBackendConfigured, progressApi } from "@/services/api";
import { useSession } from "@/stores/session";

/**
 * Learning activity recorded on this device (browser storage).
 * When the backend is connected and the session is a real backend session,
 * events are additionally posted to /api/v1/activities (fire-and-forget).
 * Quiz attempts are the exception: the quiz submit endpoint persists them
 * server-side with the authoritative score, so re-posting here would
 * double-count them.
 */
export type ActivityEvent =
  | { type: "lesson_completed"; courseId: string; lessonId: string; at: number }
  | { type: "quiz_attempt"; quizId: string; score: number; accuracy: number; byTopic: Record<string, { correct: number; total: number }>; timeTakenSec: number; at: number }
  | { type: "challenge_passed"; challengeId: string; points: number; at: number }
  | { type: "challenge_run"; challengeId: string; passed: number; total: number; at: number }
  | { type: "simulation_used"; simulationId: string; at: number }
  | { type: "scenario_completed"; scenarioId: string; at: number }
  | { type: "game_score"; game: string; score: number; at: number };

type NoAt<T> = T extends unknown ? Omit<T, "at"> : never;

function syncToServer(e: NoAt<ActivityEvent>) {
  if (!isBackendConfigured()) return;
  if (useSession.getState().mode !== "backend") return;
  if (e.type === "quiz_attempt") return;
  progressApi.record(e).catch(() => undefined);
}

interface ProgressState {
  events: ActivityEvent[];
  record: (e: NoAt<ActivityEvent>) => void;
  uncompleteLesson: (courseId: string, lessonId: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      events: [],
      record: (e) => {
        set((s) => ({ events: [...s.events, { ...e, at: Date.now() } as ActivityEvent] }));
        syncToServer(e);
      },
      uncompleteLesson: (courseId, lessonId) =>
        set((s) => ({ events: s.events.filter((e) => !(e.type === "lesson_completed" && e.courseId === courseId && e.lessonId === lessonId)) })),
      reset: () => set({ events: [] }),
    }),
    { name: "chakravyuh-progress-v1" },
  ),
);

// ---------- Derived selectors (pure, testable) ----------
export function completedLessons(events: ActivityEvent[]) {
  const set = new Set<string>();
  for (const e of events) if (e.type === "lesson_completed") set.add(`${e.courseId}/${e.lessonId}`);
  return set;
}
export function passedChallenges(events: ActivityEvent[]) {
  return new Set(events.filter((e) => e.type === "challenge_passed").map((e) => (e as { challengeId: string }).challengeId));
}
export function usedSimulations(events: ActivityEvent[]) {
  return new Set(events.filter((e) => e.type === "simulation_used").map((e) => (e as { simulationId: string }).simulationId));
}
export function completedScenarios(events: ActivityEvent[]) {
  return new Set(events.filter((e) => e.type === "scenario_completed").map((e) => (e as { scenarioId: string }).scenarioId));
}
export function quizAttempts(events: ActivityEvent[]) {
  return events.filter((e): e is Extract<ActivityEvent, { type: "quiz_attempt" }> => e.type === "quiz_attempt");
}

export function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Activity counts for the last `days` days ending today. */
export function activityByDay(events: ActivityEvent[], days = 7, now = Date.now()) {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(dayKey(e.at), (counts.get(dayKey(e.at)) ?? 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const ts = now - (days - 1 - i) * 86_400_000;
    const d = new Date(ts);
    return { day: d.toLocaleDateString(undefined, { weekday: "short" }), date: dayKey(ts), count: counts.get(dayKey(ts)) ?? 0 };
  });
}

/** Consecutive days (ending today or yesterday) with at least one activity. */
export function learningStreak(events: ActivityEvent[], now = Date.now()) {
  const days = new Set(events.map((e) => dayKey(e.at)));
  let streak = 0;
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= 86_400_000;
  while (days.has(dayKey(cursor))) { streak++; cursor -= 86_400_000; }
  return streak;
}

export function topicPerformance(events: ActivityEvent[]) {
  const agg: Record<string, { correct: number; total: number }> = {};
  for (const a of quizAttempts(events)) {
    for (const [t, v] of Object.entries(a.byTopic)) {
      agg[t] ??= { correct: 0, total: 0 };
      agg[t].correct += v.correct;
      agg[t].total += v.total;
    }
  }
  return Object.entries(agg).map(([topic, v]) => ({ topic, accuracy: Math.round((v.correct / v.total) * 100), ...v }));
}

export interface Achievement { id: string; title: string; description: string; unlocked: boolean; progress: number; target: number }

export function computeAchievements(events: ActivityEvent[]): Achievement[] {
  const lessons = completedLessons(events);
  const sims = usedSimulations(events);
  const gateSims = ["logic-gates", "circuit-builder"].filter((s) => sims.has(s)).length;
  const quizzes = quizAttempts(events).length;
  const challenges = passedChallenges(events).size;
  const embedded = [...lessons].filter((l) => l.startsWith("embedded-systems/")).length;
  const scenarios = completedScenarios(events).size;
  const highQuiz = quizAttempts(events).some((a) => a.accuracy >= 80) ? 1 : 0;
  const mk = (id: string, title: string, description: string, progress: number, target: number): Achievement => ({
    id, title, description, progress: Math.min(progress, target), target, unlocked: progress >= target,
  });
  return [
    mk("first-lesson", "First Lesson Completed", "Complete any lesson.", lessons.size, 1),
    mk("logic-explorer", "Logic Gate Explorer", "Use both the Logic Gate Lab and the Circuit Builder.", gateSims, 2),
    mk("quiz-starter", "Quiz Starter", "Submit your first quiz.", quizzes, 1),
    mk("quiz-ace", "Sharp Scorer", "Score 80% or higher on any quiz.", highQuiz, 1),
    mk("coding-beginner", "Coding Beginner", "Pass your first coding challenge.", challenges, 1),
    mk("lab-explorer", "Virtual Lab Explorer", "Use all five virtual lab simulations.", sims.size, 5),
    mk("embedded-learner", "Embedded Systems Learner", "Complete 3 Embedded Systems lessons.", embedded, 3),
    mk("scenario-engineer", "Systems Thinker", "Complete 2 real-world scenarios.", scenarios, 2),
    mk("dedicated", "Ten Lessons Strong", "Complete 10 lessons.", lessons.size, 10),
  ];
}
