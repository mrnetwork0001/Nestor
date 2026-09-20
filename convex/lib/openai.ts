// No "use node": openai@7 is fetch-based and runs in Convex's default runtime.
import OpenAI from "openai";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { env } from "../_generated/server";

export const MODELS = {
  extract: "gpt-5.6-luna", // reading a landlord's reply
  draft: "gpt-5.6-terra", // writing the Negotiator's emails
  audit: "gpt-5.6-sol", // lease review
  // Tried once when the primary is not enabled for this key
  extractFallback: "gpt-5.4-nano",
  draftFallback: "gpt-5.6-luna",
  auditFallback: "gpt-5.6-terra",
} as const;

/**
 * Null when no key is set, so callers can fall back to demo behaviour.
 * Always call inside a handler: the constructor throws without a key, and
 * Convex evaluates module top level at push time.
 */
export function getOpenAI(options: { timeoutMs?: number; maxRetries?: number } = {}): OpenAI | null {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    timeout: options.timeoutMs ?? 90_000, // SDK default is 10 minutes per attempt
    maxRetries: options.maxRetries ?? 2,
  });
}

/** Unwraps a responses.parse() result, or throws a readable error. */
export function requireParsed<T>(r: ParsedResponse<T>, what: string): T {
  if (r.status === "incomplete") {
    throw new Error(`${what}: incomplete (${r.incomplete_details?.reason ?? "unknown"})`);
  }
  if (r.status === "failed") {
    throw new Error(`${what}: failed (${r.error?.code ?? "?"}: ${r.error?.message ?? ""})`);
  }
  for (const item of r.output) {
    if (item.type !== "message") continue;
    for (const part of item.content) {
      if (part.type === "refusal") throw new Error(`${what}: model refused: ${part.refusal}`);
    }
  }
  if (r.output_parsed == null) throw new Error(`${what}: no parsed output (status=${r.status})`);
  return r.output_parsed;
}

/** A short error string that is safe to store and show to the renter. */
export function describeOpenAIError(e: unknown): string {
  if (e instanceof OpenAI.APIError) {
    // OpenAI's 401 message echoes part of the key; keep it out of the logs.
    if (e.status === 401) return "OpenAI 401 unauthorized";
    return `OpenAI ${e.status ?? "network"} ${e.code ?? e.type ?? ""}: ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}

export function isModelUnavailable(e: unknown): boolean {
  return (
    e instanceof OpenAI.APIError &&
    (e.status === 404 || e.status === 403 || e.code === "model_not_found")
  );
}

/** Runs `call` with the primary model, then once with the fallback if that model is unavailable. */
export async function withModelFallback<T>(
  primary: string,
  fallback: string,
  call: (model: string) => Promise<T>,
): Promise<{ result: T; model: string }> {
  try {
    return { result: await call(primary), model: primary };
  } catch (e) {
    if (!isModelUnavailable(e)) throw e;
    return { result: await call(fallback), model: fallback };
  }
}
