/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as agentmailApi from "../agentmailApi.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as devtools from "../devtools.js";
import type * as http from "../http.js";
import type * as landlordSim from "../landlordSim.js";
import type * as leaseAuditor from "../leaseAuditor.js";
import type * as leaseAudits from "../leaseAudits.js";
import type * as lib_aiSchemas from "../lib/aiSchemas.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_integrations from "../lib/integrations.js";
import type * as lib_leaseSchema from "../lib/leaseSchema.js";
import type * as lib_limits from "../lib/limits.js";
import type * as lib_listingSchema from "../lib/listingSchema.js";
import type * as lib_matching from "../lib/matching.js";
import type * as lib_negotiationPolicy from "../lib/negotiationPolicy.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_sampleLease from "../lib/sampleLease.js";
import type * as lib_sampleListings from "../lib/sampleListings.js";
import type * as lib_validators from "../lib/validators.js";
import type * as listings from "../listings.js";
import type * as mail from "../mail.js";
import type * as negotiator from "../negotiator.js";
import type * as renters from "../renters.js";
import type * as scout from "../scout.js";
import type * as system from "../system.js";
import type * as threads from "../threads.js";
import type * as tours from "../tours.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  agentmailApi: typeof agentmailApi;
  auth: typeof auth;
  crons: typeof crons;
  dashboard: typeof dashboard;
  devtools: typeof devtools;
  http: typeof http;
  landlordSim: typeof landlordSim;
  leaseAuditor: typeof leaseAuditor;
  leaseAudits: typeof leaseAudits;
  "lib/aiSchemas": typeof lib_aiSchemas;
  "lib/auth": typeof lib_auth;
  "lib/integrations": typeof lib_integrations;
  "lib/leaseSchema": typeof lib_leaseSchema;
  "lib/limits": typeof lib_limits;
  "lib/listingSchema": typeof lib_listingSchema;
  "lib/matching": typeof lib_matching;
  "lib/negotiationPolicy": typeof lib_negotiationPolicy;
  "lib/openai": typeof lib_openai;
  "lib/sampleLease": typeof lib_sampleLease;
  "lib/sampleListings": typeof lib_sampleListings;
  "lib/validators": typeof lib_validators;
  listings: typeof listings;
  mail: typeof mail;
  negotiator: typeof negotiator;
  renters: typeof renters;
  scout: typeof scout;
  system: typeof system;
  threads: typeof threads;
  tours: typeof tours;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
