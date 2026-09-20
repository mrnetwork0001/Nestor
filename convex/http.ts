import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handleAgentMailWebhook } from "./mail";

const http = httpRouter();

// Convex Auth: OIDC discovery and JWKS under /.well-known/
auth.addHttpRoutes(http);

// AgentMail delivers inbound landlord email here, signed (Svix). Verification, dedupe and
// storage are the @agentmail/convex component's; see handleAgentMailWebhook for the two guards.
http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => await handleAgentMailWebhook(ctx, request)),
});

// The SPA. A GET catch-all on "/", so exact routes above always win and deep
// links like /passport/<token> fall back to index.html.
registerStaticRoutes(http, components.staticHosting);

export default http;
