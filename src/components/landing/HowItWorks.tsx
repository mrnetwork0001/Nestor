import type { ReactNode } from "react";
import {
  DraftFragment,
  LeaseFlagFragment,
  TourChoiceFragment,
  UrlBarFragment,
} from "./fragments";
import { Eyebrow, Numeral, RooflineRule } from "./Motif";

const STEPS: ReadonlyArray<{ title: string; body: string; fragment: ReactNode }> = [
  {
    title: "Paste a listing",
    body: "Drop in a link from Zumper, PadMapper, Apartment List or Redfin. The Scout reads the page into rent, fees, pet policy and move-in date, then scores it against what you told Nestor. No link handy? Ask it to find a few, or load the sample listings.",
    fragment: <UrlBarFragment />,
  },
  {
    title: "Nestor emails the landlord",
    body: "The Negotiator writes the inquiry and shows you its reasoning. Approve it, edit it, or tell it what to say instead. It goes out from Nestor's own inbox with a link to your Renter Passport, so the landlord's first questions are already answered.",
    fragment: <DraftFragment compact className="shadow-card" />,
  },
  {
    title: "Replies become tours and offers",
    body: "When the landlord answers, Nestor reads the email into tour times, rent offers, concessions and questions, and your dashboard updates while you watch. Choose a tour time and the confirmation is drafted for you.",
    fragment: <TourChoiceFragment />,
  },
  {
    title: "Check the lease before you sign",
    body: "Upload the PDF. Nestor quotes the clauses that deserve a second look, explains each one in plain language, and hands you the sentence to send back.",
    fragment: <LeaseFlagFragment compact />,
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 border-t border-line bg-card">
      <div className="mx-auto grid grid-cols-1 w-full max-w-[calc(50vw+38rem)] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-title" className="mt-4 text-4xl leading-[1.08] text-ink sm:text-5xl">
            From a link to a lease you understand.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
            Four steps. You make the decisions; Nestor does the reading, the writing and the
            waiting.
          </p>
          <RooflineRule className="mt-10 hidden max-w-xs lg:flex" />
        </div>

        <ol className="divide-y divide-line-strong border-y border-line-strong">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="grid grid-cols-1 gap-x-8 gap-y-5 py-10 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:py-12"
            >
              <Numeral n={index + 1} className="sm:pt-1" />
              <div>
                <h3 className="text-2xl leading-snug text-ink sm:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">{step.body}</p>
                <div className="mt-6 max-w-lg">{step.fragment}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
