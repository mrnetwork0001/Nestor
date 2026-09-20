import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

// The query's inferred type spells absent fields as `key: T | undefined`. Turning
// those into optional keys lets previews build the same shape without listing them.
type UndefinedToOptional<T> = {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
};

/** Exactly what `api.renters.passport` returns: the allow-listed public facts. */
export type PassportFacts = UndefinedToOptional<
  NonNullable<FunctionReturnType<typeof api.renters.passport>>
>;

export function firstNameOf(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || "This renter";
}
