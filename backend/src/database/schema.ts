/**
 * Mashwar — Kysely Database Schema Definition
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Platform: PostgreSQL / Kysely
 */

import { Generated } from 'kysely';
import { UserRole } from '../security/rbac.js';
import {
  ServiceTypeId,
  OrderStatus,
  SubscriptionStatus,
  PaymentMethod,
  StoreCategory,
  ComplaintStatus,
  ComplaintPriority,
  ComplaintCategory,
} from '../types/index.js';

export interface UsersTable {
  id: string; // Supabase auth.users UUID
  email: string | null;
  phone: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface CitiesTable {
  id: string; // e.g. city_el_bagour
  code: string; // e.g. EL_BAGOUR
  name_ar: string;
  name_en: string;
  governorate_ar: string;
  governorate_en: string;
  is_active: boolean;
  center_lat: number;
  center_lng: number;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ServiceZonesTable {
  id: string; // e.g. zone_bagour_center
  city_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  is_rural: boolean;
  is_active: boolean;
  max_radius_km: number;
  landmarks_json: string; // JSON array of Arabic landmarks
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface ZoneTariffsTable {
  id: string;
  zone_id: string;
  service_type_id: string;
  base_fare_piasters: number;
  base_included_km: number;
  rate_per_km_piasters: number;
  rural_surcharge_piasters: number;
  platform_fee_piasters: number;
  min_fare_piasters: number;
  is_active: boolean;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface MerchantsTable {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  national_id_masked: string;
  subscription_status: SubscriptionStatus;
  subscription_plan_code: string;
  monthly_fee_piasters: number;
  current_period_ends_at: string;
  is_active: boolean;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface StoresTable {
  id: string;
  merchant_id: string;
  merchant_user_id: string;
  city_id: string;
  zone_id: string;
  name_ar: string;
  category: StoreCategory;
  category_ar: string;
  description_ar: string;
  phone: string;
  address_detailed: string;
  landmark: string;
  is_open: boolean;
  is_active: boolean;
  min_order_piasters: number;
  prep_time_minutes: number;
  rating_average: number;
  commission_rate_percent: number; // Always 0
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface MenuCategoriesTable {
  id: string;
  store_id: string;
  name_ar: string;
  sort_order: number;
  is_active: boolean;
  created_at: Generated<string>;
}

export interface MenuItemsTable {
  id: string;
  store_id: string;
  category_id: string;
  category_name_ar: string;
  name_ar: string;
  description_ar: string;
  price_piasters: number; // Integer Egyptian Piasters
  unit_ar: string;
  is_available: boolean;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface CaptainsTable {
  id: string; // e.g. cpt_ahmed_fathy
  user_id: string; // Foreign key to users.id / auth.users.id
  full_name: string;
  phone: string;
  national_id_masked: string;
  city_id?: string | null;
  active_zone_id?: string | null;
  vehicle_type: 'motorcycle' | 'scooter' | 'tricycle' | 'light_commercial_van';
  vehicle_plate: string;
  subscription_status: SubscriptionStatus;
  subscription_plan_code: string;
  current_period_ends_at: string;
  grace_period_ends_at: string | null;
  cash_holding_piasters: number; // Stored in Egyptian Piasters (integer)
  max_cash_holding_piasters: number; // e.g. 100,000 piasters = 1,000 EGP
  rating_average: number;
  is_online: boolean;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface OrdersTable {
  id: string;
  order_number: string;
  customer_id: string; // Supabase user ID (sub)
  customer_name: string;
  customer_phone: string;
  service_type_id: ServiceTypeId;
  status: OrderStatus;
  city_id?: string | null;
  zone_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  merchant_user_id?: string | null;
  quote_id: string;
  pickup_landmark: string;
  pickup_detailed_address: string;
  pickup_contact_phone: string;
  dropoff_landmark: string;
  dropoff_detailed_address: string;
  dropoff_contact_phone: string;
  item_description: string;
  items_subtotal_piasters?: number | null;
  delivery_fee_piasters?: number | null;
  platform_fee_piasters?: number | null;
  special_instructions: string | null;
  total_fare_piasters: number; // Egyptian Piasters (integer)
  payment_method: PaymentMethod;
  is_paid: boolean;
  assigned_captain_id: string | null;
  captain_name: string | null;
  captain_phone: string | null;
  captain_vehicle: string | null;
  cash_collected_piasters: number | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
}

export interface OrderItemsTable {
  id: string;
  order_id: string;
  menu_item_id: string;
  name_ar: string;
  quantity: number;
  unit_price_piasters: number;
  total_price_piasters: number;
  notes: string | null;
  created_at: Generated<string>;
}

export interface OrderStateHistoryTable {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_id: string;
  actor_role: string;
  notes: string | null;
  created_at: Generated<string>;
}

export interface CaptainSubscriptionsTable {
  id: string;
  captain_id: string;
  plan_code: string;
  fee_piasters: number;
  status: SubscriptionStatus;
  period_starts_at: string;
  period_ends_at: string;
  grace_ends_at: string | null;
  activated_by_actor_id: string;
  created_at: Generated<string>;
}

export interface MerchantSubscriptionsTable {
  id: string;
  merchant_id: string;
  plan_code: string;
  fee_piasters: number;
  status: SubscriptionStatus;
  period_starts_at: string;
  period_ends_at: string;
  activated_by_actor_id: string;
  created_at: Generated<string>;
}

export interface CashCollectionsTable {
  id: string; // collection_...
  order_id: string;
  captain_id: string;
  amount_piasters: number;
  idempotency_key: string; // Unique index to prevent duplicate credit
  customer_confirmed: boolean;
  notes: string | null;
  created_at: Generated<string>;
}

export interface FinancialLedgerTable {
  id: string;
  transaction_type: 'CASH_COLLECTED' | 'CASH_REMITTED' | 'SUBSCRIPTION_FEE' | 'PLATFORM_FEE' | 'REFUND_ISSUED';
  order_id: string | null;
  captain_id: string | null;
  amount_piasters: number;
  balance_after_piasters: number;
  actor_id: string;
  actor_role: string;
  notes: string | null;
  created_at: Generated<string>;
}

export interface ComplaintsTable {
  id: string;
  ticket_number: string;
  order_id: string | null;
  store_id: string | null;
  reporter_user_id: string;
  reporter_name: string;
  reporter_phone: string;
  reporter_role: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  subject_ar: string;
  description_ar: string;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  resolution_notes_ar: string | null;
  refund_amount_piasters: number | null;
  created_at: Generated<string>;
  updated_at: Generated<string>;
  resolved_at: string | null;
}

export interface ComplaintEventsTable {
  id: string;
  complaint_id: string;
  actor_id: string;
  actor_role: string;
  actor_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  message_ar: string;
  created_at: Generated<string>;
}

export interface NotificationsTable {
  id: string;
  recipient_user_id: string;
  recipient_role: string;
  title_ar: string;
  body_ar: string;
  order_id: string | null;
  is_read: boolean;
  created_at: Generated<string>;
}

export interface IdempotencyKeysTable {
  key: string;
  scope: string;
  order_id: string | null;
  response_status: number;
  response_body: string; // JSON serialized
  created_at: Generated<string>;
}

export interface DatabaseSchema {
  users: UsersTable;
  cities: CitiesTable;
  service_zones: ServiceZonesTable;
  zone_tariffs: ZoneTariffsTable;
  merchants: MerchantsTable;
  stores: StoresTable;
  menu_categories: MenuCategoriesTable;
  menu_items: MenuItemsTable;
  captains: CaptainsTable;
  orders: OrdersTable;
  order_items: OrderItemsTable;
  order_state_history: OrderStateHistoryTable;
  captain_subscriptions: CaptainSubscriptionsTable;
  merchant_subscriptions: MerchantSubscriptionsTable;
  cash_collections: CashCollectionsTable;
  financial_ledger: FinancialLedgerTable;
  complaints: ComplaintsTable;
  complaint_events: ComplaintEventsTable;
  notifications: NotificationsTable;
  idempotency_keys: IdempotencyKeysTable;
}

export type Database = DatabaseSchema;


