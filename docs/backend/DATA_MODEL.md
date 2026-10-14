# Mashwar — Relational Database Schema & Data Model Specification
**Data Platform:** Supabase / PostgreSQL 15+  
**Target Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Monetary Representation:** Integer Minor Units (Egyptian Piasters - قروش)  
**Status:** Reviewable Specification (Design Phase Only — No Live Database Modified)  

---

## 1. Verified Code vs. Proposed Database Schema

| Area | Verified Repository Code (`flutter_mashwar/`) | Proposed Database Design | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Monetary Units** | `double estimatedFareEGP = 22.0` (IEEE 754 float in EGP) | `BIGINT` in Egyptian Piasters (`2200` = 22.00 EGP). Zero rounding drift. | **Proposed** (Defect identified in client model) |
| **Primary Keys** | Client strings (e.g. `'MSH-8102'`, `'MSH-${ts % 10000}'`) | Globally unique `UUIDv7` or `UUID` (`gen_random_uuid()`) + human display code. | **Proposed** |
| **Captain Monetization** | Hardcoded daily earnings screen displaying static 240.00 EGP / 9 trips. | **Captain Subscription Model:** `captain_subscription_plans`, `captain_subscriptions`, `captain_subscription_payments`. | **Proposed** |
| **Cash Collection** | Simulated label on active order card. | `cash_collections` table recording collection timestamp, collector ID, amount in piasters, and remittance state. | **Proposed** |
| **Electronic Payments** | Not implemented in Flutter codebase. | `payment_intents`, `payment_transactions`, `webhook_events` with HMAC verification & idempotency keys. | **Proposed** |
| **Addresses** | Flat strings (`pickupAddress: 'ميدان المحطة'`) | Normalized `customer_addresses` + immutable `order_addresses` snapshots. | **Proposed** |
| **Passenger Mobility** | Disabled in UI with warning dialog. | Locked by constraint: `service_types.is_enabled = FALSE`. | **Proposed** (Enforcing client invariant) |

---

## 2. Monetary Representation Justification (Integer Piasters)

All monetary fields throughout Mashwar are stored as **`BIGINT` in Egyptian Piasters (قروش مصري)**:
- `1 EGP = 100 Piasters` (e.g. 15.00 EGP = `1500` piasters; 22.50 EGP = `2250` piasters).

### Why Floating-Point (`FLOAT` / `DOUBLE`) is Rejected:
1. **IEEE 754 Precision Drift:** Binary representation of decimals produces rounding errors (e.g. `15.10 + 4.20 = 19.300000000000004`). In ledgers and cash collection reconciliation, penny-level discrepancies undermine financial auditing.
2. **Egyptian Gateway Compatibility:** Major Egyptian payment gateways (Paymob, Fawry, Accept) strictly require payment amounts to be formatted as integer minor units (piasters/cents) to prevent rounding ambiguity.
3. **Atomic Calculations:** Integer addition, subtraction, and multi-tier fee distribution are exact and immune to platform-specific floating point implementations.

---

## 3. Entity-Relationship Overview

```text
 ┌──────────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │        roles         │◀─────▶│ user_role_assignments│◀─────▶│      auth.users        │
 └──────────────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                           │ 1:1
                                                                           ▼
 ┌──────────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │   captain_sub_plans  │       │       captains       │◀─────▶│     user_profiles      │
 └──────────┬───────────┘       └──────────┬───────────┘       └───────────┬────────────┘
            │ 1:N                          │ 1:N                           │ 1:N
            ▼                              ▼                               ▼
 ┌──────────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │ captain_subscriptions│       │ captain_assignments  │       │   customer_addresses   │
 └──────────┬───────────┘       └──────────▲───────────┘       └────────────────────────┘
            │ 1:N                          │
            ▼                              │ 1:N
 ┌──────────────────────┐       ┌──────────┴───────────┐       ┌────────────────────────┐
 │ captain_sub_payments │       │        orders        │◀─────▶│   merchant_branches    │
 └──────────────────────┘       └──────────┬───────────┘       └────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐              ┌──────────────────┐              ┌──────────────────┐
│ order_addresses  │              │   fare_quotes    │              │ cash_collections │
│ (Immutable Snap) │              │ (Minor Units)    │              │ (Separate Ledger)│
└──────────────────┘              └────────┬─────────┘              └──────────────────┘
                                           │ 1:N
                                           ▼
                                  ┌──────────────────┐
                                  │fare_quote_line_it│
                                  └──────────────────┘
```

---

## 4. Complete Table Specifications

### 4.1 Identity, Users & Roles

#### `user_profiles`
- **Purpose:** Extended profile for authenticated users in Supabase Auth.
- **Sensitive Data:** Full name, phone number, national ID, preferred language.

```sql
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ar', -- 'ar' or 'en'
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_phone_format CHECK (phone_number ~ '^\+20(10|11|12|15)[0-9]{8}$'),
    CONSTRAINT chk_language CHECK (preferred_language IN ('ar', 'en'))
);
```

#### `roles`, `permissions`, and `user_role_assignments`
- **Purpose:** RBAC mapping for least-privilege operations.

```sql
CREATE TABLE roles (
    id VARCHAR(30) PRIMARY KEY, -- 'customer', 'captain', 'merchant_staff', 'merchant_admin', 'operations_agent', 'super_admin'
    name_ar VARCHAR(80) NOT NULL,
    name_en VARCHAR(80) NOT NULL,
    description TEXT NULL
);

CREATE TABLE permissions (
    id VARCHAR(60) PRIMARY KEY, -- e.g. 'orders:read_all', 'fares:override', 'captains:verify'
    description TEXT NOT NULL
);

CREATE TABLE role_permissions (
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(60) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role_assignments (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);
```

---

### 4.2 Captain Fleet, Verification & Availability

#### `captains`
- **Purpose:** Courier record, vehicle identity, and operational standing.

```sql
CREATE TYPE captain_verification_status AS ENUM (
    'draft',
    'pending_review',
    'approved',
    'suspended',
    'rejected'
);

CREATE TYPE vehicle_type AS ENUM (
    'motorcycle',
    'scooter',
    'bicycle',
    'light_commercial_van'
);

CREATE TABLE captains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    national_id_number VARCHAR(14) NOT NULL,
    verification_status captain_verification_status NOT NULL DEFAULT 'draft',
    vehicle_type vehicle_type NOT NULL,
    vehicle_plate_letters VARCHAR(10) NOT NULL, -- e.g. 'م ن'
    vehicle_plate_numbers VARCHAR(10) NOT NULL, -- e.g. '٤٣٢١'
    vehicle_model_description VARCHAR(100) NOT NULL,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    total_trips_completed INT NOT NULL DEFAULT 0,
    
    -- Cash holding and risk limits
    is_approved_for_cash_collection BOOLEAN NOT NULL DEFAULT TRUE,
    maximum_cash_holding_piasters BIGINT NOT NULL DEFAULT 100000, -- 1,000.00 EGP
    current_cash_holding_piasters BIGINT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captains_user UNIQUE (user_id),
    CONSTRAINT uq_captains_nid UNIQUE (national_id_number),
    CONSTRAINT chk_nid_digits CHECK (national_id_number ~ '^[0-9]{14}$'),
    CONSTRAINT chk_cash_holding_nonneg CHECK (current_cash_holding_piasters >= 0)
);

CREATE INDEX idx_captains_verification ON captains(verification_status);
```

#### `captain_documents`
- **Purpose:** Document audit trail for Egyptian regulatory compliance.

```sql
CREATE TABLE captain_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
    document_type VARCHAR(40) NOT NULL, -- 'national_id_front', 'national_id_back', 'driving_license', 'vehicle_license', 'criminal_record'
    storage_path TEXT NOT NULL, -- Path inside private Supabase storage bucket
    expiry_date DATE NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captain_document_type UNIQUE (captain_id, document_type)
);
```

#### `captain_availability`
- **Purpose:** Real-time state of online/offline status and assignment load.

```sql
CREATE TABLE captain_availability (
    captain_id UUID PRIMARY KEY REFERENCES captains(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_known_latitude DOUBLE PRECISION NULL,
    last_known_longitude DOUBLE PRECISION NULL,
    last_known_landmark VARCHAR(150) NULL,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_orders_count INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_active_orders_count CHECK (active_orders_count >= 0)
);

CREATE INDEX idx_captain_availability_active ON captain_availability(is_online, active_orders_count) WHERE is_online = TRUE;
```

---

### 4.3 Captain Monthly Subscription System (Confirmed Monetization Model)

#### `captain_subscription_plans`
- **Purpose:** Available subscription tiers for captains in El Bagour.

```sql
CREATE TABLE captain_subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(30) NOT NULL UNIQUE, -- e.g. 'EL_BAGOUR_MONTHLY_STANDARD'
    name_ar VARCHAR(100) NOT NULL, -- e.g. 'اشتراك الباجور الشهري الموحد'
    name_en VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL DEFAULT 30,
    price_piasters BIGINT NOT NULL, -- e.g. 25000 piasters = 250.00 EGP
    grace_period_days INT NOT NULL DEFAULT 3, -- 72-hour grace period upon expiration
    max_active_orders INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### `captain_subscriptions`
- **Purpose:** Captain subscription status, lifecycle periods, and renewal standing.

```sql
CREATE TYPE subscription_status AS ENUM (
    'trial',          -- 14-day initial trial for newly onboarded captains
    'active',         -- Fully paid and eligible for dispatch
    'grace_period',   -- Period ended, 72h grace window with warning active
    'expired',        -- Grace window closed, new offers blocked
    'suspended',      -- Manually suspended by operations for misconduct
    'cancelled'       -- Captain voluntarily ended subscription
);

CREATE TABLE captain_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES captain_subscription_plans(id) ON DELETE RESTRICT,
    status subscription_status NOT NULL DEFAULT 'trial',
    starts_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    current_period_starts_at TIMESTAMPTZ NOT NULL,
    current_period_ends_at TIMESTAMPTZ NOT NULL,
    grace_period_ends_at TIMESTAMPTZ NOT NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captain_subscription UNIQUE (captain_id)
);

CREATE INDEX idx_captain_subscriptions_status ON captain_subscriptions(status, current_period_ends_at);
```

#### `captain_subscription_payments`
- **Purpose:** Payment audit log for subscription fees.

```sql
CREATE TYPE subscription_payment_method AS ENUM (
    'cash_at_hub',     -- Paid in cash at El Bagour operational office
    'vodafone_cash',   -- Mobile wallet transfer with transaction reference
    'fawry',           -- Fawry payment reference code
    'electronic_card'  -- Debit/Credit card via online payment gateway
);

CREATE TABLE captain_subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES captain_subscriptions(id) ON DELETE CASCADE,
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE RESTRICT,
    amount_piasters BIGINT NOT NULL,
    method subscription_payment_method NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    provider_transaction_ref VARCHAR(100) NULL,
    receipt_number VARCHAR(50) NULL,
    verified_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 4.4 Orders, Immutable Snapshots & Fares

#### `orders`
- **Purpose:** Core delivery order record.

```sql
CREATE TYPE order_status AS ENUM (
    'created',
    'searching_captain',
    'captain_assigned',
    'at_pickup',
    'in_transit',
    'delivered',
    'cancelled'
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code VARCHAR(20) NOT NULL UNIQUE, -- Human-friendly Egyptian code, e.g. 'MSH-8105'
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    service_type_id VARCHAR(30) NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'created',
    merchant_branch_id UUID NULL REFERENCES merchant_branches(id) ON DELETE RESTRICT,
    
    -- Monetary summary in Piasters (Minor Units)
    quoted_fare_piasters BIGINT NOT NULL,
    final_settled_fare_piasters BIGINT NULL,
    
    item_description TEXT NOT NULL,
    special_instructions TEXT NULL,
    idempotency_key VARCHAR(100) NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancellation_reason TEXT NULL,
    
    CONSTRAINT uq_customer_order_idempotency UNIQUE (customer_id, idempotency_key),
    CONSTRAINT chk_fare_positive CHECK (quoted_fare_piasters > 0)
);

CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_active_status ON orders(status) WHERE status NOT IN ('delivered', 'cancelled');
```

#### `order_addresses` (Immutable Pickup & Drop-Off Snapshots)
- **Purpose:** Guarantees that updating a customer's address book never alters past or active orders.

```sql
CREATE TYPE address_role AS ENUM ('pickup', 'dropoff');

CREATE TABLE order_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    role address_role NOT NULL,
    landmark_name VARCHAR(150) NOT NULL,
    detailed_address TEXT NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    latitude DOUBLE PRECISION NULL,
    longitude DOUBLE PRECISION NULL,
    is_rural_or_village BOOLEAN NOT NULL DEFAULT FALSE,
    village_name VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_address_role UNIQUE (order_id, role)
);
```

#### `fare_quotes` & `fare_quote_line_items`
- **Purpose:** Full itemized audit log of authoritative fare calculation.

```sql
CREATE TABLE fare_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NULL REFERENCES orders(id) ON DELETE CASCADE,
    pricing_rule_version INT NOT NULL,
    calculated_distance_km NUMERIC(6, 2) NOT NULL,
    base_fare_piasters BIGINT NOT NULL,
    distance_fare_piasters BIGINT NOT NULL,
    rural_surcharge_piasters BIGINT NOT NULL DEFAULT 0,
    platform_fee_piasters BIGINT NOT NULL,
    total_quoted_fare_piasters BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fare_quote_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fare_quote_id UUID NOT NULL REFERENCES fare_quotes(id) ON DELETE CASCADE,
    title_ar VARCHAR(100) NOT NULL,
    title_en VARCHAR(100) NOT NULL,
    amount_piasters BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 4.5 Cash Collections & Electronic Payments

#### `cash_collections` (Separated Ledger for COD)
- **Purpose:** Dedicated tracking of cash collected at the doorstep by captains.

```sql
CREATE TYPE cash_collection_status AS ENUM (
    'collected_by_captain',
    'remitted_to_hub',
    'verified_by_finance',
    'disputed'
);

CREATE TABLE cash_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE RESTRICT,
    amount_expected_piasters BIGINT NOT NULL,
    amount_collected_piasters BIGINT NOT NULL,
    status cash_collection_status NOT NULL DEFAULT 'collected_by_captain',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remitted_at TIMESTAMPTZ NULL,
    verified_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    CONSTRAINT uq_order_cash_collection UNIQUE (order_id)
);

CREATE INDEX idx_cash_collections_captain ON cash_collections(captain_id, status);
```

#### `payment_intents`, `payment_transactions`, & `webhook_events`
- **Purpose:** Electronic payment processing with guaranteed webhook idempotency.

```sql
CREATE TYPE payment_gateway_provider AS ENUM (
    'paymob',
    'fawry',
    'vodafone_cash_direct',
    'manual_cash'
);

CREATE TYPE payment_intent_status AS ENUM (
    'requires_payment_method',
    'requires_customer_action',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
);

CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    provider payment_gateway_provider NOT NULL,
    amount_piasters BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    status payment_intent_status NOT NULL DEFAULT 'requires_payment_method',
    provider_intent_id VARCHAR(150) NULL,
    client_secret_hash VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_payment_intent UNIQUE (order_id)
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider payment_gateway_provider NOT NULL,
    provider_event_id VARCHAR(150) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    is_processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ NULL,
    processing_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX idx_webhook_events_unprocessed ON webhook_events(is_processed) WHERE is_processed = FALSE;
```

---

### 4.6 Captain Assignments & Concurrency Control

#### `captain_assignments`
- **Purpose:** Tracks dispatch offers and active captain assignment.

```sql
CREATE TYPE assignment_status AS ENUM (
    'offered',
    'accepted',
    'rejected',
    'timeout',
    'cancelled',
    'completed'
);

CREATE TABLE captain_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE RESTRICT,
    status assignment_status NOT NULL DEFAULT 'offered',
    offered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ATOMIC RACE CONDITION PROTECTION:
-- Exactly one captain assignment can have status = 'accepted' for any given order:
CREATE UNIQUE INDEX uq_order_active_captain_assignment 
ON captain_assignments (order_id) 
WHERE status = 'accepted';

CREATE INDEX idx_captain_assignments_captain ON captain_assignments(captain_id, status);
```
