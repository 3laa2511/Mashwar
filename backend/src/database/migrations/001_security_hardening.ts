/**
 * Migration 001: Security Hardening, Captain Identity Derivation & Atomic Cash Collection Ledger
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Users table (synced with Supabase auth.users)
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('email', 'varchar(255)')
    .addColumn('phone', 'varchar(32)', (col) => col.notNull().unique())
    .addColumn('role', 'varchar(32)', (col) => col.notNull())
    .addColumn('full_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 2. Captains table with unique index on user_id for authoritative identity resolution
  await db.schema
    .createTable('captains')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('full_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('national_id_masked', 'varchar(32)', (col) => col.notNull())
    .addColumn('vehicle_type', 'varchar(32)', (col) => col.notNull())
    .addColumn('vehicle_plate', 'varchar(32)', (col) => col.notNull())
    .addColumn('subscription_status', 'varchar(32)', (col) => col.notNull().defaultTo('active'))
    .addColumn('subscription_plan_code', 'varchar(64)', (col) => col.notNull())
    .addColumn('current_period_ends_at', 'timestamp', (col) => col.notNull())
    .addColumn('grace_period_ends_at', 'timestamp')
    .addColumn('cash_holding_piasters', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('max_cash_holding_piasters', 'integer', (col) => col.notNull().defaultTo(100000))
    .addColumn('rating_average', 'numeric(3, 2)', (col) => col.notNull().defaultTo(5.0))
    .addColumn('is_online', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // Index on user_id for fast resolution from token sub
  await db.schema
    .createIndex('idx_captains_user_id')
    .ifNotExists()
    .on('captains')
    .column('user_id')
    .execute();

  // 3. Orders table
  await db.schema
    .createTable('orders')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('order_number', 'varchar(32)', (col) => col.notNull().unique())
    .addColumn('customer_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('customer_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('customer_phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('service_type_id', 'varchar(32)', (col) => col.notNull())
    .addColumn('status', 'varchar(32)', (col) => col.notNull().defaultTo('created'))
    .addColumn('quote_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('pickup_landmark', 'varchar(255)', (col) => col.notNull())
    .addColumn('pickup_detailed_address', 'text', (col) => col.notNull())
    .addColumn('pickup_contact_phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('dropoff_landmark', 'varchar(255)', (col) => col.notNull())
    .addColumn('dropoff_detailed_address', 'text', (col) => col.notNull())
    .addColumn('dropoff_contact_phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('item_description', 'text', (col) => col.notNull())
    .addColumn('special_instructions', 'text')
    .addColumn('total_fare_piasters', 'integer', (col) => col.notNull())
    .addColumn('payment_method', 'varchar(32)', (col) => col.notNull().defaultTo('cash_on_delivery'))
    .addColumn('is_paid', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('assigned_captain_id', 'varchar(64)')
    .addColumn('captain_name', 'varchar(128)')
    .addColumn('captain_phone', 'varchar(32)')
    .addColumn('captain_vehicle', 'varchar(64)')
    .addColumn('cash_collected_piasters', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_orders_customer_id')
    .ifNotExists()
    .on('orders')
    .column('customer_id')
    .execute();

  await db.schema
    .createIndex('idx_orders_assigned_captain')
    .ifNotExists()
    .on('orders')
    .column('assigned_captain_id')
    .execute();

  // 4. Cash collections table with idempotency key
  await db.schema
    .createTable('cash_collections')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('order_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('captain_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('amount_piasters', 'integer', (col) => col.notNull())
    .addColumn('idempotency_key', 'varchar(128)', (col) => col.notNull().unique())
    .addColumn('customer_confirmed', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 5. Immutable Financial Ledger table
  await db.schema
    .createTable('financial_ledger')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('transaction_type', 'varchar(32)', (col) => col.notNull())
    .addColumn('order_id', 'varchar(64)')
    .addColumn('captain_id', 'varchar(64)')
    .addColumn('amount_piasters', 'integer', (col) => col.notNull())
    .addColumn('balance_after_piasters', 'integer', (col) => col.notNull())
    .addColumn('actor_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('actor_role', 'varchar(32)', (col) => col.notNull())
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 6. Idempotency Keys table
  await db.schema
    .createTable('idempotency_keys')
    .ifNotExists()
    .addColumn('key', 'varchar(128)', (col) => col.primaryKey())
    .addColumn('scope', 'varchar(64)', (col) => col.notNull())
    .addColumn('order_id', 'varchar(64)')
    .addColumn('response_status', 'integer', (col) => col.notNull())
    .addColumn('response_body', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('idempotency_keys').ifExists().execute();
  await db.schema.dropTable('financial_ledger').ifExists().execute();
  await db.schema.dropTable('cash_collections').ifExists().execute();
  await db.schema.dropTable('orders').ifExists().execute();
  await db.schema.dropTable('captains').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
}
