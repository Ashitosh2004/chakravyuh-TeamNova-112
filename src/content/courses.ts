import { communicationSystems } from "./course-comm";
import { digitalElectronics } from "./course-digital";
import { embeddedSystems } from "./course-embedded";
import { aiml, analogElectronics, dsp, iot, sensorsInstrumentation, signalsSystems, wireless } from "./course-other";
import type { Course, Lesson } from "./types";

export const COURSES: Course[] = [
  digitalElectronics,
  analogElectronics,
  communicationSystems,
  signalsSystems,
  dsp,
  sensorsInstrumentation,
  embeddedSystems,
  iot,
  wireless,
  aiml,
];

export function getCourse(id: string) {
  return COURSES.find((c) => c.id === id);
}

export function courseLessons(c: Course): Lesson[] {
  return c.modules.flatMap((m) => m.lessons);
}

export function getLesson(courseId: string, lessonId: string) {
  const c = getCourse(courseId);
  if (!c) return undefined;
  const lessons = courseLessons(c);
  const idx = lessons.findIndex((l) => l.id === lessonId);
  if (idx < 0) return undefined;
  return { course: c, lesson: lessons[idx], prev: lessons[idx - 1], next: lessons[idx + 1], index: idx, total: lessons.length };
}

export function courseProgress(c: Course, completed: Set<string>) {
  const lessons = courseLessons(c);
  const done = lessons.filter((l) => completed.has(`${c.id}/${l.id}`)).length;
  return { done, total: lessons.length, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 };
}
