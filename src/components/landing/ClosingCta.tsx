import { Button } from "@/components/ui";
import { LinkButton } from "./LinkButton";
import { KeyMark } from "./Motif";

export function ClosingCta({
  destination,
  isAuthenticated,
  startGuest,
  guestPending,
}: {
  destination: string;
  isAuthenticated: boolean;
  startGuest: () => void;
  guestPending: boolean;
}) {
  return (
    <section aria-labelledby="closing-title" className="relative isolate overflow-hidden bg-paper-deep">
      <div aria-hidden="true" className="paper-grain absolute inset-0 -z-10" />
      <div className="mx-auto grid grid-cols-1 w-full max-w-[calc(50vw+38rem)] gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:items-end">
        <div>
          <KeyMark className="h-10 w-24 text-forest" />
          <h2
            id="closing-title"
            className="mt-8 text-[2.5rem] leading-[1.05] text-ink sm:text-6xl"
          >
            Your next place is <em className="block text-clay">one link away.</em>
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
            Paste a listing and watch Nestor get to work. The guest tour runs on Nestor's demo
            landlord and never emails a real person.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 lg:flex-col lg:items-stretch">
          <LinkButton
            to={destination}
            variant="accent"
            size="lg"
          >
            Launch app
          </LinkButton>
          {!isAuthenticated && (
            <Button variant="secondary" size="lg" onClick={startGuest} loading={guestPending}>
              Try it as a guest
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
