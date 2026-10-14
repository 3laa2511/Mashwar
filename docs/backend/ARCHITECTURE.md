# Mashwar — Backend Architecture & Technology Specification
**Platform:** Mashwar (مشوار) — Local Delivery & Mobility Platform  
**Target Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Phase:** Phase 2 — Architecture Review & Database Planning  
**Status:** Reviewable Specification Only (No Production Databases Accessed or Modified)  

---

## 1. Verified Repository Facts vs. Proposed Design

To maintain strict architectural transparency, the table below separates verified repository code from proposed designs and unresolved decisions:

| Dimension | Verified Repository Code (`flutter_mashwar/`) | Proposed Production Design | Unresolved Decisions | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **Data Platform** | Static in-memory mock repository (`MockDataRepository`) with 12 hardcoded El Bagour landmarks. | Supabase (Managed PostgreSQL 15+, Supabase Auth, Storage) + Dedicated Trusted Server-Side API. | Selection of managed Supabase tier vs self-hosted Supabase for data residency in Egypt. | **Not Implemented** (Design Phase Only) |
| **API & Business Rules** | Client-side calculations in `PriceCalculator` (`double` arithmetic) and local `OrdersNotifier`. | Trusted Node.js/TypeScript REST API enforcing all authoritative business logic, pricing, dispatch, and state machines. | Hosting environment for trusted API (Cloud Run vs dedicated VPS). | **Not Implemented** (Design Phase Only) |
| **Captain Monetization** | Hardcoded daily earnings screen displaying static 240.00 EGP / 9 trips. | **Monthly Subscription Model** (default model: fixed monthly fee, zero commission on standard deliveries). | Exact subscription price tiers (e.g. 200 EGP vs 300 EGP/mo) and multi-day grace period duration. | **Not Implemented** (Design Phase Only) |
| **Payments** | Simulated cash total label on UI (`22.00 ج.م كاش`). | Multi-modal ledger: Cash-on-Delivery (COD) with captain cash holding limits + Electronic Payments via Egyptian aggregators. | Selection of primary Egyptian payment gateway (Paymob vs Fawry vs Accept). | **Not Implemented** (Design Phase Only) |
| **Order State Machine** | Local Dart `advanceOrderStatus()` allows client to unilaterally advance states. | Server-enforced Finite State Machine (FSM) with atomic row locking (`SELECT FOR UPDATE`) and audit trail. | Exact timeout duration for captain radar offer acceptance (e.g. 30s vs 45s). | **Not Implemented** (Design Phase Only) |
| **Passenger Transport** | Disabled in UI with warning dialog in `CustomerHomeScreen` & read-only lock in `OperationsDashboardScreen`. | Permanently locked at API and database schema levels (`service_types.is_enabled = FALSE`). | Regulatory compliance roadmap under Law No. 73 of 2018 with Menoufia Traffic Directorate. | **Verified Disabled in Client / Enforced in Schema** |

---

## 2. Technology Stack & Architectural Topology

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                Mobile Applications (Android / iOS)          │
 │                Flutter / Dart (Sound Null Safety)           │
 └──────────────┬──────────────────────────────▲───────────────┘
                │ HTTPS (JWT Bearer Token)     │ Push (FCM)
                ▼                              │
 ┌─────────────────────────────────────────────────────────────┐
 │            Trusted Server-Side API (Node.js / TypeScript)   │
 │ ─────────────────────────────────────────────────────────── │
 │  - Authorization & Least-Privilege Verification (RBAC)      │
 │  - Authoritative Pricing Engine (Minor Units: Piasters)     │
 │  - Captain Subscription Eligibility Evaluator               │
 │  - Atomic Dispatch & Concurrency Engine                     │
 │  - Payment Webhook Receiver (HMAC Verification)             │
 │  - Audit Event Dispatcher                                   │
 └──────────────┬──────────────────────────────▲───────────────┘
                │ Connection Pool (Service Key)│ Webhook Callbacks
                ▼                              │
 ┌─────────────────────────────────────────────────────────────┐
 │            Supabase Platform / PostgreSQL Engine            │
 │ ─────────────────────────────────────────────────────────── │
 │  - Supabase Auth: Phone/SMS OTP Identity Provider           │
 │  - PostgreSQL 15+ Relational Database (3NF)                 │
 │  - Row-Level Security (RLS) as Defense-in-Depth             │
 │  - Database Constraints (Foreign Keys, CHECKs, Unique)      │
 │  - Private Storage Buckets (Encrypted Captain Documents)    │
 └─────────────────────────────────────────────────────────────┘
```

### 2.1 The Role of Supabase vs. Trusted Server API
To ensure high security without compromising development speed:
1. **Supabase Auth:** Used for user authentication, issuance of signed JWT tokens, and phone-based OTP verification.
2. **Supabase Storage:** Used for private, encrypted storage of captain verification documents (scanned national IDs, criminal record certificates / فيش وتشبيه, and vehicle licenses) with short-lived presigned URLs.
3. **Supabase PostgreSQL:** Serves as the normalized, relational system of record with database constraints and RLS policies.
4. **Trusted Server-Side API:** A dedicated backend service written in TypeScript that sits between the mobile clients and the database for all sensitive mutations. 

### 2.2 Client Invariants (Zero-Trust Principle)
The mobile client must **never** be authoritative for:
- Calculating final delivery fares or applying discounts.
- Assigning a captain or selecting which captain receives an offer.
- Transitioning order statuses (e.g. marking an order `delivered`).
- Confirming payments or issuing refunds.
- Activating, renewing, or modifying captain subscriptions.
- Granting roles or modifying administrative privileges.

---

## 3. Operation Placement Matrix

Every operation in Mashwar is explicitly mapped to its authoritative execution tier:

| Operation | Execution Tier | Mechanism & Rationale |
| :--- | :--- | :--- |
| **Identity Verification & OTP** | Supabase Auth | Managed phone OTP identity provider with Egyptian carrier support. |
| **Authoritative Fare Calculation** | Trusted API | Server pricing engine computes itemized quote in piasters using versioned rules. Client only provides pickup/drop-off. |
| **Order Creation** | Trusted API | Validates quote expiration, service eligibility, and idempotency key before inserting into PostgreSQL. |
| **Captain Offer Dispatch** | Trusted API + DB Lock | Evaluates captain subscription eligibility, selects online captains within El Bagour radius, broadcasts offer. |
| **Captain Offer Acceptance** | Trusted API (`SELECT FOR UPDATE`) | Atomic database transaction acquires exclusive row lock to prevent double-assignment conflicts (`409 Conflict`). |
| **Delivery Status Transitions** | Trusted API | FSM validates allowed transitions, actor identity, and mandatory cash/confirmation payloads. |
| **Cash Collection Recording** | Trusted API + DB Trigger | Captain records collected cash amount; server validates against quoted fare and updates captain cash ledger. |
| **Electronic Payment Intent** | Trusted API | Communicates with payment provider via server-side credentials; generates client payment token. |
| **Payment Confirmation** | Payment Webhook | Webhook receiver validates provider HMAC signature and updates `payments` table idempotently. |
| **Captain Subscription Renewal** | Trusted API + Webhook | Recurring billing job or webhook confirms payment and extends subscription validity. |
| **Captain Assignment Eligibility** | Trusted API + DB View | Evaluates verification status, active subscription (or grace period), and cash holding limits before dispatch. |
| **Passenger Ride Requests** | Database Constraint + API | Hard-blocked by `service_types.is_enabled = FALSE` and API rejection (`403 Forbidden`). |
| **Tenant Data Isolation** | PostgreSQL RLS | Defense-in-depth policy guarantees users cannot read other tenants' data even in raw SQL queries. |
| **Audit Logging** | PostgreSQL Trigger + API | Immutable audit log records every state change, actor ID, and IP address. |

---

## 4. Least-Privilege Database Access

1. **Anonymous / Client Role (`anon`):** Has zero table permissions. Direct PostgREST access from the Flutter mobile app is disabled or restricted strictly to public read-only lookup of active service types.
2. **Authenticated Role (`authenticated`):** Bound by Row-Level Security (RLS) policies. Even if a compromised client attempts to issue direct SQL/PostgREST queries, RLS enforces that customers only see their own orders, and captains only see orders currently assigned to them.
3. **Trusted API Service Role (`service_role`):** Used exclusively by the trusted backend API. Bypasses RLS to perform atomic multi-table operations, but authorization checks are rigorously enforced in TypeScript middleware prior to database queries.


---

## 8. Platform Expansion, Marketplace & Location Dispatch (Scope Addendum — 2026-10-14)

**Architecture constraint:** El Bagour is the initial enabled service area, not a hard-coded product boundary. Region/city/coverage are configuration and relational data. Do not add city-specific conditionals to core pricing, orders, merchant discovery, or dispatch.

### Required bounded contexts
- **Geography & coverage:** country → governorate → city/locality → service area; active coverage boundaries and per-area service/operating configuration.
- **Merchant marketplace:** merchant owner/memberships, branches, catalog, availability, merchant subscription and entitlements.
- **Captain trust & fleet:** public captain profile separated from private identity documents/review records; service-area membership, availability and location freshness.
- **Orders & dispatch:** distinct direct-courier and merchant-order workflows sharing authoritative quotes, order snapshots, status history and durable assignment.
- **Operations:** separate owner/admin web surface backed by authorized APIs for area activation, merchant review, captain verification, order monitoring, subscription policy and audit.
- **Routing adapter:** `RoutingProvider` abstraction so a routing provider can be replaced without changing domain logic.

### Trust boundaries
The Flutter app and the `src/App.tsx` developer preview are untrusted clients. The preview is not the production owner dashboard. Only the authenticated trusted API can approve merchants/captains, issue authoritative quotes, change order state, assign a captain, grant subscription entitlements, or confirm electronic payment. Database RLS and constraints remain defense-in-depth.

### Expansion acceptance
Use a second synthetic city in tests to expose El Bagour assumptions. A service area is not enabled until operations has verified captain coverage, merchant supply, routing, pricing, support, cash reconciliation and local legal readiness. Passenger transport remains disabled pending separate legal and safety authorization.
