/**
 * Export the frontend's bundled curriculum content to JSON for MongoDB seeding.
 * Run from the repo root:  bun backend/scripts/export_content.ts
 * (Bun resolves the frontend's extensionless TS imports and `@/` aliases.)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { COURSES, courseLessons } from "../../src/content/courses";
import { CHALLENGES } from "../../src/content/challenges";
import { GAMES, QUIZZES } from "../../src/content/quizzes";
import { SCENARIOS, SIMULATIONS } from "../../src/content/catalog";

const OUT = resolve(import.meta.dir, "../seed_data");
mkdirSync(OUT, { recursive: true });

const stripIcon = ({ icon: _icon, ...rest }: Record<string, unknown>) => rest;

writeFileSync(resolve(OUT, "courses.json"), JSON.stringify(COURSES, null, 2));
writeFileSync(resolve(OUT, "challenges.json"), JSON.stringify(CHALLENGES, null, 2));
writeFileSync(resolve(OUT, "quizzes.json"), JSON.stringify(QUIZZES, null, 2));
writeFileSync(resolve(OUT, "games.json"), JSON.stringify(GAMES, null, 2));
writeFileSync(
  resolve(OUT, "simulations.json"),
  JSON.stringify(SIMULATIONS.map(stripIcon), null, 2),
);
writeFileSync(resolve(OUT, "scenarios.json"), JSON.stringify(SCENARIOS, null, 2));

let lessons = 0;
for (const c of COURSES) lessons += courseLessons(c).length;
console.log(`Exported ${COURSES.length} courses (${lessons} lessons), ${CHALLENGES.length} challenges, ${QUIZZES.length} quizzes, ${GAMES.length} games, ${SIMULATIONS.length} simulations, ${SCENARIOS.length} scenarios -> ${OUT}`);
