# Nestor

An AI concierge for apartment hunting. Nestor reads rental listings, emails landlords from its own
inbox, negotiates terms, books tours, and checks your lease for bad clauses before you sign.

**Live: https://standing-elephant-306.convex.site** (choose Launch app, then Continue as guest)

Built for the [Convex All Gas Hackathon](https://www.convex.dev/hackathons/all-gas) on Convex,
Firecrawl, AgentMail and OpenAI. Build log: [hackathon.md](hackathon.md). Product and architecture:
[NESTOR_PROJECT_SPEC.md](NESTOR_PROJECT_SPEC.md).

## What it does

- **Scout (Firecrawl).** Paste a listing URL or ask Nestor to find some. It extracts rent, fees, pet
  policy, availability and contacts, scores the listing against your preferences, and can look up the
  leasing office's published email with a source link. It never guesses an address.
- **Negotiator (AgentMail + OpenAI).** Nestor drafts an inquiry from its own inbox, links your Renter
  Passport, and asks for up to two concessions you chose. You approve each email, or turn on autopilot.
  Replies arrive by signed webhook and are read into tour slots, offers, concessions and questions.
- **Live dashboard (Convex).** Listings move through a pipeline as negotiations progress, next to a
  feed of what the agents are doing. No refresh.
- **Lease check (OpenAI).** Upload the lease PDF. Nestor quotes the clauses that deserve a second look,
  explains each in plain language, and suggests what to ask for. Not legal advice.
- **Renter Passport.** A public page for landlords showing who you are in bands, never documents.
  Your maximum budget is never shared.

Every email says it was written by Nestor, an AI assistant, on the renter's behalf. It states only facts
from the renter's profile and never invents offers.

## Stack

React 19, Vite, TypeScript and Tailwind CSS 4 on the front. Convex 1.46 on the back: schema, queries,
mutations, actions, scheduler, crons, file storage, HTTP actions and Convex Auth (guest plus email and
password). Convex components: `@firecrawl/firecrawl-convex`, `@agentmail/convex`,
`@convex-dev/rate-limiter`, `@convex-dev/static-hosting`. OpenAI Responses API with structured outputs.

## Run it locally

You need Node 20 or newer. No Convex account is required: the first run creates a local deployment.

```bash
git clone https://github.com/mrnetwork0001/Nestor.git
cd Nestor
npm install
```

**1. Add your keys.** Copy the block from [.env.example](.env.example) into a new file named `.env.keys`
(it is gitignored) and fill in what you have:

| Key | Needed for | Without it |
| --- | --- | --- |
| `FIRECRAWL_API_KEY` | Scout | Required to start. Any placeholder works; Nestor then uses sample listings. |
| `AGENTMAIL_API_KEY` | Negotiator's inbox | Conversations run against the demo landlord inside Convex. |
| `OPENAI_API_KEY` | Drafts, reply parsing, lease check | Template drafts, rule-based parsing, sample lease only. |

The AgentMail key must be allowed to create inboxes. Nestor creates two: its own, and a demo landlord.

**2. Start the backend, then load the keys.** In one terminal:

```bash
npm run dev:backend
```

The first push stops with `MissingEnvironmentVariables: FIRECRAWL_API_KEY`. That is expected. In a second
terminal:

```bash
npm run env:push      # copies .env.keys into the deployment; prints names, never values
npm run auth:keys     # generates Convex Auth signing keys
npx convex env set AGENTMAIL_POLL 1   # local only: no public URL, so poll the inbox
```

The backend re-pushes by itself and prints `Convex functions ready!`.

**3. Start the frontend.**

```bash
npm run dev:frontend
```

Open the URL Vite prints and choose **Launch app**, then **Continue as guest**.

Backend secrets live in the Convex deployment, not in a file the app reads. `.env.local` is written by
Convex and holds only the deployment name and the URL for the browser. Never prefix a secret with `VITE_`.

## Deploy to convex.site

```bash
npx convex login                 # once, opens a browser
npx convex dev                   # links the project and creates a cloud dev deployment
npm run env:push -- --prod       # production has its own environment
npm run auth:keys -- --prod
npm run deploy                   # pushes the backend, builds with the production URL, publishes the site
```

`npm run deploy` runs `convex deploy -y` and then `static-hosting deploy --skip-convex`. The static hosting
CLI calls `convex deploy` without `-y`, which cannot prompt in a non-interactive shell, so the backend is
pushed first.

The app is then live at `https://<deployment-name>.convex.site`. To receive landlord replies there,
register the webhook once and store the secret it returns:

```bash
npx convex run --prod mail:registerWebhook '{}'
npx convex env set --prod AGENTMAIL_WEBHOOK_SECRET <the secret it printed>
```

Leave `AGENTMAIL_POLL` unset in production.

## Project layout

```
convex/            backend: schema, auth, http, crons, and one file per concern
  listings.ts scout.ts                          the Scout
  threads.ts negotiator.ts mail.ts tours.ts     the Negotiator
  landlordSim.ts                                the demo landlord
  renters.ts leaseAudits.ts leaseAuditor.ts     profile, Passport, lease check
  lib/                                          validators, auth helpers, rate limits, prompts
src/               React app: pages/, components/, design tokens in index.css
scripts/           env:push and auth:keys
```

## Things worth knowing

- No file uses `"use node"`. Everything runs in Convex's default runtime with `fetch`.
- Firecrawl does not support craigslist.org or facebook.com. Zumper, PadMapper, Apartment List and
  Redfin work well.
- Guests can run the whole flow against the demo landlord. Emailing a real landlord needs an account and
  is rate limited, because the site is public.
- Outbound mail uses AgentMail's REST API; inbound goes through the `@agentmail/convex` component, which
  verifies the signature and drops duplicates.

## License

[Apache-2.0](LICENSE)
