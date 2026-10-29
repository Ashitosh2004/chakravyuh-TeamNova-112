import { zodResolver } from "@hookform/resolvers/zod";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout, FieldError, PasswordInput } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema } from "@/schemas/auth";
import { ApiError, authApi, isBackendConfigured } from "@/services/api";
import { startDevelopmentSession, useSession } from "@/stores/session";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s.redirect === "string" ? { redirect: s.redirect } : {}),
  head: () => ({
    meta: [
      { title: "Log in — CHAKRAVYUH" },
      { name: "description", content: "Sign in to continue your ENTC learning on CHAKRAVYUH." },
      { property: "og:title", content: "Log in — CHAKRAVYUH" },
      { property: "og:description", content: "Sign in to your ENTC learning lab." },
    ],
  }),
  component: LoginPage,
});

type Form = z.infer<typeof loginSchema>;

function safeRedirect(r?: string) {
  return r && r.startsWith("/") && !r.startsWith("//") && !/^\/(login|register)/.test(r) ? r : "/dashboard";
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const expired = useSession((s) => s.expired);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, getValues, trigger, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (v: Form) => {
    setServerError(null);
    try {
      const { user } = await authApi.login(v);
      useSession.getState().setSession(user, "backend");
      navigate({ to: safeRedirect(redirect) });
    } catch (e) {
      setServerError(e instanceof ApiError ? (e.kind === "unauthorized" ? "Incorrect email or password." : e.message) : "Sign-in failed.");
    }
  };

  const devMode = async () => {
    if (!(await trigger("email"))) return;
    const email = getValues("email");
    startDevelopmentSession(email.split("@")[0], email);
    navigate({ to: safeRedirect(redirect) });
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue learning." footer={<>New here? <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link></>}>
      {expired && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">Your session expired. Please sign in again.</div>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="email-err" {...register("email")} />
          <FieldError id="email-err" message={errors.email?.message} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby="pw-err" {...register("password")} />
          <FieldError id="pw-err" message={errors.password?.message} />
        </div>
        {serverError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{serverError}</div>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Log in</Button>
      </form>
      {!isBackendConfigured() && (
        <Button variant="outline" className="mt-3 w-full" onClick={devMode}>Continue in development mode</Button>
      )}
    </AuthLayout>
  );
}
