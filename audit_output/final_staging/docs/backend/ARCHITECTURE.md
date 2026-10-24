# Mashwar — Backend Architecture & Technology Specification
**Platform:** Mashwar (مشوار) — Local Delivery & Mobility Platform  
**Target Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt (Multi-City Architecture across Menoufia)  
**Phase:** Production-Readiness Engineering Complete  
**Status:** Implemented & Verified Locally (23 Automated Test Suites)  

---

## 1. Verified Repository Implementation Status

| Dimension | Client Prototype (`flutter_mashwar/` & `src/`) | Authoritative Backend (`backend/src/`) | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Data Platform** | React Web Marketplace + Flutter Mobile Source. | PostgreSQL + Kysely (`schema.ts`, Migrations `001` & `002`) with `PersistentStore` fallback when `DATABASE_URL` is unset. | **Implemented & Verified** |
| **Multi-Zone Pricing** | Zone-aware quote requests (`/api/v1/quotes`). | `PricingEngine` computing HMAC-SHA256 signed quotes in integer Egyptian Piasters per city/service zone (`cities`, `service_zones`, `zone_tariffs`). | **Implemented & Verified** |
| **Merchant & Catalog** | Store browsing, cart, and kitchen preparation UI. | `MerchantService` enforcing strict store ownership (`store.merchantUserId === req.user.id`) and integer piaster catalog items. | **Implemented & Verified** |
| **Order State Machine** | Store prep + captain delivery tracking. | `OrderFsm` enforcing legal transitions (`created` -> `accepted_by_store` -> `preparing` -> `ready_for_pickup` -> `captain_assigned` -> `at_pickup` -> `picked_up` -> `in_transit` -> `delivered`) + `order_state_history`. | **Implemented & Verified** |
| **Payments & COD** | Cash collection & electronic payment options. | `CashCollectionService` with Kysely `SELECT ... FOR UPDATE` row locking, idempotency payload hash checks, and 100,000 piaster ceiling enforcement. | **Implemented & Verified** |
| **Support & Complaints** | Customer/Captain/Merchant support tickets. | `ComplaintService` with tenant isolation, support agent assignment, resolution notes, and event history. | **Implemented & Verified** |
| **Passenger Transport** | Disabled in UI with regulatory notice. | Hard-locked at API, PricingEngine, and SystemSettings levels (`403 REGULATORY_COMPLIANCE_LOCK`). | **Implemented & Verified** |

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
