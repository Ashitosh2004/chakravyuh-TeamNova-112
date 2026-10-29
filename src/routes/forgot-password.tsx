import { zodResolver } from "@hookform/resolvers/zod";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AuthLayout, FieldError } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotSchema } from "@/schemas/auth";
import { ApiError, authApi } from "@/services/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset password — CHAKRAVYUH" },
      { name: "description", content: "Request a password reset link for your CHAKRAVYUH account." },
      { property: "og:title", content: "Reset password — CHAKRAVYUH" },
      { property: "og:description", content: "Recover access to your account." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  const onSubmit = async (v: z.infer<typeof forgotSchema>) => {
    setErr(null);
    try {
      await authApi.forgot(v);
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Request failed.");
    }
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link." footer={<Link to="/login" className="font-medium text-primary hover:underline">Back to log in</Link>}>
      {sent ? (
        <div role="status" className="rounded-md border border-success/50 bg-success/10 p-4 text-sm">If an account exists for that email, the server has sent a reset link.</div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} aria-describedby="em-err" {...register("email")} />
            <FieldError id="em-err" message={errors.email?.message} />
          </div>
          {err && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{err}</div>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />} Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
