import { useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { errorSentence } from "@/lib/errors";
import type { api } from "../../../convex/_generated/api";

/*
 * Small helpers shared by the dashboard, the listing page and the thread view.
 */

export type ListingRow = FunctionReturnType<typeof api.listings.list>[number];
export type ThreadRow = FunctionReturnType<typeof api.threads.list>[number];
export type TourRow = FunctionReturnType<typeof api.tours.list>[number];
export type SystemStatus = FunctionReturnType<typeof api.system.status>;

/** The sentence a mutation threw, or a generic line for anything unexpected. */
export function errorMessage(error: unknown): string {
  return errorSentence(error);
}

export function toastError(error: unknown): void {
  toast.error(errorMessage(error));
}

/** Sample listings use sample:// addresses, which must never be linked or parsed as web pages. */
export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function hostOf(url: string): string | null {
  if (!isWebUrl(url)) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function listingName(listing: { title?: string; address?: string; sourceUrl: string }): string {
  return listing.title ?? listing.address ?? hostOf(listing.sourceUrl) ?? "Rental listing";
}

/** A clock that re-renders its caller, so "2m ago" labels keep moving without new data. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function firstName(name: string | undefined | null, fallback: string): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : fallback;
}
