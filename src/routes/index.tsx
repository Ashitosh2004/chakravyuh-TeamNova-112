import { Link, createFileRoute } from "@tanstack/react-router";
import { Activity, ArrowRight, BookOpen, Bot, Code2, Cpu, FlaskConical, Globe2, ListChecks, Radio, Waves } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { GateSymbol } from "@/components/lab/GateSymbol";
import { Plot } from "@/components/lab/Plot";
import { Button } from "@/components/ui/button";
import { COURSES } from "@/content/courses";
import { evaluateGate, GATE_INFO, GATE_TYPES, type GateType } from "@/engines/logic";
import { generateWave } from "@/engines/signals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CHAKRAVYUH — Learn Electronics by Building, Testing, and Exploring" },
      { name: "description", content: "An interactive ENTC learning platform with a virtual electronics lab, signal simulations, coding challenges, quizzes and IoT scenarios." },
      { property: "og:title", content: "CHAKRAVYUH — Smart ENTC Learning & Innovation Platform" },
      { property: "og:description", content: "Circuits come alive, signals become understandable, and engineering concepts turn into practical skills." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function HeroDemo() {
  const [gate, setGate] = useState<GateType>("XOR");
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  const inputs = gate === "NOT" ? [a] : [a, b];
  const out = evaluateGate(gate, inputs);
  const Toggle = ({ label, v, set }: { label: string; v: boolean; set: (v: boolean) => void }) => (
    <button
      onClick={() => set(!v)}
      aria-pressed={v}
      aria-label={`Input ${label}: ${v ? 1 : 0}`}
      className={cn("flex h-11 w-16 items-center justify-between rounded-md border-2 px-2 font-mono text-sm transition-colors", v ? "border-success bg-success/15" : "border-ink-foreground/30")}
    >
      <span>{label}</span><span className="font-bold">{v ? 1 : 0}</span>
    </button>
  );
  return (
    <div className="rounded-xl border border-ink-foreground/15 bg-ink p-5 text-ink-foreground shadow-lift">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-foreground/60">Live logic gate · try it</span>
        <span className="font-mono text-xs text-ink-foreground/70">{GATE_INFO[gate].expr}</span>
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {GATE_TYPES.map((g) => (
          <button key={g} onClick={() => setGate(g)} aria-pressed={g === gate} className={cn("rounded px-2 py-1 font-mono text-[11px]", g === gate ? "bg-ink-foreground text-ink" : "text-ink-foreground/70 hover:bg-ink-foreground/10")}>{g}</button>
        ))}
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex flex-col gap-3">
          <Toggle label="A" v={a} set={setA} />
          {gate !== "NOT" && <Toggle label="B" v={b} set={setB} />}
        </div>
        <div className="rounded-md bg-card p-2"><GateSymbol type={gate} inputs={inputs} output={out} /></div>
        <div className="flex flex-col items-center gap-1">
          <span className={cn("h-10 w-10 rounded-full border-2 transition-colors", out ? "border-success bg-success" : "border-ink-foreground/30")} aria-hidden="true" />
          <span className="font-mono text-sm" aria-live="polite">Y = {out ? 1 : 0}</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-foreground/70">{GATE_INFO[gate].description}</p>
    </div>
  );
}

const MODULES = [
  { icon: BookOpen, title: "Structured lessons", text: "Ten ENTC courses with explanations, equations, worked examples and knowledge checks.", to: "/learn" },
  { icon: FlaskConical, title: "Virtual electronics lab", text: "Logic gates, a circuit builder, signal, modulation and sensor labs that compute in real time.", to: "/lab" },
  { icon: Code2, title: "Coding challenges", text: "Arduino-style problems evaluated in a restricted sandbox with test-case feedback.", to: "/coding" },
  { icon: ListChecks, title: "Quizzes & mini-games", text: "Timed quizzes with explanations, plus logic puzzles and component identification.", to: "/quizzes" },
  { icon: Globe2, title: "Real-world scenarios", text: "Smart homes, safety systems, environment monitoring and wireless networks.", to: "/scenarios" },
  { icon: Bot, title: "AI learning assistant", text: "Ask technical questions with lesson and simulation context once the AI service is connected.", to: "/ai-assistant" },
];

function Landing() {
  const sine = generateWave({ shape: "sine", amplitude: 1, frequency: 3, phase: 0 }, 1, 300);
  const sq = generateWave({ shape: "square", amplitude: 0.6, frequency: 3, phase: 0 }, 1, 300);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link to="/"><Logo /></Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm md:flex" aria-label="Public">
            <a href="#modules" className="text-muted-foreground hover:text-foreground">Platform</a>
            <a href="#lab" className="text-muted-foreground hover:text-foreground">Virtual Lab</a>
            <a href="#workflow" className="text-muted-foreground hover:text-foreground">How it works</a>
            <Link to="/login" className="text-muted-foreground hover:text-foreground">Log in</Link>
          </nav>
          <Button asChild size="sm" className="ml-auto md:ml-0"><Link to="/register">Get started</Link></Button>
        </div>
      </header>

      <section className="border-b bg-blueprint">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <div className="eyebrow mb-4">Electronics & Telecommunication · Interactive learning</div>
            <h1 className="text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">Learn Electronics by Building, Testing, and Exploring.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">An interactive ENTC learning platform where circuits come alive, signals become understandable, and engineering concepts turn into practical skills.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/learn">Start Learning <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/lab">Explore Virtual Lab</Link></Button>
            </div>
          </div>
          <HeroDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" id="overview">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="eyebrow mb-2">Platform overview</div>
            <h2 className="text-3xl font-bold">From passive reading to active experimentation.</h2>
          </div>
          <p className="text-muted-foreground md:col-span-2 md:text-lg">CHAKRAVYUH combines structured ENTC lessons with simulations you can manipulate, problems you can code, and scenarios you can configure. Every concept is paired with something to try — toggle a gate, drag a slider, write a threshold rule — so you see cause and effect, not just definitions.</p>
        </div>
      </section>

      <section id="modules" className="border-y bg-card">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="eyebrow mb-2">Interactive learning modules</div>
          <h2 className="mb-8 text-3xl font-bold">Everything an ENTC student practises</h2>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <Link key={m.title} to={m.to} className="group bg-card p-6 transition-colors hover:bg-accent/40">
                <m.icon className="mb-4 h-6 w-6 text-signal" />
                <h3 className="font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {COURSES.map((c) => (
              <Link key={c.id} to="/learn/$courseId" params={{ courseId: c.id }} className="rounded border bg-background px-2.5 py-1 font-mono text-xs hover:border-primary">{c.title}</Link>
            ))}
          </div>
        </div>
      </section>

      <section id="lab" className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
        <div>
          <div className="eyebrow mb-2">Virtual Electronics Lab preview</div>
          <h2 className="text-3xl font-bold">Simulations that actually compute.</h2>
          <p className="mt-3 text-muted-foreground">Waveforms are generated from their equations, circuits are evaluated gate by gate, and sensor rules run on a deterministic engine. Educational models are labelled as simplified where they are.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[[Cpu, "Logic gates and a drag-and-wire circuit builder"], [Waves, "Sine, square, triangle, sawtooth — sampling and quantization"], [Radio, "AM / FM modulation with noise and SNR"], [Activity, "Virtual sensors driving fans, LEDs and buzzers"]].map(([I, t]) => {
              const Icon = I as typeof Cpu;
              return <li key={t as string} className="flex items-center gap-3"><Icon className="h-4 w-4 text-success" />{t as string}</li>;
            })}
          </ul>
          <Button asChild className="mt-6" variant="outline"><Link to="/lab">Open the lab</Link></Button>
        </div>
        <div className="panel p-4">
          <Plot ariaLabel="Example sine and square waveforms" tMax={1} vMax={1.2} series={[{ label: "Sine 3 Hz", className: "stroke-signal", points: sine }, { label: "Square 3 Hz", className: "stroke-success", points: sq }]} />
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
          <div>
            <div className="eyebrow mb-2">AI Learning Assistant preview</div>
            <h2 className="text-3xl font-bold">Ask with context.</h2>
            <p className="mt-3 text-muted-foreground">The assistant receives the lesson, simulation or code you're working on, and adapts explanations to beginner, intermediate or advanced level. It connects to the CHAKRAVYUH AI service; if that service is unavailable, the app says so plainly and points you to lessons instead.</p>
          </div>
          <div className="panel space-y-3 p-5 font-mono text-sm">
            <div className="ml-auto w-fit rounded-md bg-primary px-3 py-2 text-primary-foreground">Explain XOR gates with a truth table.</div>
            <div className="w-fit rounded-md border bg-muted px-3 py-2 text-muted-foreground">Example prompt — responses come from the connected AI service.</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="panel p-6">
            <div className="eyebrow mb-2">Coding challenges and quizzes</div>
            <h3 className="text-xl font-semibold">Practise until it clicks</h3>
            <p className="mt-2 text-sm text-muted-foreground">Write Arduino-style C in a sandboxed evaluator — digitalWrite, analogWrite, loops and conditionals — and see each test case pass or fail with a reason. Take timed quizzes with truth-table, numeric and code-output questions.</p>
            <div className="mt-4 flex gap-2"><Button asChild size="sm"><Link to="/coding">Challenges</Link></Button><Button asChild size="sm" variant="outline"><Link to="/quizzes">Quizzes</Link></Button></div>
          </div>
          <div className="panel p-6">
            <div className="eyebrow mb-2">Real-world IoT scenarios</div>
            <h3 className="text-xl font-semibold">Engineering in context</h3>
            <p className="mt-2 text-sm text-muted-foreground">Configure a smart home, tune gas and smoke alarms, monitor a classroom's air, or balance a wireless network's throughput and latency — all with transparent, explainable rules.</p>
            <Button asChild size="sm" className="mt-4" variant="outline"><Link to="/scenarios">Explore scenarios</Link></Button>
          </div>
        </div>
      </section>

      <section id="workflow" className="border-y bg-ink text-ink-foreground">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-foreground/60">Learning workflow</div>
          <h2 className="mb-10 text-3xl font-bold">Learn → Simulate → Code → Test → Apply</h2>
          <ol className="grid gap-6 sm:grid-cols-5">
            {["Read a focused lesson", "Experiment in the lab", "Solve a coding challenge", "Check with a quiz", "Apply in a scenario"].map((s, i) => (
              <li key={s} className="border-t border-ink-foreground/25 pt-4">
                <div className="font-mono text-sm text-success">0{i + 1}</div>
                <div className="mt-1 font-medium">{s}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="eyebrow mb-2">Benefits for ENTC students</div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[["See cause and effect", "Change a parameter and watch the result immediately."], ["No hardware required", "Practise circuits and sensor logic before you touch a breadboard."], ["Exam-relevant core", "Number systems, modulation, sampling, GPIO and more."], ["Track your growth", "Progress and achievements reflect what you actually did."]].map(([t, d]) => (
            <div key={t}><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-6">
          <div><h3 className="text-xl font-semibold">Ready to build your first circuit?</h3><p className="text-sm text-muted-foreground">Create an account and start with Binary Numbers.</p></div>
          <Button asChild size="lg"><Link to="/register">Start Learning</Link></Button>
        </div>
      </section>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
          <div><Logo /><p className="mt-3 text-xs text-muted-foreground">Smart ENTC Learning & Innovation Platform. Built for the CHAKRAVYUH AI Vibe Coding Challenge.</p></div>
          <nav aria-label="Footer learning" className="flex flex-col gap-1.5 text-sm">
            <span className="eyebrow mb-1">Learn</span>
            <Link to="/learn" className="hover:underline">Learning Center</Link>
            <Link to="/lab" className="hover:underline">Virtual Lab</Link>
            <Link to="/coding" className="hover:underline">Coding Challenges</Link>
            <Link to="/quizzes" className="hover:underline">Quizzes</Link>
          </nav>
          <nav aria-label="Footer account" className="flex flex-col gap-1.5 text-sm">
            <span className="eyebrow mb-1">Account</span>
            <Link to="/login" className="hover:underline">Log in</Link>
            <Link to="/register" className="hover:underline">Register</Link>
            <Link to="/scenarios" className="hover:underline">Scenarios</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
