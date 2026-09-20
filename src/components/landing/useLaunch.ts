import { useCallback, useEffect, useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";

type GuestState = "idle" | "queued" | "signingIn";

/**
 * Where "Launch app" goes, and the one-click guest start.
 *
 * After `signIn` resolves there is a short window in which the token is stored
 * but Convex has not confirmed it yet, and `useConvexAuth` still reports
 * signed-out. Navigating in that window would bounce the visitor through
 * /signin, so the guest start waits for `isAuthenticated` before it moves on.
 */
export function useLaunch() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const renter = useQuery(api.renters.me, isAuthenticated ? {} : "skip");
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [guest, setGuest] = useState<GuestState>("idle");

  // While the profile is still loading, /app is right: its gate sends people
  // without a profile on to onboarding.
  const destination = !isAuthenticated ? "/signin" : renter === null ? "/onboarding" : "/app";

  const startGuest = useCallback(() => {
    setGuest((state) => (state === "idle" ? "queued" : state));
  }, []);

  useEffect(() => {
    if (guest === "idle" || isLoading) return;
    if (isAuthenticated) {
      // A brand-new guest has no profile. A returning visitor who clicked the
      // guest button keeps their session instead of being replaced by a new user.
      navigate(guest === "signingIn" ? "/onboarding" : destination);
      return;
    }
    if (guest === "queued") {
      setGuest("signingIn");
      signIn("anonymous").catch(() => {
        setGuest("idle");
        toast.error("Nestor could not start a guest session. Please try again.");
      });
    }
  }, [guest, isLoading, isAuthenticated, destination, navigate, signIn]);

  return {
    destination,
    isAuthenticated,
    authLoading: isLoading,
    startGuest,
    guestPending: guest !== "idle",
  };
}
