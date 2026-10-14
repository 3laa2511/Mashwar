# Mashwar — Phase 3 Database Schema & Security Hardening Review Report
**Project:** Mashwar (مشوار)  
**Target Launch City:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Phase:** Phase 3 Architecture Review & Security Hardening  
**Status:** Review Complete (Documentation & Draft Artifacts Only — Zero Live Execution)  

---

## 1. Files Inspected and Changed

### 1.1 Files Inspected
- `flutter_mashwar/lib/app/app.dart`
- `flutter_mashwar/lib/app/router/app_router.dart`
- `flutter_mashwar/lib/shared/models/order_model.dart`
- `flutter_mashwar/lib/shared/providers/orders_provider.dart`
- `flutter_mashwar/lib/core/utils/price_calculator.dart`
- `flutter_mashwar/test/unit/price_calculator_test.dart`
- `docs/backend/ARCHITECTURE.md`
- `docs/backend/DATA_MODEL.md`
- `docs/backend/SECURITY_MODEL.md`
- `docs/backend/API_CONTRACTS.md`
- `docs/backend/PAYMENTS_AND_SUBSCRIPTIONS.md`
- `docs/backend/ORDER_LIFECYCLE.md`
- `docs/backend/OPEN_DECISIONS.md`
- `docs/backend/IMPLEMENTATION_ROADMAP.md`
- `docs/backend/drafts/schema_draft.sql`

### 1.2 Files Created / Updated in Phase 3
1. **`docs/backend/drafts/schema_draft.sql`** (Updated): Corrected DDL schema covering all 15 logical domains, explicit foreign keys to `auth.users(id)`, non-negative money constraints in piasters, phone regex checks, rating limits, composite unique constraints, indexes for all query lookup paths, and RLS activation statements.
2. **`docs/backend/RLS_POLICY_MATRIX.md`** (Created): Exhaustive authorization table detailing table-by-table client read/write policies, tenant ownership rules, operations boundaries, and an explicit justification for the 14 backend-only tables.
3. **`docs/backend/DATABASE_SECURITY_TEST_PLAN.md`** (Created): 20-scenario security and integrity test matrix (cross-user access, fare tampering, concurrent captain claims, webhook HMAC signatures, expired subscriptions, idempotency) all explicitly marked **NOT RUN**.
4. **`docs/backend/OPEN_DECISIONS.md`** (Updated): Formal decision register keeping subscription fees, trial lengths, 72-hour grace period rules, gateway selection, cash rounding (fakka), and Nile Delta distance routing explicitly open for management sign-off while locking the zero-commission invariant.
5. **`docs/product/PRODUCT_UX_DIRECTION.md`** (Created): Design system documentation codifying the Cairo Arabic typography hierarchy, Egyptian Amber/Delta Emerald color palette, high-contrast sunlight tokens, four distinct role experiences, and accessibility guidelines.
6. **`docs/backend/PHASE_3_REVIEW_REPORT.md`** (This file): Master synthesis and audit report.

---

## 2. Confirmed Repository Defects in Existing Code

1. **Floating-Point Arithmetic in Financial Calculations:**
   - In `flutter_mashwar/lib/core/utils/price_calculator.dart`, monetary amounts are defined as `double`. In floating-point math, binary representation produces precision drift. Corrected in proposed backend to use **Integer Minor Units (Egyptian Piasters - `BIGINT`)**.
2. **Dart String Interpolation Bug in Duration Estimate:**
   - Line 35 in `price_calculator.dart` contains `estimatedDurationMinutes: '$minutes-$minutes+5'`. Because of operator precedence in Dart string interpolation, `$minutes+5` outputs `"11-11+5"` rather than calculating `"11-16"`.
3. **Conflation of Display Code with Entity Identifiers:**
   - `OrderModel` in `order_model.dart` uses client-generated strings (`MSH-8102` or `MSH-${ts % 10000}`) as primary keys. In production, primary keys must be globally unique `UUIDv7` or `UUIDv4`, with human-friendly codes stored separately.
4. **Lack of Entity Foreign Keys and Payment States:**
   - `OrderModel` lacks foreign key attributes (`customer_id`, `captain_id`, `merchant_branch_id`, `quote_id`) and lacks any field for payment method (`cash_on_delivery` vs `electronic`) or payment status.
5. **Unilateral Client Status Advancement:**
   - `OrdersNotifier.advanceOrderStatus()` in `orders_provider.dart` allows client code to jump through states unconditionally and hardcodes a fictional captain (`كابتن طارق الغريب`) without evaluating availability, verification, or subscription eligibility.

---

## 3. Schema Inconsistencies and Corrections Made

1. **Foreign Key Integrity with Supabase Auth:**
   - Previous schema draft had several tables referencing unconstrained `user_id UUID`. All user-related foreign keys now explicitly reference `auth.users(id)` with explicit cascade or restrict policies (`ON DELETE RESTRICT` for financial and order records; `ON DELETE CASCADE` for customer addresses and profiles).
2. **Missing Logical Domains Added:**
   - Added `merchant_operating_hours` table (day of week, opening/closing time, is_closed) to prevent ordering from closed stores.
   - Added `order_items` table to support itemized restaurant and grocery orders.
   - Added `notifications` table for persistent in-app notifications.
   - Added `support_tickets` table for customer and captain support issues.
   - Added `refunds` table for tracking customer refund requests and gateway references.
3. **Integer Piasters Constraints:**
   - All monetary fields use `BIGINT` with `CHECK (amount >= 0)` or `CHECK (fare > 0)` constraints, eliminating negative value corruption.

---

## 4. RLS Coverage and Unresolved Security Questions

1. **Defense-in-Depth:**
   - All 15 domain tables have RLS enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.
   - 14 sensitive tables are classified as **Backend-Only**; mobile clients have zero direct read/write privileges over these tables.
2. **Unresolved Security Questions for Infrastructure Deployment:**
   - *Data Residency in Egypt:* Whether Supabase Cloud (AWS Frankfurt / Europe) complies with Egyptian Personal Data Protection Law (Law No. 151 of 2020) for storing citizen National ID data, or if self-hosted Supabase on an Egyptian data center (e.g. Telecom Egypt / WE) is required for full regulatory compliance.
   - *SMS OTP Provider Whitelisting:* Selection of local Egyptian SMS aggregator (Vodafone, Orange, e&, or Infobip) with approved sender ID (`Mashwar` / `مشوار`).

---

## 5. Transaction and Payment Integrity Risks

1. **Captain Assignment Race Condition:**
   - *Risk:* 10 captains tapping "Accept" simultaneously on an order broadcast.
   - *Mitigation:* Explicit row-level locking (`SELECT ... FOR UPDATE`) in the trusted API transaction combined with a database-level partial unique index:
     `CREATE UNIQUE INDEX uq_order_active_captain_assignment ON captain_assignments(order_id) WHERE status = 'accepted';`
2. **Doorstep Cash Reconciliation Discrepancies:**
   - *Risk:* Captain claims to have collected 20.00 EGP when quoted fare was 25.00 EGP, or captain accumulates large cash amounts and disappears.
   - *Mitigation:* Explicit `cash_collections` ledger separate from orders; automatic dispatch block when a captain's cash holding exceeds 1,000.00 EGP (100,000 piasters) until remitted.
3. **Webhook Replay & Forged Confirmation:**
   - *Risk:* Malicious actor forging a payment success callback to mark an order paid.
   - *Mitigation:* Mandatory HMAC-SHA256 signature verification using server-side webhook secrets, atomic event insertion into `webhook_events`, and idempotency checking before updating `payment_intents`.

---

## 6. Open Business Decisions Register

The following decisions remain **OPEN** and require stakeholder sign-off:
1. **Monthly Subscription Price Point:** 200 EGP launch promotion vs 250 EGP vs 300 EGP standard fee.
2. **Grace Period Duration:** Proposed 72 hours before dispatch radar is suspended.
3. **Payment Gateway Provider Selection:** Paymob vs Fawry vs Vodafone Cash Direct.
4. **Cash Rounding Policy (أزمة الفكة):** Recommended `Math.ceil` to the nearest whole Egyptian Pound to eliminate change friction on the street.
5. **Nile Delta Distance Engine:** Static landmark matrix for MVP vs self-hosted OSRM for expansion.
6. **Passenger Transport Approval:** Permanently locked pending Law No. 73 of 2018 review in Q3 2027.

---

## 7. Test Cases Designed vs. Tests Actually Executed

- **Test Cases Designed:** 20 comprehensive test cases documented in `docs/backend/DATABASE_SECURITY_TEST_PLAN.md` covering RLS isolation, fare tampering, illegal state transitions, race conditions, webhook idempotency, and OTP abuse.
- **Tests Actually Executed:**
  - `compile_applet`: **EXECUTED & PASSED** (Vite/TypeScript web preview compiled cleanly).
  - `lint_applet`: **EXECUTED & PASSED** (0 lint errors).
  - Backend integration tests & Flutter tests: **NOT RUN** (No live database connected; Flutter SDK not present in Linux container).

---

## 8. Compatibility Concerns with Current Flutter Code

1. **Model Drift:** When the backend API is implemented in Phase 4, `OrderModel` in `flutter_mashwar/` must be updated to use server UUIDs, integer minor units (piasters), and structured pickup/dropoff address objects.
2. **Repository Layer:** `MockDataRepository` must be abstracted behind an interface (`IOrderRepository`) so that `HttpOrderRepository` can be swapped in without modifying screen widgets.
3. **Session Management:** The client needs `flutter_secure_storage` integrated to persist JWT access and refresh tokens from Supabase Auth.

---

## 9. Prioritized List of Remaining Work

1. **Priority 1 (Next Phase — Phase 4): Backend Scaffolding & Core Engines:**
   - Set up Node.js / TypeScript service repository with Drizzle ORM.
   - Implement Authoritative Pricing Engine and Order Finite State Machine.
   - Run integration tests in an isolated local Docker PostgreSQL container.
2. **Priority 2 (Phase 5): Flutter Client Repository Refactoring:**
   - Introduce `Dio` HTTP client with token refresh interceptor.
   - Connect Riverpod `ordersProvider` to live API endpoints.
   - Implement subscription management screen in the Captain app.
3. **Priority 3 (Phase 6): Egyptian Gateway Sandboxing & Staging Pilot:**
   - Integrate Paymob / Fawry sandbox for card and mobile wallet transactions.
   - Pilot test with 15 verified captains in El Bagour center.

---

## 10. Exact Next Recommended Phase

**Phase 4: Backend API Service Implementation & Core Domain Engines**
- Create the backend service directory (`backend/`) using TypeScript, Express/Fastify, and Drizzle ORM.
- Implement the pricing calculation and order state machine domain logic.
- Execute the test plan against a local ephemeral Docker PostgreSQL instance to verify zero race conditions before connecting to any staging Supabase environment.
