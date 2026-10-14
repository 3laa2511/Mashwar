# Mashwar — Unresolved Product, Commercial & Legal Decisions (OPEN DECISIONS)
**Phase:** Phase 2 Backend Specification  
**Status:** Open for Stakeholder / Executive Sign-Off  

---

## 1. Commercial Pricing Model for El Bagour

### Open Decision 1.1: Platform Fee Allocation
- **Current Prototype Rule:** 2.00 EGP platform fee added directly to customer delivery fare.
- **Unresolved Alternatives:**
  - *Option A (Customer Pays):* Quoted fare is `Base + Distance + Rural + Platform Fee` (Total paid by customer).
  - *Option B (Captain Commission):* Customer pays pure delivery fare; Mashwar deducts 10% or 2.00 EGP from the captain's delivery payout.
  - *Option C (Hybrid / Merchant Absorbed):* For restaurant/store orders, the merchant absorbs the platform fee as part of their partnership agreement.
- **Status:** **OPEN DECISION — AWAITING BUSINESS REVIEW**.

---

## 2. Distance Calculation & Routing Engine for the Nile Delta

### Open Decision 2.1: Road Routing vs. Direct Landmark Distances
- **Current Prototype Rule:** Straight-line estimate with 1.35x winding factor or static distance matrix between 12 El Bagour landmarks.
- **Operational Reality:** The Nile Delta contains agricultural canals, railway crossings, and unpaved rural berm roads (طرق جسور الترع والمصارف) where straight-line distance severely understates travel time.
- **Unresolved Alternatives:**
  - *Option A (Static Landmark Matrix):* Pre-measured distance matrix between known centers (El Bagour Station, Shintana, Kafr El Bagour, Meet Afif). Inexpensive and deterministic, but inflexible for house-to-house deliveries.
  - *Option B (OSRM / OpenStreetMap Engine):* Self-hosted OpenStreetMap routing service. No per-request API costs, but requires local map refinement for Menoufia villages.
  - *Option C (Google Maps Distance Matrix API):* High precision, accounts for local Egyptian road conditions, but incurs recurring USD transaction costs per quote.
- **Status:** **OPEN DECISION — AWAITING BUDGET & INFRASTRUCTURE BENCHMARKING**.

---

## 3. Monetary Rounding & Coinage Friction

### Open Decision 3.1: Egyptian Cash Currency Rounding Policy
- **Operational Reality:** In Egyptian local cash transactions, coins or fractions under 1.00 EGP (e.g. 0.25 EGP, 0.50 EGP) are practically absent from daily street circulation (أزمة الفكة). Calculating a fare of `23.40 EGP` or `18.75 EGP` creates severe operational friction between captains and customers.
- **Unresolved Alternatives:**
  - *Option A (Ceiling to Nearest Whole Pound):* `Math.ceil(fare)` (e.g. 23.20 EGP → 24.00 EGP).
  - *Option B (Nearest 5 Pounds Rounding):* Round to nearest 5.00 EGP increment (e.g. 22.00 EGP → 20.00 or 25.00 EGP) to ease change handling.
  - *Option C (Digital Wallet Credit for Remainder):* Overpayments stored as credit for subsequent orders.
- **Status:** **OPEN DECISION — AWAITING OPERATIONS FIELD TRIAL**.

---

## 4. Captain Cash Reconciliation & Settlement Policy

### Open Decision 4.1: Cash-on-Delivery (COD) Remittance
- **Current Prototype Rule:** Captains collect cash directly from customers up to a maximum holding limit (e.g. 1,000 EGP).
- **Unresolved Questions:**
  - What is the remittance cycle? (Daily remittance at El Bagour operational office, or digital remittance via Fawry / Vodafone Cash merchant code?).
  - What happens when a captain reaches the 1,000 EGP cash holding limit? (Automatic dispatch suspension until balance is cleared).
- **Status:** **OPEN DECISION — AWAITING FINANCIAL TREASURY REVIEW**.

---

## 5. Cancellation Penalty & Captain Compensation

### Open Decision 5.1: Late Cancellation Fees
- **Current Prototype Rule:** 10.00 EGP cancellation fee.
- **Unresolved Questions:**
  - At what point is a customer charged for cancellation? (e.g., free cancellation within 3 minutes of captain assignment; 10 EGP fee if captain has already arrived at the pickup location).
  - In a Cash-on-Delivery model, how is a cancellation fee collected from a customer who refused an order at their doorstep? (Added as a debit on their next Mashwar booking).
  - How much of this fee is credited to the captain as petrol / effort compensation? (e.g., 8 EGP to captain, 2 EGP to platform).
- **Status:** **OPEN DECISION — AWAITING CUSTOMER OPERATIONS SIGN-OFF**.

---

## 6. Passenger Transportation Regulatory Roadmap

### Open Decision 6.1: Legal & Licensing Prerequisites
- **Current Platform Invariant:** Passenger mobility remains **strictly disabled** across all database entities, APIs, and mobile UI flows.
- **Prerequisites for Unlocking:**
  1. Review of Law No. 73 of 2018 regulating road transport services using information technology in Egypt.
  2. Obtaining commercial ride-hailing operating licenses from the Land Transport Regulatory Authority (جهاز تنظيم النقل البري الداخلي والدولي).
  3. Commercial passenger bodily injury liability insurance with an Egyptian licensed insurer.
  4. Coordination with Menoufia Traffic Directorate regarding two-wheeler passenger transport rules.
- **Status:** **LOCKED BY POLICY — REVIEWS SCHEDULED FOR Q3 2027**.
