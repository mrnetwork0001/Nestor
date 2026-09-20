#!/usr/bin/env node
// Generates the signing keys Convex Auth needs and stores them on the
// deployment. Replaces the interactive `npx @convex-dev/auth` wizard.
//
//   npm run auth:keys              -> deployment in .env.local
//   npm run auth:keys -- --prod    -> production deployment
//   npm run auth:keys -- --force   -> rotate keys (signs everyone out)

import { spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";

const argv = process.argv.slice(2);
const force = argv.includes("--force");
const passthrough = argv.filter((a) => a !== "--force"); // e.g. --prod

function convex(args) {
  return spawnSync("npx", ["convex", ...args], { encoding: "utf8" });
}

function hasEnv(name) {
  const r = convex(["env", "get", ...passthrough, name]);
  return r.status === 0 && r.stdout.trim().length > 0;
}

function setEnv(name, value) {
  // "--" is required: the PEM starts with "-----BEGIN" and would be read as a flag.
  const r = convex(["env", "set", ...passthrough, "--", name, value]);
  if (r.status !== 0) {
    console.error(`Failed to set ${name}:\n${r.stderr}`);
    process.exit(1);
  }
  console.log(`set ${name}`);
}

if (!force && hasEnv("JWT_PRIVATE_KEY") && hasEnv("JWKS")) {
  console.log("JWT_PRIVATE_KEY and JWKS are already set. Pass --force to rotate.");
} else {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwk = publicKey.export({ format: "jwk" });
  setEnv("JWT_PRIVATE_KEY", pem.trimEnd().replace(/\n/g, " "));
  setEnv("JWKS", JSON.stringify({ keys: [{ use: "sig", ...jwk }] }));
}

if (process.env.SITE_URL) setEnv("SITE_URL", process.env.SITE_URL.replace(/\/$/, ""));
