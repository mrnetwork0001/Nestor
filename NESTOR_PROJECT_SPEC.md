# Nestor: product and architecture spec

Nestor is an AI concierge for people looking for an apartment. It reads rental listings, writes to
landlords from its own email inbox, negotiates terms, books tours, and checks a lease for bad clauses
before you sign. Built for the Convex All Gas Hackathon (Convex, OpenAI, Firecrawl, AgentMail).

- Author: Ifeanyichukwu Onwo (`mrnetwork0001`)
- License: Apache-2.0
- Submission deadline: September 22, 2026, 12:00 PM PT

## The problem

Apartment hunting is repetitive work against a clock. You re-type the same facts about yourself into
every inquiry, wait days for replies, lose track of who offered what, and then sign a long contract you
did not have time to read. Most renters never ask for a concession because asking is awkward and slow.

## What Nestor does

1. **Scout.** Paste a listing URL, or ask Nestor to find some. Firecrawl extracts rent, fees, pet policy,
   availability, amenities and contact details into structured data. Nestor scores each listing against
   your preferences and explains the score. Rental portals rarely publish a landlord email, so the Scout
   can also look for the property's own leasing-office page and show you the addresses published there,
   with the source link. It never guesses an address.
2. **Negotiator.** Nestor has its own AgentMail inbox. It drafts an inquiry that introduces you, links your
   Renter Passport, and asks for at most two concessions you chose (lower rent, waived pet fee, flexible
   move-in, and so on), justified by facts from the listing. You approve each email, or turn on autopilot.
   Replies come back by signed webhook. OpenAI reads each reply into tour slots, rent offers, concessions
   and questions for you, and Nestor drafts the next message.
3. **Renter Passport.** A public page at `/passport/<token>` that shows a landlord who you are: move-in
   date, household, pets, credit band, income band, rental history. Bands, never documents or numbers.
   Your maximum budget is never shown to a landlord and never given to the model as a shareable fact.
4. **Live dashboard.** Listings move through a pipeline as negotiations progress and an activity feed shows
   what the agents are doing, all through Convex reactive queries with no refresh.
5. **Lease check.** Upload the lease PDF. OpenAI flags hidden fees, deposit traps, entry and privacy terms,
   auto-renewal, early-termination penalties and similar clauses, quotes each one, explains it in plain
   language, and suggests what to ask for. Not legal advice.

## Rules the Negotiator follows

- Every email says it is written by Nestor, an AI assistant, on behalf of the renter.
- It states only facts from the renter's profile. It never invents competing offers, deadlines or facts.
- It never reveals the renter's maximum budget, and never agrees to sign, pay, or share sensitive details.
- Landlord emails, listing pages and lease text are treated as untrusted data, not instructions.
- Guests can run the whole flow against a demo landlord. Emailing a real landlord requires an account and
  is rate limited, because the live site is public.

## Architecture

```
React 19 + Vite SPA  ── Convex reactive queries / mutations (WebSocket) ──┐
                                                                          │
                        Convex backend (convex/)                          │
  schema · auth · queries · mutations · actions · scheduler · crons · file storage · HTTP actions
        │                     │                         │                        │
  Firecrawl component   AgentMail component      OpenAI (Responses API)   Rate limiter component
  scrape + search       signed inbound webhook   drafts, reply parsing,   caps on credits and email
                        + REST for outbound      lease audit from PDF
                                                                          │
                     Static hosting component serves the SPA at <deployment>.convex.site
```

The core loop is the idiomatic Convex one: a public mutation validates, rate limits and inserts a row with
a pending status, then schedules an internal action. The action calls the outside world and writes the
result through an internal mutation. The UI is only ever subscribed to the row.

### Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, React Router |
| Backend | Convex 1.46: schema, queries, mutations, actions, scheduler, crons, file storage, HTTP actions |
| Auth | Convex Auth: one-click guest plus email and password; a guest who signs up keeps their data |
| Convex components | `@firecrawl/firecrawl-convex`, `@agentmail/convex`, `@convex-dev/rate-limiter`, `@convex-dev/static-hosting` |
| AI | OpenAI Responses API with structured outputs; a small model for reading replies, a mid model for drafting, the flagship for lease review |
| Hosting | Convex static hosting on `convex.site` |

### Constraints worth knowing

- No `"use node"` files. Everything runs in Convex's default runtime using `fetch`.
- The published AgentMail component handles inbound mail well but its send functions fail, so outbound
  mail uses AgentMail's REST API directly. Inbound goes through the component (signature check, dedupe).
- AgentMail's free tier allows three inboxes, so every renter shares one agent inbox and conversations are
  told apart by thread id. A second inbox plays the demo landlord.
- Firecrawl refuses craigslist.org and facebook.com. Zumper, PadMapper, Apartment List and Redfin work.
- A local Convex deployment has no public URL, so inbound mail is polled there instead of pushed.

## Submission checklist

- [ ] Public GitHub repo
- [ ] `hackathon.md` at the repo root, kept current with the official hackathon skill
- [ ] Live app on Convex static hosting (`<deployment>.convex.site`)
- [ ] Video demo under three minutes
- [ ] Post on X or LinkedIn tagging @convex, @OpenAI, @firecrawl and @agentmail
- [ ] Submit at vibeapps.dev before September 22, 12:00 PM PT
