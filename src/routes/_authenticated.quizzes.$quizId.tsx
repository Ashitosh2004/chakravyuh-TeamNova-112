import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { PageHeader } from "@/components/layout/PageHeader";
import { CircuitPuzzle, ComponentGame, RapidLogic } from "@/components/quizzes/Games";
import { QuizRunner } from "@/components/quizzes/QuizRunner";
import { getGame, getQuiz } from "@/content/quizzes";

export const Route = createFileRoute("/_authenticated/quizzes/$quizId")({
  loader: ({ params }) => {
    const q = getQuiz(params.quizId);
    const g = getGame(params.quizId);
    if (!q && !g) throw notFound();
    return { title: q?.title ?? g!.title, description: q?.description ?? g!.description };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Quiz"} — CHAKRAVYUH` }, { name: "description", content: loaderData?.description ?? "Quiz" }, { property: "og:title", content: `${loaderData?.title ?? "Quiz"} — CHAKRAVYUH` }, { property: "og:description", content: loaderData?.description ?? "Quiz" }] }),
  notFoundComponent: () => <div className="p-6">Quiz not found. <Link to="/quizzes" className="text-signal underline">Back</Link></div>,
  component: QuizPage,
});

function QuizPage() {
  const { quizId } = Route.useParams();
  const quiz = getQuiz(quizId);
  const game = getGame(quizId);
  const title = quiz?.title ?? game!.title;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={quiz ? quiz.category : "Mini-game"} title={title} description={game?.description} crumbs={[{ label: "Quizzes", to: "/quizzes" }, { label: title }]} />
      {quiz ? <QuizRunner quiz={quiz} /> : game!.kind === "circuit-puzzle" ? <CircuitPuzzle /> : game!.kind === "components" ? <ComponentGame /> : <RapidLogic />}
    </div>
  );
}
