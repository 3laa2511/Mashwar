# Mashwar — Security, Authorization & Privacy Model
**Classification:** Confidential Architecture Document  
**Phase:** Phase 2 Security Architecture Specification  

---

## 1. Zero-Trust Security Tenet

Mashwar's backend enforces a strict **Zero-Trust Client Policy**:
1. **No Client Authorization Authority:** The mobile application cannot authorize a transaction, set its own user ID, select a role, calculate an authoritative price, or assign a captain.
2. **Untrusted Headers & Body Parameters:** Parameters such as `customer_id`, `role`, `fare`, or `is_paid` sent in request bodies are ignored. The application server derives all permissions and tenant identity exclusively from the cryptographically verified JWT issued by the identity provider.
3. **Defense-in-Depth:** Authorization is validated at two distinct tiers:
   - **Tier 1 (Application Gateway / Middleware):** Route-level RBAC and tenant ownership verification in TypeScript.
   - **Tier 2 (Database Layer / Row-Level Security):** If a managed engine like Supabase is used, RLS policies enforce isolation even if internal queries run directly.

---

## 2. Authentication Identity Mapping to Roles

```text
 ┌───────────────────────┐
 │   Phone / SMS Auth    │  (Egyptian carrier verification)
 └──────────┬────────────┘
            │ Verified Phone Number
            ▼
 ┌───────────────────────┐
 │       users           │  (Unique UUID primary key)
 └──────────┬────────────┘
            │
            ├───────────────────────┬───────────────────────┐
            ▼                       ▼                       ▼
 ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
 │  Customer Role      │ │  Captain Role       │ │  Merchant Role      │
 │  (Default upon sign)│ │  (Requires approved │ │  (Linked to specific│
 │                     │ │   verification)     │ │   branch ID)        │
 └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
```

1. **Token Claims:** When a user logs in, the backend issues an access token with claims:
   ```json
   {
     "sub": "7b053d56-7594-4aa2-9bd4-ba97a6a82f92",
     "phone": "+201012345678",
     "roles": ["customer", "captain"],
     "active_role": "customer",
     "merchant_branch_ids": [],
     "iss": "https://api.mashwar.app",
     "exp": 1791984000
   }
   ```
2. **Context Injection:** In every request, the `AuthMiddleware` verifies the JWT signature, queries the active session status, and attaches a strongly typed `RequestContext` to the request pipeline:
   ```typescript
   export interface RequestContext {
     userId: string;
     roles: AppRole[];
     permissions: Set<string>;
     activeRole: AppRole;
     merchantBranchIds?: string[];
   }
   ```

---

## 3. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Customer | Captain | Merchant Staff | Operations Agent | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Request Fare Quote** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Create Delivery Order** | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes (Assisted) | ✅ Yes |
| **View Order Details** | ✅ Own Orders | ✅ Assigned Orders | ✅ Own Branch Orders | ✅ All Orders | ✅ All Orders |
| **Cancel Order** | ✅ Before Pickup | ❌ No | ✅ Before Pickup | ✅ Override | ✅ Override |
| **Accept Dispatch Offer** | ❌ No | ✅ If Offered | ❌ No | ❌ No | ❌ No |
| **Advance Order (Pickup/Delivered)**| ❌ No | ✅ Assigned Order | ❌ No | ✅ Override | ✅ Override |
| **Mark Order Ready in Kitchen** | ❌ No | ❌ No | ✅ Own Branch | ✅ Override | ✅ Override |
| **Verify Captain Documents** | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **Modify Pricing Rules** | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| **Access Regulatory Compliance Lock**| ❌ Read-Only | ❌ Read-Only | ❌ Read-Only | ❌ Read-Only | ⚠️ Legal Approval |

---

## 4. Tenant & Record Ownership Enforcement

### 4.1 Customer Ownership Rule
A customer can only query or mutate an order where:
```sql
orders.customer_id = current_user_id()
```
Attempting to fetch another customer's order ID returns `404 Not Found` (to avoid resource enumeration) rather than `403 Forbidden`.

### 4.2 Captain Assigned-Only Access Rule
A captain can view the full pickup/drop-off phone numbers and detailed address **only** if they are actively assigned:
```sql
orders.id IN (
    SELECT order_id FROM captain_assignments 
    WHERE captain_id = current_captain_id() AND status = 'accepted'
)
```
Before an offer is accepted (during the radar broadcast phase), the captain only sees the landmark neighborhood, distance, and payout. Customer phone numbers and exact building/apartment numbers are redacted.

### 4.3 Merchant Branch Isolation
Merchant personnel can access orders only if:
```sql
orders.merchant_branch_id IN (
    SELECT branch_id FROM merchant_user_assignments 
    WHERE user_id = current_user_id()
)
```

---

## 5. Row-Level Security (RLS) Policies (PostgreSQL / Supabase Tier)

Even though mobile clients connect via the authoritative API layer, database RLS is enabled as a defense-in-depth measure.

```sql
-- Enable RLS on Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

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

-- 3. Operations staff with permission can select all orders
CREATE POLICY operations_select_all_orders ON orders
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_role_assignments
            WHERE user_id = auth.uid()
            AND role_id IN ('operations_agent', 'super_admin')
        )
    );

-- 4. Mutating orders directly from client is FORBIDDEN
CREATE POLICY prevent_direct_client_updates ON orders
    FOR UPDATE
    USING (FALSE); -- Only the trusted backend service-role bypasses RLS
```

---

## 6. Personal Identifiable Information (PII) Protection

1. **National ID & Drivers Licenses:**
   - National ID numbers (`national_id_number`) are encrypted using `pgcrypto` (`pgp_sym_encrypt`) or stored with application-level AES-256-GCM.
   - Document image files (scanned licenses, criminal records) are stored in a private object bucket with short-lived presigned URLs (15 minutes). Public read access is strictly disabled.
2. **Phone Number Redaction in Audit Logs:**
   - Structured logging filters strip Egyptian mobile numbers (`+2010...`) and authorization tokens before emitting logs to disk or monitoring tools.
3. **Session Revocation:**
   - Suspended captains or deactivated users have their refresh tokens immediately revoked in the database (`users.is_active = FALSE`).
