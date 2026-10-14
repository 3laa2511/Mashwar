# Mashwar — Unresolved Product, Commercial, Payment & Legal Decisions (OPEN DECISIONS)
**Phase:** Phase 3 Architecture Review & Security Hardening  
**Status:** Open for Stakeholder / Executive Sign-Off  

---

## 1. Verified Facts vs. Unresolved Decisions

| Domain | Verified Fact in Repository | Open Unresolved Decision | Decision Owner |
| :--- | :--- | :--- | :--- |
| **Monetization Model** | Prototype shows mock daily earnings. | Confirmed default model is **100% Monthly Subscription (Zero Commission on Deliveries)**. Unresolved: exact price (e.g. 200 vs 250 vs 300 EGP/month) & billing cycle. | Commercial & Finance Team |
| **Subscription Grace Period** | Not represented in client. | Exact duration of grace period (proposed: 72 hours) and exact behavior upon expiration. | Operations Lead |
| **Payment Gateway** | No gateway integrated. | Primary Egyptian electronic payment aggregator selection (Paymob vs Fawry vs Vodafone Cash Direct). | Engineering & Finance |
| **Routing & Distance Engine** | 12 fixed El Bagour landmarks. | Selection of Nile Delta routing provider (OSRM self-hosted vs Google Maps Distance Matrix API). | Engineering Lead |
| **Cash Rounding (أزمة الفكة)** | Exact floats in client (`22.0 EGP`). | Cash rounding policy for street transactions (ceil to 1.00 EGP vs 5.00 EGP increments). | Operations Lead |
| **Cash Remittance Frequency** | Not represented in client. | Daily vs weekly cash remittance to El Bagour office or digital transfer. | Finance / Operations |
| **Passenger Transportation** | Disabled in UI with warning dialog. | Commercial licensing under Law No. 73 of 2018 and Menoufia Traffic Authority approval. | Legal & Compliance Team |

---

## 2. Detailed Decision Dossiers & Invariants

### Decision 2.1: Captain Subscription Pricing & Plan Structure
- **Confirmed Baseline Invariant:** Captain monetization is **100% Monthly Subscription with ZERO commission on standard deliveries**. Captains retain 100% of the customer delivery fare. No percentage-based commission may be silently introduced.
- **Unresolved Variables:**
  - *Monthly Fee Amount:* Recommended 200.00 EGP (20,000 piasters) during initial 3-month launch promo, transitioning to 250.00 or 300.00 EGP standard fee.
  - *Free Trial Duration:* Recommended 14 calendar days upon initial document verification approval.
- **Status:** **OPEN DECISION — AWAITING MANAGEMENT APPROVAL**.

---

### Decision 2.2: Exact Captain Grace-Period & Expiration Behavior
- **Proposed Policy Specification:**
  1. **Trial Period (Days 1–14):** Full eligibility; receives unlimited dispatch offers.
  2. **Active Subscription (Days 1–30):** Full eligibility; receives unlimited dispatch offers.
  3. **Grace Period (72 Hours Post-Expiration):** 
     - **Allowed:** Eligible to receive and accept new delivery offers.
     - **In-App Experience:** Persistent non-dismissible amber alert banner at the top of the Captain dashboard: *"انتهت فترة الاشتراك. أنت الآن في فترة سماح لمدة ٧٢ ساعة. يرجى التجديد لتجنب إيقاف استقبال الطلبات."*
  4. **Expired Status (Post-Grace Period):**
     - **Forbidden:** Dispatch engine automatically excludes captain from incoming radar offers (`is_online` forced to `false`).
     - **Allowed:** Can complete any currently active in-flight delivery; can view past earnings history; can access the subscription purchase/renewal screen.
- **Status:** **OPEN DECISION — AWAITING OPERATIONS SIGN-OFF**.

---

### Decision 2.3: Payment Gateway Provider Selection & Onboarding
- **Options Evaluated:**
  - *Option A: Paymob (Accept)* — Market leader in Egypt for card processing and mobile wallets (Vodafone Cash, Orange Money, InstaPay). Comprehensive webhook support and Arabic checkout screens.
  - *Option B: Fawry Pay* — Deepest penetration in rural Egyptian convenience stores and kiosks. Excellent for cash-in vouchers (كود دفع فوري), but higher integration overhead.
  - *Option C: Multi-Provider (Paymob for Wallets/Cards + Fawry for Kiosk Cash-In)*.
- **Recommendation:** Start with Paymob for electronic cards and mobile wallets in Phase 3/4; integrate Fawry cash-in codes for captain subscription purchases in Phase 5.
- **Status:** **OPEN DECISION — AWAITING COMMERCIAL CONTRACT TERMS**.

---

### Decision 2.4: Cash Rounding & Street Change Friction (أزمة الفكة)
- **Problem Statement:** In Egyptian street transactions, coins or fractions under 1.00 EGP do not circulate. Fares like `23.40 EGP` cause arguments between captains and customers.
- **Options Evaluated:**
  - *Option A (Ceiling to Whole Pound):* `Math.ceil(fare)` (e.g. 23.20 EGP → 24.00 EGP).
  - *Option B (Nearest 5 Pounds Rounding):* (e.g. 22.00 EGP → 20.00 or 25.00 EGP).
- **Recommendation:** Option A (Ceiling to the nearest integer Egyptian Pound) as the fairest, least disruptive policy for both captain and customer.
- **Status:** **OPEN DECISION — AWAITING OPERATIONS SIGN-OFF**.

---

### Decision 2.5: Nile Delta Routing & Distance Calculation Engine
- **Problem Statement:** Straight-line calculations underestimate travel distances in El Bagour due to irrigation canals (ترع) and railway crossings.
- **Options Evaluated:**
  - *Option A: Static Landmark Matrix* — Fixed distances between 25 El Bagour hubs. Deterministic and zero-cost, but rigid.
  - *Option B: Self-Hosted OSRM (OpenStreetMap)* — Highly accurate, zero per-query cost, but requires maintaining Menoufia OSM map tiles.
  - *Option C: Google Maps Distance Matrix API* — Turnkey accuracy, but incurs per-call USD billing.
- **Recommendation:** Option A for initial MVP / beta launch, transitioning to Option B (OSRM) as order volume grows.
- **Status:** **OPEN DECISION — AWAITING BUDGET SIGN-OFF**.

---

### Decision 2.6: Passenger Mobility Legal & Regulatory Roadmap
- **Platform Invariant:** Passenger ride-hailing is **strictly locked and disabled** across all database entities, APIs, and mobile UI flows.
- **Legal Review Items:**
  1. Compliance with Law No. 73 of 2018 regulating land transport using information technology in Egypt.
  2. Obtaining commercial ride-hailing operating licenses from the Land Transport Regulatory Authority (جهاز تنظيم النقل البري).
  3. Commercial passenger bodily injury liability insurance with an Egyptian insurer.
- **Status:** **PERMANENTLY LOCKED PENDING Q3 2027 REGULATORY REVIEW**.


---

## 4. New Decisions for Marketplace & Multi-Region Expansion (2026-10-14)

These items remain open unless explicitly approved. The initial enabled area is El Bagour, Menoufia; the product must support adding more areas through data/configuration.

| Decision | Safe default for design | Must be approved before production |
|---|---|---|
| Merchant subscription price/trial/renewal/grace | Separate plans and entitlements from captain subscription; no hard-coded commercial terms | Yes |
| Merchant fees/commission | Do not silently introduce commission; display and charge only approved terms | Yes |
| Merchant onboarding documents | Collect minimum legally necessary data; private storage and limited reviewer access | Legal basis, required documents, retention |
| Captain identity provider/review SLA | Manual authorized review until a provider is chosen | Yes |
| Service-area boundaries | Operations-managed active coverage; El Bagour initially enabled | Boundary, delivery hours, capacity |
| Routing provider | `RoutingProvider` abstraction; no fake road distance/ETA | Cost, accuracy, privacy and service terms |
| Captain offer timeout/radius/waves | Configurable values with auditability | Operational tuning |
| Location retention/background tracking | Minimum necessary collection, transparent permission, short retention | Legal and product approval |
| Ratings/moderation | One eligible rating per completed order, abuse reporting | Final moderation policy |
| Passenger transportation | Disabled | Separate legal, licensing, insurance and safety approval |

No real customer/captain PII, production secrets, production database changes, or live payment integrations are authorized by this documentation change.
