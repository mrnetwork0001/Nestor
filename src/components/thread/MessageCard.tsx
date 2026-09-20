import { Fragment, useState, type ReactNode } from "react";
import { ChevronDown, FlaskConical, Mail } from "@/components/icons";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge, Callout, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";
import { AnalysisPanel, AnalysisPending } from "./AnalysisPanel";
import { DeliveryDetails } from "./DeliveryDetails";

type Message = Doc<"messages">;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase() || "?";
}

/**
 * Turns web addresses in Nestor's own emails (the Passport link) into links.
 * Landlord emails are untrusted, so inbound bodies are always rendered as plain text.
 */
function linkify(text: string): ReactNode {
  const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all font-medium text-forest underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/** How the message travelled. "agentmail" is real email; "simulated" never left Nestor. */
export function ChannelBadge({ message }: { message: Message }) {
  if (message.channel === "agentmail") {
    return (
      <Badge tone="forest">
        <Mail className="size-3" aria-hidden="true" />
        {message.direction === "outbound" ? "Sent via AgentMail" : "Received via AgentMail"}
      </Badge>
    );
  }
  return (
    <Badge tone="honey">
      <FlaskConical className="size-3" aria-hidden="true" />
      Demo landlord, stayed inside Nestor
    </Badge>
  );
}

function Rationale({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-forest/10 px-4 py-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-moss hover:text-forest"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
        Why Nestor wrote this
      </button>
      {open && <p className="mt-1.5 animate-rise pb-1 text-sm leading-relaxed text-ink-soft">{text}</p>}
    </div>
  );
}

/** One email in the conversation. Outbound is Nestor writing for the renter; inbound is the landlord. */
export function MessageCard({
  message,
  landlordName,
  rentAsked,
  brainLive,
  analysisExpected,
}: {
  message: Message;
  landlordName: string;
  rentAsked: number | undefined;
  brainLive: boolean;
  /** True while a fresh inbound email has no analysis yet. */
  analysisExpected: boolean;
}) {
  const outbound = message.direction === "outbound";
  const when = message.sentAt ?? message._creationTime;

  return (
    <li className={cn("flex animate-rise", outbound ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "w-full overflow-hidden rounded-card border shadow-card sm:w-[94%]",
          outbound ? "border-forest/15 bg-forest-soft/45" : "border-line border-l-4 border-l-clay bg-card",
        )}
      >
        <header className="flex items-start gap-3 px-4 pt-3.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              outbound ? "bg-forest text-paper" : "bg-clay-soft text-clay-deep",
            )}
            aria-hidden="true"
          >
            {outbound ? "N" : initials(landlordName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-sm font-semibold text-ink">
                {outbound ? "Nestor, on your behalf" : landlordName}
              </p>
              <time dateTime={new Date(when).toISOString()} className="text-xs text-ink-faint">
                {dateTime(when)}
              </time>
            </div>
            <p className="truncate text-xs text-ink-faint">
              {outbound ? `To ${message.toAddress}` : `From ${message.fromAddress}`}
            </p>
          </div>
        </header>

        <div className="px-4 pb-3.5 pt-2.5">
          <p className="text-sm font-semibold text-ink">{message.subject}</p>
          <div className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
            {outbound ? linkify(message.body) : message.body}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {message.status === "queued" ? (
              <Badge tone="sky">
                <Spinner className="size-3 text-sky" />
                Sending
              </Badge>
            ) : message.status === "failed" ? (
              <Badge tone="clay">Not sent</Badge>
            ) : (
              <ChannelBadge message={message} />
            )}
          </div>
          {/* Only a message that actually went or arrived has a delivery record to show. */}
          {(message.status === "sent" || message.status === "received") && (
            <DeliveryDetails message={message} className="mt-2" />
          )}
          {message.status === "failed" && (
            <Callout tone="clay" className="mt-3">
              {message.error ?? "This email could not be sent."}
            </Callout>
          )}
        </div>

        {outbound && message.rationale && message.status !== "failed" && <Rationale text={message.rationale} />}
        {!outbound &&
          (message.analysis ? (
            <AnalysisPanel analysis={message.analysis} rentAsked={rentAsked} brainLive={brainLive} />
          ) : (
            analysisExpected && <AnalysisPending brainLive={brainLive} />
          ))}
      </article>
    </li>
  );
}
