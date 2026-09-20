import { KeyMark } from "./Motif";

/*
 * An agent that sends email in your name has to say exactly where its limits
 * are. Each line maps to a rule in convex/lib/negotiationPolicy.ts: a check in
 * code where one is possible (disclosure, budget, commitments, the email cap),
 * a standing instruction to the model where it is not. Keep the two in step.
 */

const COMMITMENTS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "You approve every email.",
    body: "Each draft waits for your OK, with the Negotiator's reasoning beside it. Autopilot exists, and it stays off until you switch it on.",
  },
  {
    title: "It always says what it is.",
    body: "Every email opens by saying Nestor is an AI assistant writing on your behalf. Delete that line from a draft and Nestor puts it back.",
  },
  {
    title: "It never bluffs.",
    body: "No invented competing offers, no made-up deadlines, and never your maximum budget. It will not agree to sign, pay, or share an SSN or bank details.",
  },
  {
    title: "Your Passport shows ranges, never documents.",
    body: "Credit and income appear as bands you chose. No budget, no email address, no paperwork. Replace the link and the old one stops working at once.",
  },
];

const SMALL_PRINT = [
  "Nestor never guesses a landlord's email address. It uses one that is published, or one you type in.",
  "A landlord's reply is read as information, never as instructions to follow.",
  "It stops after eight emails in one conversation and hands the thread back to you.",
];

export function Trust() {
  return (
    <section aria-labelledby="trust-title" className="bg-forest text-paper">
      <div className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-paper/70">
              House rules
            </p>
            <h2 id="trust-title" className="mt-4 text-4xl leading-[1.08] sm:text-5xl">
              It writes in your name, so it plays by your rules.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-paper/80">
              These are not settings. They are how Nestor is built.
            </p>
            <KeyMark className="mt-10 hidden h-10 w-24 text-paper/40 lg:block" />
          </div>

          <div>
            <ol className="divide-y divide-paper/20 border-y border-paper/20">
              {COMMITMENTS.map((commitment, index) => (
                <li key={commitment.title} className="grid grid-cols-1 gap-x-8 gap-y-2 py-8 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
                  <span aria-hidden="true" className="font-display text-4xl leading-none text-paper/50 tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-2xl leading-snug">{commitment.title}</h3>
                    <p className="mt-2 max-w-xl leading-relaxed text-paper/80">{commitment.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 text-sm leading-relaxed text-paper/75 sm:grid-cols-3">
              {SMALL_PRINT.map((line) => (
                <li key={line} className="border-l border-paper/25 pl-4">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
