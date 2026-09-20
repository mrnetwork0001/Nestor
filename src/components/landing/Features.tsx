import type { ReactNode } from "react";
import { PassportCard } from "@/components/passport/PassportCard";
import type { PassportFacts } from "@/components/passport/passportFacts";
import { cn } from "@/lib/cn";
import { FeeTableFragment, PipelineFragment, RewriteFragment } from "./fragments";
import { Eyebrow, FigCaption } from "./Motif";
import { STORY } from "./story";

const SAMPLE_PASSPORT: PassportFacts = {
  displayName: STORY.renter.name,
  headline: "Product designer relocating for work. Quiet, tidy, usually home by nine.",
  occupation: "Product designer",
  city: "Chicago",
  moveInDate: "2026-10-01",
  leaseTermMonths: 12,
  bedroomsMin: 1,
  occupants: 1,
  smoker: false,
  hasRentalHistory: true,
  pets: { hasPets: true, description: "One 30 lb beagle, house-trained" },
  creditBand: "good",
  incomeBand: "5k_8k",
  memberSince: Date.UTC(2026, 8, 1),
};

function Feature({
  role,
  title,
  children,
  fragment,
  className,
  tinted = false,
}: {
  role: string;
  title: string;
  children: ReactNode;
  fragment: ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-8 rounded-[1.5rem] border border-line p-6 sm:p-8",
        tinted ? "bg-paper-deep/60" : "bg-card",
        className,
      )}
    >
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-clay-deep">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-clay" />
          {role}
        </p>
        <h3 className="mt-3 text-2xl leading-snug text-ink sm:text-[1.75rem]">{title}</h3>
        <p className="mt-3 max-w-prose leading-relaxed text-ink-soft">{children}</p>
      </div>
      <div className="mt-auto">{fragment}</div>
    </article>
  );
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 pb-10 pt-20 sm:px-8 sm:pb-12 sm:pt-28">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>What you get</Eyebrow>
            <h2 id="features-title" className="mt-4 text-4xl leading-[1.08] text-ink sm:text-5xl">
              Four specialists, and a letter of introduction.
            </h2>
          </div>
          <p className="text-lg leading-relaxed text-ink-soft">
            Each part of Nestor has one job in your search. Together they cover the hunt from the
            first link to the last clause.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-12">
          <Feature
            role="The Scout"
            title="Every fee on the table before you ask."
            className="lg:col-span-7"
            fragment={<FeeTableFragment />}
          >
            It reads the listing so you don't have to, and points out what is worth negotiating.
            When a portal hides the landlord's address, the Scout searches the property's own site
            for one that is actually published, and shows you where it found it. It never guesses
            an email address.
          </Feature>

          <Feature
            role="The Negotiator"
            title="Emails that ask for the right thing."
            className="lg:col-span-5"
            tinted
            fragment={<RewriteFragment />}
          >
            Short, courteous, and built on facts from the listing. Every draft comes with its
            reasoning, and one sentence from you is enough to change its tone or its ask.
          </Feature>

          <Feature
            role="The live dashboard"
            title="Watch your search move."
            className="lg:col-span-5"
            tinted
            fragment={<PipelineFragment />}
          >
            Listings cross the board as landlords reply. Tour times, offers and open questions
            appear the moment they arrive, with no refresh, and one number tells you what needs
            you today.
          </Feature>

          <Feature
            role="The Renter Passport"
            title="One page a landlord can say yes to."
            className="lg:col-span-7"
            fragment={
              <figure>
                <PassportCard passport={SAMPLE_PASSPORT} compact nameAs="p" />
                <FigCaption label="Fig. 3">
                  The real Passport component with a fictional renter. Ranges, never documents; no
                  budget, no email address.
                </FigCaption>
              </figure>
            }
          >
            Move-in date, household, pets, and credit and income as ranges. Nestor links it in the
            first email, you see when it has been opened, and you can replace the link whenever
            you like.
          </Feature>
        </div>
      </div>
    </section>
  );
}
