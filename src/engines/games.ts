import { evaluateGate, inputCombinations, type GateType } from "./logic";
import { seededRandom } from "./communication";

/** Circuit puzzle: Y = G2( G1(A,B), C ). Find inputs that make Y = 1. */
export interface Puzzle { g1: GateType; g2: GateType; invertC: boolean }

export function evalPuzzle(p: Puzzle, a: boolean, b: boolean, c: boolean) {
  const mid = evaluateGate(p.g1, [a, b]);
  return evaluateGate(p.g2, [mid, p.invertC ? !c : c]);
}

export function puzzleSolutions(p: Puzzle) {
  return inputCombinations(3).filter(([a, b, c]) => evalPuzzle(p, a, b, c));
}

const TWO: GateType[] = ["AND", "OR", "NAND", "NOR", "XOR", "XNOR"];

/** Generates puzzles with between 1 and 3 solutions (so they're non-trivial). */
export function makePuzzle(seed: number): Puzzle {
  const r = seededRandom(seed);
  for (;;) {
    const p = { g1: TWO[Math.floor(r() * TWO.length)], g2: TWO[Math.floor(r() * TWO.length)], invertC: r() > 0.5 };
    const n = puzzleSolutions(p).length;
    if (n >= 1 && n <= 3) return p;
  }
}

/** Rapid logic: random expression over A,B with known answer. */
export interface RapidQ { text: string; answer: 0 | 1 }

export function makeRapid(seed: number): RapidQ {
  const r = seededRandom(seed);
  const a = r() > 0.5, b = r() > 0.5;
  const g = TWO[Math.floor(r() * TWO.length)];
  const neg = r() > 0.7;
  const v = evaluateGate(g, [a, b]);
  const ans = neg ? !v : v;
  return { text: `${neg ? "NOT " : ""}(${a ? 1 : 0} ${g} ${b ? 1 : 0})`, answer: ans ? 1 : 0 };
}

/** Points: +10 per correct, −5 per wrong, never below 0. */
export function rapidScore(correct: number, wrong: number) {
  return Math.max(0, correct * 10 - wrong * 5);
}
