# Hackathon log

- **Project:** Nestor
- **Event:** Convex All Gas Hackathon
- **What it does:** An AI concierge for apartment hunting that reads rental listings, emails landlords from its own inbox, negotiates terms, books tours, and checks a lease for bad clauses.
- **Live app:** https://standing-elephant-306.convex.site
- **Repo:** https://github.com/mrnetwork0001/Nestor
- **Frontend:** Convex static hosting
- **Convex deployment:** https://standing-elephant-306.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/rate-limiter, @firecrawl/firecrawl-convex, @agentmail/convex
- **Convex features:** schema, tables, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, file storage, realtime queries
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-luna, gpt-5.6-terra, gpt-5.6-sol
- **Started:** 2026-08-28T07:46:38Z
- **Last updated:** 2026-09-20T14:50:41Z

## Log

### 2026-08-28 - de27c96
Wrote the project spec, agent directives and a repo skill, and added the Apache-2.0 license and a package
manifest. No application code yet.

### 2026-09-20 - edc4373
Rewrote the spec and agent directives after checking every integration against its installed package: the
frontend is a Vite app on Convex static hosting, renters share one agent inbox, and the Scout targets sites
Firecrawl supports. Added a .gitignore, enabled the Convex plugin for Claude Code and installed the official
hackathon skill (`NESTOR_PROJECT_SPEC.md`, `.claude/settings.json`).

### 2026-09-20 - 3e8cf50
Set up Vite, React 19, TypeScript and Tailwind CSS 4 with current Convex packages. Secrets live in the Convex
deployment: `scripts/push-env.mjs` loads them from a gitignored file and prints names only, and
`scripts/setup-auth-keys.mjs` generates the Convex Auth signing keys.

### 2026-09-20 - 3582759
Registered four components (Firecrawl, AgentMail, rate limiter, static hosting) with a typed environment, and
wrote the schema with an index for every lookup. Convex Auth with one-click guest and email plus password; a
guest who signs up keeps the same user row and data. Identity is derived from the session in one place, and
every costly operation has a per-renter limit and a deployment-wide daily cap. Convex features: schema,
indexes, queries, mutations, components (`convex/convex.config.ts`, `convex/schema.ts`, `convex/auth.ts`,
`convex/lib/auth.ts`, `convex/lib/limits.ts`, `convex/activity.ts`).

### 2026-09-20 - 583bc97
Scout. A renter pastes a listing link; a mutation validates, dedupes, rate-limits and queues it, and a
scheduled action scrapes it through the Firecrawl component with a hand-written JSON schema, then scores it
against the renter's preferences. Firecrawl search finds listings for a city and looks up a leasing office's
published email; an address is only ever one found on a page. Convex features: actions, scheduled functions
(`convex/listings.ts`, `convex/scout.ts`, `convex/lib/matching.ts`, `convex/lib/openai.ts`).

### 2026-09-20 - 8be7cb1
Negotiator. OpenAI drafts each email with a stated rationale, the renter approves it or autopilot sends it,
and it goes out through AgentMail's REST API from the shared agent inbox. Replies come in through the
AgentMail component on a signed webhook route, with a polling cron for deployments that have no public URL;
both paths end in the same component ingest, deduped by event and message id. OpenAI reads each reply into
tour slots, rent offers, concessions and questions, and the thread moves stage. Round trip proven on the
local dev deployment between the agent inbox and the demo landlord inbox: inquiry out, reply in, tour chosen,
confirmation out, counter-offer parsed. Policy is checked in code: every email discloses it is written by an
AI assistant, the renter's maximum budget never enters a prompt, and landlord text is delimited as untrusted
data. Convex features: HTTP actions (`convex/mail.ts`, `convex/agentmailApi.ts`, `convex/negotiator.ts`,
`convex/threads.ts`, `convex/tours.ts`, `convex/landlordSim.ts`, `convex/http.ts`,
`convex/lib/negotiationPolicy.ts`).

### 2026-09-20 - 2e86ae7
Renter profile and a public Renter Passport query that returns bands only and is rate limited per token.
Lease check: a PDF goes to Convex file storage, a scheduled action sends it to OpenAI and stores quoted
clauses with a plain explanation and a suggested ask. Crons poll the inbox, re-check tracked listings for
rent changes and sweep orphan uploads. Convex features: file storage, crons (`convex/renters.ts`,
`convex/leaseAudits.ts`, `convex/leaseAuditor.ts`, `convex/dashboard.ts`, `convex/crons.ts`).

### 2026-09-20 - 9c819be
Frontend on reactive queries: landing page, sign-in, onboarding, a pipeline board with a live activity feed,
listing and conversation view with draft approval, tours, lease check, Passport editor and public page, and
settings. The sidebar shows live counts of what is waiting on the renter. A browser walk-through on the local
deployment took a guest from onboarding to a booked tour, upgraded them to an account, and signed them back
in with their data intact. Not deployed yet: the static hosting component is registered with a `deploy`
script but has not published a site. Convex features: realtime queries (`src/`, `README.md`).

A four-lens review of the backend (authorization, the mail state machine, prompt safety, Convex limits)
confirmed 25 findings and all were fixed before these commits, including missing deployment-wide spend caps
and autopilot replying to auto-replies.

### 2026-09-20 - b0987b1
Deployed. The backend runs on the production Convex deployment and the frontend is served by the static
hosting component at the convex.site URL above. Production has its own keys and Convex Auth signing keys,
and the AgentMail webhook is registered against the production site URL with its signing secret stored on
the deployment; an unsigned POST to `/agentmail/webhook` returns 401. A browser walk-through on the live URL
took a guest from onboarding through a negotiation with the demo landlord, where the reply arrived through
the signed webhook, to a booked tour, then upgraded the guest to an account and signed back in with the data
intact. Added the logo artwork and favicon, and fixed the one-command deploy, which failed because the static
hosting CLI calls `convex deploy` without `-y` (`package.json`, `src/components/Logo.tsx`).

### 2026-09-20 - 5604d6c
Rewrote the README from facts extracted from the code, each with a file reference, then had three independent
reviewers check it for technical truth, working links and commands, and tone; 20 of their 27 findings were
confirmed and fixed. Added six screenshots of the live site taken with fictional data (`README.md`,
`docs/screenshots/`).

Replaced every stock icon with a custom family of 71 drawn from the logo mark: arched tops, one diagonal
corner and a single flat tint. They are exported under the names of the library they replaced, so 47 files
changed one import line each, and the stock library was removed. Two reviewers looked at renders of the set
and of real screens, and 27 glyphs were redrawn after five failed to read at 16px. Redeployed, and the browser
walk-through passed again on the live URL (`src/components/icons/`, `src/components/landing/Motif.tsx`).
