import { cn } from "@/lib/utils";

/** Original CHAKRAVYUH mark: concentric circuit rings with a central node. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="6" className="fill-primary" />
      <circle cx="16" cy="16" r="9.5" fill="none" strokeWidth="1.6" className="stroke-primary-foreground" strokeDasharray="14 4" />
      <circle cx="16" cy="16" r="5" fill="none" strokeWidth="1.6" className="stroke-primary-foreground" strokeDasharray="7 3" />
      <circle cx="16" cy="16" r="1.8" className="fill-success" />
      <path d="M16 1.5v5M16 25.5v5M1.5 16h5M25.5 16h5" strokeWidth="1.6" className="stroke-primary-foreground" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[15px] font-bold tracking-[0.08em]">CHAKRAVYUH</span>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">ENTC Learning Lab</span>
        </span>
      )}
    </span>
  );
}
