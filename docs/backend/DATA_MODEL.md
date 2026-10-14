# Mashwar — Relational Database Schema & Data Model Specification
**Engine:** PostgreSQL 15+  
**Target Hub:** El Bagour, Menoufia Governorate, Egypt  
**Phase:** Phase 2 Database Design Specification  

---

## 1. Schema Design Principles

1. **Third Normal Form (3NF) with Intentional Immutable Denormalization:** 
   Entities representing transient concepts (such as customer profiles, merchant catalog items, and pricing formulas) are strictly normalized. Entities representing contractual commitments (orders, historic fares, pickup/delivery coordinates, and receipts) snapshot their state at execution time into immutable tables.
2. **Explicit Data Types & Exact Precision:**
   - Primary Keys: `UUID` (`gen_random_uuid()`) for distributed scalability and tamper resistance.
   - Monetary values: `NUMERIC(10, 2)` representing Egyptian Pounds (EGP) with exact 2-decimal precision (or integer piasters).
   - Coordinates: `DOUBLE PRECISION` or PostGIS `GEOMETRY(Point, 4326)` for latitude and longitude.
   - Timestamps: `TIMESTAMPTZ` with timezone (always recorded in UTC).
3. **Defense-in-Depth Constraints:**
   Every column with constrained domain values utilizes PostgreSQL `CHECK` constraints or explicit `ENUM` types. Foreign keys declare explicit `ON DELETE RESTRICT` or `ON DELETE CASCADE` policies.

---

## 2. Entity-Relationship Overview

```text
 ┌──────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │    roles     │◀─────▶│ user_role_assignments│◀─────▶│         users          │
 └──────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                   │ 1:1
                                                                   ▼
 ┌──────────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │     merchants        │       │       captains       │       │     user_profiles      │
 └──────────┬───────────┘       └──────────┬───────────┘       └───────────┬────────────┘
            │ 1:N                          │ 1:N                           │ 1:N
            ▼                              ▼                               ▼
 ┌──────────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
 │  merchant_branches   │       │ captain_assignments  │       │   customer_addresses   │
 └──────────┬───────────┘       └──────────▲───────────┘       └────────────────────────┘
            │                              │
            │                              │ 1:N
            │           ┌──────────────────┴───┐
            └──────────▶│        orders        │
                        └──────────┬───────────┘
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ order_addresses  │      │   fare_quotes    │      │order_status_hist │
│ (Immutable Snap) │      │ (Itemized Calc)  │      │ (State Audit)    │
└──────────────────┘      └────────┬─────────┘      └──────────────────┘
                                   │ 1:N
                                   ▼
                          ┌──────────────────┐
                          │fare_quote_line_it│
                          └──────────────────┘
```

---

## 3. Detailed Table Specifications

### 3.1 Identity, Users & Roles

#### 3.1.1 `users`
- **Purpose:** Core authentication entity representing individuals across all roles (Customers, Captains, Merchants, Operators).
- **Sensitive Data Classification:** Confidential (Phone number is PII).
- **Retention:** Retained indefinitely; account deletion anonymizes phone and profile.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL, -- Egyptian mobile format: '+2010xxxxxxxx'
    phone_verified_at TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_phone UNIQUE (phone_number),
    CONSTRAINT chk_users_phone_format CHECK (phone_number ~ '^\+20(10|11|12|15)[0-9]{8}$')
);

CREATE INDEX idx_users_phone ON users(phone_number);
```

#### 3.1.2 `user_profiles`
- **Purpose:** Extended personal information for a user.
- **Sensitive Data:** Full name, email, national ID.

```sql
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NULL,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ar', -- 'ar' or 'en'
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_profiles_lang CHECK (preferred_language IN ('ar', 'en'))
);
```

#### 3.1.3 `roles` & `permissions`
- **Purpose:** Granular Role-Based Access Control (RBAC).

```sql
CREATE TABLE roles (
    id VARCHAR(30) PRIMARY KEY, -- 'customer', 'captain', 'merchant_staff', 'merchant_admin', 'operations_agent', 'super_admin'
    name_ar VARCHAR(80) NOT NULL,
    name_en VARCHAR(80) NOT NULL,
    description TEXT NULL
);

CREATE TABLE permissions (
    id VARCHAR(60) PRIMARY KEY, -- e.g., 'orders:read_assigned', 'fares:override', 'captains:verify'
    description TEXT NOT NULL
);

CREATE TABLE role_permissions (
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(60) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_role_assignments (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);
```

---

### 3.2 Customer Addresses

#### 3.2.1 `customer_addresses`
- **Purpose:** Reusable address book entries for customers in El Bagour and surrounding villages.

```sql
CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- e.g., 'المنزل', 'العمل', 'بيت العائلة'
    landmark_name VARCHAR(150) NOT NULL, -- Landmark in El Bagour e.g. 'ميدان المحطة'
    detailed_address TEXT NOT NULL, -- Street, building number, floor, apartment
    latitude DOUBLE PRECISION NULL,
    longitude DOUBLE PRECISION NULL,
    is_rural_or_village BOOLEAN NOT NULL DEFAULT FALSE,
    village_name VARCHAR(100) NULL, -- e.g., 'كفر الباجور', 'شنتنا الحجر'
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_addresses_user ON customer_addresses(user_id);
```

---

### 3.3 Captain Fleet & Verification

#### 3.3.1 `captains`
- **Purpose:** Courier/driver record, vehicle info, and compliance standing.
- **Sensitive Data:** National ID number, driver's license number, criminal record certificate.

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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    national_id_number VARCHAR(14) NOT NULL, -- Egyptian 14-digit National ID
    verification_status captain_verification_status NOT NULL DEFAULT 'draft',
    vehicle_type vehicle_type NOT NULL,
    vehicle_plate_letters VARCHAR(10) NOT NULL, -- e.g. 'م ن'
    vehicle_plate_numbers VARCHAR(10) NOT NULL, -- e.g. '٤٣٢١'
    vehicle_model_description VARCHAR(100) NOT NULL, -- e.g. 'دراجة هوجان سوداء ٢٠٢٢'
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    total_trips_completed INTEGER NOT NULL DEFAULT 0,
    is_approved_for_cash_collection BOOLEAN NOT NULL DEFAULT TRUE,
    maximum_cash_holding_egp NUMERIC(10, 2) NOT NULL DEFAULT 1000.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captains_user UNIQUE (user_id),
    CONSTRAINT uq_captains_nid UNIQUE (national_id_number),
    CONSTRAINT chk_nid_format CHECK (national_id_number ~ '^[0-9]{14}$')
);

CREATE INDEX idx_captains_status ON captains(verification_status);
```

#### 3.3.2 `captain_documents`
- **Purpose:** Track scanned documents (National ID front/back, driver license, motorcycle registration, criminal record certificate / فيش جنائي).

```sql
CREATE TABLE captain_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
    document_type VARCHAR(40) NOT NULL, -- 'national_id_front', 'national_id_back', 'driving_license', 'vehicle_license', 'criminal_record'
    file_storage_path TEXT NOT NULL,
    expiry_date DATE NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captain_doc_type UNIQUE (captain_id, document_type)
);
```

#### 3.3.3 `captain_availability`
- **Purpose:** Real-time state of online/offline status, battery level, and last known landmark/coordinates.

```sql
CREATE TABLE captain_availability (
    captain_id UUID PRIMARY KEY REFERENCES captains(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_known_latitude DOUBLE PRECISION NULL,
    last_known_longitude DOUBLE PRECISION NULL,
    last_known_landmark VARCHAR(150) NULL,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_assigned_orders_count INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_active_orders_nonneg CHECK (active_assigned_orders_count >= 0)
);

CREATE INDEX idx_captain_availability_online ON captain_availability(is_online) WHERE is_online = TRUE;
```

---

### 3.4 Merchants & Branch Fulfillment

#### 3.4.1 `merchants` & `merchant_branches`
- **Purpose:** Local stores and restaurants in El Bagour.

```sql
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commercial_name VARCHAR(150) NOT NULL, -- e.g., 'مطعم فطاير ومشاوي الباجور'
    category VARCHAR(50) NOT NULL, -- 'restaurant', 'supermarket', 'bakery', 'pharmacy', 'hardware'
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    branch_name VARCHAR(100) NOT NULL DEFAULT 'الفرع الرئيسي',
    address_description TEXT NOT NULL, -- e.g., 'شارع الجيش - برج الشروق'
    landmark_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    is_accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
    average_preparation_time_minutes INT NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merchant_branches_active ON merchant_branches(is_accepting_orders) WHERE is_accepting_orders = TRUE;
```

---

### 3.5 Services & Pricing Configuration

#### 3.5.1 `service_types`
- **Purpose:** Defines active platform services and enforces regulatory locks.

```sql
CREATE TABLE service_types (
    id VARCHAR(30) PRIMARY KEY, -- 'package', 'store_delivery', 'errand', 'passenger'
    title_ar VARCHAR(80) NOT NULL,
    title_en VARCHAR(80) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    regulatory_lock_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial services with Passenger Transport locked by default:
INSERT INTO service_types (id, title_ar, title_en, is_enabled, regulatory_lock_reason) VALUES
('package', 'توصيل طرد أو أمانة', 'Package Courier', TRUE, NULL),
('store_delivery', 'طلبات المطاعم والمحلات', 'Store Delivery', TRUE, NULL),
('errand', 'مشوار خاص وصيدلية', 'Errands & Pharmacy', TRUE, NULL),
('passenger', 'نقل الركاب', 'Passenger Transport', FALSE, 'معلق نظامياً لحين استيفاء التراخيص الرسمية من إدارة المرور ومجلس مدينة الباجور');
```

#### 3.5.2 `pricing_rules` & `pricing_rule_tiers`
- **Purpose:** Versioned, auditable pricing rules without hardcoded values.

```sql
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id VARCHAR(30) NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    rule_version INT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NULL, -- NULL indicates current active rule
    base_fare_egp NUMERIC(10, 2) NOT NULL, -- e.g. 15.00 EGP
    base_included_distance_km NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
    rate_per_km_egp NUMERIC(10, 2) NOT NULL, -- e.g. 4.00 EGP
    rural_village_surcharge_egp NUMERIC(10, 2) NOT NULL DEFAULT 5.00,
    platform_fee_egp NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
    minimum_fare_egp NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
    cancellation_fee_egp NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_service_rule_version UNIQUE (service_type_id, rule_version)
);
```

---

### 3.6 Orders, Snapshots & Status Auditing

#### 3.6.1 `orders`
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
    order_code VARCHAR(20) NOT NULL, -- Human-friendly Egyptian code, e.g. 'MSH-8102'
    customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_type_id VARCHAR(30) NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'created',
    merchant_branch_id UUID NULL REFERENCES merchant_branches(id) ON DELETE RESTRICT,
    
    -- Financial summary (authoritative values calculated on server)
    quoted_fare_egp NUMERIC(10, 2) NOT NULL,
    final_settled_fare_egp NUMERIC(10, 2) NULL,
    cash_collected_egp NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    
    -- Content details
    item_description TEXT NOT NULL,
    special_instructions TEXT NULL,
    
    -- Idempotency key to prevent accidental duplicate ordering
    idempotency_key VARCHAR(100) NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancellation_reason TEXT NULL,
    
    CONSTRAINT uq_orders_code UNIQUE (order_code),
    CONSTRAINT uq_orders_idempotency UNIQUE (customer_id, idempotency_key)
);

CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(status) WHERE status NOT IN ('delivered', 'cancelled');
```

#### 3.6.2 `order_addresses` (Immutable Pickup & Drop-Off Snapshots)
- **Purpose:** Guarantees that future updates or deletions to customer address books do not rewrite delivery history.

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

CREATE INDEX idx_order_addresses_order ON order_addresses(order_id);
```

#### 3.6.3 `fare_quotes` & `fare_quote_line_items`
- **Purpose:** Full transparency and itemized audit record of how the fare was constructed.

```sql
CREATE TABLE fare_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pricing_rule_id UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE RESTRICT,
    calculated_distance_km NUMERIC(6, 2) NOT NULL,
    base_fare_egp NUMERIC(10, 2) NOT NULL,
    distance_fare_egp NUMERIC(10, 2) NOT NULL,
    rural_surcharge_egp NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    platform_fee_egp NUMERIC(10, 2) NOT NULL,
    total_quoted_fare_egp NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_fare_quote UNIQUE (order_id)
);

CREATE TABLE fare_quote_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fare_quote_id UUID NOT NULL REFERENCES fare_quotes(id) ON DELETE CASCADE,
    title_ar VARCHAR(100) NOT NULL, -- e.g. 'أجرة البداية (أول 1.5 كم)'
    title_en VARCHAR(100) NOT NULL,
    amount_egp NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.6.4 `order_status_history`
- **Purpose:** Immutable audit trail of every status transition.

```sql
CREATE TABLE order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status order_status NULL,
    to_status order_status NOT NULL,
    changed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(30) NOT NULL, -- 'customer', 'captain', 'system', 'operations_agent'
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_status_hist_order ON order_status_history(order_id, created_at ASC);
```

---

### 3.7 Captain Assignments & Concurrency Protection

#### 3.7.1 `captain_assignments`
- **Purpose:** Tracks dispatch offers and active captain assignment.
- **Race Condition Prevention:** Partial unique index guarantees that at most **one** captain is actively assigned to an order at any moment in time.

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

-- CRITICAL CONCURRENCY RULE:
-- Exactly one assignment can have status = 'accepted' for a given order:
CREATE UNIQUE INDEX uq_order_active_captain_assignment 
ON captain_assignments (order_id) 
WHERE status = 'accepted';

CREATE INDEX idx_captain_assignments_active ON captain_assignments(captain_id, status);
```

---

### 3.8 Payments, Refunds & Transactions

#### 3.8.1 `payments` & `payment_transactions`
- **Purpose:** Payment ledger supporting Cash on Delivery (COD), Vodafone Cash, and future Fawry / Card gateways.

```sql
CREATE TYPE payment_method AS ENUM (
    'cash_on_delivery',
    'vodafone_cash',
    'fawry',
    'credit_card'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'collected',
    'verified',
    'refunded',
    'failed'
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount_egp NUMERIC(10, 2) NOT NULL,
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    collector_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL, -- Captain who collected cash
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_payment UNIQUE (order_id)
);

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    gateway_reference VARCHAR(100) NULL, -- Paymob transaction ID or Vodafone Cash receipt
    raw_payload JSONB NULL,
    is_success BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

### 3.9 Audit Logs & Support

#### 3.9.1 `audit_logs`
- **Purpose:** Compliance logging for sensitive actions (fare overrides, captain document approval, role changes).

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_ip_address VARCHAR(45) NULL,
    action VARCHAR(80) NOT NULL, -- e.g. 'PRICING_RULE_OVERRIDE', 'CAPTAIN_VERIFIED', 'ORDER_FORCE_CANCELLED'
    entity_name VARCHAR(50) NOT NULL, -- e.g. 'orders', 'pricing_rules', 'captains'
    entity_id VARCHAR(50) NOT NULL,
    before_state JSONB NULL,
    after_state JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
```

---

## 4. Deferred Entities (Phased for Later Stages)

To avoid premature complexity, the following entities are consciously deferred:
1. **Dynamic Real-Time Surge Multipliers:** Complex surge pricing matrices are deferred. In Phase 2/3, fixed rural surcharges and night-time allowances are managed via simple `pricing_rule_tiers`.
2. **Multi-Leg Route Graph Waypoints:** Multi-stop orders are deferred; the current launch scope focuses on 1 pickup point and 1 drop-off point.
3. **Wallet Balance Ledger:** A dedicated digital wallet with prepaid balances is deferred until financial and banking compliance reviews for stored-value wallets in Egypt are completed. Payments in the initial release utilize direct Cash on Delivery (COD) and direct gateway receipts.
