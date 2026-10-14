# Mashwar — Master Implementation Plan

Status: source-of-truth roadmap for the Mashwar project. This document records scope, sequencing, engineering standards, dependencies, and release gates so agreed requirements are not lost between implementation sessions.

## Product mission

Build a reliable, Arabic-first, multi-region delivery platform connecting customers, captains, merchants, and internal operations. Launch with a controlled service area in El Bagour, Menoufia, but configure service areas in the backend so growth does not require a code rewrite. The product combines local marketplace orders, courier/parcel delivery, merchant operations, dispatch, support, HR, and accounting.

Passenger transport stays disabled until a separate legal, licensing, insurance, and safety approval is documented.

## Source-of-truth documents

- Product scope, reports, merchants, HR, finance, scaling: `docs/product/OPERATIONS_REPORTS_HR_FINANCE_MERCHANTS_SCALE_SPEC.md`
- Adaptive location, dispatch ranking, battery/network efficiency: `docs/architecture/LOCATION_DISPATCH_BATTERY_EFFICIENCY.md`
- This file: overall delivery order, engineering standards, completion evidence, and cross-feature dependencies.

Update these documents when a requirement changes. Do not silently drop scope; mark a requirement as shipped, deferred with a reason, blocked, or rejected with rationale.

## Engineering principles (mandatory)

1. **Solve coherent problems, not line counts.** Do not split a single responsibility into many tiny functions merely to claim progress. Keep a function cohesive and readable; extract helpers when they name a meaningful domain operation, isolate a reusable policy, reduce complexity, or create a useful test boundary. Avoid both giant monoliths and pointless micro-functions.
2. **Build vertical slices.** For each feature, connect UI → typed API contract → authorization/validation → domain logic → durable persistence → audit/events → tests. A UI mock or isolated helper is not a completed feature.
3. **Keep clear boundaries.** UI does not own business rules; API controllers handle transport concerns; domain services implement business rules; repositories own persistence; providers are behind interfaces. Avoid circular imports and duplicate sources of truth.
4. **One source of truth.** Order state, assignment, payment, ledger, service areas, pricing and permissions are server-authoritative. Never trust client-supplied identity, price, role, tenant, branch, or completion status.
5. **Durable before scalable.** PostgreSQL is the source of truth. No in-memory Maps, process-local mutexes, or local arrays as production state for orders, idempotency, dispatch, payments, complaints, sessions or payroll. Use transactions, constraints, migrations, durable jobs/outbox and idempotent consumers where required.
6. **Security is part of the feature.** Authenticated sessions, per-resource authorization, rate limits, server validation, tenant/service-area isolation, RLS where supported, secret management, private object storage, safe logs, audit trails and retention controls are designed alongside each feature.
7. **Fail honestly.** Never display success when an API/provider/database operation failed or was not attempted. Expose loading, empty, offline, stale, permission-denied and retry states. Do not invent metrics, live location, payment status, integrations or test results.
8. **Privacy and minimum collection.** Collect only data required for a documented purpose; restrict sensitive documents and location to authorized roles; define retention and deletion. Background location must be visible, permission-based and active only for a justified service mode.
9. **Measure performance.** Set baselines for API latency, database query plans/pool usage, battery, network traffic, routing costs, error rate and operational outcomes. Optimize based on profiling and tests rather than guesses.
10. **Maintainability over superficial completion.** Prefer a small, clear, tested domain model over duplicated conditionals or premature abstractions. Add abstractions when there is real variation or a boundary worth protecting.
11. **No production side effects without approval.** Do not mutate production/staging data, deploy, charge, contact real customers, or enable sensitive permissions/integrations without explicit approval and a reviewed plan.
12. **Evidence-based status.** A task is not done because code was written. Link the commit, tests, migration, endpoint/UI path, and any external setup still required.

## Definition of Done for each vertical slice

A feature is complete only when all applicable checks pass:
- Acceptance criteria and error states are documented.
- Types/contracts and server validation are defined.
- Authentication and authorization are enforced on every relevant resource.
- Durable schema/migration, constraints, indexes and transaction boundaries exist where needed.
- Idempotency/concurrency behavior is correct for retries and parallel requests.
- Audit/privacy/retention controls are in place for sensitive operations.
- UI is responsive and accessible in Arabic RTL and English LTR, with honest loading/empty/error/offline states.
- Unit and integration tests cover success, denial, failure, duplicates, concurrency and boundary cases.
- CI passes; device/load/security/restore testing is performed where relevant.
- Operator documentation, configuration and rollback/feature flag are ready.
- The feature is marked shipped only after end-to-end evidence exists.

## Delivery roadmap

### Phase 0 — Repository and CI stability
- [ ] Verify the latest CI run on the current PR head.
- [ ] Fix Flutter dependency/analyzer/test failures with targeted changes; no suppressions without a documented reason.
- [ ] Confirm web and backend checks pass on the same commit.
- [ ] Document local setup, environment variables, and repeatable test commands.
**Gate:** all required CI jobs green on one commit.

### Phase 1 — Architecture and API contracts
- [ ] Inventory existing code, endpoints, state stores, and UI routes; identify demo-only and in-memory paths.
- [ ] Define shared order/service-area/location/quote contracts with validation and versioning.
- [ ] Define domain boundaries: identity, service areas, catalog, orders, dispatch, tracking, reports, merchant, finance, HR.
- [ ] Set migration, configuration, error, logging, and API conventions.
**Gate:** implementation map and contracts reviewed; no hidden demo behavior in production paths.

### Phase 2 — Secure identity and durable foundation
- [ ] Implement real customer/captain/merchant/staff identities, sessions, token lifecycle and account recovery.
- [ ] Add OTP provider abstraction, rate limiting, abuse protection and delivery/provider observability.
- [ ] Establish PostgreSQL migrations, connection pooling, tenant/service-area scoping, RLS/access tests where appropriate, backups and restore drills.
- [ ] Replace in-memory production state for orders/idempotency/dispatch with durable transactional persistence.
- [ ] Establish permission matrix and audit events.
**Gate:** cross-user/resource access tests fail closed; persistence survives restart and concurrent requests.

### Phase 3 — Customer order journey
- [ ] Address search/map pin/manual fallback and service-area eligibility.
- [ ] Merchant/service discovery and accurate catalog/availability.
- [ ] Server quote with transparent price components and expiry.
- [ ] Idempotent order creation, durable state machine, cancellation rules and receipt.
- [ ] Customer order history, tracking, support/report flow and accessible RTL/LTR UI.
**Gate:** end-to-end order journey works with real backend and database, including retries and failures.

### Phase 4 — Merchant operations
- [ ] Merchant application/review, business/branch profiles and controlled document access.
- [ ] Versioned contract consent/signature workflow with legal review of enforceability; physical-signature status where applicable.
- [ ] Catalog, options, price, availability, stock and preparation-time management.
- [ ] Merchant order acceptance, preparation/readiness and cancellation reasons.
- [ ] Merchant subscription plan and billing rules, clearly separated from delivery charges.
**Gate:** a reviewed merchant can manage catalog and complete real test orders with auditable changes.

### Phase 5 — Captain lifecycle and adaptive tracking
- [ ] Captain application, verification status, vehicle/service eligibility and public profile privacy.
- [ ] Explicit online/offline/shift lifecycle and permission explanation.
- [ ] Adaptive Android/iOS location modes, stale/accuracy indicators, bounded offline queue and battery/network instrumentation.
- [ ] Stop sharing when offline or delivery ends; enforce visibility based on active order relationships.
- [ ] Test permission revocation, app backgrounding/termination, battery saver, poor network and device variation.
**Gate:** field-tested battery and freshness thresholds, documented permissions, no false-live states.

### Phase 6 — Dispatch and ETA
- [ ] Eligibility filters before ranking.
- [ ] Geospatial candidate retrieval and configurable staged radius expansion.
- [ ] Road-aware ETA via a routing-provider interface, cache, quota/cost budgets and deterministic fallback.
- [ ] Versioned explainable ranking (pickup ETA, capacity, current workload, reliability, fairness and location freshness).
- [ ] Atomic assignment lease, idempotent offer/accept/reject/timeout lifecycle and durable outbox.
- [ ] Re-evaluation with anti-oscillation rules; operations manual fallback.
- [ ] Constrained multi-stop batching only after single-order SLA is stable.
**Gate:** concurrent assignment/load tests pass; no duplicate assignment; measured ETA and routing cost meet agreed targets.

### Phase 7 — Communication and evidence
- [ ] Order-linked customer/captain/merchant chat with resource authorization.
- [ ] Private audio upload intents, signed access, limits, retention and malware/content controls as appropriate.
- [ ] Realtime updates with polling fallback and stale indicators.
- [ ] Delivery proof policy (e.g. OTP/confirmation) that never treats coordinates alone as proof.
**Gate:** access tests, upload lifecycle and retry behavior pass end to end.

### Phase 8 — Reports and operations dashboard
- [ ] Public/customer/captain/merchant/staff report intake and complaint lifecycle.
- [ ] Assignment, priority, SLA, internal notes, attachments, audit trail and escalation.
- [ ] Real operational metrics linked to source records; no fake seeded totals in production.
- [ ] Workspace permissions for Owner/Admin/Ops/Support and restricted identity-data views.
- [ ] System health, stale tracking, dispatch exceptions and provider-cost monitoring.
**Gate:** each dashboard number traces to a query/source and role-based access is tested.

### Phase 9 — Accounting and payments
- [ ] Provider-neutral payment state machine and webhook signature/replay/idempotency controls.
- [ ] Payment reconciliation; never treat client redirect as proof of payment.
- [ ] Immutable posted double-entry ledger with reversals, integer EGP piasters, chart of accounts and audit.
- [ ] Merchant/captain balances, settlements, refunds, expenses, subscriptions and reconciliation.
- [ ] Segregation of duties and period close controls.
**Gate:** ledger balances, duplicate/replayed webhook tests pass, and reconciliation is explainable.

### Phase 10 — HR and payroll
- [ ] Employee records, schedules, leave, attendance events and correction approvals.
- [ ] Payroll periods, salary components, overtime, deductions, approvals and payslips.
- [ ] Fingerprint/biometric provider only after legal/privacy review; do not store raw biometric templates by default.
- [ ] Role restrictions and payroll audit trail.
**Gate:** payroll can be recalculated/reconciled and sensitive fields are access-tested.

### Phase 11 — Quality, security and regional scale
- [ ] Load tests for peak orders, location writes, dispatch and database connection budget.
- [ ] Threat modeling and security tests (authz, RLS, rate limits, replay, abuse, data leakage).
- [ ] Backup restore drill, migration rollback strategy, incident runbooks and observability.
- [ ] Android/iOS device matrix, accessibility, slow network, low battery and app lifecycle tests.
- [ ] Feature-flagged rollout by service area with monitored rollback criteria.
**Gate:** launch criteria and operational ownership are signed off before public scale-up.

## Cross-cutting backlog — must not be forgotten

- [ ] Customer/captain/merchant/public complaints and reports.
- [ ] Real registration, login, phone verification and session revocation.
- [ ] Merchant onboarding, contracts, catalog and subscription management.
- [ ] Operations dashboard with accountants, HR, reports and role-scoped data.
- [ ] Attendance and payroll; biometric/fingerprint integration only after approval.
- [ ] Double-entry accounting connected to orders, payments, inventory/expenses, merchant/captain settlement and payroll.
- [ ] Local service configuration and expansion without hard-coded city logic.
- [ ] Location battery efficiency, privacy, road-aware dispatch, ETA, fairness and safe batching.
- [ ] Chat and private voice notes with real backend authorization/storage.
- [ ] Accessibility, RTL/LTR, responsive layouts, weak-network support and truthful errors.
- [ ] Monitoring, audit, backups, restore, load tests, security tests and provider cost controls.

## Change control

When a new idea appears:
1. Record it in this roadmap or the relevant domain specification.
2. Identify affected domains, dependencies, privacy/security risk, and acceptance criteria.
3. Implement in the correct phase unless an explicit dependency justifies reprioritization.
4. Update checkboxes only with evidence; include commit/PR/test links and unresolved blockers.
5. Keep scope visible: deferred means still planned unless the user explicitly removes it.

This roadmap is a plan, not a claim that all listed functionality is implemented. Current release state must be derived from repository code, CI, tests, integrations, and deployment evidence.
