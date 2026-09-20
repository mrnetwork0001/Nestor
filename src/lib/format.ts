import type { Tone } from "@/components/ui";

/*
 * Display helpers shared by every page. The label maps mirror the unions in
 * convex/lib/validators.ts; keep the two in step.
 */

export function money(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function rent(amount: number | undefined | null): string {
  return amount === undefined || amount === null ? "Rent not listed" : `${money(amount)}/mo`;
}

export function timeAgo(ms: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function dayLabel(isoDate: string | undefined): string {
  if (!isoDate) return "Flexible";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function bedsBaths(bedrooms?: number, bathrooms?: number): string {
  const parts: string[] = [];
  if (bedrooms !== undefined) parts.push(bedrooms === 0 ? "Studio" : `${bedrooms} bd`);
  if (bathrooms !== undefined) parts.push(`${bathrooms} ba`);
  return parts.join(" · ");
}

export const STAGE_LABEL: Record<string, string> = {
  drafting: "Writing",
  needs_approval: "Needs your OK",
  awaiting_reply: "Awaiting reply",
  negotiating: "Negotiating",
  tour_scheduled: "Tour booked",
  terms_agreed: "Terms agreed",
  declined: "Declined",
  closed: "Closed",
};

export const STAGE_TONE: Record<string, Tone> = {
  drafting: "neutral",
  needs_approval: "honey",
  awaiting_reply: "sky",
  negotiating: "clay",
  tour_scheduled: "forest",
  terms_agreed: "forest",
  declined: "neutral",
  closed: "neutral",
};

/** Left-to-right order of the pipeline columns on the dashboard. */
export const STAGE_ORDER = [
  "needs_approval",
  "awaiting_reply",
  "negotiating",
  "tour_scheduled",
  "terms_agreed",
] as const;

export const CREDIT_LABEL: Record<string, string> = {
  excellent: "Excellent (740+)",
  good: "Good (670–739)",
  fair: "Fair (580–669)",
  building: "Building credit",
};

export const INCOME_LABEL: Record<string, string> = {
  under_3k: "Under $3k / month",
  "3k_5k": "$3k–$5k / month",
  "5k_8k": "$5k–$8k / month",
  "8k_12k": "$8k–$12k / month",
  "12k_plus": "$12k+ / month",
};

export const GOAL_LABEL: Record<string, string> = {
  lower_rent: "Lower monthly rent",
  waive_pet_fee: "Waive pet fee or deposit",
  waive_application_fee: "Waive application fee",
  reduced_deposit: "Smaller security deposit",
  flexible_move_in: "Flexible move-in date",
  shorter_lease: "Shorter lease",
  longer_lease_discount: "Discount for a longer lease",
  free_parking: "Parking included",
};

export const RISK_TONE: Record<string, Tone> = {
  low: "forest",
  medium: "honey",
  high: "clay",
};

export const ACTIVITY_TONE: Record<string, Tone> = {
  scout: "sky",
  negotiator: "forest",
  landlord: "clay",
  tour: "forest",
  lease: "honey",
  system: "neutral",
};
