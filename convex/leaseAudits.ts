import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { logActivity } from "./activity";
import { getRenter, requireOwned, requireRenter } from "./lib/auth";
import { openaiLive } from "./lib/integrations";
import { limits } from "./lib/limits";
import { CANNED_SAMPLE_AUDIT, SAMPLE_LEASE_FILE_NAME } from "./lib/sampleLease";
import { auditStatus, leaseFlag, riskLevel } from "./lib/validators";

/*
 * Lease check. The renter uploads a PDF (generateUploadUrl -> POST -> create),
 * or tries the bundled sample lease; the row starts as `analyzing`, the
 * reviewer in leaseAuditor.ts fills it in, and the page watches it live.
 */

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const PDF_TYPES = new Set(["application/pdf", "application/x-pdf"]);
// An action is killed at 10 minutes, so past this the reviewer is gone and the row is stuck.
const STUCK_AFTER_MS = 11 * 60 * 1000;
const ORPHAN_AFTER_MS = 2 * 60 * 60 * 1000;

// The sample review is a real model call, and guests are free to mint. Past
// these caps the sample falls back to the pre-written review, labelled as such.
const sampleLimits = new RateLimiter(components.rateLimiter, {
  sampleLeaseAudit: { kind: "fixed window", rate: 3, period: DAY },
  sampleLeaseAuditGlobal: { kind: "fixed window", rate: 25, period: DAY },
});

function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const name = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
  return name.length > 0 ? name : "Lease.pdf";
}

function waitPhrase(retryAfterMs: number): string {
  const hours = Math.ceil(retryAfterMs / (60 * 60 * 1000));
  return hours <= 1 ? "in about an hour" : `in about ${hours} hours`;
}

async function renterAudits(ctx: MutationCtx, renterId: Id<"renters">) {
  return await ctx.db
    .query("leaseAudits")
    .withIndex("by_renter", (q) => q.eq("renterId", renterId))
    .order("desc")
    .take(50);
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);
    // Checked here as well as in `create`, so nobody uploads a file that would then be refused.
    const status = await limits.check(ctx, "leaseAudit", { key: renter._id });
    if (!status.ok) {
      throw new ConvexError(
        `You have used today's lease checks. You can check another lease ${waitPhrase(status.retryAfter)}.`,
      );
    }
    const shared = await limits.check(ctx, "globalLeaseAudit");
    if (!shared.ok) {
      throw new ConvexError("Nestor has used today's shared allowance for lease checks. Please try again tomorrow.");
    }
    // Upload links are metered too: each one lets a file into storage before `create` can vet it.
    const own = await limits.limit(ctx, "uploadUrl", { key: renter._id });
    const everyone = own.ok ? await limits.limit(ctx, "globalUploadUrl") : own;
    if (!everyone.ok) {
      throw new ConvexError(`Too many uploads for today. You can upload again ${waitPhrase(everyone.retryAfter)}.`);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    fileName: v.string(),
    listingId: v.optional(v.id("listings")),
  },
  returns: v.id("leaseAudits"),
  handler: async (ctx, args) => {
    const renter = await requireRenter(ctx);
    const fileName = cleanFileName(args.fileName);

    if (args.listingId !== undefined) {
      const listing = await ctx.db.get(args.listingId);
      if (listing === null || listing.renterId !== renter._id) throw new ConvexError("Not found.");
    }

    const file = await ctx.db.system.get(args.storageId);
    if (file === null) throw new ConvexError("That upload could not be found. Please try again.");

    // A double submit, or a retry after a dropped connection, lands on the same audit.
    const existing = await ctx.db
      .query("leaseAudits")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (existing !== null) {
      if (existing.renterId !== renter._id) throw new ConvexError("Not found.");
      return existing._id;
    }

    /*
     * A refused file has to be deleted, and a throw would roll that delete back
     * with the rest of the transaction. So a refusal is recorded as a failed
     * audit carrying the reason, and the blob goes away for good.
     */
    const refuse = async (reason: string): Promise<Id<"leaseAudits">> => {
      await ctx.storage.delete(args.storageId);
      return await ctx.db.insert("leaseAudits", {
        renterId: renter._id,
        listingId: args.listingId,
        fileName,
        isSample: false,
        status: "failed",
        flags: [],
        error: reason,
        completedAt: Date.now(),
      });
    };

    const contentType = (file.contentType ?? "").split(";")[0].trim().toLowerCase();
    // Some browsers upload PDFs with no type at all. The reviewer checks the
    // file's first bytes before anything is sent to OpenAI.
    const untypedPdf =
      (contentType === "" || contentType === "application/octet-stream") && /\.pdf$/i.test(fileName);
    if (!PDF_TYPES.has(contentType) && !untypedPdf) {
      return await refuse("Only PDF files can be checked. Export or scan your lease as a PDF and try again.");
    }
    if (file.size > MAX_PDF_BYTES) {
      return await refuse("That PDF is larger than 15 MB. Try a smaller scan or export and upload it again.");
    }
    if (file.size === 0) return await refuse("That file is empty.");

    // Refusals do not roll back, so the shared ceiling is checked before the renter's own token is spent.
    const shared = await limits.check(ctx, "globalLeaseAudit");
    if (!shared.ok) {
      return await refuse("Nestor has used today's shared allowance for lease checks. Please try again tomorrow.");
    }
    const allowed = await limits.limit(ctx, "leaseAudit", { key: renter._id });
    if (!allowed.ok) {
      return await refuse(
        `You have used today's lease checks. You can check another lease ${waitPhrase(allowed.retryAfter)}.`,
      );
    }

    await limits.limit(ctx, "globalLeaseAudit");

    const auditId = await ctx.db.insert("leaseAudits", {
      renterId: renter._id,
      listingId: args.listingId,
      storageId: args.storageId,
      fileName,
      isSample: false,
      status: "analyzing",
      flags: [],
    });
    await ctx.scheduler.runAfter(0, internal.leaseAuditor.analyze, { auditId });
    await ctx.scheduler.runAfter(STUCK_AFTER_MS, internal.leaseAudits.expireIfStuck, { auditId });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "lease",
      title: `Reading your lease: ${fileName}`,
      detail: "Looking for fees, deposit terms, entry rights, renewal traps and anything one-sided.",
      listingId: args.listingId,
    });
    return auditId;
  },
});

/**
 * Reviews the bundled sample lease. With OpenAI connected it is a real model
 * call over the sample text; otherwise the pre-written review, which says so.
 */
export const runSample = mutation({
  args: {},
  returns: v.id("leaseAudits"),
  handler: async (ctx) => {
    const renter = await requireRenter(ctx);

    const samples = (await renterAudits(ctx, renter._id)).filter((a) => a.isSample);
    const current = samples.find((a) => a.status === "analyzing" || a.status === "done");
    if (current !== undefined) return current._id;
    for (const failed of samples) await ctx.db.delete(failed._id);

    let live = openaiLive();
    if (live) live = (await sampleLimits.limit(ctx, "sampleLeaseAudit", { key: renter._id })).ok;
    if (live) live = (await sampleLimits.limit(ctx, "sampleLeaseAuditGlobal")).ok;

    if (!live) {
      const auditId = await ctx.db.insert("leaseAudits", {
        renterId: renter._id,
        fileName: SAMPLE_LEASE_FILE_NAME,
        isSample: true,
        status: "done",
        ...CANNED_SAMPLE_AUDIT,
        completedAt: Date.now(),
      });
      await logActivity(ctx, {
        renterId: renter._id,
        kind: "lease",
        title: `Sample lease: ${CANNED_SAMPLE_AUDIT.flags.length} clauses worth a look`,
        detail: "This is Nestor's pre-written example review. Connect OpenAI for a live one.",
      });
      return auditId;
    }

    const auditId = await ctx.db.insert("leaseAudits", {
      renterId: renter._id,
      fileName: SAMPLE_LEASE_FILE_NAME,
      isSample: true,
      status: "analyzing",
      flags: [],
    });
    await ctx.scheduler.runAfter(0, internal.leaseAuditor.analyze, { auditId });
    await ctx.scheduler.runAfter(STUCK_AFTER_MS, internal.leaseAudits.expireIfStuck, { auditId });
    await logActivity(ctx, {
      renterId: renter._id,
      kind: "lease",
      title: "Reading the sample lease",
      detail: "A made-up one-year apartment lease with a few traps in it.",
    });
    return auditId;
  },
});

/** The renter's audits, newest first. */
export const list = query({
  args: {},
  handler: async (ctx): Promise<Doc<"leaseAudits">[]> => {
    const renter = await getRenter(ctx);
    if (renter === null) return [];
    return await ctx.db
      .query("leaseAudits")
      .withIndex("by_renter", (q) => q.eq("renterId", renter._id))
      .order("desc")
      .take(20);
  },
});

/** One audit plus a short-lived link to the uploaded PDF (null for the sample). */
export const get = query({
  args: { auditId: v.id("leaseAudits") },
  handler: async (ctx, { auditId }): Promise<(Doc<"leaseAudits"> & { fileUrl: string | null }) | null> => {
    const renter = await getRenter(ctx);
    if (renter === null) return null;
    const audit = await ctx.db.get(auditId);
    if (audit === null || audit.renterId !== renter._id) return null;
    const fileUrl = audit.storageId === undefined ? null : await ctx.storage.getUrl(audit.storageId);
    return { ...audit, fileUrl };
  },
});

export const remove = mutation({
  args: { auditId: v.id("leaseAudits") },
  returns: v.null(),
  handler: async (ctx, { auditId }) => {
    const { doc: audit } = await requireOwned(ctx, "leaseAudits", auditId);
    if (audit.storageId !== undefined && (await ctx.db.system.get(audit.storageId)) !== null) {
      await ctx.storage.delete(audit.storageId);
    }
    // A review still in flight finds no row when it finishes and drops its result.
    await ctx.db.delete(auditId);
    return null;
  },
});

// Internal: the reviewer's read and write path ---------------------------------

export const forAnalysis = internalQuery({
  args: { auditId: v.id("leaseAudits") },
  returns: v.union(
    v.null(),
    v.object({
      status: auditStatus,
      isSample: v.boolean(),
      storageId: v.union(v.id("_storage"), v.null()),
      city: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { auditId }) => {
    const audit = await ctx.db.get(auditId);
    if (audit === null) return null;
    const renter = await ctx.db.get(audit.renterId);
    return {
      status: audit.status,
      isSample: audit.isSample,
      storageId: audit.storageId ?? null,
      city: renter?.city ?? null,
    };
  },
});

export const saveResult = internalMutation({
  args: {
    auditId: v.id("leaseAudits"),
    overallRisk: riskLevel,
    summary: v.string(),
    flags: v.array(leaseFlag),
    model: v.optional(v.string()), // absent = the pre-written sample review
  },
  returns: v.null(),
  handler: async (ctx, { auditId, overallRisk, summary, flags, model }) => {
    const audit = await ctx.db.get(auditId);
    if (audit === null) return null;
    await ctx.db.patch(auditId, {
      status: "done",
      overallRisk,
      summary,
      flags,
      model,
      error: undefined,
      completedAt: Date.now(),
    });

    const serious = flags.filter((f) => f.severity === "high").length;
    const name = audit.isSample ? "Sample lease" : "Lease check";
    const count = `${flags.length} ${flags.length === 1 ? "clause" : "clauses"} worth a look`;
    await logActivity(ctx, {
      renterId: audit.renterId,
      kind: "lease",
      title:
        flags.length === 0
          ? `${name}: nothing unusual found`
          : serious > 0
            ? `${name}: ${count}, ${serious} of them serious`
            : `${name}: ${count}`,
      detail: flags.length > 0 ? `Top concern: ${flags[0].title}` : undefined,
      listingId: audit.listingId,
    });
    return null;
  },
});

export const saveFailure = internalMutation({
  args: { auditId: v.id("leaseAudits"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { auditId, error }) => {
    const audit = await ctx.db.get(auditId);
    if (audit === null || audit.status !== "analyzing") return null;
    await ctx.db.patch(auditId, { status: "failed", error, completedAt: Date.now() });
    await logActivity(ctx, {
      renterId: audit.renterId,
      kind: "lease",
      title: "The lease check could not finish",
      detail: error,
      listingId: audit.listingId,
    });
    return null;
  },
});

/** Scheduled with every review. Actions are not retried, so a crash would otherwise spin forever. */
export const expireIfStuck = internalMutation({
  args: { auditId: v.id("leaseAudits") },
  returns: v.null(),
  handler: async (ctx, { auditId }) => {
    const audit = await ctx.db.get(auditId);
    if (audit === null || audit.status !== "analyzing") return null;
    await ctx.db.patch(auditId, {
      status: "failed",
      error: "The review took too long and was stopped. Please try again.",
      completedAt: Date.now(),
    });
    return null;
  },
});

/** Hourly cron. Deletes uploads that never reached `create` (closed tab, refused request). Lease PDFs are the only files stored. */
export const sweepOrphanUploads = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    // A day-wide window, re-read every hour, so blobs that are in use never block the ones behind them.
    const blobs = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) =>
        q.gt("_creationTime", now - 26 * 60 * 60 * 1000).lt("_creationTime", now - ORPHAN_AFTER_MS),
      )
      .take(200);
    let deleted = 0;
    for (const blob of blobs) {
      const audit = await ctx.db
        .query("leaseAudits")
        .withIndex("by_storage", (q) => q.eq("storageId", blob._id))
        .first();
      if (audit !== null) continue;
      await ctx.storage.delete(blob._id);
      deleted++;
    }
    return deleted;
  },
});
