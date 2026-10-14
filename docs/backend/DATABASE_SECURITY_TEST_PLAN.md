# Mashwar — Database Security, Integrity & Acceptance Test Plan
**Phase:** Phase 3 Architecture Review & Security Hardening  
**Target:** PostgreSQL 15+ / Supabase & Trusted Server API  
**Status:** Test Specification (All Tests Marked NOT RUN — Zero Live Execution)  

---

## 1. Quality Gate Philosophy

Every invariant, security boundary, and financial calculation specified in Phase 2 and Phase 3 must be verifiable through automated tests before production deployment. In accordance with platform operating rules, **no tests have been run against a live database**, and all test cases in this document are documented as **NOT RUN** pending local container/staging environment provisioning.

---

## 2. Security, Integrity & Concurrency Test Matrix

| ID | Test Category | Scenario / Preconditions | Attempted Action | Expected Result | Test Level | Current Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **Cross-User Isolation** | Customer A has order `ord_001`. Customer B is authenticated with valid JWT. | Customer B sends `GET /api/v1/orders/ord_001` or direct PostgREST query. | **404 Not Found** / 0 rows returned. Zero data leakage across customer boundaries. | Integration (RLS + API) | **NOT RUN** (Design Specified) |
| **SEC-02** | **Cross-Role Violation** | Captain C is authenticated. Merchant branch `br_001` has active kitchen order. | Captain C sends `GET /api/v1/merchant/branches/br_001/orders`. | **403 Forbidden**. Captain identity rejected at RBAC middleware. | Integration (API) | **NOT RUN** (Design Specified) |
| **SEC-03** | **Fare Tampering** | Trip distance is 8.5 km to a rural village (Server quote: 4200 piasters). | Client submits `POST /api/v1/orders` with body `quotedFarePiasters: 500`. | **400 Bad Request**. Server ignores client fare and validates against signed `quoteId`. | Integration (API) | **NOT RUN** (Design Specified) |
| **SEC-04** | **Illegal State Jump** | Order is in `created` status. | Client sends `POST /api/v1/orders/ord_001/transitions` with `targetStatus: "delivered"`. | **422 Unprocessable Entity**. FSM rejects non-sequential state jump; order remains `created`. | Unit / Integration | **NOT RUN** (Design Specified) |
| **SEC-05** | **Duplicate Order Submission** | Order `ord_001` created with `Idempotency-Key: idemp_abc123`. Network times out. | Client retries identical request with same `Idempotency-Key: idemp_abc123`. | **200 OK / 201 Created**. Returns existing `ord_001`; exactly 1 order row exists in database. | Integration (API + DB) | **NOT RUN** (Design Specified) |
| **SEC-06** | **Concurrent Captain Acceptance** | Order is in `searching_captain`. Offer broadcast to 10 captains in El Bagour. | 10 captains concurrently execute `POST /offers/:id/accept` within 10ms window. | **Exactly 1 captain receives 200 OK**; remaining 9 receive `409 Conflict (OFFER_ALREADY_CLAIMED)`. | Concurrency Stress Test | **NOT RUN** (Design Specified) |
| **SEC-07** | **Duplicate Webhook Delivery** | Payment provider webhook sends `TRANSACTION_SUCCESS` for payment `pay_001`. | Gateway delivers identical webhook event 3 times due to network retries. | First event commits transaction; subsequent 2 return `200 OK (ALREADY_PROCESSED)`. Ledger balance credited once. | Integration (Webhook) | **NOT RUN** (Design Specified) |
| **SEC-08** | **Invalid Webhook Signature** | Attacker crafts synthetic `TRANSACTION_SUCCESS` webhook payload. | Attacker posts to `/api/v1/webhooks/payments/paymob` with invalid or missing HMAC signature. | **401 Unauthorized**. Payload rejected before database interaction; security event logged in `audit_logs`. | Integration (API) | **NOT RUN** (Design Specified) |
| **SEC-09** | **Payment Amount Mismatch** | Order quoted fare is 3120 piasters. | Webhook returns `TRANSACTION_SUCCESS` but payload specifies `amount_cents: 1000`. | **422 Unprocessable Entity**. Order marked `payment_mismatch_flagged`; dispatch blocked; alert raised to operations. | Integration (Webhook) | **NOT RUN** (Design Specified) |
| **SEC-10** | **Duplicate Cash Collection** | Captain collects cash at delivery and submits collection record. | Malicious or buggy client submits a second cash collection payload for the same order. | **409 Conflict**. Enforced by unique constraint `uq_order_cash_collection`. | Integration (DB Constraint) | **NOT RUN** (Design Specified) |
| **SEC-11** | **Duplicate Refund Request** | Order was cancelled pre-pickup. Refund initiated. | Operator accidentally double-clicks "Issue Refund" button sending parallel requests. | Exactly 1 refund entry created in `refunds`; second request rejected by idempotency lock. | Integration (API) | **NOT RUN** (Design Specified) |
| **SEC-12** | **Expired Subscription Radar Block**| Captain subscription ended 5 days ago (grace period expired 2 days ago). | Captain calls `POST /api/v1/captain/availability` setting `isOnline: true`. | **403 Forbidden (CAPTAIN_SUBSCRIPTION_EXPIRED)**. Dispatch engine excludes captain from offer radar. | Integration (API + DB) | **NOT RUN** (Design Specified) |
| **SEC-13** | **Grace Period Allowance** | Captain subscription ended 24 hours ago (within 72-hour grace period). | Captain is offered and accepts a delivery order. | **200 OK**. Order accepted; persistent warning banner returned in response payload. | Integration (API) | **NOT RUN** (Design Specified) |
| **SEC-14** | **Private Document Download** | Scanned National ID stored in Supabase private bucket `captain-documents`. | Unauthenticated user or standard customer requests direct bucket URL. | **403 Forbidden**. File inaccessible; presigned URL required with operations role. | Integration (Storage RLS) | **NOT RUN** (Design Specified) |
| **SEC-15** | **SQL Injection Resistance** | Attacker inputs `' OR 1=1; DROP TABLE orders; --` in `itemDescription` field. | Client submits order creation with malicious string. | String parameterized safely via Drizzle/pg prepared statement; treated as literal text. | Unit (ORM Security) | **NOT RUN** (Design Specified) |
| **SEC-16** | **OTP Brute-Force Rate Limiting**| Attacker attempts to guess 4-digit SMS OTP for `+201012345678`. | Attacker issues 10 requests to `/api/v1/auth/verify-otp` with incorrect codes. | **429 Too Many Requests**. Account locked for 15 minutes after 5 consecutive failed attempts. | Integration (Rate Limit) | **NOT RUN** (Design Specified) |
| **SEC-17** | **Session Revocation** | Captain is suspended by operations agent for safety violation. | Captain attempts to fetch assigned orders using previously issued refresh token. | **401 Unauthorized**. Token rejected against active user check (`is_active = FALSE`). | Integration (Auth Middleware)| **NOT RUN** (Design Specified) |
| **SEC-18** | **Audit Log PII Leakage** | Order with customer phone `+201012345678` is updated. | Automated audit trigger writes to `audit_logs`. | Phone numbers and bearer tokens are masked (`+2010****5678`); zero secrets stored in log. | Integration (Audit Trigger) | **NOT RUN** (Design Specified) |
| **SEC-19** | **Migration Repeatability** | Clean PostgreSQL test container initialized. | Runner executes `schema_draft.sql` followed by rollback drop statements. | All tables, enums, constraints, and indexes create without syntax errors and roll back cleanly. | Staging / CI Migration | **NOT RUN** (Design Specified) |
| **SEC-20** | **Passenger Transport Invariant** | Customer attempts to bypass UI and call `POST /api/v1/orders` with `serviceTypeId: "passenger"`. | Payload sent to order creation endpoint. | **403 Forbidden (REGULATORY_COMPLIANCE_LOCK)**. Enforced by database `is_enabled = FALSE` constraint. | Integration (FSM / Schema) | **NOT RUN** (Design Specified) |

---

## 3. Pre-Deployment Staging Execution Protocol

Before promoting the database schema from draft to staging:
1. **Isolated Container Execution:** Run `schema_draft.sql` against an ephemeral Docker PostgreSQL 15 instance.
2. **Automated Rollback Test:** Verify that every `CREATE` statement has a corresponding, validated `DROP` / `ALTER` rollback script.
3. **Synthetic Seed Validation:** Load synthetic El Bagour landmarks, test merchants, and dummy captains to verify foreign key integrity.
4. **Load & Concurrency Profiling:** Execute `SEC-06` (10 concurrent captain claims on a single order) under load to confirm zero deadlocks and 100% mutual exclusion.
