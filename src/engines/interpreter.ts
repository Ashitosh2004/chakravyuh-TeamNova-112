/**
 * ChakraScript — a tiny, sandboxed C/Arduino-style language interpreter.
 * It never uses eval/Function. Supported: numeric/bool variables, arithmetic,
 * bitwise, comparison and logical operators, if/else, while, for, return,
 * a whitelist of math helpers, and Arduino-style digitalWrite/analogWrite/
 * Serial.println which are recorded rather than touching any hardware.
 * Execution is bounded by a step limit to prevent infinite loops.
 */

type Tok = { t: "num" | "id" | "op" | "eof"; v: string; line: number };

const OPS = ["<<=", ">>=", "&&", "||", "==", "!=", "<=", ">=", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "++", "--",
  "+", "-", "*", "/", "%", "<", ">", "=", "!", "~", "&", "|", "^", "?", ":", "(", ")", "{", "}", ";", ","];

export class ScriptError extends Error {
  constructor(message: string, public line?: number) {
    super(line ? `Line ${line}: ${message}` : message);
  }
}

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  while (i < src.length) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
      i += 2; continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(0b[01]+|0x[0-9a-fA-F]+|\d*\.?\d+(?:e[+-]?\d+)?)/.exec(src.slice(i));
      if (!m) throw new ScriptError(`Invalid number`, line);
      toks.push({ t: "num", v: m[0], line }); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?/.exec(src.slice(i))!;
      toks.push({ t: "id", v: m[0], line }); i += m[0].length; continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new ScriptError(`Unexpected character '${c}'`, line);
    toks.push({ t: "op", v: op, line }); i += op.length;
  }
  toks.push({ t: "eof", v: "", line });
  return toks;
}

type Expr =
  | { k: "num"; v: number }
  | { k: "var"; name: string; line: number }
  | { k: "un"; op: string; e: Expr }
  | { k: "bin"; op: string; l: Expr; r: Expr }
  | { k: "tern"; c: Expr; a: Expr; b: Expr }
  | { k: "call"; name: string; args: Expr[]; line: number };

type Stmt =
  | { k: "decl" | "assign"; name: string; op: string; e: Expr; line: number }
  | { k: "expr"; e: Expr }
  | { k: "if"; c: Expr; a: Stmt; b?: Stmt }
  | { k: "while"; c: Expr; body: Stmt }
  | { k: "for"; init?: Stmt; c?: Expr; upd?: Stmt; body: Stmt }
  | { k: "block"; body: Stmt[] }
  | { k: "return"; e?: Expr };

const TYPES = new Set(["int", "float", "bool", "long", "byte", "let", "double", "const", "unsigned"]);
const CONSTS: Record<string, number> = { HIGH: 1, LOW: 0, true: 1, false: 0, OUTPUT: 1, INPUT: 0, PI: Math.PI };

class Parser {
  p = 0;
  constructor(private toks: Tok[]) {}
  peek(o = 0) { return this.toks[this.p + o]; }
  next() { return this.toks[this.p++]; }
  is(v: string) { const t = this.peek(); return (t.t === "op" || t.t === "id") && t.v === v; }
  expect(v: string) {
    const t = this.next();
    if (t.v !== v) throw new ScriptError(`Expected '${v}' but found '${t.v || "end of code"}'`, t.line);
    return t;
  }
  program(): Stmt[] {
    const out: Stmt[] = [];
    while (this.peek().t !== "eof") out.push(this.stmt());
    return out;
  }
  stmt(): Stmt {
    const t = this.peek();
    if (this.is("{")) {
      this.next();
      const body: Stmt[] = [];
      while (!this.is("}")) { if (this.peek().t === "eof") throw new ScriptError("Missing '}'", t.line); body.push(this.stmt()); }
      this.next();
      return { k: "block", body };
    }
    if (this.is("if")) {
      this.next(); this.expect("("); const c = this.expr(); this.expect(")");
      const a = this.stmt();
      let b: Stmt | undefined;
      if (this.is("else")) { this.next(); b = this.stmt(); }
      return { k: "if", c, a, b };
    }
    if (this.is("while")) {
      this.next(); this.expect("("); const c = this.expr(); this.expect(")");
      return { k: "while", c, body: this.stmt() };
    }
    if (this.is("for")) {
      this.next(); this.expect("(");
      const init = this.is(";") ? undefined : this.simple();
      this.expect(";");
      const c = this.is(";") ? undefined : this.expr();
      this.expect(";");
      const upd = this.is(")") ? undefined : this.simple();
      this.expect(")");
      return { k: "for", init, c, upd, body: this.stmt() };
    }
    if (this.is("return")) {
      this.next();
      const e = this.is(";") ? undefined : this.expr();
      this.expect(";");
      return { k: "return", e };
    }
    const s = this.simple();
    this.expect(";");
    return s;
  }
  simple(): Stmt {
    const t = this.peek();
    let decl = false;
    while (t.t === "id" && TYPES.has(this.peek().v)) { this.next(); decl = true; }
    const idTok = this.peek();
    if (idTok.t === "id") {
      const nx = this.peek(1);
      if (nx.t === "op" && ["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>="].includes(nx.v)) {
        this.next(); this.next();
        return { k: decl ? "decl" : "assign", name: idTok.v, op: nx.v, e: this.expr(), line: idTok.line };
      }
      if (nx.t === "op" && (nx.v === "++" || nx.v === "--")) {
        this.next(); this.next();
        return { k: "assign", name: idTok.v, op: nx.v === "++" ? "+=" : "-=", e: { k: "num", v: 1 }, line: idTok.line };
      }
      if (decl) { this.next(); return { k: "decl", name: idTok.v, op: "=", e: { k: "num", v: 0 }, line: idTok.line }; }
    }
    return { k: "expr", e: this.expr() };
  }
  expr(): Expr { return this.ternary(); }
  ternary(): Expr {
    const c = this.bin(0);
    if (this.is("?")) { this.next(); const a = this.expr(); this.expect(":"); const b = this.expr(); return { k: "tern", c, a, b }; }
    return c;
  }
  static LEVELS = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]];
  bin(level: number): Expr {
    if (level >= Parser.LEVELS.length) return this.unary();
    let l = this.bin(level + 1);
    while (this.peek().t === "op" && Parser.LEVELS[level].includes(this.peek().v)) {
      const op = this.next().v;
      l = { k: "bin", op, l, r: this.bin(level + 1) };
    }
    return l;
  }
  unary(): Expr {
    if (this.peek().t === "op" && ["!", "-", "~", "+"].includes(this.peek().v)) {
      const op = this.next().v;
      return { k: "un", op, e: this.unary() };
    }
    return this.primary();
  }
  primary(): Expr {
    const t = this.next();
    if (t.t === "num") {
      const v = t.v.startsWith("0b") ? parseInt(t.v.slice(2), 2) : Number(t.v);
      return { k: "num", v };
    }
    if (t.t === "id") {
      if (this.is("(")) {
        this.next();
        const args: Expr[] = [];
        if (!this.is(")")) { do { args.push(this.expr()); } while (this.is(",") && this.next()); }
        this.expect(")");
        return { k: "call", name: t.v, args, line: t.line };
      }
      return { k: "var", name: t.v, line: t.line };
    }
    if (t.v === "(") { const e = this.expr(); this.expect(")"); return e; }
    throw new ScriptError(`Unexpected '${t.v || "end of code"}'`, t.line);
  }
}

export interface RunResult {
  ok: boolean;
  returnValue?: number;
  output: string[]; // Serial.println lines
  pins: Record<number, number>; // last written pin values
  pinLog: { pin: number; value: number }[];
  error?: string;
  steps: number;
}

class ReturnSignal { constructor(public v: number | undefined) {} }

const MATH: Record<string, (...a: number[]) => number> = {
  abs: Math.abs, min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan, log10: Math.log10, log: Math.log,
  constrain: (x, a, b) => Math.min(Math.max(x, a), b),
  map: (x, a, b, c, d) => Math.trunc(((x - a) * (d - c)) / (b - a) + c),
  bit: (n, i) => (n >> i) & 1,
};

export function runScript(src: string, inputs: Record<string, number> = {}, maxSteps = 100_000): RunResult {
  const res: RunResult = { ok: true, output: [], pins: {}, pinLog: [], steps: 0 };
  if (src.length > 20_000) return { ...res, ok: false, error: "Code is too long (limit 20,000 characters)." };
  let prog: Stmt[];
  try {
    prog = new Parser(tokenize(src)).program();
  } catch (e) {
    return { ...res, ok: false, error: (e as Error).message };
  }
  const vars = new Map<string, number>(Object.entries(inputs));
  const step = () => { if (++res.steps > maxSteps) throw new ScriptError(`Step limit of ${maxSteps} exceeded — check for an infinite loop.`); };
  const num = (b: boolean) => (b ? 1 : 0);
  const ev = (e: Expr): number => {
    step();
    switch (e.k) {
      case "num": return e.v;
      case "var":
        if (vars.has(e.name)) return vars.get(e.name)!;
        if (e.name in CONSTS) return CONSTS[e.name];
        throw new ScriptError(`'${e.name}' is not defined`, e.line);
      case "un": {
        const v = ev(e.e);
        return e.op === "!" ? num(!v) : e.op === "-" ? -v : e.op === "~" ? ~v : v;
      }
      case "tern": return ev(e.c) ? ev(e.a) : ev(e.b);
      case "bin": {
        if (e.op === "&&") return num(Boolean(ev(e.l)) && Boolean(ev(e.r)));
        if (e.op === "||") return num(Boolean(ev(e.l)) || Boolean(ev(e.r)));
        const a = ev(e.l), b = ev(e.r);
        switch (e.op) {
          case "+": return a + b; case "-": return a - b; case "*": return a * b;
          case "/": if (b === 0) throw new ScriptError("Division by zero"); return a / b;
          case "%": if (b === 0) throw new ScriptError("Modulo by zero"); return a % b;
          case "<": return num(a < b); case ">": return num(a > b); case "<=": return num(a <= b); case ">=": return num(a >= b);
          case "==": return num(a === b); case "!=": return num(a !== b);
          case "&": return a & b; case "|": return a | b; case "^": return a ^ b; case "<<": return a << b; case ">>": return a >> b;
        }
        throw new ScriptError(`Unknown operator ${e.op}`);
      }
      case "call": {
        const args = e.args.map(ev);
        if (e.name === "digitalWrite" || e.name === "analogWrite") {
          if (args.length !== 2) throw new ScriptError(`${e.name}(pin, value) needs 2 arguments`, e.line);
          const value = e.name === "digitalWrite" ? num(Boolean(args[1])) : Math.max(0, Math.min(255, Math.round(args[1])));
          res.pins[args[0]] = value; res.pinLog.push({ pin: args[0], value }); return 0;
        }
        if (e.name === "Serial.println" || e.name === "Serial.print" || e.name === "print") {
          res.output.push(args.map((a) => (Number.isInteger(a) ? String(a) : a.toFixed(4))).join(" ")); return 0;
        }
        if (e.name === "pinMode" || e.name === "delay") return 0;
        if (e.name === "int") return Math.trunc(args[0]);
        const f = MATH[e.name];
        if (!f) throw new ScriptError(`Function '${e.name}' is not available in this sandbox`, e.line);
        return f(...args);
      }
    }
  };
  const exec = (s: Stmt): void => {
    step();
    switch (s.k) {
      case "decl": case "assign": {
        if (s.k === "assign" && !vars.has(s.name)) throw new ScriptError(`'${s.name}' is not declared`, s.line);
        const v = ev(s.e);
        const cur = vars.get(s.name) ?? 0;
        const ops: Record<string, number> = { "=": v, "+=": cur + v, "-=": cur - v, "*=": cur * v, "/=": cur / v, "%=": cur % v, "<<=": cur << v, ">>=": cur >> v };
        vars.set(s.name, ops[s.op]); return;
      }
      case "expr": ev(s.e); return;
      case "block": s.body.forEach(exec); return;
      case "if": if (ev(s.c)) exec(s.a); else if (s.b) exec(s.b); return;
      case "while": while (ev(s.c)) exec(s.body); return;
      case "for": if (s.init) exec(s.init); while (s.c ? ev(s.c) : true) { exec(s.body); if (s.upd) exec(s.upd); } return;
      case "return": throw new ReturnSignal(s.e ? ev(s.e) : undefined);
    }
  };
  try {
    prog.forEach(exec);
  } catch (e) {
    if (e instanceof ReturnSignal) { res.returnValue = e.v; return res; }
    return { ...res, ok: false, error: (e as Error).message };
  }
  return res;
}
