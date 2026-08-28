# 🏆 Convex All Gas Hackathon Build Log — NESTOR

> **Project Name:** Nestor  
> **Tagline:** Autonomous Tenant Concierge & Lease Negotiation Fleet  
> **Submitted To:** `vibeapps.dev`  
> **Live App URL:** `https://nestor.convex.site`  
> **GitHub Repo:** `https://github.com/mrnetwork/Nestor`  
> **Demo Video Link:** `https://youtube.com/watch?v=demo`  

---

## 🛠️ Stack & Sponsor Integration Breakdown

### 1. Convex Backend (`convex/`)
- Real-time reactive database schema storing apartment listings, renter passports, landlord email threads, and tour schedules.
- Live WebSocket updates powered by Convex queries & mutations.

### 2. Firecrawl Integration (`@mendable/firecrawl-js`)
- Crawls rental portals and extracts clean structured markdown including rent, move-in dates, and direct landlord contact emails.

### 3. AgentMail Integration (`agentmail.to`)
- Provisions dedicated agent inboxes (`renter@agentmail.to`) to send automated landlord inquiries, attach Verified Renter Passports, and receive landlord replies in real-time.

### 4. OpenAI Integration
- Parses incoming landlord email replies, extracts tour appointment slots, and audits lease PDF contracts for predatory clauses.

---

## 📜 Build Changelog
- **Aug 28, 2026:** Master blueprint, architecture specs, and Convex schema design initialized.
