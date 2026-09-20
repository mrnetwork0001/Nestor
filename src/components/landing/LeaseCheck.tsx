import { Check } from "lucide-react";
import { LeaseFlagFragment } from "./fragments";
import { LinkButton } from "./LinkButton";
import { FigCaption } from "./Motif";

const POINTS = [
  "Quotes the clause word for word, so you can find it in your copy.",
  "Explains why it matters in plain language, and says when the rule varies by state.",
  "Writes the sentence to send back, ready to copy.",
];

export function LeaseCheck({ destination }: { destination: string }) {
  return (
    <section id="lease" aria-labelledby="lease-title" className="scroll-mt-20">
      <div className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-12">
        <div className="grid grid-cols-1 gap-10 rounded-[1.5rem] border border-line bg-card p-6 sm:p-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:p-14">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-clay-deep">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-clay" />
              The lease check
            </p>
            <h2 id="lease-title" className="mt-4 text-4xl leading-[1.08] text-ink sm:text-5xl">
              Read the fine print before it reads you.
            </h2>
            <p className="mt-5 leading-relaxed text-ink-soft">
              Upload the lease as a PDF and Nestor goes through it clause by clause: hidden and
              recurring fees, deposit terms, entry and privacy, repairs pushed onto you,
              auto-renewal traps, early-termination penalties, waived rights and forced
              arbitration.
            </p>
            <ul className="mt-6 space-y-3">
              {POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-ink-soft">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <LinkButton to={destination}>
                Try it on the sample lease
              </LinkButton>
              <p className="text-sm text-ink-faint">PDFs up to 15 MB.</p>
            </div>
            <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-faint">
              Nestor is not a lawyer and a lease check is not legal advice. Every review says so.
            </p>
          </div>

          <figure className="lg:pt-2">
            <LeaseFlagFragment />
            <FigCaption label="Fig. 4">
              One flag from the review of Nestor's bundled sample lease, word for word.
            </FigCaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
