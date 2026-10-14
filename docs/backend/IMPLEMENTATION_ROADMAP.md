# Mashwar — Backend Implementation, Migration & Quality Gates Roadmap
**Phase:** Phase 2 Architecture Review & Planning  
**Target Hub:** El Bagour, Menoufia Governorate, Egypt  
**Status:** Reviewable Specification (Zero Production Databases Accessed)  

---

## 1. Verified Code vs. Proposed Implementation Phases

| Area | Verified Repository Code (`flutter_mashwar/`) | Proposed Roadmap Phase | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Backend API** | No backend codebase (pure Flutter mock repository). | Phase 3: Dedicated Node.js / TypeScript API service with Drizzle ORM. | **Not Implemented** |
| **Database Migrations** | No SQL migration scripts. | Phase 3: Versioned DDL migrations in `db/migrations/` (design drafts in `docs/backend/drafts/`). | **Design Draft Ready** |
| **Quality Gates & Tests** | 4 Dart test files in `flutter_mashwar/test/` (NOT RUN in AI Studio container). | Automated Jest/Vitest integration test suite for RLS, concurrency, and idempotency. | **Not Implemented** |
| **Payment Integration** | Not implemented. | Phase 4: Paymob / Fawry sandbox integration for electronic payments & captain subscriptions. | **Not Implemented** |

---

## 2. Environment Separation Strategy

```text
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Local Development (`dev`)                                │
 │    - Docker Compose running PostgreSQL 15 + Redis           │
 │    - Mock SMS Provider (returns fixed code '1234')          │
 │    - Synthetic seed data (no real customer/captain PII)     │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Pull Request & CI Gates
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Staging Environment (`staging`)                          │
 │    - Managed Supabase / PostgreSQL instance matching prod   │
 │    - Paymob & Fawry Sandbox accounts (test cards / wallets) │
 │    - Staging SMS gateway with test recipient whitelist      │
 │    - Automated migration test runner with rollback verify   │
 └──────────────────────────────┬──────────────────────────────┘
                                │ Approval & Production Deploy
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Production Environment (`prod`)                          │
 │    - Multi-AZ High Availability PostgreSQL with WAL PITR    │
 │    - Automated daily encrypted snapshots                    │
 │    - Strict secret management (never in client or git)      │
 │    - Initial restricted beta launch in El Bagour center     │
 └─────────────────────────────────────────────────────────────┘
```

---

## 3. Automated Quality Gates & Integration Test Matrix

The backend test suite must implement automated integration tests covering the following critical invariants:

| Test Suite | Scenario Tested | Expected Verification |
| :--- | :--- | :--- |
| **RLS Isolation** | Customer A queries Order ID belonging to Customer B. | Returns `404 Not Found` / 0 rows; zero cross-tenant leakage. |
| **Price Tampering** | Client submits `quoted_fare = 500 piasters` for a 10 km rural trip. | Server rejects request with `400 Bad Request`; only signed `quoteId` accepted. |
| **Invalid State Jump** | Client attempts to transition order from `created` directly to `delivered`. | State machine throws `422 Unprocessable Entity`; state remains `created`. |
| **Concurrent Captain Race** | 10 simulated captains concurrently tap "Accept" on the exact same order. | Exactly 1 captain succeeds (`200 OK`); remaining 9 receive `409 Conflict`. |
| **Webhook Idempotency** | Payment gateway delivers identical `TRANSACTION_SUCCESS` webhook 3 times. | First event processes order; subsequent 2 return `200 OK (ALREADY_PROCESSED)`. |
| **Subscription Renewal Race**| Automated cron renewal and manual payment trigger simultaneously. | Distributed lock or unique index prevents double charging the captain. |
| **Cash Collection Integrity**| Captain attempts to complete delivery without recording cash collected. | Server blocks transition to `delivered` with `422 Missing Cash Collection`. |
| **Passenger Mobility Lock** | Client submits `serviceTypeId = 'passenger'`. | Request blocked with `403 Forbidden (REGULATORY_COMPLIANCE_LOCK)`. |

---

## 4. Database Migration & Rollback Protocol

1. **Pre-Migration Safety Checklist:**
   - Schema alterations must be strictly backwards-compatible (expand-and-contract pattern).
   - Columns are added as nullable or with defaults first.
   - Destructive commands (`DROP TABLE`, `DROP COLUMN`) are forbidden in standard migrations.
2. **Rollback Verification:**
   - Every migration script `000X_name.sql` must have a corresponding, tested `000X_name.down.sql`.
   - In the staging environment, the CI pipeline automatically runs `migrate up` followed by `migrate down` to guarantee clean rollback capabilities before promoting code.
3. **Synthetic Seed Policy:**
   - Real Egyptian National IDs, real names, or real customer phone numbers must **never** be committed to seed scripts.
   - All seed records use synthetic numbers (`+201000000001`, `+201000000002`) and simulated landmarks.

---

## 5. Phased Implementation Roadmap

```text
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 2 (Completed): Architecture Review & Database Planning│
 │ - Supabase + Trusted API topology specification             │
 │ - Relational Data Model (Integer minor units: Piasters)     │
 │ - Captain Subscription Lifecycle & Eligibility Policies     │
 │ - REST API Service Contracts & Draft DDL                    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 3 (Next Phase): Backend Scaffolding & Core Engines    │
 │ - Scaffold Node.js / TypeScript API Gateway                 │
 │ - Implement Authoritative Pricing Engine & Order FSM        │
 │ - Run Local Docker test containers with automated test suite│
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 4: Flutter API Client Integration                     │
 │ - Build `HttpOrderRepository` in `flutter_mashwar/`         │
 │ - Connect Riverpod `ordersProvider` to live API endpoints   │
 │ - Implement token refresh and offline retry interceptors    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 5: Egyptian Gateway Integration & Staging Pilot       │
 │ - Integrate Paymob / Fawry sandbox for card & wallet payments│
 │ - Onboard initial pilot fleet of 15 verified El Bagour      │
 │   captains on the 14-day subscription trial                 │
 └─────────────────────────────────────────────────────────────┘
```
