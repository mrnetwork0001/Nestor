import { z } from "zod";
import type { LeaseFlag, RiskLevel } from "./validators";

/*
 * What the lease reviewer must return, as a zod schema (sent to OpenAI as a
 * strict JSON Schema) plus the mapping onto the `leaseFlag` validator the
 * table stores. Strict mode has no optional keys: "unknown" is null.
 */

const CATEGORY_LABEL = {
  fees: "Fees",
  deposit: "Deposit",
  rent_increase: "Rent increases",
  renewal_notice: "Renewal & notice",
  early_termination: "Early termination",
  entry_privacy: "Entry & privacy",
  maintenance: "Maintenance & repairs",
  waiver_of_rights: "Waiver of rights",
  joint_liability: "Joint liability",
  dispute_resolution: "Arbitration & disputes",
  utilities: "Utilities",
  guests_subletting: "Guests & subletting",
  other: "Other",
} as const;

type CategoryKey = keyof typeof CATEGORY_LABEL;
const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as [CategoryKey, ...CategoryKey[]];

const LeaseReviewFlag = z.object({
  severity: z
    .enum(["low", "medium", "high"])
    .describe("high = could cost the renter serious money or rights; medium = worth negotiating; low = worth knowing."),
  category: z.enum(CATEGORY_KEYS),
  title: z.string().describe("Six words or fewer, plain language, e.g. 'Landlord can enter without notice'."),
  clauseQuote: z
    .string()
    .describe("Copied word for word from the lease, at most about 60 words. Never paraphrase or tidy it."),
  pageHint: z
    .string()
    .nullable()
    .describe("Where the clause is, e.g. 'Page 3, Section 12' or 'Section 9'. Null if unsure."),
  whyItMatters: z
    .string()
    .describe("Two or three plain sentences for a renter with no legal background. Say so when the rule varies by state."),
  suggestedAsk: z
    .string()
    .describe("One specific, polite request the renter can send the landlord, written in the renter's voice."),
});

export const LeaseReview = z.object({
  isResidentialLease: z
    .boolean()
    .describe("False when the document is not a residential lease or rental agreement."),
  overallRisk: z.enum(["low", "medium", "high"]),
  summary: z
    .string()
    .describe(
      "Three or four plain sentences: what kind of lease this is, the biggest issues, what to do first. End with one short sentence saying this is not legal advice.",
    ),
  flags: z.array(LeaseReviewFlag).describe("At most 12 flags, most severe first. Empty when nothing stands out."),
});
export type LeaseReview = z.infer<typeof LeaseReview>;

export const MAX_FLAGS = 12;

const SEVERITY_RANK: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

function clip(text: string, max: number): string {
  const clean = text.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Model output -> rows for `leaseAudits.flags`: bounded, most severe first. */
export function toLeaseFlags(review: LeaseReview): LeaseFlag[] {
  return review.flags
    .filter((flag) => flag.clauseQuote.trim().length > 0)
    .map((flag): LeaseFlag => {
      const pageHint = flag.pageHint === null ? "" : flag.pageHint.trim();
      return {
        severity: flag.severity,
        category: CATEGORY_LABEL[flag.category],
        title: clip(flag.title, 120),
        clauseQuote: clip(flag.clauseQuote, 700),
        ...(pageHint.length > 0 ? { pageHint: clip(pageHint, 60) } : {}),
        whyItMatters: clip(flag.whyItMatters, 700),
        suggestedAsk: clip(flag.suggestedAsk, 500),
      };
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, MAX_FLAGS);
}

export function clipSummary(summary: string): string {
  return clip(summary, 1200);
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();
}

/**
 * True when every part of `quote` (split on ellipses) appears in `source`,
 * ignoring case, punctuation and whitespace. Only usable when the lease text is
 * known, which is the bundled sample: a PDF's text never reaches our code.
 */
export function quoteAppearsIn(quote: string, source: string): boolean {
  const haystack = normalizeForMatch(source);
  const parts = quote
    .split(/\.{3,}|…|\[\.\.\.\]/)
    .map(normalizeForMatch)
    .filter((part) => part.length > 0);
  return parts.length > 0 && parts.every((part) => haystack.includes(part));
}
