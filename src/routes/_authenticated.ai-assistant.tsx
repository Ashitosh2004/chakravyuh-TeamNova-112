import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Copy, Loader2, Plus, RefreshCw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SIMULATIONS } from "@/content/catalog";
import { searchIndex } from "@/content/search";
import { cn } from "@/lib/utils";
import { aiApi, ApiError, isBackendConfigured, type ChatRequest } from "@/services/api";
import { usePreferences, type Level } from "@/stores/preferences";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  validateSearch: (s: Record<string, unknown>): { q?: string; ctx?: string } => ({ ...(typeof s.q === "string" ? { q: s.q } : {}), ...(typeof s.ctx === "string" ? { ctx: s.ctx } : {}) }),
  head: () => ({ meta: [{ title: "AI Learning Assistant — CHAKRAVYUH" }, { name: "description", content: "Ask ENTC questions with lesson, simulation and code context." }, { property: "og:title", content: "AI Learning Assistant — CHAKRAVYUH" }, { property: "og:description", content: "Context-aware technical explanations." }] }),
  component: AssistantPage,
});

interface Msg { id: string; role: "user" | "assistant" | "error"; content: string; feedback?: "up" | "down"; retryable?: boolean }
interface Convo { id: string; serverId?: string; title: string; messages: Msg[] }

const SUGGESTED = [
  "Explain XOR gates with a truth table.",
  "Why does increasing frequency change this waveform?",
  "Help me understand amplitude modulation.",
  "Explain how a temperature sensor controls a fan.",
  "Help me debug this Arduino-style code.",
];

function parseContext(ctx?: string): ChatRequest["context"] {
  if (!ctx) return undefined;
  const [kind, rest] = ctx.split(":");
  if (kind === "lesson") { const [courseId, lessonId] = rest.split("/"); return { courseId, lessonId }; }
  if (kind === "simulation") return { simulationId: rest };
  if (kind === "challenge") return { challengeId: rest, code: typeof window !== "undefined" ? localStorage.getItem(`chakravyuh-code-${rest}`) ?? undefined : undefined };
  if (kind === "quiz") return { quizQuestionId: rest };
  return undefined;
}

/** Renders text with ``` code blocks and `inline code`, safely (no HTML injection). */
function Rich({ text }: { text: string }) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  const out: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    out.push(<span key={i} className="whitespace-pre-wrap">{parts[i].split(/(`[^`]+`)/g).map((s, j) => s.startsWith("`") && s.endsWith("`") ? <code key={j} className="rounded bg-muted px-1 font-mono text-[0.9em]">{s.slice(1, -1)}</code> : s)}</span>);
    if (parts[i + 2] !== undefined) out.push(<pre key={`c${i}`} className="my-2 overflow-x-auto rounded-md bg-ink p-3 font-mono text-xs text-ink-foreground">{parts[i + 2]}</pre>);
  }
  return <>{out}</>;
}

function relatedResources(q: string) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return searchIndex().filter((i) => (i.category === "Lesson" || i.category === "Simulation") && words.some((w) => `${i.title} ${i.keywords}`.toLowerCase().includes(w))).slice(0, 4);
}

function AssistantPage() {
  const { q, ctx } = Route.useSearch();
  const prefLevel = usePreferences((s) => s.level);
  const [level, setLevel] = useState<Level>(prefLevel);
  const [convos, setConvos] = useState<Convo[]>([{ id: "c1", title: "New conversation", messages: [] }]);
  const [active, setActive] = useState("c1");
  const [input, setInput] = useState(q ?? "");
  const [loading, setLoading] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const context = parseContext(ctx);
  const convo = convos.find((c) => c.id === active)!;
  const configured = isBackendConfigured();

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [convo.messages.length]);
  useEffect(() => () => abort.current?.abort(), []);

  const patch = (id: string, fn: (c: Convo) => Convo) => setConvos((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));

  const send = async (text: string, reuseUser = false) => {
    const msg = text.trim();
    if (!msg) { toast.error("Type a question first."); return; }
    if (msg.length > 4000) { toast.error("Please keep questions under 4,000 characters."); return; }
    const cid = active;
    if (!reuseUser) patch(cid, (c) => ({ ...c, title: c.messages.length ? c.title : msg.slice(0, 40), messages: [...c.messages, { id: crypto.randomUUID(), role: "user", content: msg }] }));
    else patch(cid, (c) => ({ ...c, messages: c.messages.filter((m) => m.role !== "error") }));
    setInput("");
    setLoading(true);
    abort.current = new AbortController();
    try {
      const res = await aiApi.chat({ message: msg, level, conversationId: convo.serverId, context }, abort.current.signal);
      patch(cid, (c) => ({ ...c, serverId: res.conversationId, messages: [...c.messages, { id: res.messageId, role: "assistant", content: res.content }] }));
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("network", "Unexpected error");
      if (err.kind === "aborted") return;
      const text = err.kind === "not_configured" ? "The AI assistant is unavailable: the CHAKRAVYUH AI service is not connected yet. No answer was generated." : err.kind === "rate_limited" ? "You're sending questions too quickly. Please wait a moment, then retry." : err.kind === "timeout" ? "The AI service took too long to respond." : err.message;
      patch(cid, (c) => ({ ...c, messages: [...c.messages, { id: crypto.randomUUID(), role: "error", content: text, retryable: err.retryable }] }));
    } finally { setLoading(false); }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!loading) send(input); } };
  const lastUser = [...convo.messages].reverse().find((m) => m.role === "user");
  const resources = relatedResources(lastUser?.content ?? input);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Assistant" title="AI Learning Assistant" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "AI Assistant" }]}
        actions={<div className="flex items-center gap-1 rounded-md border p-1" role="radiogroup" aria-label="Explanation level">{(["beginner", "intermediate", "advanced"] as Level[]).map((l) => <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={cn("rounded px-2.5 py-1 text-xs capitalize", level === l && "bg-primary text-primary-foreground")}>{l}</button>)}</div>} />
      {!configured && (
        <div role="status" className="mb-4 flex gap-3 rounded-md border border-warning/60 bg-warning/10 p-3 text-sm"><AlertTriangle className="h-5 w-5 shrink-0" /><div><strong>Assistant unavailable.</strong> The AI service hasn't been connected yet, so questions can't be answered. Related lessons and simulations are suggested on the right.</div></div>
      )}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr_260px]">
        <aside className="panel h-fit p-3">
          <Button size="sm" variant="outline" className="mb-2 w-full" onClick={() => { const id = `c${Date.now()}`; setConvos((c) => [{ id, title: "New conversation", messages: [] }, ...c]); setActive(id); }}><Plus /> New conversation</Button>
          <ul className="space-y-0.5">{convos.map((c) => <li key={c.id}><button onClick={() => setActive(c.id)} aria-current={c.id === active} className={cn("w-full truncate rounded px-2 py-1.5 text-left text-sm", c.id === active ? "bg-accent font-medium" : "hover:bg-accent/50")}>{c.title}</button></li>)}</ul>
          <p className="mt-3 text-[11px] text-muted-foreground">Conversation history persists on the server once connected; here it lasts for this visit.</p>
        </aside>

        <section className="panel flex min-h-[520px] flex-col">
          {context && <div className="border-b px-4 py-2 text-xs text-muted-foreground">Context attached: <span className="font-mono">{ctx}</span></div>}
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {convo.messages.length === 0 && (
              <div><p className="mb-3 text-sm text-muted-foreground">Try one of these:</p><div className="flex flex-wrap gap-2">{SUGGESTED.map((s) => <button key={s} onClick={() => setInput(s)} className="rounded-full border px-3 py-1.5 text-xs hover:border-primary">{s}</button>)}</div></div>
            )}
            {convo.messages.map((m) => (
              <div key={m.id} className={cn("max-w-[85%] rounded-lg px-4 py-3 text-sm", m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : m.role === "error" ? "border border-destructive/40 bg-destructive/5" : "border bg-muted/40")}>
                {m.role === "assistant" ? <Rich text={m.content} /> : <span className="whitespace-pre-wrap">{m.content}</span>}
                {m.role === "assistant" && (
                  <div className="mt-2 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy response" onClick={() => { navigator.clipboard.writeText(m.content); toast.success("Copied"); }}><Copy /></Button>
                    {(["up", "down"] as const).map((f) => <Button key={f} size="icon" variant="ghost" className={cn("h-7 w-7", m.feedback === f && "text-signal")} aria-label={f === "up" ? "Helpful" : "Not helpful"} aria-pressed={m.feedback === f} onClick={() => patch(active, (c) => ({ ...c, messages: c.messages.map((x) => (x.id === m.id ? { ...x, feedback: f } : x)) }))}>{f === "up" ? <ThumbsUp /> : <ThumbsDown />}</Button>)}
                  </div>
                )}
                {m.role === "error" && m.retryable && lastUser && <Button size="sm" variant="outline" className="mt-2" onClick={() => send(lastUser.content, true)}><RefreshCw /> Retry</Button>}
              </div>
            ))}
            {loading && <div className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking… <button className="underline" onClick={() => abort.current?.abort()}>Cancel</button></div>}
            <div ref={endRef} />
          </div>
          <form className="border-t p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} rows={3} placeholder="Ask an ENTC question… (Enter to send, Shift+Enter for a new line)" aria-label="Message" maxLength={4000} />
            <div className="mt-2 flex items-center justify-between"><span className="text-xs text-muted-foreground">{input.length}/4000</span><Button type="submit" disabled={loading || !input.trim()}><Send /> Send</Button></div>
          </form>
        </section>

        <aside className="space-y-4">
          <div className="panel p-4"><h2 className="mb-2 text-sm font-semibold">Related resources</h2>
            {resources.length ? <ul className="space-y-1 text-sm">{resources.map((r) => <li key={r.href}><Link to={r.href} className="text-signal hover:underline">{r.title}</Link> <span className="text-xs text-muted-foreground">({r.category})</span></li>)}</ul> : <p className="text-xs text-muted-foreground">Ask a question to see matching lessons and labs.</p>}
          </div>
          <div className="panel p-4"><h2 className="mb-2 text-sm font-semibold">Labs</h2><ul className="space-y-1 text-sm">{SIMULATIONS.map((s) => <li key={s.id}><Link to="/lab/$simulationId" params={{ simulationId: s.id }} className="hover:underline">{s.title}</Link></li>)}</ul></div>
        </aside>
      </div>
    </div>
  );
}
