import { ConvexError } from "convex/values";

/**
 * The plain sentence a Convex function threw for the renter, or a fallback for
 * anything unexpected. Plain `Error` messages are hidden in production, so only
 * `ConvexError` data is ever shown.
 */
export function errorSentence(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof ConvexError && typeof error.data === "string" ? error.data : fallback;
}
