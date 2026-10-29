export type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR";
export const GATE_TYPES: GateType[] = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"];

export const GATE_INFO: Record<GateType, { expr: string; description: string; inputs: number }> = {
  AND: { expr: "Y = A · B", description: "Output is 1 only when every input is 1.", inputs: 2 },
  OR: { expr: "Y = A + B", description: "Output is 1 when at least one input is 1.", inputs: 2 },
  NOT: { expr: "Y = A'", description: "Output is the complement of the single input.", inputs: 1 },
  NAND: { expr: "Y = (A · B)'", description: "Inverted AND: output is 0 only when every input is 1.", inputs: 2 },
  NOR: { expr: "Y = (A + B)'", description: "Inverted OR: output is 1 only when every input is 0.", inputs: 2 },
  XOR: { expr: "Y = A ⊕ B", description: "Output is 1 when an odd number of inputs are 1.", inputs: 2 },
  XNOR: { expr: "Y = (A ⊕ B)'", description: "Output is 1 when an even number of inputs are 1 (inputs equal).", inputs: 2 },
};

export function evaluateGate(type: GateType, inputs: boolean[]): boolean {
  if (type === "NOT") {
    if (inputs.length !== 1) throw new Error("NOT gate requires exactly one input");
    return !inputs[0];
  }
  if (inputs.length < 2) throw new Error(`${type} gate requires at least two inputs`);
  const ones = inputs.filter(Boolean).length;
  switch (type) {
    case "AND": return ones === inputs.length;
    case "OR": return ones > 0;
    case "NAND": return ones !== inputs.length;
    case "NOR": return ones === 0;
    case "XOR": return ones % 2 === 1;
    case "XNOR": return ones % 2 === 0;
  }
}

/** All 2^n input combinations in binary counting order (MSB first). */
export function inputCombinations(n: number): boolean[][] {
  const rows: boolean[][] = [];
  for (let i = 0; i < 1 << n; i++) {
    rows.push(Array.from({ length: n }, (_, b) => Boolean((i >> (n - 1 - b)) & 1)));
  }
  return rows;
}

export function gateTruthTable(type: GateType, n = GATE_INFO[type].inputs) {
  return inputCombinations(n).map((inputs) => ({ inputs, output: evaluateGate(type, inputs) }));
}

export function explainGate(type: GateType, inputs: boolean[]): string {
  const out = evaluateGate(type, inputs);
  const bits = inputs.map((v) => (v ? 1 : 0)).join(", ");
  const ones = inputs.filter(Boolean).length;
  const why: Record<GateType, string> = {
    AND: out ? "all inputs are 1" : "at least one input is 0",
    OR: out ? "at least one input is 1" : "every input is 0",
    NOT: out ? "the input is 0, so it is inverted to 1" : "the input is 1, so it is inverted to 0",
    NAND: out ? "not every input is 1, so the AND result (0) is inverted" : "all inputs are 1, so the AND result (1) is inverted",
    NOR: out ? "every input is 0, so the OR result (0) is inverted" : "at least one input is 1, so the OR result (1) is inverted",
    XOR: `${ones} input(s) are 1 — an ${ones % 2 ? "odd" : "even"} count`,
    XNOR: `${ones} input(s) are 1 — an ${ones % 2 ? "odd" : "even"} count, then inverted`,
  };
  return `Inputs (${bits}) → Y = ${out ? 1 : 0} because ${why[type]}.`;
}

// ---------------- Circuit graph ----------------

export type NodeKind = "INPUT" | "OUTPUT" | GateType;
export interface CircuitNode {
  id: string;
  kind: NodeKind;
  label: string;
  x: number;
  y: number;
  value?: boolean; // for INPUT
}
export interface Wire {
  id: string;
  from: string; // source node id (its output)
  to: string; // target node id
  toPort: number; // target input index
}
export interface Circuit {
  nodes: CircuitNode[];
  wires: Wire[];
}

export function inputPortCount(kind: NodeKind): number {
  if (kind === "INPUT") return 0;
  if (kind === "OUTPUT" || kind === "NOT") return 1;
  return 2;
}

export interface ValidationIssue {
  nodeId?: string;
  message: string;
}

/** Checks whether a proposed wire is allowed. Returns error message or null. */
export function validateConnection(c: Circuit, from: string, to: string, toPort: number): string | null {
  const src = c.nodes.find((n) => n.id === from);
  const dst = c.nodes.find((n) => n.id === to);
  if (!src || !dst) return "Unknown component.";
  if (from === to) return "A component cannot connect to itself.";
  if (src.kind === "OUTPUT") return "Output indicators have no output port.";
  if (dst.kind === "INPUT") return "Input switches have no input port.";
  if (toPort < 0 || toPort >= inputPortCount(dst.kind)) return "That input port does not exist.";
  if (c.wires.some((w) => w.to === to && w.toPort === toPort)) return "That input port is already connected.";
  // cycle check: would 'to' reach 'from'?
  const adj = new Map<string, string[]>();
  for (const w of c.wires) adj.set(w.from, [...(adj.get(w.from) ?? []), w.to]);
  const stack = [to];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === from) return "This connection would create a feedback loop, which this combinational simulator does not support.";
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...(adj.get(cur) ?? []));
  }
  return null;
}

export function validateCircuit(c: Circuit): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const outputs = c.nodes.filter((n) => n.kind === "OUTPUT");
  if (!c.nodes.some((n) => n.kind === "INPUT")) issues.push({ message: "Add at least one input switch." });
  if (outputs.length === 0) issues.push({ message: "Add at least one output indicator." });
  for (const n of c.nodes) {
    const ports = inputPortCount(n.kind);
    for (let p = 0; p < ports; p++) {
      if (!c.wires.some((w) => w.to === n.id && w.toPort === p)) {
        issues.push({ nodeId: n.id, message: `${n.label}: input ${p + 1} is not connected.` });
      }
    }
  }
  return issues;
}

/** Evaluates all nodes. Throws if the circuit is invalid. */
export function evaluateCircuit(c: Circuit, inputOverrides?: Record<string, boolean>): Record<string, boolean> {
  const issues = validateCircuit(c);
  if (issues.length) throw new Error(issues[0].message);
  const values: Record<string, boolean> = {};
  const visiting = new Set<string>();
  const byId = new Map(c.nodes.map((n) => [n.id, n]));
  const resolve = (id: string): boolean => {
    if (id in values) return values[id];
    if (visiting.has(id)) throw new Error("Feedback loop detected.");
    visiting.add(id);
    const n = byId.get(id)!;
    let v: boolean;
    if (n.kind === "INPUT") v = inputOverrides?.[id] ?? Boolean(n.value);
    else {
      const ins = Array.from({ length: inputPortCount(n.kind) }, (_, p) => {
        const w = c.wires.find((w) => w.to === id && w.toPort === p)!;
        return resolve(w.from);
      });
      v = n.kind === "OUTPUT" ? ins[0] : evaluateGate(n.kind, ins);
    }
    visiting.delete(id);
    values[id] = v;
    return v;
  };
  c.nodes.forEach((n) => resolve(n.id));
  return values;
}

export function circuitTruthTable(c: Circuit) {
  const inputs = c.nodes.filter((n) => n.kind === "INPUT");
  const outputs = c.nodes.filter((n) => n.kind === "OUTPUT");
  if (inputs.length > 6) throw new Error("Truth tables are limited to 6 inputs (64 rows).");
  const rows = inputCombinations(inputs.length).map((combo) => {
    const ov = Object.fromEntries(inputs.map((n, i) => [n.id, combo[i]]));
    const vals = evaluateCircuit(c, ov);
    return { inputs: combo, outputs: outputs.map((o) => vals[o.id]) };
  });
  return { inputLabels: inputs.map((n) => n.label), outputLabels: outputs.map((n) => n.label), rows };
}
