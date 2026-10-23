/**
 * Mashwar — Backend Type Definitions & Domain Enums
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Units: Egyptian Piasters (BIGINT / integer minor units: 1 EGP = 100 Piasters)
 */

export type ServiceTypeId = 'package' | 'restaurant_store' | 'errand' | 'passenger';

export type OrderStatus =
  | 'created'
  | 'searching_captain'
  | 'captain_assigned'
  | 'at_pickup'
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

export interface LocationLandmark {
  landmarkName: string;
  detailedAddress: string;
  contactPhone: string;
  notes?: string;
}

export interface FareQuote {
  quoteId: string;
  serviceTypeId: ServiceTypeId;
  distanceKm: number;
  baseFarePiasters: number;
  distanceFarePiasters: number;
  ruralSurchargePiasters: number;
  platformFeePiasters: number;
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
  quoteId: string;
  pickup: LocationLandmark;
  dropoff: LocationLandmark;
  itemDescription: string;
  specialInstructions?: string;
  totalFarePiasters: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  assignedCaptainId?: string;
  captainName?: string;
  captainPhone?: string;
  captainVehicle?: string;
  cashCollectedPiasters?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CaptainProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  nationalIdMasked: string;
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
