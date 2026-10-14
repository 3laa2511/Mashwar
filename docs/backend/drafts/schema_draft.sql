-- ============================================================================
-- MASHWAR PLATFORM — POSTGRESQL / SUPABASE RELATIONAL SCHEMA
-- Target Hub: El Bagour (الباجور), Menoufia Governorate, Egypt
-- Currency: Egyptian Piasters (قروش) — Integer Minor Units (1 EGP = 100 Piasters)
--
-- STATUS: DESIGN DRAFT ONLY — NOT EXECUTED AGAINST ANY LIVE DATABASE
-- THIS FILE IS CREATED FOR ARCHITECTURAL REVIEW PURPOSES ONLY.
-- DO NOT APPLY TO PRODUCTION WITHOUT PRIOR STAGING VALIDATION AND BACKUP.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

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

CREATE TYPE subscription_status AS ENUM (
    'trial',          -- 14-day initial trial for newly onboarded captains
    'active',         -- Fully paid and eligible for dispatch
    'grace_period',   -- Period ended, 72h grace window with warning active
    'expired',        -- Grace window closed, new offers blocked
    'suspended',      -- Manually suspended by operations for misconduct
    'cancelled'       -- Captain voluntarily ended subscription
);

CREATE TYPE subscription_payment_method AS ENUM (
    'cash_at_hub',     -- Paid in cash at El Bagour operational office
    'vodafone_cash',   -- Mobile wallet transfer with transaction reference
    'fawry',           -- Fawry payment reference code
    'electronic_card'  -- Debit/Credit card via online payment gateway
);

CREATE TYPE order_status AS ENUM (
    'created',
    'searching_captain',
    'captain_assigned',
    'at_pickup',
    'in_transit',
    'delivered',
    'cancelled'
);

CREATE TYPE address_role AS ENUM (
    'pickup',
    'dropoff'
);

CREATE TYPE assignment_status AS ENUM (
    'offered',
    'accepted',
    'rejected',
    'timeout',
    'cancelled',
    'completed'
);

CREATE TYPE cash_collection_status AS ENUM (
    'collected_by_captain',
    'remitted_to_hub',
    'verified_by_finance',
    'disputed'
);

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

CREATE TYPE refund_status AS ENUM (
    'pending',
    'processed',
    'failed'
);

CREATE TYPE support_ticket_status AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);

-- ============================================================================
-- 2. USERS, PROFILES & ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    preferred_language VARCHAR(5) NOT NULL DEFAULT 'ar',
    avatar_url TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_phone_format CHECK (phone_number ~ '^\+20(10|11|12|15)[0-9]{8}$'),
    CONSTRAINT chk_language CHECK (preferred_language IN ('ar', 'en'))
);

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(30) PRIMARY KEY, -- 'customer', 'captain', 'merchant_staff', 'merchant_admin', 'operations_agent', 'super_admin'
    name_ar VARCHAR(80) NOT NULL,
    name_en VARCHAR(80) NOT NULL,
    description TEXT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(60) PRIMARY KEY, -- e.g. 'orders:read_all', 'fares:override', 'captains:verify'
    description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(60) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id VARCHAR(30) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,
    landmark_name VARCHAR(150) NOT NULL,
    detailed_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NULL,
    longitude DOUBLE PRECISION NULL,
    is_rural_or_village BOOLEAN NOT NULL DEFAULT FALSE,
    village_name VARCHAR(100) NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON customer_addresses(user_id);

-- ============================================================================
-- 3. CAPTAINS, DOCUMENTS & AVAILABILITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS captains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT UNIQUE,
    national_id_number VARCHAR(14) NOT NULL UNIQUE,
    verification_status captain_verification_status NOT NULL DEFAULT 'draft',
    vehicle_type vehicle_type NOT NULL,
    vehicle_plate_letters VARCHAR(10) NOT NULL,
    vehicle_plate_numbers VARCHAR(10) NOT NULL,
    vehicle_model_description VARCHAR(100) NOT NULL,
    rating NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    total_trips_completed INT NOT NULL DEFAULT 0,
    
    -- Cash holding and risk limits
    is_approved_for_cash_collection BOOLEAN NOT NULL DEFAULT TRUE,
    maximum_cash_holding_piasters BIGINT NOT NULL DEFAULT 100000, -- 1,000.00 EGP
    current_cash_holding_piasters BIGINT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_nid_digits CHECK (national_id_number ~ '^[0-9]{14}$'),
    CONSTRAINT chk_cash_holding_nonneg CHECK (current_cash_holding_piasters >= 0),
    CONSTRAINT chk_rating_range CHECK (rating >= 1.00 AND rating <= 5.00)
);

CREATE INDEX IF NOT EXISTS idx_captains_verification ON captains(verification_status);

CREATE TABLE IF NOT EXISTS captain_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE CASCADE,
    document_type VARCHAR(40) NOT NULL, -- 'national_id_front', 'national_id_back', 'driving_license', 'vehicle_license', 'criminal_record'
    storage_path TEXT NOT NULL, -- Private Supabase Storage bucket path
    expiry_date DATE NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_captain_document_type UNIQUE (captain_id, document_type)
);

CREATE INDEX IF NOT EXISTS idx_captain_documents_captain ON captain_documents(captain_id);

CREATE TABLE IF NOT EXISTS captain_availability (
    captain_id UUID PRIMARY KEY REFERENCES captains(id) ON DELETE CASCADE,
    is_online BOOLEAN NOT NULL DEFAULT FALSE,
    last_known_latitude DOUBLE PRECISION NULL,
    last_known_longitude DOUBLE PRECISION NULL,
    last_known_landmark VARCHAR(150) NULL,
    last_ping_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active_orders_count INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_active_orders_count CHECK (active_orders_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_captain_availability_active ON captain_availability(is_online, active_orders_count) WHERE is_online = TRUE;

-- ============================================================================
-- 4. CAPTAIN SUBSCRIPTION PLANS & PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS captain_subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_code VARCHAR(30) NOT NULL UNIQUE, -- e.g. 'EL_BAGOUR_MONTHLY_STANDARD'
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    duration_days INT NOT NULL DEFAULT 30,
    price_piasters BIGINT NOT NULL, -- e.g. 25000 = 250.00 EGP
    grace_period_days INT NOT NULL DEFAULT 3, -- 72-hour grace period upon expiration
    max_active_orders INT NOT NULL DEFAULT 2,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_plan_price_nonneg CHECK (price_piasters >= 0),
    CONSTRAINT chk_duration_positive CHECK (duration_days > 0)
);

CREATE TABLE IF NOT EXISTS captain_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE CASCADE UNIQUE,
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
    CONSTRAINT chk_period_order CHECK (current_period_ends_at >= current_period_starts_at),
    CONSTRAINT chk_grace_order CHECK (grace_period_ends_at >= current_period_ends_at)
);

CREATE INDEX IF NOT EXISTS idx_captain_subscriptions_status ON captain_subscriptions(status, current_period_ends_at);

CREATE TABLE IF NOT EXISTS captain_subscription_payments (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_sub_payment_amount_pos CHECK (amount_piasters > 0)
);

CREATE INDEX IF NOT EXISTS idx_captain_sub_payments_sub ON captain_subscription_payments(subscription_id);

-- ============================================================================
-- 5. MERCHANTS, BRANCHES & OPERATING HOURS
-- ============================================================================

CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commercial_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'restaurant', 'supermarket', 'bakery', 'pharmacy'
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    branch_name VARCHAR(100) NOT NULL DEFAULT 'الفرع الرئيسي',
    address_description TEXT NOT NULL,
    landmark_name VARCHAR(150) NOT NULL,
    contact_phone VARCHAR(20) NOT NULL,
    is_accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
    average_preparation_time_minutes INT NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_branches_merchant ON merchant_branches(merchant_id);

CREATE TABLE IF NOT EXISTS merchant_operating_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES merchant_branches(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL, -- 0 = Sunday, 6 = Saturday
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_branch_day UNIQUE (branch_id, day_of_week),
    CONSTRAINT chk_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6)
);

CREATE TABLE IF NOT EXISTS merchant_user_assignments (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES merchant_branches(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'merchant_staff', -- 'merchant_staff', 'merchant_admin'
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, branch_id)
);

-- ============================================================================
-- 6. SERVICES & VERSIONED PRICING RULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_types (
    id VARCHAR(30) PRIMARY KEY, -- 'package', 'store_delivery', 'errand', 'passenger'
    title_ar VARCHAR(80) NOT NULL,
    title_en VARCHAR(80) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    regulatory_lock_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_type_id VARCHAR(30) NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    rule_version INT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ NULL,
    base_fare_piasters BIGINT NOT NULL, -- e.g. 1500 = 15.00 EGP
    base_included_distance_km NUMERIC(5, 2) NOT NULL DEFAULT 1.50,
    rate_per_km_piasters BIGINT NOT NULL, -- e.g. 400 = 4.00 EGP
    rural_village_surcharge_piasters BIGINT NOT NULL DEFAULT 500,
    platform_fee_piasters BIGINT NOT NULL DEFAULT 200,
    minimum_fare_piasters BIGINT NOT NULL DEFAULT 1500,
    cancellation_fee_piasters BIGINT NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT uq_service_rule_version UNIQUE (service_type_id, rule_version),
    CONSTRAINT chk_base_fare_pos CHECK (base_fare_piasters > 0),
    CONSTRAINT chk_rate_per_km_nonneg CHECK (rate_per_km_piasters >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_lookup ON pricing_rules(service_type_id, effective_from DESC);

-- ============================================================================
-- 7. ORDERS, ADDRESSES, ITEMS & FARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_code VARCHAR(20) NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    service_type_id VARCHAR(30) NOT NULL REFERENCES service_types(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'created',
    merchant_branch_id UUID NULL REFERENCES merchant_branches(id) ON DELETE RESTRICT,
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
    CONSTRAINT chk_fare_positive CHECK (quoted_fare_piasters > 0),
    CONSTRAINT chk_settled_nonneg CHECK (final_settled_fare_piasters IS NULL OR final_settled_fare_piasters >= 0)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status) WHERE status NOT IN ('delivered', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(merchant_branch_id) WHERE merchant_branch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_piasters BIGINT NOT NULL,
    special_instructions TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_item_quantity_pos CHECK (quantity > 0),
    CONSTRAINT chk_item_price_nonneg CHECK (unit_price_piasters >= 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS order_addresses (
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

CREATE INDEX IF NOT EXISTS idx_order_addresses_order ON order_addresses(order_id);

CREATE TABLE IF NOT EXISTS fare_quotes (
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_total_quoted_pos CHECK (total_quoted_fare_piasters > 0)
);

CREATE INDEX IF NOT EXISTS idx_fare_quotes_order ON fare_quotes(order_id);

CREATE TABLE IF NOT EXISTS fare_quote_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fare_quote_id UUID NOT NULL REFERENCES fare_quotes(id) ON DELETE CASCADE,
    title_ar VARCHAR(100) NOT NULL,
    title_en VARCHAR(100) NOT NULL,
    amount_piasters BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fare_quote_line_items ON fare_quote_line_items(fare_quote_id);

CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status order_status NULL,
    to_status order_status NOT NULL,
    changed_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role VARCHAR(30) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at ASC);

-- ============================================================================
-- 8. CAPTAIN OFFERS & ATOMIC ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS captain_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE RESTRICT,
    status assignment_status NOT NULL DEFAULT 'offered',
    offered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CRITICAL ATOMIC ASSIGNMENT INDEX:
-- Guarantees that at most one captain can have status = 'accepted' for an order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_active_captain_assignment 
ON captain_assignments (order_id) 
WHERE status = 'accepted';

CREATE INDEX IF NOT EXISTS idx_captain_assignments_captain ON captain_assignments(captain_id, status);

-- ============================================================================
-- 9. CASH COLLECTIONS & ELECTRONIC PAYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cash_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT UNIQUE,
    captain_id UUID NOT NULL REFERENCES captains(id) ON DELETE RESTRICT,
    amount_expected_piasters BIGINT NOT NULL,
    amount_collected_piasters BIGINT NOT NULL,
    status cash_collection_status NOT NULL DEFAULT 'collected_by_captain',
    collected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remitted_at TIMESTAMPTZ NULL,
    verified_by_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    CONSTRAINT chk_cash_collected_nonneg CHECK (amount_collected_piasters >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cash_collections_captain ON cash_collections(captain_id, status);

CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT UNIQUE,
    provider payment_gateway_provider NOT NULL,
    amount_piasters BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EGP',
    status payment_intent_status NOT NULL DEFAULT 'requires_payment_method',
    provider_intent_id VARCHAR(150) NULL,
    client_secret_hash VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_payment_amount_pos CHECK (amount_piasters > 0)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    provider_transaction_id VARCHAR(150) NOT NULL,
    amount_piasters BIGINT NOT NULL,
    fee_piasters BIGINT NOT NULL DEFAULT 0,
    is_success BOOLEAN NOT NULL,
    raw_response JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_intent ON payment_transactions(payment_intent_id);

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    amount_piasters BIGINT NOT NULL,
    status refund_status NOT NULL DEFAULT 'pending',
    reason TEXT NOT NULL,
    authorized_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    provider_refund_ref VARCHAR(150) NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_refund_amount_pos CHECK (amount_piasters > 0)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
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

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(is_processed) WHERE is_processed = FALSE;

-- ============================================================================
-- 10. NOTIFICATIONS, SUPPORT & AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title_ar VARCHAR(150) NOT NULL,
    body_ar TEXT NOT NULL,
    title_en VARCHAR(150) NULL,
    body_en TEXT NULL,
    data JSONB NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    order_id UUID NULL REFERENCES orders(id) ON DELETE SET NULL,
    subject VARCHAR(150) NOT NULL,
    status support_ticket_status NOT NULL DEFAULT 'open',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'urgent'
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_ip_address VARCHAR(45) NULL,
    action VARCHAR(80) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50) NOT NULL,
    before_state JSONB NULL,
    after_state JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

-- ============================================================================
-- 11. ROW-LEVEL SECURITY (RLS) ACTIVATION (DEFENSE-IN-DEPTH)
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE captains ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain_subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Note: Policies defined in docs/backend/RLS_POLICY_MATRIX.md
-- End of schema draft
