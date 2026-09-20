import type { ReactNode } from "react";
import { CalendarClock, Check, MessageCircleQuestionMark, Tag } from "@/components/icons";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge, Spinner, type Tone } from "@/components/ui";
import { money } from "@/lib/format";

type Analysis = NonNullable<Doc<"messages">["analysis"]>;

const INTENT: Record<Analysis["intent"], { label: string; tone: Tone }> = {
  tour_offer: { label: "Offers a tour", tone: "forest" },
  counter_offer: { label: "Counter-offer", tone: "clay" },
  acceptance: { label: "Says yes", tone: "forest" },
  question: { label: "Asks a question", tone: "honey" },
  rejection: { label: "No longer available", tone: "neutral" },
  other: { label: "General reply", tone: "neutral" },
};

const SENTIMENT: Record<Analysis["sentiment"], string> = {
  positive: "Warm tone",
  neutral: "Neutral tone",
  negative: "Cool tone",
};

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex animate-rise items-start gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 text-xs font-medium leading-snug text-ink">
      <span className="mt-px shrink-0 text-forest" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Shown on an inbound email while the Negotiator is still parsing it. */
export function AnalysisPending(_props: { brainLive?: boolean }) {
  // Who ends up reading it is not known yet (OpenAI can fail over to pattern matching), so no reader is named here.
  return (
    <div className="flex animate-rise items-center gap-2.5 border-t border-line bg-paper-deep/50 px-4 py-3 text-sm text-ink-soft">
      <Spinner className="size-4" />
      Reading this reply for tour times, offers and questions
    </div>
  );
}

/**
 * Says who read the email, from what was recorded on this one result. Rows
 * saved before the reader was recorded get a neutral label, never a claim.
 */
function ReaderBadge({ analysis }: { analysis: Analysis }) {
  if (analysis.source === "openai") {
    return <Badge tone="sky">{analysis.model ? `Read by OpenAI (${analysis.model})` : "Read by OpenAI"}</Badge>;
  }
  if (analysis.source === "rules") return <Badge tone="honey">Read by pattern matching</Badge>;
  return <Badge>Reader not recorded</Badge>;
}

/**
 * What the Negotiator understood from one landlord email: the structured
 * output that drives the tours, the offer tracking and the next draft.
 */
export function AnalysisPanel({
  analysis,
  rentAsked,
}: {
  analysis: Analysis;
  rentAsked: number | undefined;
  // Still passed by the message card, but unused: a key being set says nothing about who read this email.
  brainLive?: boolean;
}) {
  const intent = INTENT[analysis.intent];
  const under =
    analysis.rentOffered !== undefined && rentAsked !== undefined && analysis.rentOffered < rentAsked
      ? rentAsked - analysis.rentOffered
      : 0;
  const hasFacts =
    analysis.rentOffered !== undefined ||
    analysis.concessions.length > 0 ||
    analysis.tourSlots.length > 0 ||
    analysis.questionsForRenter.length > 0;

  return (
    <div className="animate-rise border-t border-line bg-paper-deep/50 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="mr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          What Nestor understood
        </p>
        <Badge tone={intent.tone}>{intent.label}</Badge>
        <Badge>{SENTIMENT[analysis.sentiment]}</Badge>
        <ReaderBadge analysis={analysis} />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{analysis.summary}</p>

      {hasFacts && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {analysis.rentOffered !== undefined && (
            <Fact icon={<Tag className="size-3.5" />}>
              {/* A landlord who holds the rent restates the asking price; calling that an offer would read as a win. */}
              {rentAsked !== undefined && analysis.rentOffered === rentAsked
                ? `Rent stays at ${money(analysis.rentOffered)} a month`
                : `${money(analysis.rentOffered)} a month offered`}
              {under > 0 && <span className="text-forest">, {money(under)} under asking</span>}
            </Fact>
          )}
          {analysis.concessions.map((concession) => (
            <Fact key={concession} icon={<Check className="size-3.5" />}>
              {concession}
            </Fact>
          ))}
          {analysis.tourSlots.map((slot) => (
            <Fact key={slot.startsAt} icon={<CalendarClock className="size-3.5" />}>
              Tour: {slot.label}
            </Fact>
          ))}
          {analysis.questionsForRenter.map((question) => (
            <Fact key={question} icon={<MessageCircleQuestionMark className="size-3.5" />}>
              {question}
            </Fact>
          ))}
        </ul>
      )}
    </div>
  );
}
