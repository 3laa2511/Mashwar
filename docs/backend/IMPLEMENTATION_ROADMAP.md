# Mashwar — Backend Implementation, Migration & Flutter Integration Roadmap
**Phase:** Phase 2 Architecture & Specification  
**Status:** Approved Specification  

---

## 1. Migration & Environment Strategy

### 1.1 Environment Separation
1. **Local Development (`dev`):**
   - Docker Compose running PostgreSQL 15 + Redis (for ephemeral locks).
   - Mock SMS Provider (returns fixed code `1234` for any Egyptian phone).
   - Local synthetic seed data.
2. **Automated Testing (`test`):**
   - Ephemeral PostgreSQL test containers spawned during CI runs.
   - 100% isolated database schema per test worker.
3. **Staging (`staging`):**
   - Dedicated managed PostgreSQL instance matching production configuration.
   - Connected to payment gateway test sandboxes (Paymob / Fawry test cards) and real Egyptian SMS staging gateway.
4. **Production (`prod`):**
   - Multi-AZ managed PostgreSQL with automated daily snapshots, Point-In-Time Recovery (PITR), and encrypted backups.
   - Strict secrets management (never committed to git or exposed to client builds).

### 1.2 Versioned Database Migrations
- Tooling: Drizzle Kit or Flyway with forward (`.sql`) and rollback scripts in `db/migrations/`:
  - `0001_initial_schema.sql` (Users, roles, permissions)
  - `0002_captains_and_merchants.sql`
  - `0003_orders_and_fare_quotes.sql`
  - `0004_captain_assignments_and_concurrency.sql`
  - `0005_payments_and_audit_logs.sql`
- Zero-Downtime Rule: Schema alterations follow expand-and-contract patterns (e.g. adding columns as nullable, migrating data asynchronously, then adding constraints).

### 1.3 Synthetic Seed Strategy
- Real customer or captain PII is **strictly prohibited** in seed scripts.
- Seed data generates representative El Bagour landmarks (ميدان المحطة، مجلس المدينة، مستشفى الباجور العام، قرى شنتنا وجروان وميت عفيف)، mock merchant menus (فطاير ومشاوي الباجور)، and test captains with virtual motorcycle license plates.

---

## 2. Automated Quality Gates & Test Matrix

The backend implementation must implement automated test suites verifying:
1. **Tenant Role Isolation Tests:** Verify a customer cannot read or cancel another customer's order.
2. **Order Lifecycle FSM Tests:** Verify illegal status jumps (e.g. `created` → `delivered`) throw `422 Unprocessable Entity`.
3. **Pricing Versioning Tests:** Verify historical orders retain their quoted fare even if the active pricing rule version changes.
4. **Captain Assignment Race Condition Tests:** Spawn 10 concurrent requests from 10 different captains attempting to accept the exact same order offer. Assert that exactly 1 request returns `200 OK` and 9 return `409 Conflict`.
5. **Idempotency Key Tests:** Re-send the exact same order creation request with the same `Idempotency-Key` and assert that no duplicate database record is created.

---

## 3. Flutter Client Integration Plan

### 3.1 Mapping Existing Mock Data to API Contracts

| Existing Mock Component in `flutter_mashwar/` | Target Production Implementation | Required Changes & Migration Action |
| :--- | :--- | :--- |
| `MockDataRepository.getInitialMockOrders()` | `HttpOrderRepository.fetchOrders()` | Replace static list with `GET /api/v1/orders` returning paginated results. |
| `PriceCalculator.calculateQuote()` | `HttpPricingRepository.getQuote()` | Keep client calculator for instant offline UI feedback, but submit to `POST /api/v1/quotes` to acquire an authoritative `quoteId` before order creation. |
| Client-generated order IDs (`MSH-8105`) | Server-assigned order IDs (`UUID` + `order_code`) | Client sends payload with `idempotency_key`; server responds with immutable `orderCode`. |
| Local `OrdersNotifier.advanceOrderStatus()` | `HttpOrderRepository.transitionStatus()` | Replace direct state modification with `POST /api/v1/captain/orders/:id/transition`. |
| In-memory `roleProvider` | Server-validated JWT Role Claims | Extract active role from decoded JWT; verify role against server session. |
| Predefined landmark strings | `Landmark` models with Lat/Lng | Replace hardcoded dropdown strings with typed address models supporting PostGIS coordinates. |

### 3.2 Phased Migration Phases

```text
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 2 (Completed): Architecture & Database Specification  │
 │ - PostgreSQL 3NF Schema & Constraints                       │
 │ - REST API Contracts & Security Model                       │
 │ - State Machine & Concurrency Specifications                │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 3 (Next Phase): Backend Service Implementation        │
 │ - Scaffold Node.js / TypeScript API Server                  │
 │ - Drizzle / Postgres Connection & Migrations                │
 │ - Pricing Engine & Order State Machine implementation       │
 │ - Concurrency & Idempotency automated test suites           │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 4: Flutter Repository Migration                       │
 │ - Create `HttpApiClient` with Dio in `flutter_mashwar/`     │
 │ - Implement `HttpOrderRepository` implementing existing     │
 │   abstract `OrderRepository` interface                      │
 │ - Connect Riverpod `ordersProvider` to live API endpoints   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ Phase 5: Egyptian Production Gateway Integrations           │
 │ - Telecom SMS Gateway integration (Vodafone/Orange/e&)      │
 │ - Egyptian Payment Gateway (Paymob / Fawry / Vodafone Cash) │
 │ - Staging Pilot Trial in El Bagour                          │
 └─────────────────────────────────────────────────────────────┘
```
