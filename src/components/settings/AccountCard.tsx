import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { LogOut, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { useSignOut } from "@/components/SignOutControl";
import { Badge, Button, Callout, Card, Field, Input, Skeleton } from "@/components/ui";

function CreateAccountForm() {
  const { signIn } = useAuthActions();
  const syncAccount = useMutation(api.renters.syncAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (String(formData.get("password") ?? "").length < 8) {
      setError("Use a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    // Signing up while the guest session is active upgrades this same user, so nothing is lost.
    formData.set("flow", "signUp");
    try {
      await signIn("password", formData);
    } catch (caught) {
      setError(
        caught instanceof ConvexError
          ? String(caught.data)
          : "Nestor could not create the account. Use a password of 8 or more characters. If this email already has an account, sign out and sign in with it instead.",
      );
      setBusy(false);
      return;
    }
    try {
      // The auth callback already flips the guest flag; this covers a missed update.
      await syncAccount({});
    } catch {
      // Not worth alarming anyone over: saving the profile again has the same effect.
    }
    toast.success("Account created. Your search is saved, and Nestor can now email real landlords.");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Email" htmlFor="account-email">
        <Input
          id="account-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={busy}
        />
      </Field>
      <Field label="Password" htmlFor="account-password" hint="At least 8 characters.">
        <Input
          id="account-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={busy}
        />
      </Field>
      <input type="hidden" name="flow" value="signUp" />
      {error && (
        <p role="alert" className="text-sm text-clay-deep sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy}>
          Create my account
        </Button>
      </div>
    </form>
  );
}

function SignOut({ isGuest }: { isGuest: boolean }) {
  const { leave, busy } = useSignOut();
  const [confirming, setConfirming] = useState(false);

  if (isGuest && confirming) {
    return (
      <div className="space-y-3">
        <Callout
          tone="clay"
          icon={<TriangleAlert className="size-4" aria-hidden="true" />}
          title="You will lose this search"
        >
          A guest session cannot be signed back into. Your listings, conversations, lease checks and Passport
          link will be out of reach for good. Create an account above first if you want to keep them.
        </Callout>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" loading={busy} onClick={leave}>
            Sign out and lose my data
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>
            Stay signed in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      loading={busy}
      icon={<LogOut className="size-4" aria-hidden="true" />}
      onClick={() => (isGuest ? setConfirming(true) : void leave())}
    >
      Sign out
    </Button>
  );
}

export function AccountCard() {
  const viewer = useQuery(api.users.viewer);

  if (viewer === undefined) {
    return (
      <Card className="p-6 sm:p-8">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-4 h-24" />
      </Card>
    );
  }
  if (viewer === null) return null;

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-2xl text-ink">Account</h2>
        <Badge tone={viewer.isAnonymous ? "honey" : "forest"}>{viewer.isAnonymous ? "Guest" : "Member"}</Badge>
      </div>

      {viewer.isAnonymous ? (
        <>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Create an account to keep your search and email real landlords. Everything you have done as a
            guest stays exactly where it is, and you can sign back in from any device.
          </p>
          <CreateAccountForm />
        </>
      ) : (
        <dl className="mt-4">
          <dt className="text-sm text-ink-faint">Signed in as</dt>
          <dd className="mt-0.5 break-all text-base font-medium text-ink">{viewer.email ?? "Your account"}</dd>
        </dl>
      )}

      <p className="mt-6 text-sm text-ink-soft">
        Your search details and what landlords see about you live on the{" "}
        <Link to="/app/passport" className="font-medium text-forest underline-offset-2 hover:underline">
          Passport page
        </Link>
        .
      </p>

      <div className="mt-6 border-t border-line pt-6">
        <SignOut isGuest={viewer.isAnonymous} />
      </div>
    </Card>
  );
}
