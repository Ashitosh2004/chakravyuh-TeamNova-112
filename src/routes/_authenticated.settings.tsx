import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { authApi, isBackendConfigured } from "@/services/api";
import { usePreferences, type Theme } from "@/stores/preferences";
import { useProgress } from "@/stores/progress";
import { useSession } from "@/stores/session";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CHAKRAVYUH" }, { name: "description", content: "Theme, accessibility, notifications and account settings." }, { property: "og:title", content: "Settings — CHAKRAVYUH" }, { property: "og:description", content: "Customise CHAKRAVYUH." }] }),
  component: SettingsPage,
});

function Row({ label, desc, children, id }: { label: string; desc?: string; children: React.ReactNode; id: string }) {
  return <div className="flex items-center justify-between gap-4 py-3"><div><label htmlFor={id} className="text-sm font-medium">{label}</label>{desc && <p className="text-xs text-muted-foreground">{desc}</p>}</div>{children}</div>;
}

function SettingsPage() {
  const p = usePreferences();
  const { mode, clear } = useSession();
  const resetProgress = useProgress((s) => s.reset);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader eyebrow="Account" title="Settings" crumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Settings" }]} />
      <section className="panel divide-y px-5">
        <h2 className="py-3 font-semibold">Appearance</h2>
        <Row id="theme" label="Theme"><div id="theme" className="flex gap-1" role="radiogroup" aria-label="Theme">{(["light", "dark", "system"] as Theme[]).map((t) => <button key={t} role="radio" aria-checked={p.theme === t} onClick={() => p.set({ theme: t })} className={`rounded-md border px-3 py-1.5 text-xs capitalize ${p.theme === t ? "border-primary bg-primary text-primary-foreground" : ""}`}>{t}</button>)}</div></Row>
      </section>
      <section className="panel divide-y px-5">
        <h2 className="py-3 font-semibold">Accessibility</h2>
        <Row id="rm" label="Reduce motion" desc="Minimise animations and transitions."><Switch id="rm" checked={p.reduceMotion} onCheckedChange={(v) => p.set({ reduceMotion: v })} /></Row>
        <Row id="lt" label="Larger text" desc="Increase base font size by 12.5%."><Switch id="lt" checked={p.largeText} onCheckedChange={(v) => p.set({ largeText: v })} /></Row>
      </section>
      <section className="panel divide-y px-5">
        <h2 className="py-3 font-semibold">Notifications</h2>
        <Row id="na" label="Achievement notifications"><Switch id="na" checked={p.notifyAchievements} onCheckedChange={(v) => p.set({ notifyAchievements: v })} /></Row>
        <Row id="nq" label="Quiz reminders" desc="Email reminders will be sent by the server once connected."><Switch id="nq" checked={p.notifyQuizReminders} onCheckedChange={(v) => p.set({ notifyQuizReminders: v })} /></Row>
      </section>
      <section className="panel space-y-3 p-5">
        <h2 className="font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">Session mode: <strong>{mode === "backend" ? "Signed in with CHAKRAVYUH account" : "Development mode (not authenticated)"}</strong>. Backend: {isBackendConfigured() ? "connected" : "not connected"}.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={async () => { if (mode === "backend") await authApi.logout().catch(() => undefined); clear(); navigate({ to: "/login" }); }}><LogOut /> Log out</Button>
          <Button variant="destructive" onClick={() => setConfirm(true)}><Trash2 /> Clear local progress</Button>
        </div>
      </section>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Clear progress on this device?</AlertDialogTitle><AlertDialogDescription>This removes all lessons, quiz attempts, challenge results and achievements stored in this browser. It cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { resetProgress(); toast.success("Local progress cleared"); }}>Clear</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
