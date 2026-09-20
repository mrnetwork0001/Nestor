import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Binoculars, Brain, Inbox } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge, Card, Skeleton, type Tone } from "@/components/ui";
import { CopyButton } from "@/components/lease/CopyButton";

type Status = FunctionReturnType<typeof api.system.status>;

interface AgentRow {
  icon: ReactNode;
  agent: string;
  poweredBy: string;
  badge: { text: string; tone: Tone; pulse: boolean };
  body: string;
  extra?: ReactNode;
}

const INBOUND_COPY: Record<Status["inboundMode"], string> = {
  webhook: "Replies arrive by signed webhook the moment the landlord hits send.",
  polling: "This deployment has no public address for webhooks, so Nestor checks its inbox every 20 seconds.",
  off: "Replies are not being picked up yet: no webhook secret is set and inbox polling is off. Sending still works.",
};

function rows(status: Status): AgentRow[] {
  const live = { text: "Live", tone: "forest" as Tone, pulse: true };
  const demo = { text: "Demo mode", tone: "honey" as Tone, pulse: false };

  const inbox: AgentRow = status.inboxReady
    ? {
        icon: <Inbox className="size-5" aria-hidden="true" />,
        agent: "Inbox",
        poweredBy: "AgentMail",
        badge: live,
        body: `Nestor sends and receives real email from its own address. ${INBOUND_COPY[status.inboundMode]}`,
        extra: status.agentInbox ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="max-w-full rounded-lg border border-line bg-paper px-2.5 py-1 font-mono text-xs break-all text-ink">
              {status.agentInbox}
            </code>
            <CopyButton text={status.agentInbox} label="Copy address" />
          </div>
        ) : undefined,
      }
    : status.agentmail
      ? {
          icon: <Inbox className="size-5" aria-hidden="true" />,
          agent: "Inbox",
          poweredBy: "AgentMail",
          badge: { text: "Not set up yet", tone: "honey", pulse: false },
          body: "An AgentMail key is connected, but Nestor's inboxes have not been created yet. Until they exist, conversations with the demo landlord stay inside Nestor and no email is sent.",
        }
      : {
          icon: <Inbox className="size-5" aria-hidden="true" />,
          agent: "Inbox",
          poweredBy: "AgentMail",
          badge: demo,
          body: "No AgentMail key is connected, so no email leaves Nestor. Conversations with the demo landlord happen inside the app and are labelled that way.",
        };

  return [
    {
      icon: <Binoculars className="size-5" aria-hidden="true" />,
      agent: "Scout",
      poweredBy: "Firecrawl",
      badge: status.firecrawl ? live : demo,
      body: status.firecrawl
        ? "Reads the listing pages you paste, searches the web for homes that fit, and looks for a leasing office's published email. It never guesses an address."
        : "No Firecrawl key is connected, so the Scout cannot open web pages. Sample listings still work, and they are labelled as samples.",
    },
    inbox,
    {
      icon: <Brain className="size-5" aria-hidden="true" />,
      agent: "Brain",
      poweredBy: "OpenAI",
      badge: status.openai ? live : demo,
      body: status.openai
        ? "Writes each email, reads landlord replies into tour times, offers and questions, and reviews leases."
        : "No OpenAI key is connected. Emails come from templates, replies are read with simple rules, and the lease check can only show its pre-written sample review. Each is labelled where it appears.",
    },
  ];
}

export function IntegrationStatus() {
  const status = useQuery(api.system.status);

  return (
    <Card className="p-6 sm:p-8">
      <h2 className="text-2xl text-ink">Nestor's agents</h2>
      <p className="mt-2 leading-relaxed text-ink-soft">
        What is connected on this deployment right now. Anything in demo mode says so wherever it shows up.
      </p>

      {status === undefined ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {rows(status).map((row) => (
            <li key={row.agent} className="flex gap-4 py-5 last:pb-0">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest-soft text-forest">
                {row.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h3 className="text-lg text-ink">{row.agent}</h3>
                  <span className="text-sm text-ink-faint">{row.poweredBy}</span>
                  <Badge tone={row.badge.tone} dot pulse={row.badge.pulse} className="ml-auto">
                    {row.badge.text}
                  </Badge>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{row.body}</p>
                {row.extra}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
