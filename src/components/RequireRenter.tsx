import type { ReactNode } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { Navigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { PageLoader } from "@/components/ui";

/**
 * Gate for /app. Signed-out visitors go to sign-in; signed-in visitors who
 * have not told Nestor about themselves yet go to onboarding, because every
 * screen behind this gate assumes a renter profile exists.
 */
export function RequireRenter({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const renter = useQuery(api.renters.me, isAuthenticated ? {} : "skip");

  if (isLoading) return <PageLoader label="Opening Nestor" />;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (renter === undefined) return <PageLoader label="Opening Nestor" />;
  if (renter === null) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}
