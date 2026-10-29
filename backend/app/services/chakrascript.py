"""ChakraScript — Python port of the frontend sandbox interpreter.

Mirrors src/engines/interpreter.ts exactly so server-side grading matches the
browser interpreter: JS number semantics (doubles, 32-bit signed bitwise ops),
short-circuiting &&/||, Arduino-style digitalWrite/analogWrite/Serial.println
(recorded, never touching hardware), and a hard step limit.

A corpus-based cross-validation test against the TypeScript original lives in
tests/test_chakrascript.py (gold master generated via backend/scripts).
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field


class ScriptError(Exception):
    def __init__(self, message: str, line: int | None = None):
        self.line = line
        super().__init__(f"Line {line}: {message}" if line else message)


class _ReturnSignal(Exception):
    def __init__(self, value):
        self.value = value


OPS = ["<<=", ">>=", "&&", "||", "==", "!=", "<=", ">=", "<<", ">>", "+=", "-=", "*=", "/=", "%=", "++", "--",
       "+", "-", "*", "/", "%", "<", ">", "=", "!", "~", "&", "|", "^", "?", ":", "(", ")", "{", "}", ";", ","]

TYPES = {"int", "float", "bool", "long", "byte", "let", "double", "const", "unsigned"}
CONSTS = {"HIGH": 1, "LOW": 0, "true": 1, "false": 0, "OUTPUT": 1, "INPUT": 0, "PI": math.pi}

_NUM_RE = re.compile(r"0b[01]+|0x[0-9a-fA-F]+|\d*\.?\d+(?:e[+-]?\d+)?")
_ID_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?")
_WS_RE = re.compile(r"\s")


@dataclass
class Tok:
    t: str
    v: str
    line: int


def _tokenize(src: str) -> list[Tok]:
    toks: list[Tok] = []
    i = 0
    line = 1
    n = len(src)
    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
            i += 1
            continue
        if _WS_RE.match(c):
            i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i += 2
            while i < n and not (src[i] == "*" and i + 1 < n and src[i + 1] == "/"):
                if src[i] == "\n":
                    line += 1
                i += 1
            i += 2
            continue
        if c.isdigit() or c == ".":
            m = _NUM_RE.match(src, i)
            if not m:
                raise ScriptError("Invalid number", line)
            toks.append(Tok("num", m.group(0), line))
            i = m.end()
            continue
        if c.isalpha() or c == "_":
            m = _ID_RE.match(src, i)
            toks.append(Tok("id", m.group(0), line))
            i = m.end()
            continue
        for op in OPS:
            if src.startswith(op, i):
                toks.append(Tok("op", op, line))
                i += len(op)
                break
        else:
            raise ScriptError(f"Unexpected character '{c}'", line)
    toks.append(Tok("eof", "", line))
    return toks


def _num_literal(v: str):
    if v.startswith("0b"):
        return int(v[2:], 2)
    if v.startswith("0x"):
        return int(v[2:], 16)
    if re.fullmatch(r"\d+", v):
        return int(v)
    return float(v)


def _to_int32(x) -> int:
    if isinstance(x, float):
        if math.isnan(x) or math.isinf(x):
            return 0
        x = math.trunc(x)
    x = int(x) & 0xFFFFFFFF
    return x - 0x100000000 if x >= 0x80000000 else x


def _js_round(x) -> int:
    # Math.round: floor(x + 0.5); NaN/Inf handled by callers (never produced).
    return math.floor(x + 0.5)


def _js_div(a, b):
    """JS division semantics used by compound assignment (/= keeps going with Inf/NaN)."""
    if b == 0:
        if a == 0 or (isinstance(a, float) and math.isnan(a)):
            return math.nan
        sign = math.copysign(1.0, float(a)) * math.copysign(1.0, float(b))
        return math.inf if sign > 0 else -math.inf
    return a / b


def _js_mod(a, b):
    if b == 0:
        return math.nan
    return math.fmod(a, b)


def _fmt_num(a) -> str:
    if isinstance(a, float):
        if math.isnan(a):
            return "NaN"
        if math.isinf(a):
            return "Infinity" if a > 0 else "-Infinity"
    if isinstance(a, int) or (isinstance(a, float) and a.is_integer()):
        return str(int(a))
    return f"{a:.4f}"


# ---------------------------------------------------------------- AST


@dataclass
class Expr:
    k: str
    v: object = None
    name: str = ""
    op: str = ""
    line: int = 0
    l: "Expr | None" = None
    r: "Expr | None" = None
    e: "Expr | None" = None
    c: "Expr | None" = None
    a: "Expr | None" = None
    b: "Expr | None" = None
    args: list = field(default_factory=list)


@dataclass
class Stmt:
    k: str
    name: str = ""
    op: str = ""
    e: "Expr | None" = None
    c: "Expr | None" = None
    a: "Stmt | None" = None
    b: "Stmt | None" = None
    body: list = field(default_factory=list)
    init: "Stmt | None" = None
    upd: "Stmt | None" = None
    line: int = 0


class Parser:
    LEVELS = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]]

    def __init__(self, toks: list[Tok]):
        self.toks = toks
        self.p = 0

    def peek(self, o: int = 0) -> Tok:
        return self.toks[min(self.p + o, len(self.toks) - 1)]

    def next(self) -> Tok:
        t = self.peek()
        self.p = min(self.p + 1, len(self.toks) - 1)
        return t

    def is_(self, v: str) -> bool:
        t = self.peek()
        return (t.t == "op" or t.t == "id") and t.v == v

    def expect(self, v: str) -> Tok:
        t = self.next()
        if t.v != v:
            raise ScriptError(f"Expected '{v}' but found '{t.v or 'end of code'}'", t.line)
        return t

    def program(self) -> list[Stmt]:
        out = []
        while self.peek().t != "eof":
            out.append(self.stmt())
        return out

    def stmt(self) -> Stmt:
        t = self.peek()
        if self.is_("{"):
            self.next()
            body: list[Stmt] = []
            while not self.is_("}"):
                if self.peek().t == "eof":
                    raise ScriptError("Missing '}'", t.line)
                body.append(self.stmt())
            self.next()
            return Stmt("block", body=body)
        if self.is_("if"):
            self.next()
            self.expect("(")
            c = self.expr()
            self.expect(")")
            a = self.stmt()
            b = None
            if self.is_("else"):
                self.next()
                b = self.stmt()
            return Stmt("if", c=c, a=a, b=b)
        if self.is_("while"):
            self.next()
            self.expect("(")
            c = self.expr()
            self.expect(")")
            return Stmt("while", c=c, a=self.stmt())
        if self.is_("for"):
            self.next()
            self.expect("(")
            init = None if self.is_(";") else self.simple()
            self.expect(";")
            c = None if self.is_(";") else self.expr()
            self.expect(";")
            upd = None if self.is_(")") else self.simple()
            self.expect(")")
            return Stmt("for", init=init, c=c, upd=upd, a=self.stmt())
        if self.is_("return"):
            self.next()
            e = None if self.is_(";") else self.expr()
            self.expect(";")
            return Stmt("return", e=e)
        s = self.simple()
        self.expect(";")
        return s

    def simple(self) -> Stmt:
        t = self.peek()
        decl = False
        while t.t == "id" and self.peek().v in TYPES:
            self.next()
            decl = True
        id_tok = self.peek()
        if id_tok.t == "id":
            nx = self.peek(1)
            if nx.t == "op" and nx.v in ("=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>="):
                self.next()
                self.next()
                return Stmt("decl" if decl else "assign", name=id_tok.v, op=nx.v, e=self.expr(), line=id_tok.line)
            if nx.t == "op" and nx.v in ("++", "--"):
                self.next()
                self.next()
                return Stmt("assign", name=id_tok.v, op="+=" if nx.v == "++" else "-=", e=Expr("num", v=1), line=id_tok.line)
            if decl:
                self.next()
                return Stmt("decl", name=id_tok.v, op="=", e=Expr("num", v=0), line=id_tok.line)
        return Stmt("expr", e=self.expr())

    def expr(self) -> Expr:
        return self.ternary()

    def ternary(self) -> Expr:
        c = self.bin(0)
        if self.is_("?"):
            self.next()
            a = self.expr()
            self.expect(":")
            b = self.expr()
            return Expr("tern", c=c, a=a, b=b)
        return c

    def bin(self, level: int) -> Expr:
        if level >= len(Parser.LEVELS):
            return self.unary()
        l = self.bin(level + 1)
        while self.peek().t == "op" and self.peek().v in Parser.LEVELS[level]:
            op = self.next().v
            l = Expr("bin", op=op, l=l, r=self.bin(level + 1))
        return l

    def unary(self) -> Expr:
        if self.peek().t == "op" and self.peek().v in ("!", "-", "~", "+"):
            op = self.next().v
            return Expr("un", op=op, e=self.unary())
        return self.primary()

    def primary(self) -> Expr:
        t = self.next()
        if t.t == "num":
            return Expr("num", v=_num_literal(t.v))
        if t.t == "id":
            if self.is_("("):
                self.next()
                args: list[Expr] = []
                if not self.is_(")"):
                    while True:
                        args.append(self.expr())
                        if self.is_(","):
                            self.next()
                            continue
                        break
                self.expect(")")
                return Expr("call", name=t.v, args=args, line=t.line)
            return Expr("var", name=t.v, line=t.line)
        if t.v == "(":
            e = self.expr()
            self.expect(")")
            return e
        raise ScriptError(f"Unexpected '{t.v or 'end of code'}'", t.line)


# ---------------------------------------------------------------- Runtime


@dataclass
class RunResult:
    ok: bool = True
    returnValue: object = None
    output: list = field(default_factory=list)
    pins: dict = field(default_factory=dict)
    pinLog: list = field(default_factory=list)
    error: str | None = None
    steps: int = 0


def _mathfn(name: str, args: list):
    try:
        if name == "abs":
            return abs(args[0])
        if name == "min":
            return min(args)
        if name == "max":
            return max(args)
        if name == "floor":
            return math.floor(args[0])
        if name == "ceil":
            return math.ceil(args[0])
        if name == "round":
            return _js_round(args[0])
        if name == "sqrt":
            return math.sqrt(args[0])
        if name == "pow":
            return math.pow(args[0], args[1])
        if name == "sin":
            return math.sin(args[0])
        if name == "cos":
            return math.cos(args[0])
        if name == "tan":
            return math.tan(args[0])
        if name == "log10":
            return math.log10(args[0])
        if name == "log":
            return math.log(args[0])
        if name == "constrain":
            return min(max(args[0], args[1]), args[2])
        if name == "map":
            x, a, b, c, d = args
            return math.trunc(((x - a) * (d - c)) / (b - a) + c)
        if name == "bit":
            return (to_int32_shift(args[0], args[1])) & 1
    except (ValueError, OverflowError) as exc:
        raise ScriptError(f"math error in {name}(): {exc}") from exc
    except TypeError as exc:
        raise ScriptError(f"Invalid arguments to '{name}'") from exc
    raise AssertionError


def to_int32_shift(n, i):
    return _to_int32(_to_int32(n) >> (_to_int32(i) & 31))


def run_script(src: str, inputs: dict | None = None, max_steps: int = 100_000) -> RunResult:
    res = RunResult()
    if len(src) > 20_000:
        res.ok = False
        res.error = "Code is too long (limit 20,000 characters)."
        return res
    try:
        prog = Parser(_tokenize(src)).program()
    except ScriptError as e:
        res.ok = False
        res.error = str(e)
        return res

    vars: dict = dict(inputs or {})

    def step():
        res.steps += 1
        if res.steps > max_steps:
            raise ScriptError(f"Step limit of {max_steps} exceeded — check for an infinite loop.")

    def truthy(v) -> bool:
        return v != 0

    def ev(e: Expr):
        step()
        if e.k == "num":
            return e.v
        if e.k == "var":
            if e.name in vars:
                return vars[e.name]
            if e.name in CONSTS:
                return CONSTS[e.name]
            raise ScriptError(f"'{e.name}' is not defined", e.line)
        if e.k == "un":
            v = ev(e.e)
            if e.op == "!":
                return 0 if truthy(v) else 1
            if e.op == "-":
                return -v
            if e.op == "~":
                return _to_int32(~_to_int32(v))
            return v
        if e.k == "tern":
            return ev(e.a) if truthy(ev(e.c)) else ev(e.b)
        if e.k == "bin":
            if e.op == "&&":
                return 1 if (truthy(ev(e.l)) and truthy(ev(e.r))) else 0
            if e.op == "||":
                return 1 if (truthy(ev(e.l)) or truthy(ev(e.r))) else 0
            a = ev(e.l)
            b = ev(e.r)
            op = e.op
            if op == "+":
                return a + b
            if op == "-":
                return a - b
            if op == "*":
                return a * b
            if op == "/":
                if b == 0:
                    raise ScriptError("Division by zero")
                return a / b
            if op == "%":
                if b == 0:
                    raise ScriptError("Modulo by zero")
                return math.fmod(a, b)
            if op == "<":
                return 1 if a < b else 0
            if op == ">":
                return 1 if a > b else 0
            if op == "<=":
                return 1 if a <= b else 0
            if op == ">=":
                return 1 if a >= b else 0
            if op == "==":
                return 1 if a == b else 0
            if op == "!=":
                return 1 if a != b else 0
            if op == "&":
                return _to_int32(_to_int32(a) & _to_int32(b))
            if op == "|":
                return _to_int32(_to_int32(a) | _to_int32(b))
            if op == "^":
                return _to_int32(_to_int32(a) ^ _to_int32(b))
            if op == "<<":
                return _to_int32(_to_int32(a) << (_to_int32(b) & 31))
            if op == ">>":
                return to_int32_shift(a, b)
            raise ScriptError(f"Unknown operator {op}")
        if e.k == "call":
            args = [ev(a) for a in e.args]
            if e.name in ("digitalWrite", "analogWrite"):
                if len(args) != 2:
                    raise ScriptError(f"{e.name}(pin, value) needs 2 arguments", e.line)
                if e.name == "digitalWrite":
                    value = 1 if truthy(args[1]) else 0
                else:
                    value = max(0, min(255, _js_round(args[1])))
                pin = args[0]
                key = int(pin) if isinstance(pin, float) and pin.is_integer() else int(pin)
                res.pins[key] = value
                res.pinLog.append({"pin": key, "value": value})
                return 0
            if e.name in ("Serial.println", "Serial.print", "print"):
                res.output.append(" ".join(_fmt_num(a) for a in args))
                return 0
            if e.name in ("pinMode", "delay"):
                return 0
            if e.name == "int":
                return math.trunc(args[0])
            if e.name in CONSTS:
                raise ScriptError(f"Function '{e.name}' is not available in this sandbox", e.line)
            try:
                return _mathfn(e.name, args)
            except ScriptError:
                raise
            except AssertionError:
                raise ScriptError(f"Function '{e.name}' is not available in this sandbox", e.line)
        raise ScriptError("Unknown expression")

    def assign_value(op: str, cur, v):
        if op == "=":
            return v
        if op == "+=":
            return cur + v
        if op == "-=":
            return cur - v
        if op == "*=":
            return cur * v
        if op == "/=":
            return _js_div(cur, v)
        if op == "%=":
            return _js_mod(cur, v)
        if op == "<<=":
            return _to_int32(_to_int32(cur) << (_to_int32(v) & 31))
        if op == ">>=":
            return to_int32_shift(cur, v)
        raise ScriptError(f"Unknown operator {op}")

    def exec(s: Stmt):
        step()
        if s.k in ("decl", "assign"):
            if s.k == "assign" and s.name not in vars:
                raise ScriptError(f"'{s.name}' is not declared", s.line)
            v = ev(s.e)
            cur = vars.get(s.name, 0)
            vars[s.name] = assign_value(s.op, cur, v)
            return
        if s.k == "expr":
            ev(s.e)
            return
        if s.k == "block":
            for child in s.body:
                exec(child)
            return
        if s.k == "if":
            if truthy(ev(s.c)):
                exec(s.a)
            elif s.b is not None:
                exec(s.b)
            return
        if s.k == "while":
            while truthy(ev(s.c)):
                exec(s.a)
            return
        if s.k == "for":
            if s.init is not None:
                exec(s.init)
            while s.c is None or truthy(ev(s.c)):
                exec(s.a)
                if s.upd is not None:
                    exec(s.upd)
            return
        if s.k == "return":
            raise _ReturnSignal(ev(s.e) if s.e is not None else None)

    try:
        for s in prog:
            exec(s)
    except _ReturnSignal as r:
        res.returnValue = r.value
        return res
    except ScriptError as e:
        res.ok = False
        res.error = str(e)
        return res
    return res
