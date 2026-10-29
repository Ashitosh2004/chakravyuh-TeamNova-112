import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FieldError } from "@/components/auth/AuthLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, profileApi } from "@/services/api";
import { usePreferences } from "@/stores/preferences";
import { useSession } from "@/stores/session";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — CHAKRAVYUH" }, { name: "description", content: "Edit your display name and learning level." }, { property: "og:title", content: "Profile — CHAKRAVYUH" }, { property: "og:description", content: "Your CHAKRAVYUH profile." }] }),
  component: ProfilePage,
});

const schema = z.object({
  displayName: z.string().trim().min(2, "At least 2 characters").max(60, "Under 60 characters"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
});

function ProfilePage() {
  const { user, mode, updateUser } = useSession();
  const setPref = usePreferences((s) => s.set);
  const { register, handleSubmit, formState: { errors, isSubmitting, isDirty }, reset } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { displayName: user?.displayName ?? "", level: user?.level ?? "beginner" } });
  const onSubmit = async (v: z.infer<typeof schema>) => {
    if (mode === "backend") {
      try { const u = await profileApi.update(v); updateUser(u); toast.success("Profile saved to your account"); }
      catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not save profile"); return; }
    } else { updateUser(v); toast.success("Profile updated on this device (development mode)"); }
    setPref({ level: v.level });
    reset(v);
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Account" title="Profile" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Profile" }]} />
      <form onSubmit={handleSubmit(onSubmit)} className="panel space-y-5 p-6" noValidate>
        <div><Label htmlFor="email">Email</Label><Input id="email" value={user?.email ?? ""} disabled /><p className="mt-1 text-xs text-muted-foreground">Email changes are handled by account services.</p></div>
        <div><Label htmlFor="displayName">Display name</Label><Input id="displayName" aria-invalid={!!errors.displayName} aria-describedby="dn-e" {...register("displayName")} /><FieldError id="dn-e" message={errors.displayName?.message} /></div>
        <div><Label htmlFor="level">Learning level</Label>
          <select id="level" className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" {...register("level")}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
          <p className="mt-1 text-xs text-muted-foreground">Used to tailor AI assistant explanations.</p></div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting && <Loader2 className="animate-spin" />} Save changes</Button>
      </form>
    </div>
  );
}
