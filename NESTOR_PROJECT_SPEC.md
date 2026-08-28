# 🏡 NESTOR — Autonomous Tenant Concierge & Lease Negotiation Fleet

> **Convex All Gas Hackathon Blueprint ($45,000 Prize & Credit Pool)**  
> **Sponsored By:** Convex.dev, OpenAI, Firecrawl, & AgentMail  
> **Target:** 1st Place ($10,000 Cash + $5,000 Codex Credits)  
> **Submission Deadline:** September 22, 2026 @ 12:00 PM PT  
> **Submission Site:** `vibeapps.dev`  
> **Core Stack:** Convex Reactive Backend + Firecrawl Scraper + AgentMail Inbox + OpenAI Reasoning + Next.js 14  
> **License:** Apache 2.0 Open Source  
> **Author:** Ifeanyichukwu Onwo (`mrnetwork`)  

---

## 📌 Executive Summary

**Nestor** is a venture-grade, everyday consumer application that acts as an **Autonomous Tenant Concierge & Lease Negotiation Fleet** for apartment seekers.

Instead of spending hours refreshing Zillow/Craigslist, filling out repetitive application forms, and waiting days for landlord email replies, Nestor automates the entire renting journey:
1. **Scouts Listings:** Crawls regional property portals and landlord sites live via **Firecrawl**.
2. **Emails & Negotiates:** Grants the AI agent its own inbox via **AgentMail** (`renter-john@agentmail.to`) to inquire, attach an interactive "Verified Renter Passport", and negotiate lease terms.
3. **Real-Time Reactive Matrix:** Syncs landlord replies, tour slots, and lease terms live via **Convex WebSocket queries**.
4. **Scans Leases:** Audits lease PDF contracts for hidden fees and predatory terms using **OpenAI**.

---

## 🏗️ Architecture & Sponsor Integration Flow

```
                                  ┌──────────────────────────────┐
                                  │      User Mobile / Web UI    │
                                  └──────────────┬───────────────┘
                                                 │
                                                 │ 1. Set Renter Preferences & Budget
                                                 ▼
                                  ┌───────────────────────────────┐
                                  │  NESTOR Convex Reactive Sync  │
                                  │   (Database, Mutations, WS)   │
                                  └───────┬───────────────┬───────┘
                                          │               │
            2. Scrape Listings            │               │ 3. Autonomous Inquiries
               & Landlord Emails          │               │    & Tour Scheduling
                                          ▼               ▼
                       ┌──────────────────────┐       ┌──────────────────────┐
                       │  Firecrawl LLM Engine│       │  AgentMail Dedicated │
                       │ (Parses Rent Portals)│       │  Inbox & Outbox      │
                       └──────────────────────┘       └───────────┬──────────┘
                                                                  │
                                                                  │ 4. Landlord Replies
                                                                  ▼
                                                      ┌──────────────────────┐
                                                      │  OpenAI Lease Audit  │
                                                      │ & Negotiation Engine │
                                                      └──────────────────────┘
```

---

## 🌟 4 Key Moat Features

### 1. 🪪 The "Verified Renter Passport"
- Renter uploads their budget, credit band, income proof, and pet status ONCE into Convex.
- AgentMail inquiries include a sleek link (`nestor.convex.site/passport/john`) showing landlords a pre-vetted, high-trust tenant profile, driving 5x higher response rates.

### 2. 🤖 Dual-Agent Architecture (The Scout & The Negotiator)
- **The Scout (Firecrawl):** Scrapes listings, landlord contact emails, move-in terms, and pricing.
- **The Negotiator (AgentMail + OpenAI):** Sends tailored inquiries, negotiates lease flexibility (e.g., waived pet deposit, $50 rent discount), and schedules tour appointments.

### 3. 📅 Live Tour Calendar & Proposal Matrix (Convex Real-Time Sync)
- Landlord email responses received by AgentMail trigger Convex mutations.
- The user's dashboard updates in real-time without refreshing: `[Tour Confirmed: Sat 2PM]`, `[Landlord Agreed to $50 Discount]`.

### 4. 📜 Lease Agreement Redline & Scam Detector (OpenAI)
- Scans uploaded lease contracts/PDFs for predatory clauses (hidden maintenance fees, illegal entry terms) and highlights red flags on the Convex dashboard.

---

## 🎯 Judging Criteria Alignment

- **Everyday App (Not Dev Tool):** Solves a universal pain point that every judge and consumer experiences (apartment hunting).
- **Convex Depth:** Full use of Convex schema, real-time queries, mutations, WebSocket sync, and static hosting (`convex.site`).
- **Sponsor Stack Synergy:** Deep native use of Convex + Firecrawl + AgentMail + OpenAI.
- **Deploy Target:** Live production app deployed at `nestor.convex.site` or `nestor.chatgpt.site`.

---

## 📄 License
Apache 2.0 Open Source
