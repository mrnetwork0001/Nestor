import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentmail from "@agentmail/convex/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import firecrawl from "@firecrawl/firecrawl-convex/convex.config";

const app = defineApp({
  env: {
    // Required: the Firecrawl component declares it required, so a push fails
    // until it is set (`npm run env:push`).
    FIRECRAWL_API_KEY: v.string(),
    // Optional: without these the matching integration runs in demo mode.
    AGENTMAIL_API_KEY: v.optional(v.string()),
    AGENTMAIL_WEBHOOK_SECRET: v.optional(v.string()),
    OPENAI_API_KEY: v.optional(v.string()),
    // Set to "1" on deployments with no public URL (local dev) to poll the
    // inbox instead of waiting for webhooks.
    AGENTMAIL_POLL: v.optional(v.string()),
  },
});

// Scout: scrape and search rental listings.
app.use(firecrawl, {
  env: { FIRECRAWL_API_KEY: app.env.FIRECRAWL_API_KEY },
});

// Negotiator: signed inbound webhooks, dedupe, inbound message store.
app.use(agentmail);

// Caps on anything that spends credits or sends email.
app.use(rateLimiter);

// Serves the built SPA from <deployment>.convex.site. No httpPrefix: our own
// http.ts keeps the root so auth discovery and the webhook stay where they are.
app.use(staticHosting);

export default app;
