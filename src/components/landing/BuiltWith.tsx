import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Badge, type Tone } from "@/components/ui";
import { Eyebrow } from "./Motif";
import agentmailLogo from "@/assets/sponsors/agentmail.jpg";
import convexLogo from "@/assets/sponsors/convex.png";
import firecrawlLogo from "@/assets/sponsors/firecrawl.png";
import openaiLogo from "@/assets/sponsors/openai.jpg";

/*
 * Each company's own mark, shown to credit it: these are their trademarks, not
 * ours, so they sit unaltered in a plain tile and are never recoloured or
 * combined with Nestor's mark. The badges read `api.system.status` live, so the
 * page never claims an integration is working on a deployment where it is in
 * demo mode.
 */

type Status = { tone: Tone; label: string; pulse: boolean };

const CHECKING: Status = { tone: "neutral", label: "Checking", pulse: false };
const LIVE: Status = { tone: "forest", label: "Live here", pulse: true };
const DEMO: Status = { tone: "honey", label: "Demo mode here", pulse: false };

export function BuiltWith() {
  const status = useQuery(api.system.status);

  const inbox: Status =
    status === undefined
      ? CHECKING
      : status.inboxReady
        ? LIVE
        : status.agentmail
          ? { tone: "honey", label: "Key set, inbox pending", pulse: false }
          : DEMO;

  const tools: ReadonlyArray<{ name: string; logo: string; job: string; status: Status }> = [
    {
      name: "Convex",
      logo: convexLogo,
      job: "The database, live queries, sign-in, scheduled jobs, file storage and this page's hosting. It is why every screen updates without a refresh.",
      // If this query answered at all, Convex is what answered it.
      status: status === undefined ? CHECKING : LIVE,
    },
    {
      name: "Firecrawl",
      logo: firecrawlLogo,
      job: "Reads listing pages into structured facts, finds new listings, and searches a property's own site for a published leasing email.",
      status: status === undefined ? CHECKING : status.firecrawl ? LIVE : DEMO,
    },
    {
      name: "AgentMail",
      logo: agentmailLogo,
      job: "Gives Nestor its own inbox: inquiries go out from it, and landlords' replies come back into your dashboard.",
      status: inbox,
    },
    {
      name: "OpenAI",
      logo: openaiLogo,
      job: "Drafts the emails, reads replies into tour times and offers, and reviews lease PDFs clause by clause.",
      status: status === undefined ? CHECKING : status.openai ? LIVE : DEMO,
    },
  ];

  return (
    <section aria-labelledby="built-title" className="border-b border-line bg-card">
      <div className="mx-auto w-full max-w-[calc(50vw+38rem)] px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
          <div>
            <Eyebrow>Built with</Eyebrow>
            <h2 id="built-title" className="mt-3 text-3xl leading-tight text-ink sm:text-4xl">
              Four tools doing real work.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
            Built for the Convex All Gas Hackathon and open source under Apache-2.0. The badges are
            read live from this deployment: where a key is missing, Nestor says so and falls back
            to a labelled demo.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 border-t border-line-strong pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {tools.map((tool) => (
            <li key={tool.name}>
              <div className="flex items-center gap-3">
                <img
                  src={tool.logo}
                  alt=""
                  aria-hidden
                  width={44}
                  height={44}
                  // Eager: 87kB for all four, and a lazy load leaves visibly
                  // empty tiles for anyone who scrolls here quickly.
                  decoding="async"
                  className="h-11 w-11 shrink-0 rounded-xl border border-line object-cover"
                />
                <p className="font-display text-[1.75rem] leading-none tracking-tight text-ink">
                  {tool.name}
                </p>
              </div>
              <div className="mt-3">
                <Badge tone={tool.status.tone} dot pulse={tool.status.pulse}>
                  {tool.status.label}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{tool.job}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
