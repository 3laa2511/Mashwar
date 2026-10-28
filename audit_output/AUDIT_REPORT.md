# Mashwar (مشوار) — Engineering, Security Hardening & Release-Readiness Audit Report

## 1. Executive Baseline & Repository Status
- **Workspace Root:** `/app/applet`
- **Launch Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt (with multi-city expansion across Shebin El-Kom, Menouf, and Sadat City)
- **Monetary Representation:** 100% Integer Egyptian Piasters (`1 EGP = 100 Piasters`) across pricing, catalog, orders, payment intents, webhooks, and cash ledger
- **Zero-Commission Model:** Captains and merchants operate on flat monthly subscriptions with `0%` per-order commission
- **Regulatory Compliance Lock:** Passenger transport (`passenger`) is hard-locked (`403 REGULATORY_COMPLIANCE_LOCK`) pursuant to Egyptian Law No. 73 of 2018
- **Environment Constraints:**
  - Node.js / TypeScript / Express / Vite build and test runners are active and verified.
  - No `.git` metadata directory is mounted in `/app/applet`; baseline comparison and `git apply --check -v` validation were executed against the preserved original baseline in `audit_output/final_staging/`.
  - `DATABASE_URL` is unset and no local PostgreSQL server (`psql` / `pg_isready`) or Flutter SDK (`flutter` / `dart`) is installed in this container.

---

## 2. Feature Audit Matrix

| Area / Module | Status | Evidence & Verification |
| :--- | :--- | :--- |
| **Pricing Engine & HMAC Quote Verification** (`backend/src/pricing/pricingEngine.ts`) | **WORKING** | Generates zone-aware integer piaster quotes with HMAC-SHA256 anti-tamper signatures, rural village surcharge (`500` piasters), and hard regulatory rejection of `passenger` requests (`403`). Verified by Suites 1, 2, 3, 11, 17. |
| **Supabase JWT Authentication & Algorithm Pinning** (`backend/src/security/auth.ts`) | **WORKING** | Enforces fail-closed algorithm selection (`HS256`, `ES256`, `RS256`), key-type binding, prevention of public-key reuse as an `HS256` secret, mandatory production `SUPABASE_JWT_ALG`/`SUPABASE_JWT_ISSUER`/`SUPABASE_JWT_AUDIENCE`, role extraction strictly from `app_metadata.role` (with safe case normalization), header stripping (`x-actor-*`), and generic non-leaking 500 client messages. Verified by Suites 12, 15, 24. |
| **Role-Based Access Control (RBAC)** (`backend/src/security/rbac.ts`, `backend/src/api/routes.ts`) | **WORKING** | Enforces explicit permissions across `owner`, `operations_dispatcher`, `support_agent`, `captain`, `merchant`, and `customer`. Zero trust in client headers or body role fields. Verified by Suites 8, 12, 15. |
| **Order Lifecycle FSM & Ownership Isolation** (`backend/src/orders/orderFsm.ts`, `backend/src/api/routes.ts`) | **WORKING** | Enforces strict transition graph, customer/merchant/captain ownership on `GET /orders/:id`, `GET /orders/:id/history`, `POST /orders/:id/cancel`, and `POST /orders/:id/transitions`, plus user-scoped idempotency with payload fingerprinting on `POST /orders`. Verified by Suites 4, 5, 15, 19, 23. |
| **Payment Intents & Webhook Verification** (`backend/src/api/routes.ts`, `backend/src/payments/webhookService.ts`) | **WORKING** | Enforces explicit role allowlist (`customer`, `merchant`, `owner`, `operations_dispatcher`), server-verified order/store ownership, authoritative integer piaster amount enforcement (`422 AMOUNT_MANIPULATION_DETECTED`), user-scoped idempotency with payload mismatch rejection (`409`), webhook HMAC verification (failing closed in production when secret is unset), and webhook amount/order-state verification. Verified by Suites 9, 10, 15, 24. |
| **Atomic Cash Collection & Ceiling Enforcement** (`backend/src/services/cashCollectionService.ts`) | **WORKING** | Enforces assigned-captain ownership, authoritative fare verification, idempotency replay and payload mismatch detection, `100,000` piaster (`1,000 EGP`) cash ceiling auto-suspension, dual-key in-memory mutex (`orderLocks` + `captainLocks`), and PostgreSQL `SELECT ... FOR UPDATE` row locking (`orders` then `captains`). Verified by Suites 7, 8, 10, 14, 16. |
| **Merchant, Store & Catalog Management** (`backend/src/services/merchantService.ts`) | **WORKING** | Enforces store ownership (`403 FORBIDDEN_STORE_OWNERSHIP` on cross-merchant edits) and integer piaster menu pricing. Verified by Suite 18. |
| **Customer Support & Complaints Workflow** (`backend/src/services/complaintService.ts`) | **WORKING** | Supports ticket creation, customer ownership filtering, agent assignment, and resolution with audit logging. Verified by Suite 21. |
| **PostgreSQL Schema & Kysely Migrations 001 + 002** (`backend/src/database/`) | **PARTIALLY VERIFIED (Compiler Pass / Live DB Blocked)** | Migrations `001_security_hardening.ts` and `002_complete_platform_schema.ts` compile cleanly via Kysely's PostgreSQL `PostgresQueryCompiler` (including `idx_cash_collections_order_id_unique` and Phase 2 multi-zone/store columns). Live PostgreSQL execution is pending `DATABASE_URL` in CI. Verified by Suites 16, 22. |
| **Web Operations Dashboard & Mobile Simulator** (`src/components/OwnerAdminDashboard.tsx`, `src/App.tsx`) | **WORKING** | Compiles cleanly via `tsc --noEmit` and `vite build`; `server.ts` serves Express API (`/api/v1`) + Vite SPA with `hmr: false` on port 3000. |
| **Flutter Mobile App** (`flutter_mashwar/`) | **PARTIALLY VERIFIED (Static Audit / SDK Blocked)** | Fixed `_serviceTypeToBackend` (`restaurant_store`) and Bearer token header injection in `flutter_mashwar/lib/shared/services/http_order_repository.dart`. Runtime `flutter analyze` / `flutter test` execution is pending a runner with the Flutter SDK installed (`.github/workflows/quality.yml`). |

---

## 3. Security Hardening Summary

1. **JWT Algorithm Pinning & Key-Type Binding (`backend/src/security/auth.ts`):**
   - Supported algorithms are explicitly restricted to `HS256`, `ES256`, and `RS256`; `none` and all unlisted algorithms are rejected before signature verification (`401 UNSUPPORTED_TOKEN_ALGORITHM`).
   - Production requires explicit `SUPABASE_JWT_ALG`, `SUPABASE_JWT_ISSUER` (or `SUPABASE_URL`), `SUPABASE_JWT_AUDIENCE`, and the matching verification key/secret (`500 AUTH_CONFIG_MISSING` if missing or ambiguous).
   - Prevents algorithm confusion: rejects `HS256` tokens whenever an asymmetric public key (`SUPABASE_JWT_PUBLIC_KEY` / `SUPABASE_JWT_PUBLIC_JWK`) is configured, and rejects PEM/JWK key material if passed in `SUPABASE_JWT_SECRET`.
   - Enforces P-256 (`prime256v1`) and 64-byte IEEE P1363 signatures for `ES256` and RSA `>= 2048` bits for `RS256`, while rejecting private keys.
   - Extracts roles strictly from `app_metadata.role` (with safe lowercase normalization) and strips spoofed `x-actor-*` headers.
   - **Token Revocation Note:** `verifyAccessToken()` performs local cryptographic signature and claim verification (`exp`, `iss`, `aud`). It does not query Supabase's remote `/auth/v1/user` endpoint on each request; therefore, a compromised token remains valid until its `exp` timestamp unless short token TTLs or a server-side revocation denylist are used.
2. **Payment Intent & Webhook Hardening (`backend/src/api/routes.ts`, `backend/src/payments/webhookService.ts`):**
   - `POST /payments/intents` enforces an explicit role allowlist (`customer`, `merchant`, `owner`, `operations_dispatcher`), regex validation on `orderId`, provider allowlist (`paymob`, `fawry`, `vodafone_cash`), server-verified customer/store ownership, terminal/paid order rejection (`409`), client amount manipulation rejection (`422`), and user-scoped idempotency (`${user.id}:${idempotencyKey}`) with payload mismatch detection (`409`).
   - `POST /webhooks/payments/:provider` verifies provider match, rejects cancelled orders (`409 ORDER_CANCELLED_CANNOT_MARK_PAID`) and mismatched amounts (`422 WEBHOOK_AMOUNT_MISMATCH`), and fails closed in production when `PAYMENT_WEBHOOK_SECRET` / provider secret is missing (`500 WEBHOOK_CONFIG_MISSING`).
3. **Order Ownership, FSM & Cash Collection Concurrency (`backend/src/orders/orderFsm.ts`, `backend/src/services/cashCollectionService.ts`):**
   - Route guards and `OrderFsm.transition()` agree on customer (`created`, `searching_captain`) and merchant (`created`, `accepted_by_store`, `preparing`, `ready_for_pickup`) cancellation rules and captain ownership.
   - `CashCollectionService` serializes concurrent collections per order and per captain in memory and locks `orders` then `captains` with `SELECT ... FOR UPDATE` in PostgreSQL, backed by unique indexes on `cash_collections(idempotency_key)` and `cash_collections(order_id)`.

---

## 4. Quality Gates & Test Execution Report

| Command | Exit Code | Result |
| :--- | :--- | :--- |
| `npm run typecheck` (`tsc --noEmit`) | `0` | Passed with zero TypeScript errors (`audit_output` excluded in `tsconfig.json`) |
| `npm test` (`NODE_ENV=test tsx backend/tests/run_tests.ts`) | `0` | **82 / 82 tests passed (0 failed)** across 24 test suites |
| `npm run build` (`vite build`) | `0` | Production bundle built cleanly in `dist/` |

---

## 5. Generated Patch Artifacts & Checksums

| File Path | Scope | Size (Bytes) | SHA-256 Checksum | `git apply --check` |
| :--- | :--- | :--- | :--- | :--- |
| `/app/applet/audit_output/mashwar-backend-security-6files.patch` | 6 Backend Security & CI files (`tsconfig.json`, `routes.ts`, `orderFsm.ts`, `auth.ts`, `cashCollectionService.ts`, `run_tests.ts`) | `129,853` | `22620405fdb1da18d51b29329469ce37b9b28d93f3fe7d86c7a55e3928b305c6` | **PASSED** (`exit 0`) |
| `/app/applet/audit_output/mashwar-backend-security-5files.patch` | 5 `final_staging` Baseline Backend files (`routes.ts`, `orderFsm.ts`, `auth.ts`, `cashCollectionService.ts`, `run_tests.ts`) | `129,370` | `c6ba9efac236ddb398fbcac8f2ad6313be133b8ec95146e2b58d8f28188692f3` | **PASSED** (`exit 0`) |
| `/app/applet/mashwar-security-hardening.patch` | Full 8-file Baseline Patch (`tsconfig.json`, `server.ts`, `002_complete_platform_schema.ts`, `routes.ts`, `orderFsm.ts`, `auth.ts`, `cashCollectionService.ts`, `run_tests.ts`) | `132,258` | `a1419fc4a953b2db4cddf3cc089ad278ae4579e18414d20c6903c54e597d664b` | **PASSED** (`exit 0`) |
