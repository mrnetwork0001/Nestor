import { env } from "./_generated/server";

/*
 * AgentMail over plain REST. @agentmail/convex@0.1.0 handles inbound mail well,
 * but its outbound and inbox functions cannot see the app's API key, so
 * everything that talks to api.agentmail.to goes through this file. It is
 * fetch only, so it runs in Convex's default runtime.
 *
 * The wire format is snake_case. `inbox_id` is the inbox's email address and
 * `message_id` is an RFC Message-ID with angle brackets, so both are always
 * URL-encoded in paths.
 */

const BASE_URL = "https://api.agentmail.to/v0";

export class AgentMailHttpError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`AgentMail ${status}: ${body.slice(0, 900)}`);
    this.name = "AgentMailHttpError";
  }
}

/** A short sentence that is safe to store on a message row and show the renter. */
export function describeAgentMailError(e: unknown): string {
  if (e instanceof AgentMailHttpError) {
    // A 403 is either a bad key or a key that may not do this one thing; the body says which.
    if (e.status === 403 && /missing_permission/.test(e.body)) {
      return "Nestor's AgentMail key is not allowed to do this. The deployment owner needs to widen the key's permissions in the AgentMail console.";
    }
    if (e.status === 401 || e.status === 403) return "AgentMail rejected the API key.";
    if (e.status === 429) return "AgentMail is rate limiting us. Try again in a minute.";
    if (e.status >= 500) return "AgentMail had a server error. Try again in a minute.";
    return `AgentMail refused the request (${e.status}).`;
  }
  return e instanceof Error ? e.message : String(e);
}

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const apiKey = env.AGENTMAIL_API_KEY;
  if (!apiKey) throw new Error("AgentMail is not connected on this deployment.");

  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const response = await fetch(url, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    // A hung request would otherwise hold the action until the platform kills it.
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new AgentMailHttpError(response.status, await response.text());
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

const enc = encodeURIComponent;

export type AgentMailInbox = {
  inbox_id: string;
  email?: string;
  display_name?: string;
  client_id?: string;
};

/** Idempotent on `clientId`: the same id returns the same inbox. It may not contain "@". */
export async function createInbox(args: {
  username?: string;
  displayName: string;
  clientId: string;
}): Promise<AgentMailInbox> {
  return await request<AgentMailInbox>("/inboxes", {
    body: { username: args.username, display_name: args.displayName, client_id: args.clientId },
  });
}

export async function listInboxes(): Promise<AgentMailInbox[]> {
  const page = await request<{ inboxes?: AgentMailInbox[] }>("/inboxes", { query: { limit: 50 } });
  return page.inboxes ?? [];
}

export type SentMessage = { message_id: string; thread_id: string };

/** Opens a new AgentMail thread. */
export async function sendMessage(args: {
  inboxId: string;
  to: string;
  subject: string;
  text: string;
  labels?: string[];
  headers?: Record<string, string>;
  idempotencyKey: string;
}): Promise<SentMessage> {
  return await request<SentMessage>(`/inboxes/${enc(args.inboxId)}/messages/send`, {
    body: {
      to: [args.to],
      subject: args.subject,
      text: args.text,
      labels: args.labels,
      headers: args.headers,
    },
    idempotencyKey: args.idempotencyKey,
  });
}

/** Joins the parent's thread. The reply endpoint takes no subject. */
export async function replyToMessage(args: {
  inboxId: string;
  parentMessageId: string;
  // Without this AgentMail addresses the reply to whoever sent the parent.
  to?: string[];
  text: string;
  labels?: string[];
  headers?: Record<string, string>;
  idempotencyKey: string;
}): Promise<SentMessage> {
  return await request<SentMessage>(
    `/inboxes/${enc(args.inboxId)}/messages/${enc(args.parentMessageId)}/reply`,
    {
      body: { to: args.to, text: args.text, labels: args.labels, headers: args.headers },
      idempotencyKey: args.idempotencyKey,
    },
  );
}

export type MessageListItem = {
  message_id: string;
  thread_id: string;
  labels?: string[];
  timestamp?: string;
};

/** Newest first. List items carry no bodies: fetch each one with `getMessage`. */
export async function listMessages(inboxId: string, limit: number): Promise<MessageListItem[]> {
  const page = await request<{ messages?: MessageListItem[] }>(
    `/inboxes/${enc(inboxId)}/messages`,
    { query: { limit } },
  );
  return page.messages ?? [];
}

export async function getMessage(
  inboxId: string,
  messageId: string,
): Promise<Record<string, unknown>> {
  return await request<Record<string, unknown>>(
    `/inboxes/${enc(inboxId)}/messages/${enc(messageId)}`,
  );
}

/*
 * The only event types @agentmail/convex@0.1.0 can store. Subscribing to any
 * other type makes the component's ingest throw, and the sender then retries
 * for hours and eventually disables the endpoint.
 */
export const COMPONENT_EVENT_TYPES = [
  "message.received",
  "message.sent",
  "message.delivered",
  "message.bounced",
  "message.complained",
  "message.rejected",
] as const;

export type AgentMailWebhook = {
  webhook_id: string;
  url: string;
  secret: string;
  enabled?: boolean;
};

export async function createWebhook(args: {
  url: string;
  inboxIds: string[];
  clientId: string;
}): Promise<AgentMailWebhook> {
  return await request<AgentMailWebhook>("/webhooks", {
    body: {
      url: args.url,
      event_types: COMPONENT_EVENT_TYPES,
      inbox_ids: args.inboxIds,
      client_id: args.clientId,
    },
  });
}

/*
 * A plain, storable view of an AgentMail message. The payload comes from the
 * network, so every field is narrowed here instead of trusted.
 */
export type NormalizedMessage = {
  inboxId: string;
  threadId: string;
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  inReplyTo: string | null;
  references: string[];
  labels: string[];
  timestamp: number | null;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Addresses arrive as "Name <a@b>" strings, arrays of them, or (older docs) objects. */
function addressList(value: unknown): string[] {
  if (typeof value === "string") return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(addressList);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const email = asString(record.email) ?? asString(record.address);
    if (!email) return [];
    const name = asString(record.name);
    return [name ? `${name} <${email}>` : email];
  }
  return [];
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "Dana Reyes <dana@example.com>" -> "dana@example.com", lowercased. */
export function bareAddress(value: string): string {
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

export function displayNameOf(value: string): string | null {
  const match = value.match(/^\s*"?([^"<]+?)"?\s*<[^<>]+>\s*$/);
  return match ? match[1].trim() : null;
}

export function normalizeMessage(raw: unknown): NormalizedMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const inboxId = asString(m.inbox_id);
  const threadId = asString(m.thread_id);
  const messageId = asString(m.message_id);
  if (!inboxId || !threadId || !messageId) return null;

  // extracted_text is the new reply without the quoted history; HTML-only mail has no text at all.
  const html = asString(m.extracted_html) ?? asString(m.html);
  const body = (
    asString(m.extracted_text) ??
    asString(m.text) ??
    (html ? stripHtml(html) : "")
  ).trim();

  const parsedTime = Date.parse(asString(m.timestamp) ?? "");
  return {
    inboxId,
    threadId,
    messageId,
    from: addressList(m.from ?? m.from_)[0] ?? "",
    to: addressList(m.to),
    subject: asString(m.subject) ?? "",
    body: body.slice(0, 20_000),
    inReplyTo: asString(m.in_reply_to),
    references: Array.isArray(m.references)
      ? m.references.filter((r): r is string => typeof r === "string")
      : [],
    labels: Array.isArray(m.labels) ? m.labels.filter((l): l is string => typeof l === "string") : [],
    timestamp: Number.isFinite(parsedTime) ? parsedTime : null,
  };
}

/*
 * The message object handed to the component's ingest. Its inbound table
 * requires `from` to be a string and `to` an array of strings, and its `raw`
 * column rejects some key names, so only known fields are passed, in the shape
 * the component expects.
 */
export function toComponentMessage(raw: unknown): Record<string, unknown> | null {
  const n = normalizeMessage(raw);
  if (!n) return null;
  const m = raw as Record<string, unknown>;
  const message: Record<string, unknown> = {
    inbox_id: n.inboxId,
    thread_id: n.threadId,
    message_id: n.messageId,
    labels: n.labels,
    timestamp: asString(m.timestamp) ?? new Date().toISOString(),
    from: n.from,
    to: n.to,
    subject: n.subject,
  };
  const cc = addressList(m.cc);
  if (cc.length > 0) message.cc = cc;
  for (const key of ["preview", "text", "html", "extracted_text", "extracted_html", "in_reply_to"]) {
    // The component stores the message twice in one document, which Convex caps at 1 MiB.
    const value = asString(m[key]);
    if (value) message[key] = value.slice(0, 60_000);
  }
  if (n.references.length > 0) message.references = n.references;
  return message;
}
