/**
 * Mashwar — Kysely Database Schema Definition
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Platform: PostgreSQL / Kysely
 */

import { Generated } from 'kysely';
import { UserRole } from '../security/rbac.js';
import { ServiceTypeId, OrderStatus, SubscriptionStatus, PaymentMethod } from '../types/index.js';

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

export interface CaptainsTable {
  id: string; // e.g. cpt_ahmed_fathy
  user_id: string; // Foreign key to users.id / auth.users.id
  full_name: string;
  phone: string;
  national_id_masked: string;
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
  quote_id: string;
  pickup_landmark: string;
  pickup_detailed_address: string;
  pickup_contact_phone: string;
  dropoff_landmark: string;
  dropoff_detailed_address: string;
  dropoff_contact_phone: string;
  item_description: string;
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
  transaction_type: 'CASH_COLLECTED' | 'CASH_REMITTED' | 'SUBSCRIPTION_FEE' | 'PLATFORM_FEE';
  order_id: string | null;
  captain_id: string | null;
  amount_piasters: number;
  balance_after_piasters: number;
  actor_id: string;
  actor_role: string;
  notes: string | null;
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
  captains: CaptainsTable;
  orders: OrdersTable;
  cash_collections: CashCollectionsTable;
  financial_ledger: FinancialLedgerTable;
  idempotency_keys: IdempotencyKeysTable;
}
