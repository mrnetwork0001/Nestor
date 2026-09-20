import { ArrowRight } from "@/components/icons";
import { Badge } from "@/components/ui";
import { money } from "@/lib/format";
import { Eyebrow, FigCaption } from "./Motif";
import { STORY } from "./story";

/*
 * The before and after of one negotiation, set like a ledger page. It keeps a
 * row the landlord refused to move on, because that is what a real negotiation
 * looks like and the page should not promise otherwise.
 */

const { listing } = STORY;
const monthlySaving = listing.rentAsked - listing.rentAgreed;
const petFee = 350;
const firstYear = monthlySaving * 12 + petFee;

const ROWS: ReadonlyArray<{
  item: string;
  listed: string;
  agreed: string;
  outcome: "won" | "held";
  note: string;
}> = [
  {
    item: "Monthly rent",
    listed: money(listing.rentAsked),
    agreed: money(listing.rentAgreed),
    outcome: "won",
    note: `${money(monthlySaving)} off on a 12-month lease`,
  },
  { item: "Pet fee", listed: money(petFee), agreed: "Waived", outcome: "won", note: "One beagle, one ask" },
  {
    item: "Security deposit",
    listed: money(listing.deposit),
    agreed: money(listing.deposit),
    outcome: "held",
    note: "The landlord held firm",
  },
];

export function NegotiationLedger() {
  return (
    <section aria-labelledby="ledger-title" className="border-t border-line bg-paper-deep/50">
      <figure className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-16">
          <div>
            <Eyebrow>Before and after</Eyebrow>
            <h2 id="ledger-title" className="mt-4 text-4xl leading-[1.08] text-ink sm:text-5xl">
              Two polite emails. A better deal than the listing.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
              The Negotiator asks for at most two things, picked from the goals you set, and backs
              each with a fact from the listing. It never invents a competing offer and never
              mentions your budget.
            </p>
            <p className="mt-8 flex items-baseline gap-3 border-t border-line-strong pt-6">
              <span className="font-display text-6xl leading-none tracking-tight text-forest tabular-nums sm:text-7xl">
                {money(firstYear)}
              </span>
              <span className="max-w-[14rem] text-sm leading-snug text-ink-soft">
                kept in the first year of this example: {money(monthlySaving)} a month, plus the pet
                fee.
              </span>
            </p>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-card shadow-card">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Terms of the example rental as listed, and after Nestor negotiated by email.
              </caption>
              <thead>
                <tr className="border-b border-line bg-paper-deep/50 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-6">
                    Term
                  </th>
                  <th scope="col" className="px-2 py-3 font-semibold">
                    As listed
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-6">
                    After Nestor asked
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ROWS.map((row) => (
                  <tr key={row.item}>
                    <th scope="row" className="px-4 py-4 align-top font-medium text-ink sm:px-6">
                      {row.item}
                    </th>
                    <td className="px-2 py-4 align-top tabular-nums">
                      <span className={row.outcome === "won" ? "text-ink-faint line-through" : "text-ink-soft"}>
                        {row.listed}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top sm:px-6">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <ArrowRight className="hidden size-3.5 text-ink-faint sm:block" aria-hidden="true" />
                        <span
                          className={
                            row.outcome === "won"
                              ? "font-display text-xl leading-none text-forest-deep tabular-nums"
                              : "tabular-nums text-ink-soft"
                          }
                        >
                          {row.agreed}
                        </span>
                        <Badge tone={row.outcome === "won" ? "forest" : "neutral"}>
                          {row.outcome === "won" ? "Won" : "No change"}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-ink-faint">{row.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-forest-soft text-forest-deep">
                  <th scope="row" className="px-4 py-3 font-medium sm:px-6">
                    Tour
                  </th>
                  <td className="px-2 py-3 text-forest-deep/70">Not arranged</td>
                  <td className="px-4 py-3 font-medium sm:px-6">Saturday, 11:00 AM</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        <FigCaption label="Fig. 2">
          An illustration, not a promise. Real landlords answer for themselves, and some say no.
        </FigCaption>
      </figure>
    </section>
  );
}
