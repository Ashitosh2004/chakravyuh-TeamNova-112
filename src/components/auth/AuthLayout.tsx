import { Link } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/input";
import { isBackendConfigured } from "@/services/api";

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground lg:flex">
        <Link to="/" className="[&_*]:text-ink-foreground"><Logo /></Link>
        <div>
          <p className="font-display text-3xl font-semibold leading-tight">“Every circuit you build here computes for real — toggle it, break it, learn why.”</p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.14em] text-ink-foreground/60">Digital · Analog · Signals · Embedded · IoT</p>
        </div>
        <div className="font-mono text-xs text-ink-foreground/50">CHAKRAVYUH · Phase 1</div>
      </div>
      <main id="main" className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {!isBackendConfigured() && (
            <div role="note" className="mb-5 rounded-md border border-warning/60 bg-warning/10 p-3 text-xs leading-relaxed">
              <strong>Backend not connected.</strong> Account sign-in will work once the CHAKRAVYUH server is connected. Until then you can explore in a clearly-labelled development mode — it is not a secure login.
            </div>
          )}
          {children}
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
      </main>
    </div>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className="pr-10" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1 text-xs text-destructive">{message}</p>;
}
