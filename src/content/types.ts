import type { GateType } from "@/engines/logic";
import type { WaveShape } from "@/engines/signals";

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export type Diagram =
  | { kind: "blocks"; blocks: string[]; caption: string }
  | { kind: "wave"; shape: WaveShape; caption: string }
  | { kind: "gate"; gate: GateType; caption: string }
  | { kind: "am"; caption: string }
  | { kind: "sampling"; caption: string };

export interface CheckQuestion {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface Lesson {
  id: string;
  title: string;
  minutes: number;
  summary: string;
  sections: { heading: string; body: string[] }[];
  terms: [string, string][];
  equations?: { label: string; expr: string; vars?: string }[];
  steps?: string[];
  example?: { problem: string; solution: string[] };
  takeaways: string[];
  check: CheckQuestion[];
  simulations?: string[];
  diagram?: Diagram;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  short: string;
  overview: string;
  difficulty: Difficulty;
  hours: number;
  objectives: string[];
  prerequisites: string[];
  activities: { label: string; href: string }[];
  quizIds: string[];
  modules: Module[];
}
