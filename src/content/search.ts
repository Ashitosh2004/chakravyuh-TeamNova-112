import { CHALLENGES } from "./challenges";
import { SCENARIOS, SIMULATIONS } from "./catalog";
import { COURSES, courseLessons } from "./courses";
import { GAMES, QUIZZES } from "./quizzes";

export type SearchCategory = "Course" | "Lesson" | "Simulation" | "Challenge" | "Quiz" | "Scenario";

export interface SearchItem {
  id: string;
  category: SearchCategory;
  title: string;
  description: string;
  difficulty?: string;
  href: string;
  keywords: string;
}

let INDEX: SearchItem[] | null = null;

export function searchIndex(): SearchItem[] {
  if (INDEX) return INDEX;
  const items: SearchItem[] = [];
  for (const c of COURSES) {
    items.push({ id: c.id, category: "Course", title: c.title, description: c.short, difficulty: c.difficulty, href: `/learn/${c.id}`, keywords: c.overview });
    for (const l of courseLessons(c)) {
      items.push({
        id: `${c.id}/${l.id}`, category: "Lesson", title: l.title, description: `${c.title} · ${l.summary}`, difficulty: c.difficulty,
        href: `/learn/${c.id}/lesson/${l.id}`, keywords: [l.summary, ...l.terms.map((t) => t.join(" ")), ...l.sections.map((s) => s.heading)].join(" "),
      });
    }
  }
  for (const s of SIMULATIONS) items.push({ id: s.id, category: "Simulation", title: s.title, description: s.description, difficulty: s.difficulty, href: `/lab/${s.id}`, keywords: s.description });
  for (const ch of CHALLENGES) items.push({ id: ch.id, category: "Challenge", title: ch.title, description: `${ch.category} · ${ch.objective}`, difficulty: ch.difficulty, href: `/coding/${ch.id}`, keywords: ch.statement });
  for (const q of QUIZZES) items.push({ id: q.id, category: "Quiz", title: q.title, description: q.description, difficulty: q.difficulty, href: `/quizzes/${q.id}`, keywords: q.category });
  for (const g of GAMES) items.push({ id: g.id, category: "Quiz", title: g.title, description: g.description, href: `/quizzes/${g.id}`, keywords: "game mini-game" });
  for (const s of SCENARIOS) items.push({ id: s.id, category: "Scenario", title: s.title, description: s.problem, difficulty: s.difficulty, href: `/scenarios/${s.id}`, keywords: s.objectives.join(" ") });
  INDEX = items;
  return items;
}

export function search(query: string, opts: { category?: SearchCategory | "All"; difficulty?: string | "All" } = {}) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return searchIndex()
    .filter((i) => !opts.category || opts.category === "All" || i.category === opts.category)
    .filter((i) => !opts.difficulty || opts.difficulty === "All" || i.difficulty === opts.difficulty)
    .map((i) => {
      if (!terms.length) return { item: i, score: 1 };
      const title = i.title.toLowerCase();
      const hay = `${title} ${i.description} ${i.keywords}`.toLowerCase();
      if (!terms.every((t) => hay.includes(t))) return { item: i, score: 0 };
      const score = terms.reduce((s, t) => s + (title.includes(t) ? 5 : 1), 0) + (title.startsWith(terms[0]) ? 3 : 0);
      return { item: i, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
