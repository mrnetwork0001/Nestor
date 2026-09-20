import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Local deployments have no public URL for AgentMail's webhook, so inbound mail
// is polled. pollAll returns at once unless AGENTMAIL_POLL=1 and the inboxes exist.
crons.interval("agentmail poll", { seconds: 20 }, internal.mail.pollAll, {});

// Keeps listings that are under negotiation fresh, so a rent drop shows up in the feed.
crons.interval("refresh tracked listings", { hours: 12 }, internal.scout.refreshStale, {});

// Uploads that never became a lease check would otherwise sit in storage for good.
crons.interval("sweep orphan uploads", { hours: 1 }, internal.leaseAudits.sweepOrphanUploads, {});

export default crons;
