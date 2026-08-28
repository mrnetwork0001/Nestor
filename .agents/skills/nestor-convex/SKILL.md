---
name: nestor-convex
description: Architecture, guidelines, Convex backend rules, Firecrawl, AgentMail, and OpenAI specs for Nestor built for the Convex All Gas Hackathon.
---

# 🏡 Nestor — Convex All Gas Hackathon Skill & Execution Guide

Use this skill whenever working on, reviewing, or developing **Nestor** — the Autonomous Tenant Concierge & Lease Negotiation Fleet for the Convex All Gas Hackathon.

## 📌 Project Overview & Prize Targets
- **Target Event:** Convex All Gas Hackathon (OpenAI, Firecrawl, AgentMail, Convex.dev)
- **Submission Deadline:** September 22, 2026 @ 12:00 PM PT
- **Prize Target:** 1st Place ($10,000 Cash + $5,000 Codex Credits)
- **Core Tech Stack:** Convex + Firecrawl + AgentMail + OpenAI + Next.js 14

## 🏗️ Technical Architecture Rules

### 1. Convex Reactive Backend
- Write schema, mutations, and reactive queries in `convex/schema.ts` and `convex/listings.ts`.

### 2. Firecrawl Integration
- Use `@mendable/firecrawl-js` to crawl property portals and extract landlord contact info.

### 3. AgentMail Inbox & Outbox
- Provision agent email inboxes (`@agentmail.to`) for outbound landlord inquiries and inbound tour confirmations.

### 4. Verified Renter Passport
- Serve static/dynamic passport links (`/passport/[renterId]`) displaying pre-vetted tenant specs to landlords.

## 🚨 Submission Checklist
- Public GitHub repo under OSI-approved license (Apache 2.0 / MIT).
- Live deployed URL on `convex.site`.
- `hackathon.md` build log file.
- 1-Minute video walkthrough.
