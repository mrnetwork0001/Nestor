import type { CSSProperties } from "react";
import { ArrowDown, Check } from "lucide-react";
import { Button } from "@/components/ui";
import { DraftFragment, FeedFragment, ListingFragment, ReplyFragment } from "./fragments";
import { LinkButton } from "./LinkButton";
import { linkButtonClass } from "./linkButtonClass";
import { Eyebrow, FigCaption } from "./Motif";

const delay = (seconds: number): CSSProperties => ({ animationDelay: `${seconds}s` });

const ASSURANCES = [
  "You approve every email",
  "It always says it is an AI assistant",
  "Your budget is never shared",
];

/*
 * The vignette is the product itself, laid out like papers on a desk: the
 * listing the Scout read, the draft waiting for an OK, the reply Nestor parsed,
 * and the feed ticking beside them. Cards rise in once; the feed keeps going.
 */
function HeroVignette() {
  return (
    <figure className="relative isolate mx-auto w-full max-w-xl lg:mx-0 lg:w-auto lg:max-w-none xl:-mr-6">
      <div
        aria-hidden="true"
        className="absolute -inset-x-3 bottom-10 top-8 -z-10 rounded-[2rem] border border-line bg-paper-deep/70 sm:-inset-x-5"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] sm:gap-5">
        {/* On phones the column wrappers dissolve so the cards can follow the story's order. */}
        <div className="contents sm:flex sm:flex-col">
          <ListingFragment tucked className="animate-rise order-1 sm:-rotate-2" style={delay(0.05)} />
          <DraftFragment
            className="animate-rise relative z-10 order-2 sm:-mt-6 sm:ml-3 sm:rotate-1"
            style={delay(0.35)}
          />
        </div>
        <div className="contents sm:flex sm:flex-col sm:pt-12">
          <FeedFragment className="animate-rise order-4 sm:rotate-1" style={delay(0.2)} />
          <ReplyFragment
            chipsAt={1}
            className="animate-rise relative z-10 order-3 sm:-ml-4 sm:-mt-4 sm:-rotate-1"
            style={delay(0.5)}
          />
        </div>
      </div>
      <FigCaption label="Fig. 1">
        Nestor's own interface, telling one story. Maya, Dana and Maple Court are fictional.
      </FigCaption>
    </figure>
  );
}

export function Hero({
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
    <section aria-labelledby="hero-title" className="relative isolate overflow-x-clip">
      <div
        aria-hidden="true"
        className="paper-grain absolute inset-0 -z-20 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <div className="mx-auto grid grid-cols-1 w-full max-w-[calc(50vw+38rem)] gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12 lg:pb-28 lg:pt-20">
        <div className="lg:pt-6">
          <Eyebrow className="animate-rise">Your apartment-hunting concierge</Eyebrow>
          <h1
            id="hero-title"
            className="animate-rise mt-5 text-[2.4rem] leading-[1.04] text-ink min-[400px]:text-[2.75rem] sm:text-6xl lg:text-[3.4rem] xl:text-[4.25rem]"
            style={delay(0.05)}
          >
            Get the keys.{" "}
            <em className="block text-clay">
              Skip the <span className="whitespace-nowrap">back-and-forth.</span>
            </em>
          </h1>
          <p
            className="animate-rise mt-6 max-w-xl text-lg leading-relaxed text-ink-soft"
            style={delay(0.12)}
          >
            Paste a listing. Nestor emails the landlord from its own inbox, negotiates the rent and
            fees you care about, lines up the tour, and reads the lease before you sign.
          </p>

          <div className="animate-rise mt-8 flex flex-wrap items-center gap-3" style={delay(0.2)}>
            <LinkButton
              to={destination}
              variant="accent"
              size="lg"
            >
              Launch app
            </LinkButton>
            {isAuthenticated ? (
              <a href="#how" className={linkButtonClass("secondary", "lg")}>
                See how it works
                <ArrowDown className="size-4" aria-hidden="true" />
              </a>
            ) : (
              <Button variant="secondary" size="lg" onClick={startGuest} loading={guestPending}>
                Try it as a guest
              </Button>
            )}
          </div>
          {!isAuthenticated && (
            <p className="animate-rise mt-3 max-w-md text-sm leading-relaxed text-ink-faint" style={delay(0.25)}>
              No sign-up for the guest tour. Guests get the whole flow with Nestor's demo landlord;
              emailing real landlords takes a free account.
            </p>
          )}

          <ul
            className="animate-rise mt-10 flex flex-col gap-2.5 border-t border-line-strong pt-6 text-sm text-ink-soft sm:flex-row sm:flex-wrap sm:gap-x-6"
            style={delay(0.3)}
          >
            {ASSURANCES.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-forest" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <HeroVignette />
      </div>
    </section>
  );
}
