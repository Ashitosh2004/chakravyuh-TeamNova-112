import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DifficultyBadge, EmptyState, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { search, type SearchCategory } from "@/content/search";

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === "string" ? { q: s.q } : {}),
  head: () => ({ meta: [{ title: "Search — CHAKRAVYUH" }, { name: "description", content: "Search courses, lessons, simulations, challenges, quizzes and scenarios." }, { property: "og:title", content: "Search — CHAKRAVYUH" }, { property: "og:description", content: "Find ENTC learning content." }] }),
  component: SearchPage,
});

const CATS: (SearchCategory | "All")[] = ["All", "Course", "Lesson", "Simulation", "Challenge", "Quiz", "Scenario"];
const DIFFS = ["All", "Beginner", "Intermediate", "Advanced"];

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [text, setText] = useState(q);
  const [debounced, setDebounced] = useState(q);
  const [cat, setCat] = useState<SearchCategory | "All">("All");
  const [diff, setDiff] = useState("All");
  useEffect(() => { const t = setTimeout(() => { setDebounced(text); navigate({ search: { q: text }, replace: true }); }, 250); return () => clearTimeout(t); }, [text, navigate]);
  const results = useMemo(() => search(debounced, { category: cat, difficulty: diff }), [debounced, cat, diff]);
  const pill = (active: boolean) => `rounded-md border px-3 py-1 text-xs ${active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Discover" title="Search" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Search" }]} />
      <div className="relative mb-4"><Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search everything…" aria-label="Search query" className="h-11 pr-10" />
        {text && <Button size="icon" variant="ghost" className="absolute right-1 top-1" aria-label="Clear search" onClick={() => setText("")}><X /></Button>}</div>
      <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Category">{CATS.map((c) => <button key={c} aria-pressed={cat === c} className={pill(cat === c)} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="mb-5 flex flex-wrap gap-1" role="group" aria-label="Difficulty">{DIFFS.map((d) => <button key={d} aria-pressed={diff === d} className={pill(diff === d)} onClick={() => setDiff(d)}>{d}</button>)}</div>
      <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">{results.length} result(s)</p>
      {results.length === 0 ? <EmptyState title="No results" description="Try different keywords or clear the filters." /> : (
        <ul className="panel divide-y">{results.map((r) => (
          <li key={`${r.category}-${r.id}`}><Link to={r.href} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40">
            <span className="mt-0.5 w-20 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{r.category}</span>
            <div className="min-w-0 flex-1"><div className="font-medium">{r.title}</div><div className="truncate text-xs text-muted-foreground">{r.description}</div></div>
            <DifficultyBadge level={r.difficulty} />
          </Link></li>
        ))}</ul>
      )}
    </div>
  );
}
