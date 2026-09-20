import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell";
import { RequireRenter } from "@/components/RequireRenter";
import { Landing } from "@/pages/Landing";
import { NotFound } from "@/pages/NotFound";
import { SignIn } from "@/pages/SignIn";
import { PageLoader } from "@/components/ui";

// The landing and sign-in pages ship in the first chunk; everything behind them loads on demand.
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const LeaseAudit = lazy(() => import("@/pages/LeaseAudit").then((m) => ({ default: m.LeaseAudit })));
const ListingDetail = lazy(() => import("@/pages/ListingDetail").then((m) => ({ default: m.ListingDetail })));
const Onboarding = lazy(() => import("@/pages/Onboarding").then((m) => ({ default: m.Onboarding })));
const PassportEditor = lazy(() => import("@/pages/PassportEditor").then((m) => ({ default: m.PassportEditor })));
const PublicPassport = lazy(() => import("@/pages/PublicPassport").then((m) => ({ default: m.PublicPassport })));
const Settings = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));
const Tours = lazy(() => import("@/pages/Tours").then((m) => ({ default: m.Tours })));

// Each lazy page suspends on its own, so the app shell stays on screen while a page's chunk loads.
function deferred(page: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{page}</Suspense>;
}

/*
 * Route map. Paths under /auth, /oauth, /api/auth, /.well-known, /agentmail and
 * /firecrawl are reserved for backend HTTP routes on convex.site; never add
 * pages there. Passport tokens must not contain "." or the static host 404s.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/passport/:token" element={deferred(<PublicPassport />)} />
      <Route path="/onboarding" element={deferred(<Onboarding />)} />

      <Route
        path="/app"
        element={
          <RequireRenter>
            <AppShell />
          </RequireRenter>
        }
      >
        <Route index element={deferred(<Dashboard />)} />
        <Route path="listings/:listingId" element={deferred(<ListingDetail />)} />
        <Route path="tours" element={deferred(<Tours />)} />
        <Route path="lease" element={deferred(<LeaseAudit />)} />
        <Route path="passport" element={deferred(<PassportEditor />)} />
        <Route path="settings" element={deferred(<Settings />)} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
