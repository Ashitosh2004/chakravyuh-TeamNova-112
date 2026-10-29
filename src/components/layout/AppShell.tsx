import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Bot, LogOut, Menu, Search, Settings, User } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { authApi } from "@/services/api";
import { computeAchievements, useProgress } from "@/stores/progress";
import { useSession } from "@/stores/session";
import { ACCOUNT_NAV, NAV } from "./nav";
import { SearchDialog } from "./SearchDialog";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const item = (to: string, label: string, Icon: typeof Bell) => {
    const active = path === to || path.startsWith(`${to}/`);
    return (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
        )}
      >
        <Icon className={cn("h-4 w-4", active && "text-signal")} />
        {label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((n) => item(n.to, n.label, n.icon))}
      <div className="eyebrow mt-5 mb-1 px-3">Account</div>
      {ACCOUNT_NAV.map((n) => item(n.to, n.label, n.icon))}
    </nav>
  );
}

function Notifications() {
  const events = useProgress((s) => s.events);
  const unlocked = useMemo(() => computeAchievements(events).filter((a) => a.unlocked), [events]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unlocked.length ? `, ${unlocked.length}` : ""}`} className="relative">
          <Bell />
          {unlocked.length > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-success" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-2 text-sm font-semibold">Notifications</div>
        {unlocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet. Achievements you unlock will appear here.</p>
        ) : (
          <ul className="space-y-2">
            {unlocked.map((a) => (
              <li key={a.id} className="rounded-md border p-2 text-sm">
                <span className="font-medium">Achievement unlocked: {a.title}</span>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        )}
        <Link to="/achievements" className="mt-3 block text-xs font-medium text-signal hover:underline">View all achievements</Link>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, mode, clear } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    if (mode === "backend") await authApi.logout().catch(() => undefined);
    clear();
    navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar p-4 lg:flex">
        <Link to="/dashboard" className="mb-6 px-2"><Logo /></Link>
        <div className="flex-1 overflow-y-auto"><NavLinks /></div>
        {mode === "development" && (
          <p className="mt-4 rounded-md border border-warning/60 bg-warning/10 p-2 text-[11px] leading-snug text-foreground">
            <strong>Development mode.</strong> Backend not connected. Progress is stored only in this browser.
          </p>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur sm:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-4">
              <SheetTitle className="mb-4"><Logo /></SheetTitle>
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" className="lg:hidden"><Logo compact /></Link>
          <button
            onClick={() => setSearchOpen(true)}
            className="ml-1 flex h-9 flex-1 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted sm:max-w-md"
            aria-label="Search courses, lessons, simulations"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search lessons, labs, challenges…</span>
            <kbd className="ml-auto hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/ai-assistant"><Bot /> Ask AI</Link>
            </Button>
            <Notifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account menu" className="rounded-full">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-sm font-semibold text-primary-foreground">
                    {(user?.displayName ?? "S").slice(0, 1).toUpperCase()}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user?.displayName}</div>
                  <div className="text-xs font-normal text-muted-foreground">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}><User /> Profile</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: "/settings" })}><Settings /> Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={logout}><LogOut /> Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
