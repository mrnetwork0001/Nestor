import { env } from "../_generated/server";

/*
 * Which sponsor integrations are live on this deployment. Anything not live
 * runs in a clearly labelled demo mode instead of failing.
 */

export function firecrawlLive(): boolean {
  // The key is required at push time, so a placeholder may be set to boot
  // without an account. Real keys start with "fc-".
  return (env.FIRECRAWL_API_KEY ?? "").startsWith("fc-");
}

export function agentmailLive(): boolean {
  return Boolean(env.AGENTMAIL_API_KEY);
}

export function openaiLive(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}

/** True where there is no public URL for webhooks, so the inbox is polled. */
export function agentmailPolling(): boolean {
  return agentmailLive() && env.AGENTMAIL_POLL === "1";
}

export function webhookVerified(): boolean {
  return Boolean(env.AGENTMAIL_WEBHOOK_SECRET);
}

/** True when a reply to one of Nestor's emails can actually get back in. */
export function inboundLive(): boolean {
  return agentmailLive() && (agentmailPolling() || webhookVerified());
}
