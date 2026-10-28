# Mashwar — Phase 2 Persistence & Commerce Policy Design

**Status:** Design-only proposal. No migration has been executed and no production system was accessed.
**Target branch:** `docs/phase-2-persistence-and-commerce-policy`
**Prerequisite:** Reconcile the reported Phase 1 hardening commit with GitHub before treating its code as the Phase 2 baseline.

## 1. Verified repository baseline

The current `main` branch contains Kysely schema definitions and migrations `001_security_hardening.ts` and `002_complete_platform_schema.ts`. The schema already defines users, orders, cash collections, financial ledger, merchant/captain subscriptions, complaints, complaint events, notifications, and idempotency keys.

This does **not** prove that runtime admin/order operations consistently use PostgreSQL. Before writing migration 003, trace each route and service to its actual persistence path and identify in-memory maps, duplicate stores, and fallback behavior. Never silently fall back to in-memory persistence in a configured production environment.

## 2. Required commercial decisions (approved)

### Refund approval
- Support receives and investigates the complaint, communicates with the customer, and prepares the refund request.
- Support cannot approve or issue a refund independently.
- Only the Owner or Operations Manager may approve/reject a refund request.
- Persist requester, complaint/order, requested amount in integer piasters, reason, decision, approver identity/role, timestamps, and an immutable audit event.
- A refund must not be recorded as paid or change a financial balance before an authorized approval and successful transactional posting.
- The implementation must define the actual payment-provider/refund executor separately. An approval is not proof that money was returned.

### Expired merchant subscription
- When a merchant subscription expires, the server must reject new orders for the affected store(s), even if a client sends requests directly to the API.
- Preserve the merchant, store, catalog, menu, settings, and historical orders.
- Do not delete the store or its data.
- After successful renewal, restore eligibility only if the store, merchant, city, and service zone are otherwise active and permitted.
- Existing orders must follow their own lifecycle policy; expiry must not silently delete or mutate in-flight orders.

## 3. Migration 003 — design gates, not yet SQL

Before implementation, compare existing DDL with the typed Kysely schema and decide whether the following need new tables or safe extensions:

1. **`audit_logs`** — append-only audit events with actor user ID/role, action, target type/ID, outcome, request/correlation ID, safe metadata, and timestamp. Do not store secrets, access tokens, or unnecessary personal data.
2. **`system_settings`** — allowlisted, typed settings with version/update metadata and actor attribution. Avoid arbitrary JSON as an unchecked configuration API.
3. **Refund workflow** — reuse/extend complaint records and complaint events only if they can represent requested, approved, rejected, processing, succeeded, and failed states with approver attribution and idempotency. Otherwise introduce a dedicated refund request table with foreign keys and constraints.
4. **Financial ledger** — verify existing constraints and ensure cash remittance, subscription fees, and refund postings are represented with integer piasters, unique business references, and immutable entries. Never update historical ledger rows to simulate a correction; post a reversing/adjusting entry.
5. **Subscription enforcement** — ensure merchant subscription status and expiry timestamps are durable and checked by the server at order creation/acceptance, not only in UI state.

Do not create duplicate tables if existing schema can be extended safely. Migrations must be forward-only in the release workflow, reviewed, idempotent where practical, and tested against a disposable real PostgreSQL instance before staging.

## 4. Transaction and concurrency requirements

- Cash settlement: lock/read the captain's cash holding in a transaction; validate a positive safe integer amount and current holding; insert the settlement/idempotency record and ledger entry; update the holding; commit atomically.
- Refund approval/posting: re-check approver permission on the server, prevent self-approval if policy later requires it, use a stable idempotency key, and atomically transition the request plus ledger records.
- Subscription renewal: record the payment/renewal event and resulting expiry/status atomically. Never reactivate a store solely because the browser requested it.
- Order creation: check store eligibility and subscription state in the same consistency boundary as order acceptance, with race-condition tests around expiry.
- Audit records for sensitive mutations should be committed with the business transaction or use a durable outbox so a successful mutation cannot disappear from the audit trail.

## 5. Required test matrix

Use real PostgreSQL in CI (service container) for persistence and transaction tests; unit tests over Maps are not sufficient.

- Restart the API and verify users, orders, settlements, audit records, settings, complaints/refund decisions, and subscriptions persist.
- Run concurrent settlement requests; verify no over-settlement and exactly one posting per idempotency key.
- Verify customer/captain/merchant/support cannot approve a refund; Owner and Operations Manager can, subject to scope.
- Verify a support agent can prepare/resolve a complaint but cannot create an approved refund by spoofing body fields or headers.
- Verify expired subscriptions reject new orders through direct API calls while existing store/catalog/history remain unchanged.
- Verify successful renewal restores order eligibility only when all other store/service-area checks pass.
- Verify rollback/error paths leave neither partial balance changes nor orphan ledger records.
- Verify audit entries record the authenticated actor and never trust client-supplied actor identity.

## 6. Safe execution sequence

1. Reconcile the reported Phase 1 commit `6bbcaae` and branch `feat/phase-1-security-hardening` with the remote repository. Do not assume the report's code is on GitHub unless the ref/commit is present.
2. Review and reconcile existing draft PRs touching authentication, payment, order lifecycle, and routes before stacking implementation work.
3. Add/validate repository-backed repositories and remove production in-memory fallbacks in a small feature PR.
4. Implement the reviewed migration and transaction services on a separate feature branch; test with disposable PostgreSQL.
5. Wire the Owner dashboard to authenticated APIs after durable services exist.
6. Run typecheck, unit/integration tests, web build, Flutter checks, security/authorization matrix, and migration tests; review CI.
7. Only after explicit approval, deploy to staging and verify. No production migration, merge to `main`, or production deployment is authorized by this design document.

## 7. Exit criteria

Phase 2 is not complete until persistent data survives restarts, sensitive mutations are transactional and idempotent, commercial policies are enforced server-side, real PostgreSQL integration tests pass, and CI evidence is attached to the pull request. A successful TypeScript build or in-memory test suite alone does not satisfy these criteria.
