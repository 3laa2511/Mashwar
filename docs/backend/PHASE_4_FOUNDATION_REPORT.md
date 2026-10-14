# Mashwar — Phase 4 Backend Foundation & Automated Quality Gates Report
**Project:** Mashwar (مشوار)  
**Target Launch Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Phase:** Phase 4 — Secure Backend Foundation & Local Integration Tests  
**Status:** Complete & Verified (19/19 Automated Tests Passing)  

---

## 1. Executive Summary & Preflight Inspection Facts

Phase 4 transitions Mashwar from architectural specifications (Phases 2 & 3) into an authoritative, tested backend foundation without fabricating connections to unconfigured live databases.

### Verified Architectural Topology:
1. **Flutter Mobile Application (`flutter_mashwar/`):**
   - Native Flutter/Dart codebase with Riverpod, Material 3, and GoRouter.
   - Clean repository abstraction (`IOrderRepository`) introduced to decouple screens from concrete data sources.
   - Implementation-ready `HttpOrderRepository` added targeting production REST contracts.
   - Confirmed client defects resolved (string interpolation bug & floating-point currency representation).
2. **Authoritative Backend Service (`backend/`):**
   - Node.js & TypeScript service implementing core business rules and REST endpoints under `/api/v1`.
   - Currency strictly standardized to **Integer Minor Units (Egyptian Piasters - قروش)**, eliminating floating-point precision loss.
   - Zero-Commission business model enforced across all captain dispatch and subscription engines.
   - Cryptographic tamper protection for fare quotes using server-side HMAC-SHA256 signatures.
   - Concurrency guard preventing double-dispatch on the streets of El Bagour.
3. **Interactive AI Studio Preview Workbench (`src/App.tsx`):**
   - Separate web-based simulator and developer dashboard.
   - Interactive testing interface for running backend test suites, verifying pricing rules, and inspecting API contracts.

---

## 2. Backend Modules Implemented

### 2.1 Authoritative Pricing Engine (`backend/src/pricing/pricingEngine.ts`)
- **El Bagour Pricing Topology:**
  - Base fare: `1,500 piasters` (15.00 EGP) covering urban trips up to 1.5 km.
  - Subsequent distance rate: `400 piasters/km` (4.00 EGP/km).
  - Rural / unpaved surcharge: `500 piasters` (5.00 EGP) for outer villages (كفر الباجور، جروان، شنتنا الحجر، ميت عفيف).
  - Platform maintenance fee: `200 piasters` (2.00 EGP).
- **Regulatory Compliance Lock:** Requests for passenger mobility (`serviceTypeId: 'passenger'`) are authoritatively blocked at the server with HTTP 403 (`REGULATORY_COMPLIANCE_LOCK`) pursuant to Egyptian Law No. 73 of 2018.
- **Cryptographic Anti-Tamper Guard:** Every issued quote includes an HMAC-SHA256 signature generated with a server secret. If a malicious client attempts to modify the fare or distance, `verifyQuote()` throws `QUOTE_SIGNATURE_TAMPERED`.

### 2.2 Order Finite State Machine (`backend/src/orders/orderFsm.ts`)
- **Strict Linear Lifecycle:**
  `created` ➔ `searching_captain` ➔ `captain_assigned` ➔ `at_pickup` ➔ `in_transit` ➔ `delivered`
- **Illegal Jumps Blocked:** Direct transitions (such as `created` directly to `delivered`) are rejected with HTTP 422 (`INVALID_STATE_TRANSITION`).
- **Terminal Protection:** Orders in `delivered` or `cancelled` cannot be mutated (`TERMINAL_STATE_MUTATION_FORBIDDEN`).
- **Cash Collection Enforcement:** Transition to `delivered` for Cash-on-Delivery (COD) orders requires recording the cash collected at the doorstep. If cash is unrecorded or insufficient, the transition is blocked (`MISSING_CASH_COLLECTION`).

### 2.3 Captain Fleet & Subscription Eligibility (`backend/src/captain/captainEligibility.ts`)
- **Zero Commission Invariant:** Captains keep 100% of their delivery fares and pay a flat monthly subscription.
- **72-Hour Grace Period:** When a subscription expires, captains enter a 72-hour grace period where dispatch offers remain active, but display an urgent countdown warning. Beyond 72 hours, the dispatch radar is suspended.
- **Cash Holding Ceiling:** If a captain accumulates `100,000 piasters` (1,000.00 EGP) in collected cash, dispatch offers are blocked until the cash is remitted to the El Bagour hub.

### 2.4 Dispatch Assignment Concurrency Guard (`backend/src/dispatch/assignmentService.ts`)
- **Atomic Assignment Mutex:** Simulates database row-level locking (`SELECT ... FOR UPDATE`).
- When multiple captains simultaneously attempt to claim an order broadcast, the first captain to acquire the lock claims the order, and all other competing requests receive HTTP 409 Conflict (`ASSIGNMENT_ALREADY_CLAIMED`).

### 2.5 Payment Webhooks & Idempotency Store (`backend/src/payments/webhookService.ts`)
- **HMAC Signature Verification:** Incoming webhooks from payment gateways (Paymob, Fawry, Vodafone Cash) must supply valid HMAC headers. Forged signatures are rejected with HTTP 401.
- **Replay Protection (Idempotency):** Duplicate webhook deliveries are detected using an in-memory idempotency store. Replays return `200 OK` with `status: 'ALREADY_PROCESSED'`, preventing double-crediting or duplicate state transitions.

### 2.6 REST API Router (`backend/src/api/routes.ts` & `backend/src/api/server.ts`)
- Implements all `/api/v1` routes specified in `docs/backend/API_CONTRACTS.md`:
  - `GET /api/v1/health`
  - `POST /api/v1/quotes`
  - `POST /api/v1/orders` (supports `Idempotency-Key` header)
  - `GET /api/v1/orders/:id`
  - `POST /api/v1/orders/:id/transitions`
  - `POST /api/v1/orders/:id/cancel`
  - `GET /api/v1/captain/eligibility`
  - `GET /api/v1/captain/subscription`
  - `POST /api/v1/captain/orders/:id/accept`
  - `POST /api/v1/captain/orders/:id/cash-collection`
  - `POST /api/v1/payments/intents`
  - `POST /api/v1/webhooks/payments/:provider`

---

## 3. Automated Quality Gates Execution & Test Results

The backend foundation is accompanied by an automated test runner (`backend/tests/run_tests.ts`) executable via `npm test` or `npx tsx backend/tests/run_tests.ts`.

### Test Execution Summary:
- **Total Tests Executed:** 19
- **Passed:** 19
- **Failed:** 0
- **Pass Rate:** 100%

### Detailed Test Results Breakdown:

| Test Suite | Scenario Verified | Expected Invariant | Status |
| :--- | :--- | :--- | :--- |
| **Pricing** | Urban baseline within 1.5 km | Base 1,500 + 200 platform = 1,700 piasters (17.00 EGP) | **PASS** |
| **Pricing** | Distance trip (3.5 km) | 1,500 + (2.0 km × 400) + 200 = 2,500 piasters (25.00 EGP) | **PASS** |
| **Pricing** | Rural / village surcharge | 1,500 + 800 + 500 (rural) + 200 = 3,000 piasters (30.00 EGP) | **PASS** |
| **Pricing** | Negative distance input | Throws `INVALID_DISTANCE` error | **PASS** |
| **Regulatory** | Passenger mobility request | Throws `REGULATORY_COMPLIANCE_LOCK` (HTTP 403) | **PASS** |
| **Security** | Valid quote verification | Legitimate HMAC-SHA256 signature accepted | **PASS** |
| **Security** | Tampered price verification | Price altered by client rejected (`QUOTE_SIGNATURE_TAMPERED`) | **PASS** |
| **FSM** | Illegal status jump | `created` directly to `delivered` throws `INVALID_STATE_TRANSITION` | **PASS** |
| **FSM** | Terminal state mutation | Altering `delivered` order throws `TERMINAL_STATE_MUTATION_FORBIDDEN` | **PASS** |
| **FSM** | Linear lifecycle progression | Order moves through all 5 valid steps cleanly | **PASS** |
| **FSM** | Unrecorded cash on COD | Transition to `delivered` throws `MISSING_CASH_COLLECTION` | **PASS** |
| **Concurrency** | 10 simultaneous captain claims | Exactly 1 captain wins (`200 OK`), remaining 9 receive `409 Conflict` | **PASS** |
| **Subscription**| Active captain in period | `isEligibleForNewOffers = true` | **PASS** |
| **Subscription**| Captain in 72h grace window | `isEligibleForNewOffers = true` with grace period warning | **PASS** |
| **Subscription**| Expired captain (>72h) | `isEligibleForNewOffers = false`, offers blocked | **PASS** |
| **Subscription**| Cash holding limit reached | Captain holding 1,050 EGP (>1,000 EGP ceiling) blocked from offers | **PASS** |
| **Webhooks** | Forged webhook signature | Rejected with `SIGNATURE_FAILED` (HTTP 401) | **PASS** |
| **Webhooks** | Valid webhook signature | Processed successfully with `status: 'PROCESSED'` | **PASS** |
| **Webhooks** | Webhook replay (3 deliveries)| 1st delivery processed; 2nd and 3rd return `ALREADY_PROCESSED` | **PASS** |

---

## 4. Flutter Codebase Audit & Defect Fixes

1. **Duration String Interpolation Fix:**
   - **Defect:** In `flutter_mashwar/lib/core/utils/price_calculator.dart`, line 36 had `'$minutes-$minutes+5'`. Because Dart doesn't automatically evaluate `+ 5` inside simple string interpolation, it rendered as `"8-8+5"`.
   - **Correction:** Updated to `'$minutes-${minutes + 5}'`. Tested and verified to output `"8-13"`.
2. **Integer Minor Units Parity:**
   - Added `PriceCalculator.calculateFarePiasters()` to the Flutter codebase so local quotes calculate exact integer piasters matching the backend engine.
3. **Repository Abstraction:**
   - Created `flutter_mashwar/lib/shared/services/order_repository_interface.dart` (`IOrderRepository`).
   - Implemented `flutter_mashwar/lib/shared/services/http_order_repository.dart` to communicate directly with the `/api/v1` backend endpoints.
   - Updated `ordersProvider` in `orders_provider.dart` to provide an injectable `orderRepositoryProvider`.
4. **pubspec.yaml Alignment:**
   - Added `http: ^1.2.0` dependency to support typed REST API calls.

---

## 5. Next Steps & Phase 5 Readiness

With the authoritative backend core built and 100% of the integration test suite passing locally:
1. **Phase 5 Target:** Egyptian Payment Gateway Sandbox (Paymob / Fawry test cards and Vodafone Cash wallets) and Supabase Staging Database provisioning once approved by project stakeholders.
2. **Zero Security Compromise:** All secrets remain isolated via environment variables (`PRICING_HMAC_SECRET`, `PAYMOB_HMAC_SECRET`). No production credentials or customer PII are present in the repository.
