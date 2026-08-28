# 🏡 Nestor — Autonomous Tenant Concierge & Lease Negotiation Fleet

> Built for **Convex All Gas Hackathon** sponsored by **OpenAI, Firecrawl, AgentMail, & Convex.dev** ($45,000 Total Pool)  
> **Target:** 1st Place ($10,000 Cash + $5,000 Codex Credits)  
> **Submission Deadline:** September 22, 2026 @ 12:00 PM PT  
> **Submission Site:** `vibeapps.dev`  
> **Hosting Target:** `nestor.convex.site`  
> **License:** Apache 2.0 Open Source  

---

## 📌 Overview

**Nestor** is an everyday consumer platform that acts as an **Autonomous Tenant Concierge & Lease Negotiation Fleet** for apartment seekers.

- **The Scout (Firecrawl):** Scrapes regional rental portals, landlord sites, and private listings, extracting rent price, lease terms, and landlord contact emails.
- **The Negotiator (AgentMail + OpenAI):** Provisions a dedicated agent email inbox (`renter@agentmail.to`), sends tailored landlord inquiries, attaches an interactive "Verified Renter Passport", and negotiates lease flexibilities.
- **Live Tour Matrix (Convex):** Real-time reactive dashboard showing tour bookings, price negotiation updates, and live email threads.
- **Lease Scam Detector (OpenAI):** Scans lease PDF contracts for hidden fees and predatory terms.

---

## 🚀 Quickstart & Setup Instructions

### 1. Prerequisites
- Node.js 18+
- Convex Account (`npx convex dev`)
- Firecrawl API Key (`FIRECRAWL_API_KEY`)
- AgentMail API Key (`AGENTMAIL_API_KEY`)
- OpenAI API Key (`OPENAI_API_KEY`)

### 2. Installation
```bash
git clone https://github.com/mrnetwork/Nestor.git
cd Nestor
npm install
npx convex dev
```

---

## 📄 License
Apache 2.0 Open Source
