import { useEffect, useId, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { useParams } from "react-router";
import { Check, ChevronDown, Copy } from "@/components/icons";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { copyText } from "@/components/lease/leaseHelpers";
import { cn } from "@/lib/cn";

type Message = Doc<"messages">;

/** To the second and with the zone: this is a record to check against AgentMail, not a friendly date. */
function toTheSecond(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

function channelInWords(message: Message): string {
  if (message.channel !== "agentmail") return "Stayed inside Nestor, no email was sent";
  // The row does not record whether the webhook or the local poller carried an inbound email in, so this claims neither.
  return message.direction === "outbound"
    ? "Sent over email with AgentMail"
    : "Received over email, in Nestor's AgentMail inbox";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 text-ink-soft">{children}</dd>
    </div>
  );
}

/** An id shown whole to a screen reader and on hover, cut short on screen, and copied whole. */
function CopyableId({ value, what }: { value: string; what: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <code title={value} className="min-w-0 truncate font-mono text-[0.6875rem] text-ink">
        {value}
      </code>
      <button
        type="button"
        onClick={() => void copyText(value).then(setCopied)}
        aria-label={`Copy the ${what}`}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded px-1 py-0.5 font-medium text-moss hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </span>
  );
}

/**
 * The AgentMail thread id lives on the thread, not on the message. The listing page already holds
 * this exact subscription, so Convex shares it, and it is only asked for once a record is opened.
 */
function ThreadFacts({ message }: { message: Message }) {
  const { listingId } = useParams();
  const conversation = useQuery(
    api.threads.forListing,
    listingId ? { listingId: listingId as Id<"listings"> } : "skip",
  );
  const thread = conversation?.thread;
  if (!thread || thread._id !== message.threadId) return null;

  return (
    <>
      {thread.agentmailThreadId && (
        <Row label="AgentMail thread">
          <CopyableId value={thread.agentmailThreadId} what="AgentMail thread id" />
        </Row>
      )}
      {thread.isSimulated && (
        <Row label="Other side">
          Nestor's demo landlord, a second AgentMail inbox that Nestor runs. The emails are real, the landlord is not.
        </Row>
      )}
    </>
  );
}

/**
 * The delivery record behind a message's channel badge: enough for anyone to find this exact email
 * in AgentMail. One quiet line until opened, so the conversation still reads as a conversation.
 */
export function DeliveryDetails({ message, className }: { message: Message; className?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const viaEmail = message.channel === "agentmail";
  const outbound = message.direction === "outbound";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex cursor-pointer items-center gap-1 rounded text-xs font-medium text-ink-faint hover:text-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
        Delivery details
      </button>
      <div id={panelId} hidden={!open}>
        {open && (
          <dl className="mt-2 animate-rise space-y-1.5 rounded-lg border border-line bg-paper/70 px-3 py-2.5 text-xs leading-relaxed">
            <Row label="Channel">{channelInWords(message)}</Row>
            {viaEmail ? (
              <>
                <Row label="AgentMail message">
                  {message.agentmailMessageId ? (
                    <CopyableId value={message.agentmailMessageId} what="AgentMail message id" />
                  ) : (
                    "No id was recorded for this email"
                  )}
                </Row>
                <ThreadFacts message={message} />
              </>
            ) : (
              <Row label="Email">
                No email was sent for this message, so there is no AgentMail id to check. It was written and read
                inside Nestor.
              </Row>
            )}
            <Row label="From">
              <span className="break-all">{message.fromAddress}</span>
            </Row>
            <Row label="To">
              <span className="break-all">{message.toAddress}</span>
            </Row>
            <Row label={viaEmail ? (outbound ? "Sent" : "Received") : "Written"}>
              <time dateTime={new Date(message.sentAt ?? message._creationTime).toISOString()}>
                {toTheSecond(message.sentAt ?? message._creationTime)}
              </time>
            </Row>
          </dl>
        )}
      </div>
    </div>
  );
}
