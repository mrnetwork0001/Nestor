import { useEffect, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { ConvexError } from "convex/values";
import { ArrowLeft, ArrowRight, Check } from "@/components/icons";
import { Link, useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
import { KeyMark } from "@/components/landing/Motif";
import { useDocumentTitle } from "@/components/landing/useDocumentTitle";
import { Button, Callout, Field, Input, PageLoader } from "@/components/ui";

type Flow = "signIn" | "signUp";

const PROMISES = [
  "You approve every email before it goes out.",
  "Nestor always tells landlords it is an AI assistant.",
  "Your budget stays private. Always.",
];

export function SignIn() {
  useDocumentTitle("Sign in · Nestor");
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const navigate = useNavigate();

  const [flow, setFlow] = useState<Flow>("signIn");
  const [busy, setBusy] = useState<"guest" | "password" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Covers visitors who arrive already signed in, and the moment Convex
  // confirms a sign-in made here. /app sends people without a profile on to
  // onboarding, so this is the one place that decides where to go next.
  useEffect(() => {
    if (isAuthenticated) navigate("/app", { replace: true });
  }, [isAuthenticated, navigate]);

  function continueAsGuest() {
    setBusy("guest");
    setError(null);
    signIn("anonymous").catch(() => {
      setBusy(null);
      setError("Nestor could not start a guest session. Check your connection and try again.");
    });
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setError(null);
    // Fields: email, password, flow. Convex Auth's Password provider reads exactly these.
    const formData = new FormData(event.currentTarget);
    signIn("password", formData).catch((err: unknown) => {
      setBusy(null);
      // Production hides the provider's own messages, so say something useful either way.
      setError(
        err instanceof ConvexError
          ? String(err.data)
          : flow === "signIn"
            ? "That email and password don't match an account. Check them, or create an account instead."
            : "Nestor could not create that account. Use at least 8 characters, or sign in if you already have one.",
      );
    });
  }

  if (isLoading || isAuthenticated) {
    return <PageLoader label={isAuthenticated ? "Opening Nestor" : "Checking your session"} />;
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-forest text-paper lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 self-start text-sm text-paper/80 transition-colors hover:text-paper"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the front page
        </Link>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/70">
            Your apartment concierge
          </p>
          <p className="mt-4 max-w-md font-display text-4xl leading-[1.1] tracking-tight xl:text-5xl">
            Get the keys. Skip the back-and-forth.
          </p>
          <ul className="mt-10 max-w-md space-y-4 border-t border-paper/20 pt-8">
            {PROMISES.map((promise) => (
              <li key={promise} className="flex items-start gap-3 text-paper/90">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-paper/15">
                  <Check className="size-3" aria-hidden="true" />
                </span>
                {promise}
              </li>
            ))}
          </ul>
        </div>
        <KeyMark className="h-10 w-24 text-paper/40" />
      </aside>

      <main className="paper-grain flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:min-h-0">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          <Link to="/" className="text-sm text-ink-soft underline-offset-4 hover:text-forest hover:underline lg:hidden">
            Front page
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <Logo className="mb-8 hidden lg:inline-flex" />
          <h1 className="text-4xl leading-tight text-ink">
            {flow === "signIn" ? "Welcome in." : "Create your account."}
          </h1>
          <p className="mt-2 text-ink-soft">
            Look around as a guest first, or sign in to pick up your search.
          </p>

          <div className="mt-8 rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <Button
              size="lg"
              variant="accent"
              className="w-full"
              onClick={continueAsGuest}
              loading={busy === "guest"}
              disabled={busy !== null}
            >
              Continue as guest
              {busy !== "guest" && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
            <p className="mt-2.5 text-center text-xs leading-relaxed text-ink-faint">
              No email needed. Guests get the whole flow with Nestor's demo landlord.
            </p>
          </div>

          <p className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
            <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />
            or use your email
            <span aria-hidden="true" className="h-px flex-1 bg-line-strong" />
          </p>

          <form onSubmit={submitPassword} className="space-y-4">
            <Field label="Email" htmlFor="signin-email">
              <Input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={busy !== null}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="signin-password"
              hint={flow === "signUp" ? "At least 8 characters." : undefined}
            >
              <Input
                id="signin-password"
                name="password"
                type="password"
                minLength={8}
                autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                required
                disabled={busy !== null}
              />
            </Field>
            <input name="flow" type="hidden" value={flow} />

            {error && (
              <div role="alert">
                <Callout tone="clay">{error}</Callout>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={busy === "password"}
              disabled={busy !== null}
            >
              {flow === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-ink-soft">
            {flow === "signIn" ? "New to Nestor?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setFlow(flow === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
              className="cursor-pointer font-medium text-forest underline underline-offset-4 hover:text-forest-deep"
            >
              {flow === "signIn" ? "Create an account" : "Sign in instead"}
            </button>
          </p>

          <p className="mt-8 text-center text-xs leading-relaxed text-ink-faint">
            An account lets Nestor email real landlords for you and keeps your search across
            devices. There is no verification email: you can start straight away.
          </p>
        </div>
      </main>
    </div>
  );
}
