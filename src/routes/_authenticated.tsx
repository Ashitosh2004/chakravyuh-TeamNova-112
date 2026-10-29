import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { authApi, isBackendConfigured, setUnauthorizedHandler } from "@/services/api";
import { useSession } from "@/stores/session";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const user = useSession((s) => s.user);
  const mode = useSession((s) => s.mode);
  const [hydrated, setHydrated] = useState(false);
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    setHydrated(true);
    setUnauthorizedHandler(() => {
      useSession.getState().clear(true);
    });
  }, []);

  const redirected = useRef(false);
  useEffect(() => {
    if (!hydrated || user || redirected.current) return;
    redirected.current = true;
    navigate({ to: "/login", search: href.startsWith("/login") ? {} : { redirect: href }, replace: true });
  }, [hydrated, user, href, navigate]);
  useEffect(() => { if (user) redirected.current = false; }, [user]);

  // Backend mode: verify the cookie session is still valid.
  useEffect(() => {
    if (!hydrated || mode !== "backend" || !isBackendConfigured()) return;
    authApi.me().catch(async () => {
      try { await authApi.refresh(); } catch { useSession.getState().clear(true); }
    });
  }, [hydrated, mode]);

  if (!hydrated || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Checking your session…</div>;
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
