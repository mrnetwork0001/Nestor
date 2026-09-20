import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { FlaskConical } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge, Button, Callout } from "@/components/ui";
import { toastError, useNow, type SystemStatus } from "@/components/listing/helpers";
import { STAGE_LABEL, STAGE_TONE } from "@/lib/format";
import { DraftCard } from "./DraftCard";
import { MessageCard } from "./MessageCard";
import { QuestionsCard, SteerBox } from "./RenterInput";
import { ThreadPulse } from "./ThreadPulse";
import { ThreadSummary } from "./ThreadSummary";
import { TourOptions } from "./TourOptions";

// An inbound email without analysis is only "being read" for a short while; older ones were simply never parsed.
const ANALYSIS_WINDOW_MS = 3 * 60 * 1000;

function CloseConversation({ thread }: { thread: Doc<"threads"> }) {
  const close = useMutation(api.threads.close);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);

  async function onClose() {
    if (closing) return;
    setClosing(true);
    try {
      await close({ threadId: thread._id });
      toast("Conversation closed. Nestor will not write here again.");
    } catch (error) {
      toastError(error);
    } finally {
      setClosing(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Close conversation
      </Button>
    );
  }
  return (
    <span className="inline-flex animate-rise items-center gap-1.5">
      <span className="text-xs text-ink-soft">Stop Nestor writing here?</span>
      <Button size="sm" variant="danger" onClick={onClose} loading={closing}>
        Yes, close it
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={closing}>
        Keep it
      </Button>
    </span>
  );
}

/**
 * The whole conversation for one listing: summary, the email thread, and the
 * things waiting on the renter. Everything comes from one reactive query, so
 * drafts, replies, parsed offers and tours appear on their own.
 */
export function Conversation({
  thread,
  messages,
  tours,
  status,
  autopilot,
}: {
  thread: Doc<"threads">;
  messages: Doc<"messages">[];
  tours: Doc<"tours">[];
  status: SystemStatus | undefined;
  autopilot: boolean;
}) {
  const markRead = useMutation(api.threads.markRead);
  const now = useNow(20_000);
  const brainLive = status?.openai === true;

  // Reading the page is reading the thread: clear the unread flag each time a reply lands while it is open.
  useEffect(() => {
    if (!thread.unread) return;
    markRead({ threadId: thread._id }).catch(() => {
      // Cosmetic only; the next visit clears it.
    });
  }, [thread.unread, thread._id, markRead]);

  const draft = messages.find((m) => m.status === "draft") ?? null;
  const exchanged = messages.filter((m) => m.status !== "draft");
  const over = thread.stage === "declined" || thread.stage === "closed";
  const hasProposedTours = tours.some((t) => t.status === "proposed" && t.startsAt > now - 3_600_000);
  const lastId = exchanged.length > 0 ? exchanged[exchanged.length - 1]._id : null;

  // Bring new arrivals into view, but only ones that land while the page is open.
  const tail = useRef<HTMLDivElement>(null);
  const seen = useRef<string | null>(null);
  const tailKey = `${lastId ?? "none"}:${draft?._id ?? "none"}:${thread.stage}`;
  useEffect(() => {
    if (seen.current !== null && seen.current !== tailKey) {
      tail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    seen.current = tailKey;
  }, [tailKey]);

  const landlordName = thread.landlordName ?? "The landlord";
  const canSteer = !over && draft === null && thread.stage !== "drafting" && thread.openQuestions.length === 0;

  return (
    <section aria-label={`Conversation with ${landlordName}`} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-moss">Conversation</p>
          <h2 className="text-2xl text-ink">{landlordName}</h2>
          <p className="break-all text-xs text-ink-faint">{thread.landlordEmail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {thread.isSimulated && (
            <Badge tone="honey">
              <FlaskConical className="size-3" aria-hidden="true" />
              Demo landlord
            </Badge>
          )}
          <span key={thread.stage} className="inline-flex animate-rise">
            <Badge
              tone={STAGE_TONE[thread.stage]}
              dot
              pulse={thread.stage === "drafting" || thread.stage === "awaiting_reply"}
            >
              {STAGE_LABEL[thread.stage]}
            </Badge>
          </span>
          {autopilot && !over && <Badge tone="clay">Autopilot on</Badge>}
        </div>
      </header>

      {thread.isSimulated && (
        <Callout tone="honey" icon={<FlaskConical className="size-4" />}>
          Nestor plays this landlord so you can see the whole flow.{" "}
          {status?.inboxReady
            ? "Emails marked AgentMail really travel between two of Nestor's own inboxes."
            : "These emails stay inside Nestor and reach nobody."}{" "}
          The drafting and the reading of replies work exactly as they do with a real landlord.
        </Callout>
      )}

      <ThreadSummary thread={thread} messages={messages} />

      {exchanged.length > 0 && (
        <ol className="space-y-3" aria-label="Emails, oldest first">
          {exchanged.map((message) => (
            <MessageCard
              key={message._id}
              message={message}
              landlordName={landlordName}
              rentAsked={thread.rentAsked}
              brainLive={brainLive}
              analysisExpected={
                message._id === lastId &&
                message.direction === "inbound" &&
                now - message._creationTime < ANALYSIS_WINDOW_MS
              }
            />
          ))}
        </ol>
      )}

      {!over && thread.openQuestions.length > 0 && <QuestionsCard thread={thread} autopilot={autopilot} />}
      <TourOptions tours={tours} stage={thread.stage} now={now} />
      {draft !== null && !over && <DraftCard key={draft._id} message={draft} thread={thread} brainLive={brainLive} />}

      <ThreadPulse thread={thread} messages={messages} status={status} hasProposedTours={hasProposedTours} />

      {!over && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canSteer ? <SteerBox thread={thread} autopilot={autopilot} /> : <span />}
          <CloseConversation thread={thread} />
        </div>
      )}
      <div ref={tail} aria-hidden="true" />
    </section>
  );
}
