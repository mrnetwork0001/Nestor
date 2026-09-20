import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  FileSearch,
  IdCard,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { api } from "../../convex/_generated/api";
import { Logo } from "@/components/Logo";
import { SidebarAccount, SignOutButton } from "@/components/SignOutControl";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

type NavKey = "dashboard" | "tours" | "lease" | "passport" | "settings";

const NAV: Array<{ key: NavKey; to: string; label: string; icon: typeof LayoutDashboard; end: boolean }> = [
  { key: "dashboard", to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { key: "tours", to: "/app/tours", label: "Tours", icon: CalendarDays, end: false },
  { key: "lease", to: "/app/lease", label: "Lease check", icon: FileSearch, end: false },
  { key: "passport", to: "/app/passport", label: "Passport", icon: IdCard, end: false },
  { key: "settings", to: "/app/settings", label: "Settings", icon: Settings2, end: false },
];

const COLLAPSED_KEY = "nestor.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false; // private windows can throw on storage access
  }
}

/** A live count on a nav item: things waiting on the renter. */
function Count({ value, active, collapsed }: { value: number; active: boolean; collapsed: boolean }) {
  if (value <= 0) return null;
  return (
    <span
      aria-label={`${value} waiting on you`}
      className={cn(
        "flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums",
        active ? "bg-paper text-forest-deep" : "bg-clay text-paper",
        collapsed ? "absolute -right-0.5 -top-0.5 min-w-4 px-1 leading-4" : "ml-auto",
      )}
    >
      {value > 9 ? "9+" : value}
    </span>
  );
}

/** Signed-in layout: a pinned, collapsible sidebar on desktop; a tab bar on phones. */
export function AppShell() {
  const status = useQuery(api.system.status);
  const summary = useQuery(api.dashboard.summary);
  const [collapsed, setCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // The preference just does not persist.
    }
  }, [collapsed]);

  // Drafts and questions are answered from a listing, reached through the dashboard.
  const waiting = summary?.needsYouBreakdown;
  const counts: Partial<Record<NavKey, number>> = {
    dashboard: (waiting?.drafts ?? 0) + (waiting?.questions ?? 0),
    tours: waiting?.tours ?? 0,
  };

  const agents = [
    { label: "Scout", live: status?.firecrawl ?? false },
    { label: "Inbox", live: status?.inboxReady ?? false },
    { label: "Brain", live: status?.openai ?? false },
  ];

  return (
    <div
      className={cn(
        "min-h-dvh lg:grid lg:transition-[grid-template-columns] lg:duration-200",
        collapsed ? "lg:grid-cols-[4.5rem_1fr]" : "lg:grid-cols-[15rem_1fr]",
      )}
    >
      <aside className="hidden border-r border-line bg-paper-deep/50 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start lg:overflow-y-auto lg:overflow-x-hidden">
        <div className={cn("flex items-start py-5", collapsed ? "flex-col items-center gap-3 px-2" : "justify-between px-5")}>
          {collapsed ? (
            <Logo className="[&>span]:hidden" />
          ) : (
            <div>
              <Logo />
              <p className="mt-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                Apartment concierge
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-paper-deep hover:text-ink"
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          </button>
        </div>

        <nav aria-label="App" className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
          {NAV.map(({ key, to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={({ isActive }) =>
                cn(
                  "relative flex items-center rounded-xl text-sm font-medium transition-colors",
                  collapsed ? "size-12 justify-center mx-auto" : "gap-3 px-3 py-2.5",
                  isActive ? "bg-forest text-paper shadow-sm" : "text-ink-soft hover:bg-paper-deep hover:text-ink",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  {!collapsed && label}
                  <Count value={counts[key] ?? 0} active={isActive} collapsed={collapsed} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className={cn("border-t border-line py-4", collapsed ? "px-2" : "space-y-2 px-5")}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2" aria-label="Agents">
              {agents.map((agent) => (
                <span
                  key={agent.label}
                  title={`${agent.label}: ${agent.live ? "live" : "demo mode"}`}
                  className={cn("size-2 rounded-full", agent.live ? "animate-pulse-dot bg-forest" : "bg-line-strong")}
                />
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Agents</p>
              <div className="flex flex-wrap gap-1.5">
                {agents.map((agent) => (
                  <Badge key={agent.label} tone={agent.live ? "forest" : "neutral"} dot pulse={agent.live}>
                    {agent.label}
                  </Badge>
                ))}
              </div>
              {status?.agentInbox && (
                <p className="truncate text-xs text-ink-faint" title={status.agentInbox}>
                  {status.agentInbox}
                </p>
              )}
            </>
          )}
        </div>

        <SidebarAccount collapsed={collapsed} />
      </aside>

      <main className="min-w-0 pb-24 lg:pb-0">
        <header className="flex items-center justify-between border-b border-line px-5 py-3 lg:hidden">
          <Logo />
          <SignOutButton labelled />
        </header>
        <Outlet />
      </main>

      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card/95 backdrop-blur lg:hidden">
        {NAV.map(({ key, to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                isActive ? "text-forest" : "text-ink-faint",
              )
            }
          >
            <span className="relative">
              <Icon className="size-5" aria-hidden="true" />
              <Count value={counts[key] ?? 0} active={false} collapsed />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
