import { useEffect, useState } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";

export type Audit = Doc<"leaseAudits">;
export type Flag = Audit["flags"][number];
export type Severity = Flag["severity"];

export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export const SEVERITIES: Severity[] = ["high", "medium", "low"];

export const SEVERITY_COPY: Record<Severity, { heading: string; blurb: string; short: string }> = {
  high: {
    heading: "Sort these out before you sign",
    blurb: "These could cost you serious money or rights.",
    short: "serious",
  },
  medium: {
    heading: "Worth negotiating",
    blurb: "Common asks that landlords often agree to.",
    short: "worth negotiating",
  },
  low: {
    heading: "Good to know",
    blurb: "Not unusual, but read them so nothing surprises you later.",
    short: "good to know",
  },
};

export const RISK_VERDICT: Record<Severity, { label: string; line: string }> = {
  high: { label: "High risk as written", line: "Ask for changes before you sign this." },
  medium: { label: "A few terms to negotiate", line: "Mostly workable, with some clauses worth pushing back on." },
  low: { label: "Mostly standard", line: "Nothing here is out of the ordinary for a residential lease." },
};

/** What the reviewer looks for, shown while it works and before the first check. */
export const CHECKLIST = [
  "Hidden and recurring fees",
  "Security deposit terms",
  "Landlord entry and privacy",
  "Repairs pushed onto you",
  "Auto-renewal and notice traps",
  "Early-termination penalties",
  "Mid-lease rent increases",
  "Rights you are asked to waive",
  "Joint liability with roommates",
  "Forced arbitration",
];

export function countBySeverity(flags: Flag[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const flag of flags) counts[flag.severity] += 1;
  return counts;
}

export function tallySentence(flags: Flag[]): string {
  const counts = countBySeverity(flags);
  const parts = SEVERITIES.filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${SEVERITY_COPY[s].short}`);
  return parts.join(", ");
}

export const ASK_EMAIL_SUBJECT = "A few points on the lease before I sign";

/** One email the renter can send as-is, built only from the asks they ticked. */
export function composeAskEmail(flags: Flag[], signature: string | undefined): string {
  const asks = flags.map((flag, i) => {
    const where = flag.pageHint ? `${flag.pageHint}: ` : "";
    return `${i + 1}. ${where}${flag.suggestedAsk}`;
  });
  return [
    "Hello,",
    "",
    "Thank you for sending the lease over. I have read it through and would like to settle " +
      (flags.length === 1 ? "one point" : "a few points") +
      " before I sign:",
    "",
    asks.join("\n\n"),
    "",
    "I am happy to talk any of this through. Thank you,",
    signature && signature.trim().length > 0 ? signature.trim() : "",
  ]
    .join("\n")
    .trimEnd();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API is blocked on some insecure origins and older browsers.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }
}

/** A PDF's header may sit anywhere in the first 1024 bytes. */
export async function looksLikePdf(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const marker = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
    for (let i = 0; i + marker.length <= head.length; i++) {
      if (marker.every((byte, j) => head[i + j] === byte)) return true;
    }
    return false;
  } catch {
    // Unreadable here does not mean invalid: the server checks again.
    return true;
  }
}

/** Returns the reason a file cannot be checked, or null when it can. */
export async function refuseFile(file: File): Promise<string | null> {
  const named = /\.pdf$/i.test(file.name);
  const typed = file.type === "application/pdf" || file.type === "application/x-pdf";
  if (!named && !typed) {
    return "Only PDF files can be checked. Export or scan your lease as a PDF and try again.";
  }
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_PDF_BYTES) {
    return `That PDF is ${fileSize(file.size)}. The limit is 15 MB: try a smaller scan or export.`;
  }
  if (!(await looksLikePdf(file))) {
    return "That file has a PDF name but is not a PDF inside. Export your lease as a PDF and try again.";
  }
  return null;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function elapsedLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Re-renders on an interval so "time ago" labels and timers stay current. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
