/**
 * Migration 002: Complete Platform Schema (Multi-Zone Expansion, Merchants, Catalog,
 * Order Lifecycle History, Subscriptions, Complaints & Notifications)
 * Target Launch Hub: El Bagour, Menoufia Governorate, Egypt (with multi-city support)
 * Monetary Units: Integer Egyptian Piasters (1 EGP = 100 Piasters)
 */

import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Cities table (Multi-city expansion foundation: El Bagour, Shebin El-Kom, Menouf, Sadat City)
  await db.schema
    .createTable('cities')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('code', 'varchar(32)', (col) => col.notNull().unique())
    .addColumn('name_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('name_en', 'varchar(128)', (col) => col.notNull())
    .addColumn('governorate_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('governorate_en', 'varchar(128)', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('center_lat', 'numeric(9, 6)', (col) => col.notNull())
    .addColumn('center_lng', 'numeric(9, 6)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 2. Service Zones table
  await db.schema
    .createTable('service_zones')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('city_id', 'varchar(64)', (col) => col.notNull().references('cities.id'))
    .addColumn('code', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('name_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('name_en', 'varchar(128)', (col) => col.notNull())
    .addColumn('is_rural', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('max_radius_km', 'numeric(5, 2)', (col) => col.notNull().defaultTo(15.0))
    .addColumn('landmarks_json', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_service_zones_city_id')
    .ifNotExists()
    .on('service_zones')
    .column('city_id')
    .execute();

  // 3. Zone Tariffs table (All monetary amounts in integer Egyptian Piasters)
  await db.schema
    .createTable('zone_tariffs')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('zone_id', 'varchar(64)', (col) => col.notNull().references('service_zones.id'))
    .addColumn('service_type_id', 'varchar(32)', (col) => col.notNull())
    .addColumn('base_fare_piasters', 'integer', (col) => col.notNull())
    .addColumn('base_included_km', 'numeric(4, 2)', (col) => col.notNull().defaultTo(1.5))
    .addColumn('rate_per_km_piasters', 'integer', (col) => col.notNull())
    .addColumn('rural_surcharge_piasters', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('platform_fee_piasters', 'integer', (col) => col.notNull().defaultTo(200))
    .addColumn('min_fare_piasters', 'integer', (col) => col.notNull().defaultTo(1500))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_zone_tariffs_zone_service')
    .ifNotExists()
    .on('zone_tariffs')
    .columns(['zone_id', 'service_type_id'])
    .execute();

  // 4. Merchants table
  await db.schema
    .createTable('merchants')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('user_id', 'varchar(64)', (col) => col.notNull().unique())
    .addColumn('full_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)')
    .addColumn('national_id_masked', 'varchar(32)', (col) => col.notNull())
    .addColumn('subscription_status', 'varchar(32)', (col) => col.notNull().defaultTo('active'))
    .addColumn('subscription_plan_code', 'varchar(64)', (col) => col.notNull())
    .addColumn('monthly_fee_piasters', 'integer', (col) => col.notNull().defaultTo(40000))
    .addColumn('current_period_ends_at', 'timestamp', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_merchants_user_id')
    .ifNotExists()
    .on('merchants')
    .column('user_id')
    .execute();

  // 5. Stores table
  await db.schema
    .createTable('stores')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('merchant_id', 'varchar(64)', (col) => col.notNull().references('merchants.id'))
    .addColumn('merchant_user_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('city_id', 'varchar(64)', (col) => col.notNull().references('cities.id'))
    .addColumn('zone_id', 'varchar(64)', (col) => col.notNull().references('service_zones.id'))
    .addColumn('name_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('category', 'varchar(32)', (col) => col.notNull())
    .addColumn('category_ar', 'varchar(64)', (col) => col.notNull())
    .addColumn('description_ar', 'text', (col) => col.notNull())
    .addColumn('phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('address_detailed', 'text', (col) => col.notNull())
    .addColumn('landmark', 'varchar(255)', (col) => col.notNull())
    .addColumn('is_open', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('min_order_piasters', 'integer', (col) => col.notNull().defaultTo(2000))
    .addColumn('prep_time_minutes', 'integer', (col) => col.notNull().defaultTo(20))
    .addColumn('rating_average', 'numeric(3, 2)', (col) => col.notNull().defaultTo(4.8))
    .addColumn('commission_rate_percent', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_stores_zone_category')
    .ifNotExists()
    .on('stores')
    .columns(['zone_id', 'category'])
    .execute();

  await db.schema
    .createIndex('idx_stores_merchant_user_id')
    .ifNotExists()
    .on('stores')
    .column('merchant_user_id')
    .execute();

  // 6. Menu Categories table
  await db.schema
    .createTable('menu_categories')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('store_id', 'varchar(64)', (col) => col.notNull().references('stores.id'))
    .addColumn('name_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(1))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 7. Menu Items table (Prices in integer Egyptian Piasters)
  await db.schema
    .createTable('menu_items')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('store_id', 'varchar(64)', (col) => col.notNull().references('stores.id'))
    .addColumn('category_id', 'varchar(64)', (col) => col.notNull().references('menu_categories.id'))
    .addColumn('category_name_ar', 'varchar(128)', (col) => col.notNull())
    .addColumn('name_ar', 'varchar(160)', (col) => col.notNull())
    .addColumn('description_ar', 'text', (col) => col.notNull())
    .addColumn('price_piasters', 'integer', (col) => col.notNull())
    .addColumn('unit_ar', 'varchar(32)', (col) => col.notNull().defaultTo('وحدة'))
    .addColumn('is_available', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_menu_items_store_id')
    .ifNotExists()
    .on('menu_items')
    .column('store_id')
    .execute();

  // 8. Order Items table
  await db.schema
    .createTable('order_items')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('order_id', 'varchar(64)', (col) => col.notNull().references('orders.id'))
    .addColumn('menu_item_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('name_ar', 'varchar(160)', (col) => col.notNull())
    .addColumn('quantity', 'integer', (col) => col.notNull())
    .addColumn('unit_price_piasters', 'integer', (col) => col.notNull())
    .addColumn('total_price_piasters', 'integer', (col) => col.notNull())
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_order_items_order_id')
    .ifNotExists()
    .on('order_items')
    .column('order_id')
    .execute();

  // 9. Order State History table
  await db.schema
    .createTable('order_state_history')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('order_id', 'varchar(64)', (col) => col.notNull().references('orders.id'))
    .addColumn('from_status', 'varchar(32)')
    .addColumn('to_status', 'varchar(32)', (col) => col.notNull())
    .addColumn('actor_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('actor_role', 'varchar(32)', (col) => col.notNull())
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  await db.schema
    .createIndex('idx_order_state_history_order_id')
    .ifNotExists()
    .on('order_state_history')
    .column('order_id')
    .execute();

  // 10. Captain Subscriptions table
  await db.schema
    .createTable('captain_subscriptions')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('captain_id', 'varchar(64)', (col) => col.notNull().references('captains.id'))
    .addColumn('plan_code', 'varchar(64)', (col) => col.notNull())
    .addColumn('fee_piasters', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(32)', (col) => col.notNull())
    .addColumn('period_starts_at', 'timestamp', (col) => col.notNull())
    .addColumn('period_ends_at', 'timestamp', (col) => col.notNull())
    .addColumn('grace_ends_at', 'timestamp')
    .addColumn('activated_by_actor_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 11. Merchant Subscriptions table
  await db.schema
    .createTable('merchant_subscriptions')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('merchant_id', 'varchar(64)', (col) => col.notNull().references('merchants.id'))
    .addColumn('plan_code', 'varchar(64)', (col) => col.notNull())
    .addColumn('fee_piasters', 'integer', (col) => col.notNull())
    .addColumn('status', 'varchar(32)', (col) => col.notNull())
    .addColumn('period_starts_at', 'timestamp', (col) => col.notNull())
    .addColumn('period_ends_at', 'timestamp', (col) => col.notNull())
    .addColumn('activated_by_actor_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 12. Complaints & Support Tickets table
  await db.schema
    .createTable('complaints')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('ticket_number', 'varchar(32)', (col) => col.notNull().unique())
    .addColumn('order_id', 'varchar(64)')
    .addColumn('store_id', 'varchar(64)')
    .addColumn('reporter_user_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('reporter_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('reporter_phone', 'varchar(32)', (col) => col.notNull())
    .addColumn('reporter_role', 'varchar(32)', (col) => col.notNull())
    .addColumn('category', 'varchar(64)', (col) => col.notNull())
    .addColumn('priority', 'varchar(32)', (col) => col.notNull().defaultTo('medium'))
    .addColumn('status', 'varchar(32)', (col) => col.notNull().defaultTo('open'))
    .addColumn('subject_ar', 'varchar(255)', (col) => col.notNull())
    .addColumn('description_ar', 'text', (col) => col.notNull())
    .addColumn('assigned_agent_id', 'varchar(64)')
    .addColumn('assigned_agent_name', 'varchar(128)')
    .addColumn('resolution_notes_ar', 'text')
    .addColumn('refund_amount_piasters', 'integer')
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .addColumn('resolved_at', 'timestamp')
    .execute();

  await db.schema
    .createIndex('idx_complaints_reporter_status')
    .ifNotExists()
    .on('complaints')
    .columns(['reporter_user_id', 'status'])
    .execute();

  // 13. Complaint Events History table
  await db.schema
    .createTable('complaint_events')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('complaint_id', 'varchar(64)', (col) => col.notNull().references('complaints.id'))
    .addColumn('actor_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('actor_role', 'varchar(32)', (col) => col.notNull())
    .addColumn('actor_name', 'varchar(128)', (col) => col.notNull())
    .addColumn('action', 'varchar(32)', (col) => col.notNull())
    .addColumn('from_status', 'varchar(32)')
    .addColumn('to_status', 'varchar(32)')
    .addColumn('message_ar', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();

  // 14. Notifications table
  await db.schema
    .createTable('notifications')
    .ifNotExists()
    .addColumn('id', 'varchar(64)', (col) => col.primaryKey())
    .addColumn('recipient_user_id', 'varchar(64)', (col) => col.notNull())
    .addColumn('recipient_role', 'varchar(32)', (col) => col.notNull())
    .addColumn('title_ar', 'varchar(255)', (col) => col.notNull())
    .addColumn('body_ar', 'text', (col) => col.notNull())
    .addColumn('order_id', 'varchar(64)')
    .addColumn('is_read', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notifications').ifExists().execute();
  await db.schema.dropTable('complaint_events').ifExists().execute();
  await db.schema.dropTable('complaints').ifExists().execute();
  await db.schema.dropTable('merchant_subscriptions').ifExists().execute();
  await db.schema.dropTable('captain_subscriptions').ifExists().execute();
  await db.schema.dropTable('order_state_history').ifExists().execute();
  await db.schema.dropTable('order_items').ifExists().execute();
  await db.schema.dropTable('menu_items').ifExists().execute();
  await db.schema.dropTable('menu_categories').ifExists().execute();
  await db.schema.dropTable('stores').ifExists().execute();
  await db.schema.dropTable('merchants').ifExists().execute();
  await db.schema.dropTable('zone_tariffs').ifExists().execute();
  await db.schema.dropTable('service_zones').ifExists().execute();
  await db.schema.dropTable('cities').ifExists().execute();
}
