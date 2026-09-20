#!/usr/bin/env node
// Pushes the filled-in keys from .env.keys into the Convex deployment's
// environment. Prints variable names only, never values.
//
//   npm run env:push              -> dev / local deployment
//   npm run env:push -- --prod    -> production deployment

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SOURCE = ".env.keys";
const ALLOWED = new Set([
  "FIRECRAWL_API_KEY",
  "AGENTMAIL_API_KEY",
  "OPENAI_API_KEY",
  "AGENTMAIL_WEBHOOK_SECRET",
  "AGENTMAIL_POLL",
]);

if (!existsSync(SOURCE)) {
  console.error(`No ${SOURCE} found. Copy the block from .env.example into ${SOURCE} first.`);
  process.exit(1);
}

const filled = [];
const blank = [];
for (const raw of readFileSync(SOURCE, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const name = line.slice(0, eq).trim();
  const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!ALLOWED.has(name)) {
    console.warn(`Skipping ${name}: not a key Nestor uses.`);
    continue;
  }
  if (name.startsWith("VITE_")) continue; // would be shipped to the browser
  (value ? filled : blank).push({ name, value });
}

if (filled.length === 0) {
  console.log(`Nothing to push: every key in ${SOURCE} is blank.`);
  process.exit(0);
}

const passthrough = process.argv.slice(2); // e.g. --prod
const dir = mkdtempSync(join(tmpdir(), "nestor-env-"));
const tmpFile = join(dir, "keys.env");
try {
  writeFileSync(tmpFile, filled.map(({ name, value }) => `${name}=${value}`).join("\n") + "\n", {
    mode: 0o600,
  });
  const result = spawnSync(
    "npx",
    ["convex", "env", "set", "--from-file", tmpFile, "--force", ...passthrough],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const target = passthrough.includes("--prod") ? "production" : "dev";
console.log(`\nPushed to the ${target} deployment: ${filled.map((k) => k.name).join(", ")}`);
if (blank.length) {
  console.log(`Still blank (demo mode): ${blank.map((k) => k.name).join(", ")}`);
}
