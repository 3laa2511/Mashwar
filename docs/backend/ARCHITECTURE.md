# Mashwar — Backend Architecture & Technology Specification
**Platform:** Mashwar (مشوار) — Local Delivery & Mobility Platform  
**Target Market:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Phase:** Phase 2 — Database Design & Backend Architecture Specification  
**Status:** Reviewable Specification (No Production Credentials or Destructive Actions)  

---

## 1. Executive Summary & Context

Mashwar is an Egyptian local mobility and delivery logistics platform designed specifically for secondary and rural Egyptian hubs, launching initially in **El Bagour, Menoufia**.

### Initial Launch Scope
1. **Package and Document Courier:** Point-to-point delivery for individuals and offices within town limits and surrounding villages.
2. **Merchant & Restaurant Fulfillment:** Orders from local food and retail merchants (e.g., bakeries, shawarma, grills, groceries, hardware).
3. **Local Errands & Pharmacy:** Specialized item procurement, pharmacy orders, and government/utility errand facilitation.
4. **Passenger Mobility (Strictly Suspended):** Passenger transport remains **hard-disabled by platform policy** until regulatory licensing, commercial insurance, and traffic authority approvals in Menoufia are formally concluded.

### Core Architecture Philosophy
- **Server-Authoritative Business Logic:** The mobile client (Flutter) is an untrusted presentation layer. Fares, captain dispatch, order state changes, merchant settlements, and payment verifications must be executed exclusively by a hardened, authoritative backend.
- **Data Integrity & Auditability:** Every financial calculation, address snapshot, state transition, and role escalation must be recorded immutably.
- **Separation of Concerns:** Clean boundary between the client application, the API gateway, the transactional relational database, and future asynchronous workers.

---

## 2. Technology Evaluation & Selection

### 2.1 Evaluated Architecture Options

| Dimension | Option A: Pure Supabase Direct-to-Client | Option B: Custom Standalone Backend (Node.js/TS + Raw PostgreSQL) | Option C: Recommended Hybrid Tier (Authoritative Node/TS API + Managed PostgreSQL/Supabase DB & Auth) |
| :--- | :--- | :--- | :--- |
| **Architecture** | Flutter talks directly to Supabase PostgREST / Realtime via anon keys with RLS. | Custom Node.js/TypeScript REST API with connection pool (Drizzle/Prisma) to self-hosted PostgreSQL. | Dedicated Node.js/TypeScript API Service handling all business logic; PostgreSQL used as normalized store; Supabase optional for Auth/Managed DB only. |
| **Business Rule Enforcement** | Encapsulated in Postgres Functions / Triggers (`PL/pgSQL`). Difficult to test, maintain, version, and debug. | High testability, full TypeScript type sharing, expressive unit tests for pricing, dispatch, and state machines. | Full server-side TypeScript control. Clear separation between storage and domain logic. Standard CI/CD. |
| **Security & Authorization** | High vulnerability risk if RLS has edge-case leaks; client could attempt to manipulate custom claims or RPC parameters. | Explicit API middleware (RBAC, input validation with Zod, rate limiting, audit logging). Zero client database access. | Maximum security. Mobile client never communicates with database ports or holds service keys. Strict API boundary. |
| **Captain Dispatch & Concurrency** | Complex concurrency locks across PostgREST endpoints. Race condition vulnerability during batch dispatch. | Database transactions (`SELECT FOR UPDATE`, advisory locks) orchestrated cleanly inside application service layer. | Database transactions with ACID isolation, atomic assignment, and idempotency key enforcement. |
| **Egyptian Market Integrations** | Difficult to integrate Fawry, Paymob, Vodafone Cash callbacks and local SMS gateways directly via webhooks. | Seamless native integration of Egyptian payment webhooks, HMAC signature verification, and SMS retry workers. | Easy integration with Egyptian payment gateways (Paymob/Fawry), telecom SMS aggregators, and background jobs. |

### 2.2 Recommended Architecture: Option C (Authoritative API Gateway + PostgreSQL)

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                 Mobile Clients (Android / iOS)             │
 │                 Flutter / Dart with Sound Null Safety       │
 └──────────────┬───────────────────────────────▲──────────────┘
                │ HTTPS / REST (JWT Bearer)     │ Push (FCM)
                ▼                               │
 ┌─────────────────────────────────────────────────────────────┐
 │          Authoritative Backend API Service (Node.js/TS)     │
 │  ┌────────────────────────────────────────────────────────┐ │
 │  │ API Gateway & Security: Rate Limiter, Helmet, CORS     │ │
 │  ├────────────────────────────────────────────────────────┤ │
 │  │ Auth & Identity: JWT Verification, RBAC Middleware     │ │
 │  ├────────────────────────────────────────────────────────┤ │
 │  │ Domain Engines:                                        │ │
 │  │   - Pricing Engine (Configurable, Versioned)           │ │
 │  │   - Order State Machine (Strict Transitions)           │ │
 │  │   - Dispatch & Assignment Engine (Atomic Locks)        │ │
 │  │   - Audit & Compliance Logger (Immutable Log)          │ │
 │  └────────────────────────────────────────────────────────┘ │
 └──────────────┬───────────────────────────────▲──────────────┘
                │ Connection Pool (pg / Drizzle)│ Async Notifications
                ▼                               │
 ┌─────────────────────────────────────────────────────────────┐
 │            PostgreSQL Relational Database Engine            │
 │             (Managed Supabase or Cloud SQL)                │
 │  - Normalized Tables (3NF)                                  │
 │  - Check Constraints & Enums                                │
 │  - Row-Level Locks & Atomic Transactions                    │
 │  - Spatial Indexes (PostGIS coordinates)                    │
 │  - Immutable Audit Logs & Snapshots                         │
 └─────────────────────────────────────────────────────────────┘
```

#### Why Direct Client-to-Database Access is Rejected:
1. **Financial Security:** Fares must be calculated server-side based on distance, time of day, weather, unpaved road conditions, and merchant commission agreements. In a client-to-database model, malicious users could craft PostgREST RPC requests with spoofed fares or bypass verification.
2. **Race Conditions in Dispatch:** When a delivery offer is broadcast to nearby captains in El Bagour, multiple captains may accept concurrently. Preventing double-assignment requires explicit database transactions with row-level locks (`SELECT ... FOR UPDATE`), which are best orchestrated within an authoritative application service.
3. **Third-Party Egyptian Integrations:** Egyptian payment aggregators (Paymob, Fawry, Vodafone Cash) and telecom SMS gateways require webhook receivers that verify HMAC signatures, validate order amounts against ledger entries, and issue asynchronous callbacks. These cannot run securely inside client code.

---

## 3. High-Level System Components

### 3.1 Mobile Client Layer (`flutter_mashwar/`)
- Pure presentation layer using **Flutter (Dart)**.
- Communicates exclusively over HTTPS with the Mashwar API using `Bearer <JWT>`.
- Employs a typed API Client (`Dio`) with interceptors for token refresh, request signing, and client-side error localization.
- Swappable repository pattern allows clean transition from `MockDataRepository` to `HttpDataRepository`.

### 3.2 API Gateway & Application Server
- **Runtime:** Node.js 20+ LTS with TypeScript in strict mode.
- **Framework:** Express / Fastify with modular layered architecture (Controller → Service → Repository).
- **Validation:** `Zod` schemas for 100% of request bodies, query params, and headers.
- **Authentication:** Standard OIDC / JWT with access tokens (15-minute expiry) and cryptographically signed refresh tokens stored securely on the mobile device (`FlutterSecureStorage`).
- **Idempotency Engine:** `Idempotency-Key` header verified against a dedicated cache/table to prevent duplicate charges or duplicate order submissions during network dropouts in Menoufia's rural corridors.

### 3.3 Relational Storage (PostgreSQL)
- **Engine:** PostgreSQL 15+ with standard extensions (`uuid-ossp`, `pgcrypto`, optional `postgis`).
- **Constraints & Enums:** Enforced at the engine level (Foreign keys with explicit cascade rules, CHECK constraints on monetary and status fields).
- **Transactions:** High isolation (`READ COMMITTED` default, `SERIALIZABLE` or explicit row-level locking for captain assignment and financial ledgers).

---

## 4. Key Architectural Decisions & Non-Negotiables

1. **Monetary Precision:** All currency amounts are stored in **Egyptian Piasters (قروش)** as `BIGINT` or as `NUMERIC(10, 2)` in EGP. Floating-point values (`FLOAT`, `DOUBLE`) are strictly forbidden to eliminate rounding drift.
2. **Time Handling:** Every event timestamp is persisted in **UTC (`TIMESTAMPTZ`)**. The Flutter client is responsible for formatting timestamps into Cairo Local Time (`Africa/Cairo`, UTC+2 / UTC+3 DST).
3. **Immutable Snapshots:** Changing a customer's saved address in their profile **never** alters the pickup or drop-off address of historic or active orders. Orders record immutable address and fare snapshots at the moment of creation.
4. **Zero-Trust Client Identity:** The server never uses `customer_id` or `user_id` from the request payload. The authenticated identity is extracted exclusively from the cryptographically verified JWT payload.
5. **Passenger Mobility Lock:** Passenger ride-hailing is disabled at the database level (`service_types.is_enabled = FALSE`) and API level. Any attempt to request an order with `service_type = 'passenger'` returns `403 Forbidden` with a regulatory compliance code.
