/**
 * Mashwar — Backend Type Definitions & Domain Enums
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Units: Egyptian Piasters (BIGINT / integer minor units: 1 EGP = 100 Piasters)
 */

export type ServiceTypeId = 'package' | 'restaurant_store' | 'errand' | 'passenger';

export type OrderStatus =
  | 'created'
  | 'accepted_by_store'
  | 'preparing'
  | 'ready_for_pickup'
  | 'searching_captain'
  | 'captain_assigned'
  | 'at_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type SubscriptionStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'expired'
  | 'suspended'
  | 'cancelled';

export type PaymentMethod =
  | 'cash_on_delivery'
  | 'electronic_wallet'
  | 'electronic_card';

export type StoreCategory = 'restaurant' | 'pharmacy' | 'supermarket' | 'bakery' | 'other';

export type ComplaintStatus = 'open' | 'under_review' | 'resolved' | 'rejected' | 'escalated';

export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ComplaintCategory =
  | 'delayed_delivery'
  | 'missing_or_damaged_item'
  | 'fare_or_cash_dispute'
  | 'captain_behavior'
  | 'store_quality'
  | 'other';

export interface City {
  id: string; // e.g. city_el_bagour
  code: string; // e.g. EL_BAGOUR
  nameAr: string; // الباجور
  nameEn: string; // El Bagour
  governorateAr: string; // المنوفية
  governorateEn: string; // Menoufia
  isActive: boolean;
  centerLat: number;
  centerLng: number;
  createdAt: string;
}

export interface ServiceZone {
  id: string; // e.g. zone_bagour_center
  cityId: string;
  code: string;
  nameAr: string;
  nameEn: string;
  isRural: boolean;
  isActive: boolean;
  maxRadiusKm: number;
  landmarksAr: string[];
  createdAt: string;
}

export interface ZoneTariff {
  id: string;
  zoneId: string;
  serviceTypeId: Exclude<ServiceTypeId, 'passenger'>;
  baseFarePiasters: number; // Integer piasters
  baseIncludedKm: number;
  ratePerKmPiasters: number; // Integer piasters
  ruralSurchargePiasters: number; // Integer piasters
  platformFeePiasters: number; // Integer piasters
  minFarePiasters: number; // Integer piasters
  isActive: boolean;
  updatedAt: string;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email?: string;
  nationalIdMasked: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlanCode: string;
  monthlyFeePiasters: number;
  currentPeriodEndsAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface Store {
  id: string;
  merchantId: string;
  merchantUserId: string;
  cityId: string;
  zoneId: string;
  nameAr: string;
  category: StoreCategory;
  categoryAr: string;
  descriptionAr: string;
  phone: string;
  addressDetailed: string;
  landmark: string;
  isOpen: boolean;
  isActive: boolean;
  minOrderPiasters: number; // Integer piasters
  prepTimeMinutes: number;
  ratingAverage: number;
  commissionRatePercent: number; // 0% invariant
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  storeId: string;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
}

export interface MenuItem {
  id: string;
  storeId: string;
  categoryId: string;
  categoryNameAr: string;
  nameAr: string;
  descriptionAr: string;
  pricePiasters: number; // Integer piasters (1 EGP = 100 piasters)
  unitAr: string;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  nameAr: string;
  quantity: number;
  unitPricePiasters: number; // Integer piasters
  totalPricePiasters: number; // quantity * unitPricePiasters
  notes?: string;
}

export interface OrderStateHistoryEntry {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId: string;
  actorRole: string;
  notes?: string;
  createdAt: string;
}

export interface LocationLandmark {
  landmarkName: string;
  detailedAddress: string;
  contactPhone: string;
  notes?: string;
}

export interface FareQuote {
  quoteId: string;
  serviceTypeId: ServiceTypeId;
  cityId?: string;
  zoneId?: string;
  distanceKm: number;
  baseFarePiasters: number;
  distanceFarePiasters: number;
  ruralSurchargePiasters: number;
  platformFeePiasters: number;
  itemsSubtotalPiasters?: number;
  totalFarePiasters: number;
  formattedTotalEgp: string;
  currency: 'EGP';
  estimatedDurationMinutes: string;
  expiresAt: string; // ISO 8601
  signature: string; // HMAC-SHA256 signature
  lineItems: Array<{
    title: string;
    amountPiasters: number;
  }>;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. MSH-8102
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceTypeId: ServiceTypeId;
  status: OrderStatus;
  cityId?: string;
  zoneId?: string;
  storeId?: string;
  storeName?: string;
  merchantUserId?: string;
  quoteId: string;
  pickup: LocationLandmark;
  dropoff: LocationLandmark;
  itemDescription: string;
  items?: OrderItem[];
  itemsSubtotalPiasters?: number;
  deliveryFeePiasters?: number;
  platformFeePiasters?: number;
  specialInstructions?: string;
  totalFarePiasters: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  assignedCaptainId?: string;
  captainName?: string;
  captainPhone?: string;
  captainVehicle?: string;
  cashCollectedPiasters?: number;
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaptainProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  nationalIdMasked: string;
  cityId?: string;
  activeZoneId?: string;
  vehicleType: 'motorcycle' | 'scooter' | 'bicycle' | 'light_commercial_van';
  vehiclePlate: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlanCode: string;
  currentPeriodEndsAt: string;
  gracePeriodEndsAt?: string;
  cashHoldingPiasters: number;
  maxCashHoldingPiasters: number;
  ratingAverage: number;
  isOnline: boolean;
}

export interface CaptainSubscriptionRecord {
  id: string;
  captainId: string;
  planCode: string;
  feePiasters: number;
  status: SubscriptionStatus;
  periodStartsAt: string;
  periodEndsAt: string;
  graceEndsAt?: string;
  activatedByActorId: string;
  createdAt: string;
}

export interface ComplaintEvent {
  id: string;
  complaintId: string;
  actorId: string;
  actorRole: string;
  actorName: string;
  action: 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'NOTE_ADDED' | 'RESOLVED';
  fromStatus?: ComplaintStatus;
  toStatus?: ComplaintStatus;
  messageAr: string;
  createdAt: string;
}

export interface Complaint {
  id: string;
  ticketNumber: string; // e.g. TKT-4012
  orderId?: string;
  storeId?: string;
  reporterUserId: string;
  reporterName: string;
  reporterPhone: string;
  reporterRole: 'customer' | 'captain' | 'merchant';
  category: ComplaintCategory;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  subjectAr: string;
  descriptionAr: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  resolutionNotesAr?: string;
  refundAmountPiasters?: number;
  events: ComplaintEvent[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  recipientRole: string;
  titleAr: string;
  bodyAr: string;
  orderId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface OrderTransitionRequest {
  targetStatus: OrderStatus;
  actorId: string;
  actorRole: 'customer' | 'captain' | 'merchant' | 'operations' | 'owner' | 'operations_dispatcher' | 'support_agent';
  cashCollectedPiasters?: number;
  cancellationReason?: string;
  notes?: string;
}

export interface WebhookEventPayload {
  eventId: string;
  provider: 'paymob' | 'fawry' | 'vodafone_cash';
  eventType: 'TRANSACTION_SUCCESS' | 'TRANSACTION_FAILED' | 'REFUND_SUCCESS';
  transactionReference: string;
  orderId?: string;
  captainSubscriptionId?: string;
  amountPiasters: number;
  currency: 'EGP';
  timestamp: string;
}
