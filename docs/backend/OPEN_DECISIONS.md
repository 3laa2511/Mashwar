# Mashwar — Unresolved Product, Commercial, Payment & Legal Decisions (OPEN DECISIONS)
**Phase:** Phase 2 Architecture Review & Database Planning  
**Status:** Open for Stakeholder / Executive Sign-Off  

---

## 1. Verified Facts vs. Unresolved Decisions

| Domain | Verified Fact in Repository | Open Unresolved Decision | Decision Owner |
| :--- | :--- | :--- | :--- |
| **Monetization** | Prototype shows mock daily earnings. | Confirmed default model is **Monthly Subscription**. Unresolved: exact price (e.g. 200 vs 250 vs 300 EGP/month) & plan duration. | Commercial & Finance Team |
| **Subscription Grace Period** | Not represented in client. | Exact duration of grace period before hard dispatch cutoff (proposed: 72 hours). | Operations Lead |
| **Payment Gateway** | No gateway integrated. | Primary Egyptian electronic payment aggregator selection (Paymob vs Fawry vs Vodafone Cash Direct). | Engineering & Finance |
| **Routing & Distance Engine** | 12 fixed El Bagour landmarks. | Selection of Nile Delta routing provider (OSRM self-hosted vs Google Maps Distance Matrix API). | Engineering Lead |
| **Cash Rounding (Fakka)** | Exact floats in client (`22.0 EGP`). | Cash rounding policy for street transactions (ceil to 1.00 EGP vs 5.00 EGP increments). | Operations Lead |
| **Cash Remittance Frequency** | Not represented in client. | Daily vs weekly cash remittance to El Bagour office or digital transfer. | Finance / Operations |
| **Passenger Transportation** | Disabled in UI with warning dialog. | Commercial licensing under Law No. 73 of 2018 and Menoufia Traffic Authority approval. | Legal & Compliance Team |

---

## 2. Detailed Decision Dossiers

### Decision 2.1: Payment Gateway Provider Selection & Onboarding
- **Options Evaluated:**
  - *Option A: Paymob (Accept)* — Market leader in Egypt for Card payments and Mobile Wallets (Vodafone Cash, Orange Money, InstaPay). Comprehensive webhook support and Arabic checkout screens.
  - *Option B: Fawry Pay* — Deepest penetration in rural Egyptian convenience stores and kiosks. Excellent for cash-in vouchers (كود دفع فوري), but slightly higher merchant integration overhead.
  - *Option C: Multi-Provider (Paymob for Wallets/Cards + Fawry for Kiosk Cash-In)*.
- **Recommendation:** Start with Paymob for electronic cards and mobile wallets in Phase 3; integrate Fawry cash-in codes for captain subscription purchases in Phase 4.
- **Status:** **OPEN DECISION — AWAITING COMMERCIAL CONTRACT TERMS**.

---

### Decision 2.2: Captain Subscription Pricing & Plan Structure
- **Confirmed Baseline:** Captain monetization is **100% Monthly Subscription**, not transaction commission. Captains retain 100% of customer delivery fares.
- **Unresolved Variables:**
  - *Monthly Fee Amount:* Recommended 200.00 EGP (20,000 piasters) during initial 3-month launch promo, transitioning to 300.00 EGP (30,000 piasters) standard fee.
  - *Free Trial Duration:* Recommended 14 calendar days upon initial document approval.
  - *Grace Period Window:* Recommended 72 hours (3 days) after period expiration before dispatch radar is suspended.
- **Status:** **OPEN DECISION — AWAITING MANAGEMENT APPROVAL**.

---

### Decision 2.3: Cash Rounding & Street Change Friction (أزمة الفكة)
- **Problem Statement:** In Egyptian street transactions, coins or fractions under 1.00 EGP do not circulate. Fares like `23.40 EGP` cause arguments between captains and customers.
- **Options Evaluated:**
  - *Option A (Ceiling to Whole Pound):* `Math.ceil(fare)` (e.g. 23.20 EGP → 24.00 EGP).
  - *Option B (Nearest 5 Pounds Rounding):* (e.g. 22.00 EGP → 20.00 or 25.00 EGP).
- **Recommendation:** Option A (Ceiling to the nearest integer Egyptian Pound) as the fairest, least disruptive policy for both captain and customer.
- **Status:** **OPEN DECISION — AWAITING OPERATIONS SIGN-OFF**.

---

### Decision 2.4: Nile Delta Routing & Distance Calculation Engine
- **Problem Statement:** Straight-line calculations underestimate travel distances in El Bagour due to irrigation canals (ترع) and railway crossings.
- **Options Evaluated:**
  - *Option A: Static Landmark Matrix* — Fixed distances between 25 El Bagour hubs. Deterministic and zero-cost, but rigid.
  - *Option B: Self-Hosted OSRM (OpenStreetMap)* — Highly accurate, zero per-query cost, but requires maintaining Menoufia OSM map tiles.
  - *Option C: Google Maps Distance Matrix API* — Turnkey accuracy, but incurs per-call USD billing.
- **Recommendation:** Option A for initial MVP / beta launch, transitioning to Option B (OSRM) as order volume grows.
- **Status:** **OPEN DECISION — AWAITING BUDGET SIGN-OFF**.

---

### Decision 2.5: Passenger Mobility Legal & Regulatory Roadmap
- **Platform Invariant:** Passenger ride-hailing is **strictly locked and disabled**.
- **Legal Review Items:**
  1. Compliance with Law No. 73 of 2018 regulating land transport using information technology.
  2. Coordination with Land Transport Regulatory Authority (جهاز تنظيم النقل البري).
  3. Commercial passenger bodily injury liability insurance with an Egyptian insurer.
- **Status:** **PERMANENTLY LOCKED PENDING Q3 2027 REGULATORY REVIEW**.
