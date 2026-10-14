# Mashwar Operations, Reports, HR, Finance & Merchant Platform Specification

**Status:** product and architecture baseline; implementation is phased and not yet end-to-end production-ready.  
**Initial service area:** El Bagour, Menoufia. Service areas must be database/config driven; never use the first area as a hard-coded platform boundary.

## Product shape

Mashwar is one connected delivery platform: customer ordering, captain delivery, merchant marketplace, courier/parcel services, operations, finance, and people management. Customer web, Flutter mobile, merchant portal, captain app, and internal operations dashboard must use the same versioned API and durable records. Passenger transport remains disabled until a separate legal, licensing, insurance, and safety approval.

## 1. Roles, accounts, and verification

- **Customer:** phone-based sign-up/sign-in, OTP verification, profile, saved addresses with consent, order history, live order status, receipts, support reports, and order-linked communication.
- **Captain:** sign-up, phone verification, identity/document submission, vehicle details, review status, eligibility/availability, subscription status, completed deliveries, ratings, payout statements, and support reports.
- **Merchant / merchant staff:** business application, owner/contact verification, branch management, catalog, operating hours, item availability, order acceptance, preparation status, subscriptions/contract status, settlement statements, and support reports.
- **Operations/support:** queue management, dispatch oversight, complaint handling, verification review, merchant onboarding review, and operational exceptions.
- **HR:** staff records, role/department, shifts, attendance, leave, payroll inputs, approvals, and employee access lifecycle.
- **Accountant/finance:** read-only operational evidence plus controlled finance actions, reconciliations, settlements, expenses, payroll posting, refunds, and reports.
- **Owner/admin:** company-level settings, service-area configuration, pricing policies, roles and permissions, audit review, and controlled emergency operations.

Use least-privilege RBAC/permission checks on every API endpoint and object; never trust a role, user ID, tenant, branch, or approval status supplied by the browser. Privileged actions require audit records and, for financial/destructive actions, reason and appropriate approval. Staff/admin accounts require stronger authentication than customer accounts. Store only necessary identity data; encrypt private documents, restrict access, and define retention/deletion rules.

## 2. Reports and complaints

A first-class **Reports & Complaints** module must be visible in the internal dashboard and support submissions from:
- customers/clients;
- captains/drivers;
- merchants/restaurants/supermarkets;
- general public / non-account users (optional contact details);
- internal staff creating an incident on behalf of a caller.

Each report has a durable ID, reporter type and authorized reporter link when known, category, priority/severity, description, optional order/merchant/captain references, private attachments, timestamps, status, assignee/team, internal notes, customer-visible replies, resolution code, and audit history. Suggested statuses: New → Triaged → In progress → Waiting for reporter/partner → Resolved → Closed, with a controlled reopen path. Categories include delivery/order, payment/refund, captain conduct/safety, merchant quality, missing/damaged item, account/verification, app/technical issue, staff/HR, and general complaint.

Dashboard indicators: open count, severity, aging/SLA breach, unassigned cases, reports by source/category/area, repeat issues, resolution time, and satisfaction when collected. Filter by time, service area, status, source, category, assignee, and linked order. Private reporter details and evidence are visible only to authorized staff; public submitters receive a random/unguessable tracking reference and can only see their own case. Rate-limit submissions, validate attachments, scan uploads, and avoid exposing personal data in logs.

## 3. Internal dashboard and workspaces

A responsive role-aware dashboard is the control plane, not a single screen with every button. Workspaces/nav modules:
1. Overview / live operations;
2. Orders and dispatch;
3. Customers;
4. Captains and identity verification;
5. Merchants, branches, applications, contracts, catalogs and subscriptions;
6. Reports & complaints;
7. HR, employees, shifts, attendance and leave;
8. Accounting, payments, settlements, expenses, payroll journals and reconciliation;
9. Pricing and service areas;
10. Analytics, exports and audit log;
11. Settings, integrations, queues and system health.

The UI must hide unavailable actions and the API must enforce the same permissions independently. Use server-side pagination, filtering, sorting, URL-backed filters, virtualized large tables where needed, responsive tables/cards, loading/empty/error/retry states, and explicit confirmation for sensitive actions. Avoid fetching the entire order/report/customer dataset into the browser. Dashboard KPI values must derive from real, timestamped API aggregates with documented definitions—not hard-coded demo totals.

## 4. Merchant acquisition, online contract, and marketplace

Merchant onboarding workflow:
1. Merchant submits a business application and contact information.
2. OTP/contact verification and required business-document collection.
3. Operations review, duplicate checks, and approve/reject/request-more-information decisions.
4. Company selects a contract template, commission/subscription model, service terms, settlement timing, cancellation/refund rules, and effective date.
5. Contract can be accepted through a properly implemented electronic-signature/consent flow with identity evidence and immutable versioned PDF/audit trail, or signed physically at the company office and uploaded by authorized staff with signed date and document hash. Do not label a checkbox or uploaded scan as a legally valid e-signature without legal review.
6. Merchant signs in and creates branches, service hours, delivery/preparation settings, menu/catalog categories, items, variants/add-ons, prices, taxes/fees, images, and stock/availability.
7. Operations approves publication; catalog changes are versioned and audited.
8. Merchant receives and accepts orders, updates preparation state, and sees settlement statements.

Support restaurants, supermarkets, shops, and service merchants through configurable catalog/service types rather than a separate codebase per vertical. Contract terms must be versioned and immutable for already accepted agreements. Do not hard-code merchant subscription price or commission policy in UI code.

## 5. HR, attendance, and payroll

HR records cover company staff and captains where employment/contract status requires it, while keeping contractor and employee classifications distinct. Initial capabilities: employee profile, department, job, manager, status, onboarding/offboarding checklist, shift schedules, leave/absence, attendance corrections, overtime approvals, payroll periods, salary components/deductions, bonuses, advances, and payslips.

If physical fingerprint/biometric attendance is later used, integrate only through a lawful, approved device/provider and documented consent/legal basis. Do not store raw fingerprint/biometric templates in Mashwar by default. Support device event ingestion with signed device identity, replay protection, duplicate handling, offline sync, manual correction with reason and approver, and an immutable attendance audit trail. GPS-based attendance is a separate optional policy and must not be silently enabled.

Payroll must be calculated from approved attendance and salary rules, be reproducible for a closed payroll period, and require review/approval before posting. Do not make a captain's delivery fee, merchant settlement, employee wage, and company revenue interchangeable.

## 6. Accounting and operational financial links

Use a durable double-entry accounting ledger as the financial source of truth. Every posted journal balances; posted entries are immutable and corrected with reversal/adjustment entries. Monetary amounts are stored as integer minor units (EGP piasters), with currency explicit.

Connect:
- order and delivery lifecycle → customer charge / cash collection / refunds;
- payment provider events → payment ledger and reconciliation;
- merchant orders → payable liability and merchant settlement statement according to the signed contract;
- captain deliveries → agreed captain earnings, subscription billing, cash handover/receivable, and payout;
- company expenses and invoices → approved expense journal;
- HR payroll → approved payroll journal and payment status;
- subscription billing → invoices, payment status, grace/suspension policy;
- reports → case outcomes, not arbitrary edits to ledger amounts.

Separate order value, delivery fare, platform fee, merchant amount, captain earnings, tax/fees, refunds, cash in hand, bank/provider balance, and company revenue. Keep a full audit trail for adjustments. Reconcile daily cash, payment-provider settlements, merchant payables, captain balances, and ledger totals. Finance screens must not calculate authoritative balances from client-side math.

## 7. Scalable architecture and reliability requirements

- Use modular domains (identity/access, customers, merchants/catalog, orders, dispatch/location, reports, HR/attendance, finance/ledger, notifications, media, analytics) with explicit service interfaces and domain ownership.
- Start with a **modular monolith** and PostgreSQL transactions as the safe low-cost baseline; do not split into microservices prematurely. Extract independently scalable workers/services only when measured load and team ownership justify it.
- PostgreSQL is the source of truth. Remove in-memory Maps as production persistence for orders, idempotency, reports, sessions, assignments, and finance. Use migrations, foreign keys, check constraints, unique constraints, proper indexes, tenant/area scoping where applicable, row-level security where configured, and transaction-local context on the same connection.
- Use a connection pool with bounded maximum connections/timeouts, pooled connections per process, and a deployment-wide connection budget. Never open a new DB connection per request.
- Use transactions for order state + audit + ledger effects; transactional outbox for reliable events; durable queue/workers for notifications, webhook processing, report SLA reminders, settlement jobs, and analytics aggregation. Consumers must be idempotent; external webhooks must verify signatures and protect against replay.
- API contracts are versioned, validated server-side, and return stable error codes. Apply authentication, authorization, rate limits, payload/file-size limits, pagination, request IDs, timeouts, retries with jitter only where safe, and idempotency keys for retried writes.
- Use optimistic concurrency/version checks for order status, inventory, catalog, contract and payroll approval changes. Define explicit order state transitions; do not let arbitrary clients set a status.
- Use object storage for private documents/audio with short-lived signed URLs, strict content type/size validation, malware scanning where available, and authorization at upload-intent and completion.
- Observability: structured redacted logs, metrics, traces, health/readiness checks, queue lag, DB pool saturation, error rates, slow query monitoring, alerting, backups and tested restore procedures.
- Reliability: no fake success, no hidden mock fallback in production, fail closed on missing signing secrets, feature flags for staged rollout, rate-limited retries, graceful degradation, and documented recovery/rollback.
- Performance validation: realistic load tests for peak order creation, dispatch, report bursts, dashboard queries and merchant catalog traffic; establish targets from product decisions and actual infrastructure. Use indexes/query plans, caching only for derived/read-heavy data with invalidation, and asynchronous exports for large reports.
- Data protection: minimize PII, encrypt in transit/at rest, restrict private documents, audit sensitive reads/actions, and never log OTPs, tokens, national IDs, biometric data, or payment secrets.

## 8. Suggested core entities

User, AuthIdentity, Session, Role, Permission, CustomerProfile, CaptainProfile, CaptainVerificationCase, Merchant, MerchantBranch, MerchantApplication, ContractTemplate, MerchantContractVersion, MerchantSubscription, CatalogCategory, CatalogItem, CatalogVariant, InventoryBalance, ServiceArea, Order, OrderLine, Quote, DispatchAssignment, DeliveryEvent, Payment, Refund, LedgerAccount, JournalEntry, JournalLine, Settlement, CaptainEarning, Expense, Employee, Department, Shift, AttendanceEvent, AttendanceCorrection, LeaveRequest, PayrollPeriod, Payslip, ReportCase, ReportMessage, PrivateAttachment, NotificationOutbox, AuditEvent.

All business records need stable IDs, creation/update timestamps, actor provenance, explicit status lifecycle, and relevant foreign keys. Use soft deletion only where business/legal rules allow it; financial and audit records must not be silently deleted.

## 9. Delivery phases and acceptance gates

### Phase A — Make the current foundation honest and green
- Fix current Flutter analyzer errors before expanding Flutter features.
- Align web/mobile request/response contracts with backend; remove false-positive online/health indicators.
- Identify and isolate demo fixtures from any production path.
- Add API contract tests and a CI gate that cannot silently skip essential jobs.

**Gate:** root TypeScript/tests, customer web typecheck/build, Flutter analyze/tests all green; no production mock fallback.

### Phase B — Identity and durable persistence
- PostgreSQL schema/migrations, sessions, OTP provider abstraction, verified phone flows, RBAC, authorization, rate limits, RLS policies and audit events.
- Replace in-memory order/idempotency/session/assignment stores with durable implementations.

**Gate:** cross-user/object authorization tests, isolation tests, duplicate-request tests, migration/restore rehearsal.

### Phase C — Orders and merchant marketplace
- Service areas, signed quotes, order creation, catalog, merchant application, contract versions/signing evidence, merchant portal, captain dispatch and order tracking.

**Gate:** a real test account can apply, get reviewed, publish a catalog, accept an order and complete a delivery end-to-end in staging.

### Phase D — Reports and support operations
- Report intake from every role plus public/general form, internal triage dashboard, assignment, replies, evidence, SLA metrics and audit history.

**Gate:** reporters can only access their own cases; authorized staff can triage and resolve; attachments are private.

### Phase E — Finance and HR
- Double-entry ledger, reconciliation, merchant/captain settlements, expenses, employee records, shifts/attendance corrections, payroll approvals and payslips.

**Gate:** independently reproducible balances, balanced journals, approval separation, audit and reconciliation tests.

### Phase F — Scale, security and launch readiness
- Load and failure testing, backup restore, monitoring/alerts, disaster recovery, penetration/security review, legal review of contracts/identity retention, pilot rollout and rollback runbooks.

**Gate:** measured SLOs and capacity, tested recovery, closed critical/high security issues, operational owners and support process.

## 10. Non-goals / guardrails

- Do not claim all modules are implemented merely because the specification exists.
- Do not enable passenger transport until the separate approval gate passes.
- Do not connect production payment providers, identity vendors, biometric devices, or e-signature services without explicit configuration and business/legal approval.
- Do not mutate production or staging databases without explicit approval.
- Do not ship dashboard numbers or order/report success backed by hard-coded samples.
