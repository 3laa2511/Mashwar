# Mashwar — Security, Authorization & Privacy Model
**Data Platform:** Supabase (Auth, Storage, RLS) + Trusted Server API (TypeScript)  
**Phase:** Phase 2 Security Architecture Specification  
**Status:** Reviewable Specification (Zero Production Credentials Stored)  

---

## 1. Verified Code vs. Proposed Security Model

| Security Domain | Verified Repository Code (`flutter_mashwar/`) | Proposed Security Architecture | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Authentication** | Demo role switch menu in UI (`PopupMenuButton`). | Supabase Auth (Egyptian mobile phone SMS OTP) issuing cryptographically signed JWTs. | **Proposed** |
| **Authorization** | Purely visual conditional rendering in client. | Route-level RBAC middleware in trusted API + Row-Level Security (RLS) in PostgreSQL. | **Proposed** |
| **Captain Monetization Gate** | Unconditional access to active order. | Server checks active subscription or grace period before dispatching delivery offers. | **Proposed** |
| **Fare Tampering** | Client calculates and sends `estimatedFareEGP`. | Server pricing engine calculates and issues signed `quoteId`. Client amounts ignored. | **Proposed** |
| **Payment Webhooks** | Not implemented. | HMAC-SHA256 signature verification with raw body inspection & replay attack protection. | **Proposed** |
| **PII & Documents** | Hardcoded sample captain name/vehicle. | AES-256 encryption for National IDs; private Supabase storage with 15-minute presigned URLs. | **Proposed** |

---

## 2. Zero-Trust Security Tenet

Mashwar's backend enforces a strict **Zero-Trust Client Policy**:
1. **No Client Authorization Authority:** The mobile application cannot authorize a transaction, set its own user ID, select a role, calculate an authoritative price, or assign a captain.
2. **Untrusted Headers & Body Parameters:** Parameters such as `customer_id`, `role`, `fare`, or `is_paid` sent in request bodies are ignored. The application server derives all permissions and tenant identity exclusively from the cryptographically verified JWT issued by the identity provider.
3. **Defense-in-Depth:** Authorization is validated at two distinct tiers:
   - **Tier 1 (Application Gateway / Middleware):** Route-level RBAC and tenant ownership verification in TypeScript.
   - **Tier 2 (Database Layer / Row-Level Security):** If a managed engine like Supabase is used, RLS policies enforce isolation even if internal queries run directly.

---

## 3. Row-Level Security (RLS) Policies (PostgreSQL / Supabase Tier)

Even though mobile clients connect primarily via the authoritative API layer, database RLS is enabled as a defense-in-depth measure.

```sql
-- Enable RLS on Orders and Captain Subscriptions
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;

-- 1. Customers can select their own orders
CREATE POLICY customer_select_own_orders ON orders
    FOR SELECT
    USING (customer_id = auth.uid());

-- 2. Captains can select orders assigned to them
CREATE POLICY captain_select_assigned_orders ON orders
    FOR SELECT
    USING (
        id IN (
            SELECT order_id FROM captain_assignments
            WHERE captain_id IN (SELECT id FROM captains WHERE user_id = auth.uid())
            AND status = 'accepted'
        )
    );

-- 3. Captains can view their own subscription status
CREATE POLICY captain_select_own_subscription ON captain_subscriptions
    FOR SELECT
    USING (captain_id IN (SELECT id FROM captains WHERE user_id = auth.uid()));

-- 4. Operations staff with permission can select all records
CREATE POLICY operations_select_all_orders ON orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_role_assignments
            WHERE user_id = auth.uid()
            AND role_id IN ('operations_agent', 'super_admin')
        )
    );

-- 5. Mutating orders directly from client is FORBIDDEN
CREATE POLICY prevent_direct_client_updates ON orders
    FOR ALL
    USING (FALSE); -- Only the trusted backend service-role bypasses RLS
```

---

## 4. Personal Identifiable Information (PII) Protection

1. **National ID & Drivers Licenses:**
   - National ID numbers (`national_id_number`) are stored using `pgcrypto` (`pgp_sym_encrypt`) or application-level AES-256-GCM.
   - Document image files (scanned licenses, criminal records) are stored in private Supabase Storage buckets with short-lived presigned URLs (15 minutes). Public read access is strictly disabled.
2. **Phone Number Redaction in Audit Logs:**
   - Structured logging filters strip Egyptian mobile numbers (`+2010...`) and authorization tokens before emitting logs to disk or monitoring tools.
3. **Session Revocation:**
   - Suspended captains or deactivated users have their refresh tokens immediately revoked in the database (`users.is_active = FALSE`).


---

## 5. Marketplace, Captain Identity & Location Privacy (Scope Addendum — 2026-10-14)

### Merchant boundaries
- Public reads are restricted to approved, active merchants/branches and public catalog fields.
- Merchant owner/staff permissions are scoped through persisted memberships and branch access; never trust a client-supplied merchant ID alone.
- Merchant subscription is not a verification bypass. Suspended/unapproved merchants cannot publish or accept orders.
- Price, stock, approval state, entitlement, and audit fields are server-owned. Validate catalog uploads and use least-privilege storage policies.

### Captain identity data
- Public profile DTOs contain only necessary display name/photo, verification badge, vehicle category, and persisted rating/completion aggregates.
- National ID numbers, ID/license images, private phone, home address, date of birth, internal review notes and risk flags are private and never included in customer/merchant API responses.
- Identity files live in private storage with short-lived signed URLs created only after authorization. Audit access and review decisions; redact signed URL tokens and PII from logs.
- Define legal basis, retention/deletion, staff access and incident response before collecting real documents. Use synthetic fixtures only.

### Location and dispatch
- Exact customer addresses and captain coordinates are access-controlled by order relationship and operational need.
- Validate coordinates and timestamps, rate-limit updates, reject stale/impossible jumps for dispatch eligibility, and record minimal data.
- A routing provider or GPS stream must not be represented as live/accurate unless actually integrated. Keep routing credentials server-side.
- Assignment uses durable database transactions and constraints; process-local locks are not a security or consistency boundary.
- Include authorization tests for cross-merchant reads, unassigned address access, captain spoofing, and concurrent acceptance.

### Region boundaries
Service-area activation is an operations privilege. Orders, merchants and captains must be checked against the authoritative active area. Never allow a request body to override the region selected from trusted order/branch configuration. Add cross-area isolation tests and preserve passenger transport lock.


---

## 6. Web/Mobile Parity, Chat & Audio Security (2026-10-14)

### Shared clients
- Flutter and browser clients are untrusted. All authoritative operations go through the same trusted API and verified JWT model.
- Web-specific CORS, CSRF protections where cookie sessions are used, secure session cookie settings, CSP, and dependency/build controls must be reviewed before deployment.
- Do not place service-role secrets, signing secrets, private storage keys, or provider credentials in either client bundle.
- Cross-client synchronization is through persisted server data, not browser local storage or device-only order lists.

### Conversation authorization
- Verify order participation and current assignment at message read, send, attachment upload, and audio download time.
- Ignore client-supplied sender ID/role as identity proof. Prevent cross-order and cross-customer access.
- Operations/support access is permission-scoped and audited; it is not blanket access for every staff account.
- Reassignment/cancellation lifecycle must define when the former captain loses access.

### Voice-note handling
- Request microphone permission only after explicit user action. Do not record automatically.
- Validate actual file bytes, MIME/codec, duration and size server-side; never trust browser-provided metadata alone.
- Use private object storage and short-lived authorized URLs. No public audio bucket or permanent public link.
- Apply upload quotas, rate limits, retention/deletion policy and safe logging. Avoid recording or transcribing without transparent consent.
- Push notifications do not include message bodies, voice URLs, exact locations, or private customer details.

### Browser and accessibility controls
- Provide keyboard-accessible controls, visible recording state, cancel/preview/send actions, large touch targets, and Arabic RTL labels.
- When microphone or geolocation is denied/unavailable, provide an honest text/manual-address fallback.
- Do not promise speech-to-text, live calls, or background GPS until separately designed, consented, and tested.
