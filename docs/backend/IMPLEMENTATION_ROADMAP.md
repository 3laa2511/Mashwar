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


---

## 6. Roadmap Addendum — Multi-Region Marketplace (2026-10-14)

This section supersedes any implication that El Bagour is the only supported future geography. It does not mark any phase complete.

1. **P0 — Reconcile foundation and security:** inspect actual source; remove fallback signing secrets; require verified auth/JWT and real authorization; close quote-verification bypass; replace in-memory order/idempotency/dispatch state with durable database transactions; clearly distinguish unit tests from DB integration tests.
2. **P1 — Multi-region data foundation:** model service areas, coverage, per-area service configuration and routing adapter; test with El Bagour plus a second synthetic city. Do not apply migrations to production/staging without explicit approval.
3. **P2 — Owner/admin web dashboard:** separate production admin surface from `src/App.tsx` developer preview; real authenticated APIs, least-privilege permissions, audit trail and honest system health.
4. **P3 — Merchant marketplace:** applications, branch review, catalog, stock where enabled, merchant orders and independent merchant subscription/entitlements.
5. **P4 — Captain onboarding & trust:** document submission/review, private storage, public profile DTO, service-area eligibility and subscription eligibility.
6. **P5 — Location dispatch:** real location permission flow, routing provider, eligible-candidate ranking, durable offers, atomic assignment, no-captain queue and privacy controls.
7. **P6 — Customer journey:** merchant discovery, search, cart, direct courier/errand flows, quote confirmation, order status, support and eligible ratings.
8. **P7 — Release readiness:** RLS and API authorization integration tests, concurrency tests against PostgreSQL, secrets audit, backup/restore drill, monitoring/cost controls, operational/legal readiness and staged rollout.

### Gate to move from specification to implementation
Each phase must identify changed files, commands actually executed, test outputs, known gaps and whether it used mocks or real infrastructure. A passing unit suite alone does not prove database persistence, RLS, provider integration, GPS, or production readiness.
