---
name: nestor-convex
description: Architecture and rules for working on Nestor, the AI apartment-hunting concierge built on Convex, Firecrawl, AgentMail and OpenAI for the Convex All Gas Hackathon. Use whenever developing or reviewing code in this repo.
---

# Working on Nestor

Read `NESTOR_PROJECT_SPEC.md` for the product and architecture, and `ANTIGRAVITY_NESTOR.md` for the hard
rules. The ones that break things fastest:

- Never add `"use node"` in `convex/`. Everything runs in Convex's default runtime with `fetch`.
- The frontend is a Vite React SPA on `@convex-dev/static-hosting`, not Next.js.
- Secrets live in the Convex deployment (`npm run env:push` from the gitignored `.env.keys`), never in git.
- Every public Convex function derives identity from the session via `convex/lib/auth.ts`.
- Costly or email-sending functions go through the rate limits in `convex/lib/limits.ts`.
- AgentMail: REST for outbound, the `@agentmail/convex` component for inbound. One shared agent inbox.
- Firecrawl: the official `@firecrawl/firecrawl-convex` component. JSON schemas passed to it must not
  contain `$`-prefixed keys. Craigslist and Facebook are refused by Firecrawl.

## Layout

- `convex/schema.ts` tables; `convex/lib/validators.ts` shared unions
- `convex/listings.ts`, `convex/scout.ts` the Scout
- `convex/threads.ts`, `convex/negotiator.ts`, `convex/mail.ts`, `convex/landlordSim.ts`, `convex/tours.ts` the Negotiator
- `convex/renters.ts`, `convex/leaseAudits.ts`, `convex/leaseAuditor.ts`, `convex/dashboard.ts`
- `src/pages/*`, `src/components/*`; design tokens in `src/index.css`, primitives in `src/components/ui.tsx`

## Submission

Public repo, `hackathon.md` at the root (update it with the `convex-hackathon-skill`), live URL on
`convex.site`, video under three minutes, social post tagging the four sponsors.
