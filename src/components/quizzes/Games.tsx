import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GateSymbol } from "@/components/lab/GateSymbol";
import { Button } from "@/components/ui/button";
import { evalPuzzle, makePuzzle, makeRapid, puzzleSolutions, rapidScore } from "@/engines/games";
import { formatClock } from "@/engines/quiz";
import { cn } from "@/lib/utils";
import { useProgress } from "@/stores/progress";

export function CircuitPuzzle() {
  const [round, setRound] = useState(1);
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const p = useMemo(() => makePuzzle(seed + round), [seed, round]);
  const [ins, setIns] = useState([false, false, false]);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const record = useProgress((s) => s.record);
  const ROUNDS = 5;

  const check = () => {
    setAttempts((a) => a + 1);
    if (evalPuzzle(p, ins[0], ins[1], ins[2])) {
      const pts = Math.max(2, 10 - attempts * 3);
      setScore((s) => s + pts);
      toast.success(`Correct! +${pts}`);
      if (round >= ROUNDS) { setDone(true); record({ type: "game_score", game: "game-circuit-puzzle", score: score + pts }); }
      else { setRound((r) => r + 1); setIns([false, false, false]); setAttempts(0); }
    } else toast.error("The LED stays off. Trace the gates and try again.");
  };
  const restart = () => { setSeed(Date.now() % 100000); setRound(1); setScore(0); setAttempts(0); setDone(false); setIns([false, false, false]); };

  if (done) return <div className="panel p-6"><h2 className="text-xl font-semibold">Puzzle complete</h2><p className="mt-2">Final score: <strong className="font-mono">{score}</strong> / {ROUNDS * 10}</p><Button className="mt-4" onClick={restart}>Play again</Button></div>;

  return (
    <div className="panel space-y-5 p-6">
      <div className="flex justify-between font-mono text-sm"><span>Round {round}/{ROUNDS}</span><span>Score {score}</span></div>
      <p className="text-sm">Find an input combination that makes <strong>Y = 1</strong>. Each wrong check reduces this round's points (10 → 7 → 4 → 2). This circuit has {puzzleSolutions(p).length} valid solution(s).</p>
      <div className="bg-blueprint grid items-center gap-4 rounded-md border p-4 sm:grid-cols-[1fr_1fr]">
        <div><div className="eyebrow mb-1">Stage 1: A, B → {p.g1}</div><GateSymbol type={p.g1} /></div>
        <div><div className="eyebrow mb-1">Stage 2: (stage 1), {p.invertC ? "NOT C" : "C"} → {p.g2} → Y</div><GateSymbol type={p.g2} /></div>
      </div>
      <p className="font-mono text-sm">Y = {p.g2}( {p.g1}(A, B), {p.invertC ? "C′" : "C"} )</p>
      <div className="flex flex-wrap gap-2">
        {["A", "B", "C"].map((l, i) => <button key={l} aria-pressed={ins[i]} onClick={() => setIns((s) => s.map((x, j) => (j === i ? !x : x)))} className={cn("w-20 rounded-md border-2 px-3 py-2 font-mono", ins[i] && "border-success bg-success/10")}>{l} = {ins[i] ? 1 : 0}</button>)}
        <Button onClick={check}>Check</Button>
      </div>
    </div>
  );
}

const COMPONENTS = [
  { name: "Resistor", symbol: "M5,30 L25,30 L30,18 L40,42 L50,18 L60,42 L70,18 L75,30 L95,30", fn: "Limits current; V = IR." },
  { name: "Capacitor", symbol: "M5,30 L44,30 M44,12 L44,48 M56,12 L56,48 M56,30 L95,30", fn: "Stores energy in an electric field; blocks DC." },
  { name: "Diode", symbol: "M5,30 L35,30 M35,14 L35,46 L65,30 Z M65,14 L65,46 M65,30 L95,30", fn: "Allows current in one direction only." },
  { name: "Inductor", symbol: "M5,30 L20,30 A7,7 0 0 1 34,30 A7,7 0 0 1 48,30 A7,7 0 0 1 62,30 A7,7 0 0 1 76,30 L95,30", fn: "Stores energy in a magnetic field; opposes changes in current." },
  { name: "Ground", symbol: "M50,5 L50,30 M30,30 L70,30 M37,38 L63,38 M44,46 L56,46", fn: "Common 0 V reference point." },
  { name: "Battery / DC source", symbol: "M5,30 L42,30 M42,14 L42,46 M52,22 L52,38 M52,30 L95,30", fn: "Provides a constant DC voltage; longer plate is +." },
  { name: "Switch", symbol: "M5,30 L35,30 M35,30 L65,16 M65,30 L95,30", fn: "Opens or closes a circuit path." },
  { name: "LED", symbol: "M5,30 L35,30 M35,14 L35,46 L65,30 Z M65,14 L65,46 M65,30 L95,30 M55,10 L68,0 M62,14 L75,4", fn: "Diode that emits light when forward-biased." },
];

export function ComponentGame() {
  const [order, setOrder] = useState(() => [...COMPONENTS].sort(() => Math.random() - 0.5));
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const record = useProgress((s) => s.record);
  const cur = order[i];
  const options = useMemo(() => {
    if (!cur) return [];
    const others = COMPONENTS.filter((c) => c.name !== cur.name).sort(() => Math.random() - 0.5).slice(0, 3);
    return [...others, cur].sort(() => Math.random() - 0.5);
  }, [cur]);
  const finished = i >= order.length;
  useEffect(() => { if (finished) record({ type: "game_score", game: "game-components", score }); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (finished) return <div className="panel p-6"><h2 className="text-xl font-semibold">All components identified</h2><p className="mt-2">Score: <strong className="font-mono">{score}/{order.length}</strong></p><Button className="mt-4" onClick={() => { setOrder([...COMPONENTS].sort(() => Math.random() - 0.5)); setI(0); setScore(0); setPicked(null); }}>Play again</Button></div>;

  return (
    <div className="panel space-y-5 p-6">
      <div className="flex justify-between font-mono text-sm"><span>{i + 1}/{order.length}</span><span>Score {score}</span></div>
      <div className="bg-blueprint mx-auto max-w-sm rounded-md border p-6"><svg viewBox="0 0 100 60" className="h-auto w-full" role="img" aria-label="Schematic symbol to identify"><path d={cur.symbol} fill="none" strokeWidth={3} strokeLinejoin="round" className="stroke-foreground" /></svg></div>
      <p className="text-center text-sm text-muted-foreground">Function: {cur.fn}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => <button key={o.name} disabled={!!picked} onClick={() => { setPicked(o.name); if (o.name === cur.name) setScore((s) => s + 1); }}
          className={cn("rounded-md border px-4 py-3 text-sm", picked && o.name === cur.name && "border-success bg-success/10", picked === o.name && o.name !== cur.name && "border-destructive bg-destructive/10")}>{o.name}</button>)}
      </div>
      {picked && <div className="flex items-center justify-between"><span role="status" className={picked === cur.name ? "text-success" : "text-destructive"}>{picked === cur.name ? "Correct!" : `That's a ${cur.name}.`}</span><Button onClick={() => { setI(i + 1); setPicked(null); }}>Next</Button></div>}
    </div>
  );
}

export function RapidLogic() {
  const [duration, setDuration] = useState(60);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(60);
  const [n, setN] = useState(0);
  const [seed] = useState(() => Date.now() % 100000);
  const [stats, setStats] = useState({ correct: 0, wrong: 0 });
  const [over, setOver] = useState(false);
  const record = useProgress((s) => s.record);
  const q = makeRapid(seed + n);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (running && left <= 0) { setRunning(false); setOver(true); record({ type: "game_score", game: "game-rapid-logic", score: rapidScore(stats.correct, stats.wrong) }); }
  }, [left, running]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!running) return;
    const k = (e: KeyboardEvent) => { if (e.key === "0" || e.key === "1") answer(Number(e.key) as 0 | 1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const answer = (v: 0 | 1) => { setStats((s) => (v === q.answer ? { ...s, correct: s.correct + 1 } : { ...s, wrong: s.wrong + 1 })); setN((x) => x + 1); };
  const start = () => { setStats({ correct: 0, wrong: 0 }); setLeft(duration); setN(0); setOver(false); setRunning(true); };

  if (!running) return (
    <div className="panel space-y-4 p-6">
      {over && <div role="status" className="rounded-md bg-success/10 p-4"><div className="font-semibold">Time! Score: <span className="font-mono">{rapidScore(stats.correct, stats.wrong)}</span></div><div className="text-sm text-muted-foreground">{stats.correct} correct, {stats.wrong} wrong (+10 / −5)</div></div>}
      <p className="text-sm">Evaluate each Boolean expression as fast as you can. Press the buttons or keys <kbd className="rounded border px-1">0</kbd> / <kbd className="rounded border px-1">1</kbd>.</p>
      <div className="flex items-center gap-2 text-sm"><span>Timer:</span>{[30, 60, 90].map((d) => <button key={d} aria-pressed={duration === d} onClick={() => setDuration(d)} className={cn("rounded-md border px-3 py-1 font-mono", duration === d && "border-primary bg-primary text-primary-foreground")}>{d}s</button>)}</div>
      <Button onClick={start}>{over ? "Play again" : "Start"}</Button>
    </div>
  );
  return (
    <div className="panel space-y-6 p-6 text-center">
      <div className="flex justify-between font-mono text-sm"><span className={left <= 10 ? "text-destructive" : ""}>{formatClock(Math.max(0, left))}</span><span>✓ {stats.correct} · ✗ {stats.wrong}</span></div>
      <div className="font-mono text-3xl font-bold" aria-live="polite">{q.text}</div>
      <div className="flex justify-center gap-4"><Button size="lg" variant="outline" className="w-24 font-mono text-xl" onClick={() => answer(0)}>0</Button><Button size="lg" className="w-24 font-mono text-xl" onClick={() => answer(1)}>1</Button></div>
    </div>
  );
}
