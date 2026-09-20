import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { LogOut } from "@/components/icons";
import { Link, useNavigate } from "react-router";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

/*
 * Sign-out, wherever a signed-in person would look for it: the app sidebar,
 * the phone header and onboarding. A guest session cannot be signed
 * back into, so guests are asked once before their search is thrown away.
 */

/** Ends the session and lands on the public home page. Shared with Settings. */
export function useSignOut() {
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function leave() {
    setBusy(true);
    // Leave /app first: once the session ends its guard would bounce to /signin instead.
    navigate("/", { replace: true });
    await signOut();
    setBusy(false);
  }
  return { leave, busy };
}

function GuestWarning({
  busy,
  onLeave,
  onStay,
  className,
}: {
  busy: boolean;
  onLeave: () => void;
  onStay: () => void;
  className?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="Sign out of a guest session"
      className={cn("rounded-xl border border-clay/25 bg-clay-soft p-3.5 text-left", className)}
    >
      <p className="text-sm font-semibold text-clay-deep">You will lose this search</p>
      <p className="mt-1 text-xs leading-relaxed text-clay-deep/90">
        A guest session cannot be signed back into.{" "}
        <Link to="/app/settings" onClick={onStay} className="font-medium underline underline-offset-2">
          Create an account
        </Link>{" "}
        first to keep it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="danger" loading={busy} onClick={onLeave}>
          Sign out anyway
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onStay}>
          Stay
        </Button>
      </div>
    </div>
  );
}

/**
 * Account block pinned to the bottom of the app sidebar. Guests get one clear
 * next step (an account is what unlocks emailing real landlords); members see
 * who they are. Collapsed, it shrinks to an avatar and a sign-out icon.
 */
export function SidebarAccount({ collapsed = false }: { collapsed?: boolean }) {
  const viewer = useQuery(api.users.viewer);
  const { leave, busy } = useSignOut();
  const [confirming, setConfirming] = useState(false);

  if (!viewer) return null;
  const isGuest = viewer.isAnonymous;
  const label = isGuest ? "Guest session" : (viewer.email ?? "Your account");
  const askToLeave = () => (isGuest ? setConfirming(true) : void leave());

  const avatar = (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-forest-soft text-sm font-semibold text-forest-deep"
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-line px-2 py-4">
        <span title={label}>{avatar}</span>
        <button
          type="button"
          disabled={busy}
          onClick={askToLeave}
          aria-label="Sign out"
          title="Sign out"
          className="flex size-10 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink disabled:opacity-60"
        >
          <LogOut className="size-4.5" aria-hidden="true" />
        </button>
        {confirming && (
          // Fixed, because the sidebar clips anything wider than itself.
          <GuestWarning
            busy={busy}
            onLeave={() => void leave()}
            onStay={() => setConfirming(false)}
            className="animate-rise fixed bottom-4 left-20 z-50 w-72 shadow-lift"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-line px-4 py-4">
      {isGuest ? (
        <div className="rounded-xl border border-line-strong bg-card p-3.5">
          <p className="text-sm font-semibold text-ink">You are on a guest session</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Create a free account to keep this search and email real landlords.
          </p>
          <Link
            to="/app/settings"
            className="mt-3 flex h-9 items-center justify-center rounded-lg bg-forest text-sm font-medium text-paper shadow-sm transition-colors hover:bg-forest-deep"
          >
            Create account
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-2 py-1">
          {avatar}
          <p className="min-w-0 truncate text-sm font-medium text-ink" title={label}>
            {label}
          </p>
        </div>
      )}

      {confirming ? (
        <GuestWarning busy={busy} onLeave={() => void leave()} onStay={() => setConfirming(false)} />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={askToLeave}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink disabled:opacity-60"
        >
          <LogOut className="size-4.5" aria-hidden="true" />
          Sign out
        </button>
      )}
    </div>
  );
}

/**
 * A single "Sign out" control for headers (the phone app header, onboarding).
 * `labelled` adds the icon beside the words. The guest warning opens as a
 * small panel underneath.
 */
export function SignOutButton({ labelled = false, className }: { labelled?: boolean; className?: string }) {
  const viewer = useQuery(api.users.viewer);
  const { leave, busy } = useSignOut();
  const [confirming, setConfirming] = useState(false);

  if (!viewer) return null;
  const isGuest = viewer.isAnonymous;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        aria-expanded={isGuest ? confirming : undefined}
        onClick={() => (isGuest ? setConfirming((value) => !value) : void leave())}
        className={cn(
          "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-paper-deep hover:text-ink disabled:opacity-60",
          className,
        )}
      >
        {labelled && <LogOut className="size-4.5" aria-hidden="true" />}
        Sign out
      </button>
      {confirming && (
        <GuestWarning
          busy={busy}
          onLeave={() => void leave()}
          onStay={() => setConfirming(false)}
          className="animate-rise absolute right-0 top-12 z-50 w-72 shadow-lift"
        />
      )}
    </div>
  );
}
