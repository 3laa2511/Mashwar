# Mashwar — Supabase Authentication & Fail-Closed Authorization Architecture

**Platform:** Supabase Auth + Kysely / PostgreSQL + Express Authoritative Server  
**Target Operational Hub:** El Bagour, Menoufia Governorate, Egypt  
**Status:** Implemented & Verified (Zero-Trust Identity Model)

---

## 1. Security Architecture Overview

Mashwar implements a **Zero-Trust Client Identity Model**:
1. **No Client Authorization Authority:** The client cannot supply its own user ID, select its role, elevate privileges, calculate authoritative prices, or assign orders.
2. **Untrusted Headers Stripped:** Headers such as `X-Actor-Id`, `X-Actor-Role`, and `X-Actor-Name` are stripped and completely ignored. Any request attempting to use them without a cryptographically verified Bearer token is rejected.
3. **Fail-Closed Authentication:** Every request to a protected endpoint must present an `Authorization: Bearer <token>` header verified either via Supabase Auth (`/auth/v1/user`) or signed with HMAC-SHA256 (`SUPABASE_JWT_SECRET`).
4. **Roles Sourced Strictly from `app_metadata.role`:** User roles (`owner`, `operations_dispatcher`, `support_agent`, `captain`, `customer`, `merchant`) are securely provisioned in `auth.users.app_metadata`. The client has zero write access to `app_metadata`.

---

## 2. Endpoint Authorization Matrix

| Endpoint | HTTP Method | Allowed Roles | Identity Derivation / Ownership Check |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | Public | None (System status, El Bagour Hub) |
| `/quotes` | `POST` | Public / All | Cryptographically signed HMAC quote calculation |
| `/orders` | `POST` | `customer`, `merchant`, `owner` | `customer_id` is derived strictly from `auth.uid()` (`token.sub`). Client body `customerId` is ignored. |
| `/orders/:id` | `GET` | All authenticated | **Customer/Merchant:** Can only access orders where `order.customerId === auth.uid()`.<br>**Captain:** Can only access if assigned or if status is `searching_captain`.<br>**Admin/Support:** Unrestricted. |
| `/orders/:id/transitions` | `POST` | `captain`, `owner`, `dispatcher` | **Captain:** Must be the assigned captain (`assignedCaptainId === resolvedCaptain.id`).<br>**Customer:** Forbidden from initiating transitions. |
| `/orders/:id/cancel` | `POST` | `customer`, `merchant`, `owner`, `dispatcher`, `support_agent` | **Customer:** Can only cancel own order (`customerId === auth.uid()`) and only pre-pickup (`created`, `searching_captain`). |
| `/captain/eligibility` | `GET` | `captain`, `owner`, `dispatcher` | **Captain:** Derived from `auth.uid()` via `captains` table lookup.<br>**Admin:** Can inspect specific captain via query param. |
| `/captain/subscription` | `GET` | `captain`, `owner` | Derived from `auth.uid()` via `captains` table lookup. |
| `/captain/orders/:id/accept` | `POST` | `captain` | Captain record resolved from `auth.uid()`. Mutex row-lock ensures single winner. |
| `/captain/orders/:id/cash-collection` | `POST` | `captain` | Captain resolved from `auth.uid()`. Transactional row lock (`FOR UPDATE`), idempotency key check, ledger entry. |
| `/payments/intents` | `POST` | `customer`, `merchant`, `owner` | Only order owner can request payment intent. |
| `/webhooks/payments/:provider` | `POST` | Webhook Providers | HMAC-SHA256 signature verification over raw body + replay attack deduplication. |
| `/admin/*` | `GET`, `POST`, `PUT` | `owner`, `operations_dispatcher`, `support_agent` | Enforces granular permissions (`manage_pricing`, `settle_cash_remittance`, `manual_dispatch_override`, `cancel_order`). |

---

## 3. Database-Backed Captain Identity Resolution

In place of temporary mock mappings, the `CaptainService` queries the durable `captains` table:

```sql
SELECT * FROM captains WHERE user_id = $1 AND is_online = TRUE;
```

- If no profile exists for `auth.uid()`, the request fails with `404 CAPTAIN_PROFILE_NOT_FOUND`.
- If the captain's account is suspended (e.g. cash ceiling exceeded), requests to claim new orders are rejected with `403 CAPTAIN_ACCOUNT_SUSPENDED`.

---

## 4. Transactional Cash Collection & Financial Ledger

Cash collection on delivery (COD) is transactional and integer piaster-based (1 EGP = 100 piasters):

1. **Row Lock (`SELECT FOR UPDATE`):** Prevents concurrent double-collection requests.
2. **Ownership Check:** Asserts `order.assigned_captain_id === captain.id`.
3. **Idempotency Key:** Protects against network retries: returning the cached receipt on duplicates without duplicate financial entries.
4. **State Transition:** Automatically updates order to `is_paid = true` and `delivered`.
5. **Cash Ceiling Enforcement:** If captain's holding exceeds 100,000 piasters (1,000 EGP), captain status is automatically switched to `suspended` until remittance is recorded at the El Bagour hub.
6. **Immutable Ledger Insertion:** Inserts audit record into `financial_ledger` tracking previous balance, current remittance/collection, and timestamp.

---

## 5. Supabase Custom Claims Provisioning

To assign roles in Supabase Auth, use Supabase CLI or Edge Functions with the service role key:

```sql
-- Update app_metadata with trusted role
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "captain"}'::jsonb
WHERE phone = '+201012345671';
```

Clients cannot alter `raw_app_meta_data`. Any attempt by a client to update its own role will be ignored by Supabase Auth and rejected by the API layer.
