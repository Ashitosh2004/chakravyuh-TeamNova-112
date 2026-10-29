import { Link, createFileRoute } from "@tanstack/react-router";
import { Gamepad2, Timer } from "lucide-react";

import { DifficultyBadge, PageHeader } from "@/components/layout/PageHeader";
import { formatClock } from "@/engines/quiz";
import { GAMES, QUIZZES } from "@/content/quizzes";
import { quizAttempts, useProgress } from "@/stores/progress";

export const Route = createFileRoute("/_authenticated/quizzes/")({
  head: () => ({ meta: [{ title: "Quizzes & Mini-Games — CHAKRAVYUH" }, { name: "description", content: "Timed ENTC quizzes with explanations plus logic and component games." }, { property: "og:title", content: "Quizzes & Mini-Games — CHAKRAVYUH" }, { property: "og:description", content: "Test your ENTC knowledge." }] }),
  component: QuizIndex,
});

function QuizIndex() {
  const attempts = quizAttempts(useProgress((s) => s.events));
  const best = (id: string) => Math.max(-1, ...attempts.filter((a) => a.quizId === id).map((a) => a.accuracy));
  const bestGame = useProgress((s) => s.events);
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Assessment" title="Quizzes & mini-games" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Quizzes" }]} />
      <h2 className="mb-3 font-semibold">Quizzes</h2>
      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        {QUIZZES.map((q) => (
          <Link key={q.id} to="/quizzes/$quizId" params={{ quizId: q.id }} className="panel p-5 hover:shadow-lift">
            <div className="mb-2 flex items-center justify-between"><span className="eyebrow">{q.category}</span><DifficultyBadge level={q.difficulty} /></div>
            <h3 className="font-semibold">{q.title}</h3>
            <p className="text-sm text-muted-foreground">{q.description}</p>
            <div className="mt-3 flex gap-4 font-mono text-xs text-muted-foreground"><span>{q.questions.length} questions</span>{q.timeLimitSec && <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{formatClock(q.timeLimitSec)}</span>}<span className="ml-auto">{best(q.id) >= 0 ? `Best ${best(q.id)}%` : "Not attempted"}</span></div>
          </Link>
        ))}
      </div>
      <h2 className="mb-3 font-semibold">Mini-games</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {GAMES.map((g) => {
          const scores = bestGame.filter((e) => e.type === "game_score" && e.game === g.id).map((e) => (e as { score: number }).score);
          return (
            <Link key={g.id} to="/quizzes/$quizId" params={{ quizId: g.id }} className="panel p-5 hover:shadow-lift">
              <Gamepad2 className="mb-3 h-6 w-6 text-signal" />
              <h3 className="font-semibold">{g.title}</h3>
              <p className="text-sm text-muted-foreground">{g.description}</p>
              <div className="mt-3 font-mono text-xs text-muted-foreground">{scores.length ? `High score ${Math.max(...scores)}` : "No score yet"}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
