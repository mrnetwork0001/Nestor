import type { ReactNode } from "react";
import { Hourglass, Mail, PenLine } from "lucide-react";
import { Link } from "react-router";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Callout } from "@/components/ui";
import { firstName, type SystemStatus } from "@/components/listing/helpers";
import { cn } from "@/lib/cn";

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-current animate-pulse-dot"
          style={{ animationDelay: `${i * 0.22}s` }}
        />
      ))}
    </span>
  );
}

function Pulse({ icon, tone, title, children }: { icon: ReactNode; tone: string; title: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className={cn("flex animate-rise items-start gap-3 rounded-card border px-4 py-3.5", tone)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{children}</p>
      </div>
    </div>
  );
}

/**
 * The line at the foot of the conversation that says what is happening right
 * now and who is doing it, so waiting never looks like nothing.
 */
export function ThreadPulse({
  thread,
  messages,
  status,
  hasProposedTours,
}: {
  thread: Doc<"threads">;
  messages: Doc<"messages">[];
  status: SystemStatus | undefined;
  hasProposedTours: boolean;
}) {
  const who = firstName(thread.landlordName, "the landlord");
  const sending = messages.some((m) => m.status === "queued");

  if (sending) {
    const realMail = !thread.isSimulated || status?.inboxReady === true;
    return (
      <Pulse
        tone="border-sky/20 bg-sky-soft text-sky"
        icon={<Mail className="size-4" />}
        title={
          <>
            Sending <TypingDots />
          </>
        }
      >
        {realMail
          ? "AgentMail is delivering the email from Nestor's own inbox."
          : "Handing the email to the demo landlord inside Nestor."}
      </Pulse>
    );
  }

  switch (thread.stage) {
    case "drafting":
      return (
        <Pulse
          tone="border-forest/20 bg-forest-soft text-forest-deep"
          icon={<PenLine className="size-4" />}
          title={
            <>
              The Negotiator is writing <TypingDots />
            </>
          }
        >
          {status?.openai === false
            ? "OpenAI is not connected here, so this will be a labelled template draft."
            : "OpenAI is drafting from your Passport facts, this listing and the conversation so far. It usually takes 5 to 20 seconds."}
        </Pulse>
      );

    case "awaiting_reply":
      return (
        <Pulse
          tone="border-sky/20 bg-sky-soft text-sky"
          icon={<Hourglass className="size-4" />}
          title={
            <>
              Waiting for {who} <TypingDots />
            </>
          }
        >
          {thread.isSimulated
            ? "The demo landlord usually answers within ten seconds. The reply lands here and gets parsed on its own."
            : status?.inboundMode === "webhook"
              ? "AgentMail notifies Nestor the moment a reply arrives. It is parsed and shown here without a refresh."
              : status?.inboundMode === "polling"
                ? "Nestor checks its AgentMail inbox every 20 seconds. A reply is parsed and shown here without a refresh."
                : "A reply is parsed and shown here as soon as it reaches Nestor's inbox."}
        </Pulse>
      );

    case "negotiating":
      if (thread.openQuestions.length > 0 || hasProposedTours) return null;
      return (
        <p className="text-sm text-ink-soft">
          The ball is in your court. Tell Nestor what to say next, or leave it here for now.
        </p>
      );

    case "terms_agreed":
      return (
        <Callout tone="forest" title="Terms agreed">
          Nothing is signed and Nestor never signs for you. When the lease arrives,{" "}
          <Link to={`/app/lease?listing=${thread.listingId}`} className="font-semibold underline underline-offset-2">
            run it through the lease check
          </Link>{" "}
          before you commit.
        </Callout>
      );

    case "declined":
      return (
        <Callout tone="neutral" title="This one is off the table">
          {firstName(thread.landlordName, "The landlord")} said the home is no longer available. Nestor has stopped
          writing here.
        </Callout>
      );

    case "closed":
      return (
        <Callout tone="neutral" title="You closed this conversation">
          Nestor will not write or send anything more here.
        </Callout>
      );

    default:
      return null;
  }
}
