import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { KeyRound, Printer } from "lucide-react";
import { Link, useParams } from "react-router";
import { api } from "../../convex/_generated/api";
import { Logo } from "@/components/Logo";
import { RooflineRule } from "@/components/landing/Motif";
import { useDocumentTitle } from "@/components/landing/useDocumentTitle";
import { PassportCard } from "@/components/passport/PassportCard";
import { firstNameOf } from "@/components/passport/passportFacts";
import { Button, Skeleton } from "@/components/ui";

/*
 * What a landlord sees when they follow the link in Nestor's first email.
 * Public and unauthenticated: the unguessable token in the URL is the key.
 */

function PassportSkeleton() {
  return (
    <div className="rounded-card border border-line bg-card p-6 shadow-card sm:p-8" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-5 lg:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="mt-8 h-20" />
    </div>
  );
}

function PassportNotFound() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center sm:py-16">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-paper-deep text-ink-faint">
        <KeyRound className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-6 text-3xl leading-tight text-ink">This Passport link is no longer active.</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Renters can replace their Passport link whenever they like, and the old one stops working
        straight away. If you are a landlord or leasing agent, reply to the email you received and
        ask for the current link.
      </p>
      <RooflineRule className="mx-auto mt-8 max-w-xs" />
      <p className="mt-6 text-sm text-ink-soft">
        Looking for a place yourself?{" "}
        <Link to="/" className="font-medium text-forest underline underline-offset-4 hover:text-forest-deep">
          See what Nestor does
        </Link>
      </p>
    </div>
  );
}

export function PublicPassport() {
  const { token = "" } = useParams();
  const passport = useQuery(api.renters.passport, { token });
  const recordView = useMutation(api.renters.recordPassportView);

  const name = passport ? passport.displayName : null;
  useDocumentTitle(
    name ? `${name} · Renter Passport · Nestor` : passport === null ? "Passport not found · Nestor" : "Renter Passport · Nestor",
  );

  // Once per visit, and only for a Passport that exists. The ref survives
  // StrictMode's double effect, so dev does not count every open twice.
  const counted = useRef<string | null>(null);
  const exists = passport !== undefined && passport !== null;
  useEffect(() => {
    if (!exists || counted.current === token) return;
    counted.current = token;
    // The mutation never throws at a landlord; a network failure is not their problem either.
    recordView({ token }).catch(() => undefined);
  }, [exists, token, recordView]);

  return (
    <div className="paper-grain min-h-dvh print:bg-none">
      {/* A shared renter profile has no business in a search index. */}
      <meta name="robots" content="noindex, nofollow" />

      <header className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8 print:hidden">
        <Logo />
        {exists && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.print()}
            icon={<Printer className="size-4" aria-hidden="true" />}
          >
            Print or save
          </Button>
        )}
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-16 sm:px-8 print:max-w-none print:p-0">
        {passport === undefined && (
          <div role="status" aria-label="Loading the Renter Passport">
            <PassportSkeleton />
          </div>
        )}
        {passport === null && <PassportNotFound />}
        {passport && (
          <div className="animate-rise">
            <PassportCard passport={passport} nameAs="h1" wide />

            <section className="mt-6 grid grid-cols-1 gap-5 text-sm leading-relaxed text-ink-soft sm:grid-cols-2 print:mt-4 print:text-xs">
              <div>
                <h2 className="text-base text-ink">Why you are seeing this</h2>
                <p className="mt-1">
                  {firstNameOf(passport.displayName)} uses Nestor, an AI assistant, to contact
                  landlords about rentals. Nestor writes the emails and says so in every one;{" "}
                  {firstNameOf(passport.displayName)} reads the whole conversation and makes every
                  decision.
                </p>
              </div>
              <div>
                <h2 className="text-base text-ink">What Nestor will never do</h2>
                <p className="mt-1">
                  It will not sign, pay, or agree to terms on anyone's behalf, and it will not invent
                  offers or deadlines. To move forward, simply reply to the email you received.
                </p>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
