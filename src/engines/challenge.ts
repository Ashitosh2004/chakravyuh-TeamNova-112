import { runScript, type RunResult } from "./interpreter";

export interface TestCase {
  name: string;
  inputs: Record<string, number>;
  expectReturn?: number;
  expectPins?: Record<number, number>;
  expectOutput?: string[];
  tolerance?: number;
}

export interface TestOutcome {
  name: string;
  passed: boolean;
  detail: string;
  run: RunResult;
}

export function runTests(code: string, tests: TestCase[]): TestOutcome[] {
  return tests.map((tc) => {
    const run = runScript(code, tc.inputs);
    if (!run.ok) return { name: tc.name, passed: false, detail: run.error ?? "Execution failed", run };
    const problems: string[] = [];
    if (tc.expectReturn !== undefined) {
      const tol = tc.tolerance ?? 1e-6;
      if (run.returnValue === undefined) problems.push(`expected return ${tc.expectReturn}, but nothing was returned`);
      else if (Math.abs(run.returnValue - tc.expectReturn) > tol) problems.push(`expected return ${tc.expectReturn}, got ${round(run.returnValue)}`);
    }
    if (tc.expectPins) {
      for (const [pin, v] of Object.entries(tc.expectPins)) {
        const got = run.pins[Number(pin)];
        if (got !== v) problems.push(`expected pin ${pin} = ${v}, got ${got === undefined ? "not written" : got}`);
      }
    }
    if (tc.expectOutput) {
      const exp = tc.expectOutput.join("\n");
      const got = run.output.join("\n");
      if (exp !== got) problems.push(`expected output "${exp}", got "${got || "(nothing)"}"`);
    }
    const inp = Object.entries(tc.inputs).map(([k, v]) => `${k}=${v}`).join(", ");
    return {
      name: tc.name,
      passed: problems.length === 0,
      detail: problems.length ? `With ${inp || "no inputs"}: ${problems.join("; ")}.` : `With ${inp || "no inputs"}: correct.`,
      run,
    };
  });
}

function round(v: number) {
  return Number.isInteger(v) ? v : Number(v.toFixed(4));
}
