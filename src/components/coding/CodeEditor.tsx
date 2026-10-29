import { useRef, type KeyboardEvent } from "react";

/** Lightweight code editor: monospace textarea with line numbers and Tab indentation. */
export function CodeEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split("\n").length;
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = el;
      const next = value.slice(0, s) + "  " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
  };
  return (
    <div className="flex h-80 overflow-hidden rounded-md border bg-ink font-mono text-[13px] leading-6 text-ink-foreground sm:h-96">
      <div ref={gutter} aria-hidden="true" className="select-none overflow-hidden border-r border-ink-foreground/15 px-2 py-2 text-right text-ink-foreground/40">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea
        ref={ref}
        aria-label={label}
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop; }}
        className="flex-1 resize-none bg-transparent p-2 outline-none"
      />
    </div>
  );
}
