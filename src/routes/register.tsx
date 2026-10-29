import { zodResolver } from "@hookform/resolvers/zod";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout, FieldError, PasswordInput } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { passwordStrength, registerSchema } from "@/schemas/auth";
import { ApiError, authApi, isBackendConfigured } from "@/services/api";
import { startDevelopmentSession, useSession } from "@/stores/session";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — CHAKRAVYUH" },
      { name: "description", content: "Create your CHAKRAVYUH account to start learning electronics interactively." },
      { property: "og:title", content: "Create account — CHAKRAVYUH" },
      { property: "og:description", content: "Join the interactive ENTC learning lab." },
    ],
  }),
  component: RegisterPage,
});

type Form = z.infer<typeof registerSchema>;

function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, trigger, getValues, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(registerSchema), defaultValues: { password: "" } });
  const strength = passwordStrength(watch("password") ?? "");

  const onSubmit = async (v: Form) => {
    setServerError(null);
    try {
      const { user } = await authApi.register({ displayName: v.displayName, email: v.email, password: v.password });
      useSession.getState().setSession(user, "backend");
      navigate({ to: "/dashboard" });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : "Registration failed.");
    }
  };

  const devMode = async () => {
    if (!(await trigger(["displayName", "email"]))) return;
    startDevelopmentSession(getValues("displayName"), getValues("email"));
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start learning ENTC by experimenting." footer={<>Already registered? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link></>}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" autoComplete="nickname" aria-invalid={!!errors.displayName} aria-describedby="dn-err" {...register("displayName")} />
          <FieldError id="dn-err" message={errors.displayName?.message} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="em-err" {...register("email")} />
          <FieldError id="em-err" message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} aria-describedby="pw-help pw-err" {...register("password")} />
          <div id="pw-help" className="mt-2">
            <div className="flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1 flex-1 rounded ${i < strength.score ? (strength.score <= 2 ? "bg-destructive" : strength.score <= 4 ? "bg-warning" : "bg-success") : "bg-muted"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Strength: {strength.label}</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-2 text-xs">
              {strength.checks.map((c) => (
                <li key={c.label} className={c.ok ? "text-success" : "text-muted-foreground"}>{c.ok ? <Check className="mr-1 inline h-3 w-3" /> : <X className="mr-1 inline h-3 w-3" />}{c.label}</li>
              ))}
            </ul>
          </div>
          <FieldError id="pw-err" message={errors.password?.message} />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} aria-describedby="cf-err" {...register("confirm")} />
          <FieldError id="cf-err" message={errors.confirm?.message} />
        </div>
        {serverError && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{serverError}</div>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Create account</Button>
      </form>
      {!isBackendConfigured() && <Button variant="outline" className="mt-3 w-full" onClick={devMode}>Continue in development mode</Button>}
    </AuthLayout>
  );
}
