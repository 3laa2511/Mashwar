import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  onAuthStateChanged,
  subscribeToScopedOrdersInFirestore,
  subscribeToCommuteSubscriptionsInFirestore,
  subscribeToStoresFromFirestore,
  subscribeToDriverRatingsFromFirestore,
  submitDriverRatingToFirestore,
  subscribeToThreadMessagesInFirestore,
  sendThreadMessageToFirestore,
  syncCommuteSlotToFirestore,
  subscribeToCommuteSlotsInFirestore,
  syncDeliveryOrderToFirestore,
  updateDeliveryOrderInFirestore,
  syncRideToFirestore,
  createCommuteSubscriptionInFirestore,
  submitWalletTopUpProofInFirestore,
  createCaptainNotificationInFirestore,
  subscribeToCaptainNotificationsInFirestore,
  markCaptainNotificationReadInFirestore,
  type User,
} from '../lib/firebase';
import {
  type CaptainAlertSoundType,
  getCaptainCustomSound,
  setCaptainCustomSound,
  playDispatchChime,
} from '../components/mobile/SoundAlertHelper';
import {
  BLUEPRINT_LIMITS,
  type CashChangeOptionEgp,
  generateFourDigitPin,
  calculateElBagourProximityDeliveryFeePiasters,
  calculateCommuteSubscriptionPricePiasters,
} from '../lib/firestoreSchemas';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export type PersonaRole = 'customer' | 'captain' | 'merchant' | 'operations';

export interface DemoUser {
  id: string;
  name: string;
  phone: string;
  role: PersonaRole;
  roleBadgeAr: string;
  avatar: string;
  merchantId?: string; // If role === 'merchant', links strictly to their specific store
  vehicleInfo?: string; // If role === 'captain'
  captainRecordId?: string; // Links to FleetCaptainItem
}

export interface ProductItem {
  id: string;
  storeId: string;
  nameAr: string;
  descriptionAr: string;
  priceEgp: number;
  categoryName: string;
  isAvailable: boolean;
  unit: string;
}

export interface StoreItem {
  id: string;
  nameAr: string;
  category: 'restaurant' | 'pharmacy' | 'supermarket';
  categoryAr: string;
  ownerName: string;
  phone: string;
  address: string;
  landmark: string;
  rating: number;
  reviewsCount: number;
  deliveryTimeEst: string;
  deliveryFeeEgp: number;
  minOrderEgp: number;
  isOpen: boolean;
  distanceKm: number;
  lat?: number;
  lng?: number;
  zoneCluster?: string;
  badgeAr?: string;
  image: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  notes?: string;
}

export type OrderStatus =
  | 'awaiting_quote' // بانتظار تسعيرة الصيدلية أو المتجر (روشتة / ورقة مقاضي)
  | 'quote_ready' // عرض السعر جاهز ومطلوب موافقة العميل
  | 'created' // بانتظار قبول المتجر
  | 'accepted_by_store' // المتجر قبل الطلب (Canonical Backend Status)
  | 'preparing' // قيد التحضير بالمتجر
  | 'merchant_accepted' // توافق رجعي (Legacy Alias)
  | 'ready_for_pickup' // جاهز للاستلام من الكابتن
  | 'searching_captain' // جاري البحث عن أقرب كابتن بالباجور
  | 'captain_assigned' // الكابتن في الطريق للاستلام
  | 'at_pickup' // الكابتن وصل لنقطة الاستلام
  | 'picked_up' // تم استلام الطلب من نقطة الانطلاق
  | 'in_transit' // الكابتن في الطريق للعميل
  | 'delivered' // تم التسليم وتحصيل الكاش
  | 'cancelled'; // ملغي

export type OrderServiceType =
  | 'restaurant_store'
  | 'package'
  | 'errand'
  | 'ride'
  | 'prescription_list';

export interface MarketplaceOrder {
  id: string;
  orderNumber: string;
  serviceType: OrderServiceType;
  serviceTypeAr: string;
  vehicleCategory?: 'tuktuk' | 'car' | 'scooter' | 'motorcycle' | 'van';
  storeId: string;
  storeName: string;
  storeIds?: string[];
  storeNames?: string[];
  storeAddress: string;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  estimatedMinutes: string;
  estimatedDuration?: number;
  estimatedDurationMinutes?: number;
  isRural: boolean;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceEgp: number;
    storeId?: string;
    storeName?: string;
  }[];
  itemDescription: string;
  aiExtractedItems?: string[];
  prescriptionSummary?: string;
  quoteTotalEgp?: number;
  quoteNotes?: string;
  subtotalEgp: number;
  deliveryFeeEgp: number;
  platformFeeEgp: number;
  ruralSurchargeEgp: number;
  discountEgp?: number;
  promoCode?: string;
  cashChangeForEgp?: CashChangeOptionEgp;
  ridePin?: string;
  requiresFamilyTrustedDriver?: boolean;
  totalEgp: number;
  totalFarePiasters: number;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
  status: OrderStatus;
  assignedCaptainId?: string;
  assignedCaptainName?: string;
  assignedCaptainPhone?: string;
  assignedCaptainVehicle?: string;
  assignedCaptainRating?: number;
  customerRating?: number;
  customerRatingTags?: string[];
  customerFeedback?: string;
  orderFeedback?: string;
  createdAt: string;
  createdAtDate: Date;
  acceptedAt?: string;
  acceptedAtIso?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  quoteId?: string;
  quoteSignature?: string;
  notes?: string;
  orderNotes?: string;
  scheduled_for?: string | null;
  scheduledFor?: string | null;
  hasVoiceNote?: boolean;
  voiceNoteDurationSec?: number;
  voiceNoteTranscript?: string;
  driverTipEgp?: number;
}

export type OrderTrackingStageKey = 'received' | 'preparing' | 'out_for_delivery' | 'delivered';

export interface OrderTrackingStageMeta {
  key: OrderTrackingStageKey;
  index: number;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
}

export const ORDER_TRACKING_STAGES: OrderTrackingStageMeta[] = [
  {
    key: 'received',
    index: 0,
    labelAr: 'تم الاستلام',
    labelEn: 'Received',
    descriptionAr: 'تم استلام طلبك وتأكيده بنجاح',
  },
  {
    key: 'preparing',
    index: 1,
    labelAr: 'قيد التجهيز',
    labelEn: 'Preparing',
    descriptionAr: 'جاري تجهيز الطلب أو تعيين أقرب كابتن',
  },
  {
    key: 'out_for_delivery',
    index: 2,
    labelAr: 'جاري التوصيل',
    labelEn: 'Out for Delivery',
    descriptionAr: 'الكابتن استلم الطلب وفي طريقه إليك',
  },
  {
    key: 'delivered',
    index: 3,
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    descriptionAr: 'تم تسليم الطلب بنجاح وإضافة نقاط الولاء',
  },
];

export function getOrderTrackingProgress(status: OrderStatus): {
  stageKey: OrderTrackingStageKey;
  stageIndex: number;
  labelAr: string;
  labelEn: string;
  progressPercent: number;
  isCancelled: boolean;
} {
  if (status === 'cancelled') {
    return {
      stageKey: 'received',
      stageIndex: 0,
      labelAr: 'ملغي',
      labelEn: 'Cancelled',
      progressPercent: 0,
      isCancelled: true,
    };
  }
  if (status === 'delivered') {
    return {
      stageKey: 'delivered',
      stageIndex: 3,
      labelAr: 'تم التسليم',
      labelEn: 'Delivered',
      progressPercent: 100,
      isCancelled: false,
    };
  }
  if (status === 'awaiting_quote') {
    return {
      stageKey: 'received',
      stageIndex: 0,
      labelAr: 'بانتظار تسعيرة المتجر',
      labelEn: 'Awaiting Quote',
      progressPercent: 18,
      isCancelled: false,
    };
  }
  if (status === 'quote_ready') {
    return {
      stageKey: 'preparing',
      stageIndex: 1,
      labelAr: 'عرض السعر جاهز للاعتماد',
      labelEn: 'Quote Ready',
      progressPercent: 35,
      isCancelled: false,
    };
  }
  if (
    status === 'captain_assigned' ||
    status === 'at_pickup' ||
    status === 'picked_up' ||
    status === 'in_transit'
  ) {
    return {
      stageKey: 'out_for_delivery',
      stageIndex: 2,
      labelAr: 'جاري التوصيل',
      labelEn: 'Out for Delivery',
      progressPercent: 72,
      isCancelled: false,
    };
  }
  if (
    status === 'accepted_by_store' ||
    status === 'merchant_accepted' ||
    status === 'preparing' ||
    status === 'ready_for_pickup' ||
    status === 'searching_captain'
  ) {
    return {
      stageKey: 'preparing',
      stageIndex: 1,
      labelAr: 'قيد التجهيز',
      labelEn: 'Preparing',
      progressPercent: 45,
      isCancelled: false,
    };
  }
  return {
    stageKey: 'received',
    stageIndex: 0,
    labelAr: 'تم الاستلام',
    labelEn: 'Received',
    progressPercent: 20,
    isCancelled: false,
  };
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderRole: 'customer' | 'captain' | 'merchant';
  senderName: string;
  text: string;
  time: string;
}

export interface WalletTransaction {
  id: string;
  titleAr: string;
  type: 'credit' | 'debit';
  amountEgp: number;
  methodAr: string;
  timestampAr: string;
  orderNumber?: string;
}

export type LoyaltyTier = 'bronze' | 'silver' | 'gold';

export interface LoyaltyCashbackEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  serviceTypeAr: string;
  orderTotalEgp: number;
  cashbackPercent: number;
  cashbackAmountEgp: number;
  pointsEarned: number;
  createdAtAr: string;
}

export function getLoyaltyTierFromPoints(points: number): {
  tier: LoyaltyTier;
  tierLabelAr: string;
  deliveryPercent: number;
  ridePercent: number;
  nextTierPointsTarget: number | null;
} {
  if (points >= 500) {
    return {
      tier: 'gold',
      tierLabelAr: 'العضوية الذهبية (Gold)',
      deliveryPercent: 10,
      ridePercent: 8,
      nextTierPointsTarget: null,
    };
  }
  if (points >= 200) {
    return {
      tier: 'silver',
      tierLabelAr: 'العضوية الفضية (Silver)',
      deliveryPercent: 6,
      ridePercent: 5,
      nextTierPointsTarget: 500,
    };
  }
  return {
    tier: 'bronze',
    tierLabelAr: 'العضوية البرونزية (Bronze)',
    deliveryPercent: 4,
    ridePercent: 3,
    nextTierPointsTarget: 200,
  };
}

export function calculateOrderCashback(
  orderTotalEgp: number,
  serviceType: OrderServiceType,
  currentPoints: number
): {
  cashbackPercent: number;
  cashbackAmountEgp: number;
  pointsEarned: number;
} {
  const tierInfo = getLoyaltyTierFromPoints(currentPoints);
  const cashbackPercent =
    serviceType === 'restaurant_store' ? tierInfo.deliveryPercent : tierInfo.ridePercent;
  const safeTotal = Math.max(0, Number(orderTotalEgp) || 0);
  const rawCashback = (safeTotal * cashbackPercent) / 100;
  // Minimum 1 EGP cashback on completed orders >= 15 EGP, capped at 25 EGP per order
  const cashbackAmountEgp =
    safeTotal >= 15 ? Math.min(25, Math.max(1, Math.round(rawCashback))) : 0;
  // 10 points per 1 EGP cashback + base 5 points per completed order
  const pointsEarned = cashbackAmountEgp * 10 + 5;
  return {
    cashbackPercent,
    cashbackAmountEgp,
    pointsEarned,
  };
}

export interface AppNotification {
  id: string;
  recipientRole: PersonaRole | 'all';
  titleAr: string;
  bodyAr: string;
  timeAr: string;
  orderNumber?: string;
  isRead: boolean;
}

export interface CaptainInAppNotification {
  id: string;
  orderId: string;
  orderNumber: string;
  zoneArea: string;
  titleAr: string;
  bodyAr: string;
  serviceType: OrderServiceType;
  estimatedEarningsEgp: number;
  soundProfile: CaptainAlertSoundType;
  timeAr: string;
  isRead: boolean;
  source: 'firestore' | 'local';
}

export interface SupportComplaint {
  id: string;
  ticketNumber: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  categoryAr: string;
  subjectAr: string;
  descriptionAr: string;
  status: 'open' | 'under_review' | 'resolved';
  createdAtAr: string;
  resolutionNotesAr?: string;
}

export type FleetSubscriptionStatus = 'active' | 'grace_period' | 'expired' | 'suspended';

export interface FleetCaptainItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber: string;
  status: FleetSubscriptionStatus;
  statusAr: string;
  daysRemaining: number;
  cashHoldingPiasters: number;
  cashCeilingPiasters: number;
  rating: number;
  isOnline: boolean;
  isFamilyTrusted: boolean;
  completedToday: number;
}

export type CommuteSlotStatus =
  | 'scheduled'
  | 'driver_assigned'
  | 'en_route'
  | 'completed'
  | 'skipped';

export interface CommuteSlotItem {
  id: string;
  subscriptionId: string;
  slotType: 'morning_go' | 'evening_return';
  slotLabelAr: string;
  dateIso: string;
  scheduledTime: string;
  status: CommuteSlotStatus;
  captainName?: string;
  ridePin?: string;
}

export interface CommuteSubscriptionItem {
  id: string;
  fromLandmark: string;
  toLandmark: string;
  scheduleDays: string[];
  morningTime: string;
  returnTime?: string;
  vehicleTier: 'tuktuk' | 'car';
  planType: 'weekly' | 'monthly';
  priceEgp: number;
  status: 'active' | 'paused';
  createdAtAr: string;
  slots?: CommuteSlotItem[];
}

export interface DriverRatingEntry {
  id: string;
  orderId: string;
  driverId: string;
  driverName: string;
  rating: number;
  tags: string[];
  feedback: string;
  createdAtAr: string;
}

export interface PlatformSystemSettings {
  baseFarePiasters: number; // 1500 = 15 EGP
  ratePerKmPiasters: number; // 400 = 4 EGP
  ruralSurchargePiasters: number; // 500 = 5 EGP
  platformFeePiasters: number; // 200 = 2 EGP
  cashCeilingPiasters: number; // 100000 = 1000 EGP
  gracePeriodHours: number; // 72 hours
  passengerLockEnabled: boolean; // False when local TukTuk/Car passenger service is enabled
}

export interface PlatformAuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actionType: string;
  target: string;
  descriptionAr: string;
}

// ============================================================================
// 2. TIME FORMATTING HELPERS (HUMAN-READABLE ARABIC TIMESTAMPS)
// ============================================================================

export function formatArabicClockTime(date: Date): string {
  return date.toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatHumanReadableAcceptedTimestamp(
  acceptedAtIso?: string,
  acceptedAtLabel?: string
): string | null {
  if (!acceptedAtIso && !acceptedAtLabel) return null;

  const candidateIso = acceptedAtIso || acceptedAtLabel;
  if (!candidateIso) return null;

  const dt = new Date(candidateIso);
  if (isNaN(dt.getTime())) return acceptedAtLabel || acceptedAtIso || null;

  const clockStr = formatArabicClockTime(dt);
  const diffMs = Date.now() - dt.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));

  let relativeStr = 'الآن';
  if (diffMins === 1) {
    relativeStr = 'منذ دقيقة واحدة';
  } else if (diffMins === 2) {
    relativeStr = 'منذ دقيقتين';
  } else if (diffMins >= 3 && diffMins <= 10) {
    relativeStr = `منذ ${diffMins.toLocaleString('ar-EG')} دقائق`;
  } else if (diffMins > 10 && diffMins < 60) {
    relativeStr = `منذ ${diffMins.toLocaleString('ar-EG')} دقيقة`;
  } else if (diffMins >= 60) {
    const hours = Math.floor(diffMins / 60);
    relativeStr = hours === 1 ? 'منذ ساعة' : hours === 2 ? 'منذ ساعتين' : `منذ ${hours.toLocaleString('ar-EG')} ساعات`;
  }

  return `الساعة ${clockStr} (${relativeStr})`;
}

/**
 * Converts a user-facing EGP input (number or numeric string) into integer Egyptian piasters (1 EGP = 100 piasters)
 * exactly once at the UI boundary. Rejects non-finite, zero/negative, or fractional piaster values.
 */
export function convertEgpInputToPiasters(egpInput: string | number): {
  valid: boolean;
  amountPiasters: number;
  errorAr?: string;
} {
  const rawNumber =
    typeof egpInput === 'number'
      ? egpInput
      : typeof egpInput === 'string' && egpInput.trim() !== ''
      ? Number(egpInput.trim())
      : NaN;

  if (!Number.isFinite(rawNumber) || rawNumber <= 0) {
    return {
      valid: false,
      amountPiasters: 0,
      errorAr: 'يرجى إدخال مبلغ صحيح موجب بالجنيه أكبر من الصفر.',
    };
  }

  const scaled = rawNumber * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > 1e-6 || !Number.isSafeInteger(rounded) || rounded <= 0) {
    return {
      valid: false,
      amountPiasters: 0,
      errorAr: 'لا يُسمح بكسور القرش؛ يجب أن يتحول المبلغ إلى عدد صحيح من القروش.',
    };
  }

  return {
    valid: true,
    amountPiasters: rounded,
  };
}

// ============================================================================
// 3. REALISTIC SEED DATA (EL BAGOUR, MENOUFIA)
// ============================================================================

export const EL_BAGOUR_LANDMARKS_LIST: {
  id: string;
  nameAr: string;
  areaAr: string;
  isRural: boolean;
  distanceFromCenterKm: number;
  lat: number;
  lng: number;
}[] = [
  { id: 'lm_station', nameAr: 'ميدان المحطة - وسط الباجور', areaAr: 'وسط المدينة', isRural: false, distanceFromCenterKm: 0.5, lat: 30.4328, lng: 31.0339 },
  { id: 'lm_shorouk', nameAr: 'شارع الجيش - برج الشروق', areaAr: 'حي وسط التجاري', isRural: false, distanceFromCenterKm: 1.4, lat: 30.4305, lng: 31.0315 },
  { id: 'lm_hospital', nameAr: 'مستشفى الباجور العام', areaAr: 'شارع المستشفى', isRural: false, distanceFromCenterKm: 2.1, lat: 30.4346, lng: 31.0286 },
  { id: 'lm_council', nameAr: 'مجلس مدينة الباجور', areaAr: 'شارع الجمهورية', isRural: false, distanceFromCenterKm: 1.2, lat: 30.4314, lng: 31.0322 },
  { id: 'lm_banque_misr', nameAr: 'شارع الجمهورية - أمام بنك مصر', areaAr: 'وسط البلد', isRural: false, distanceFromCenterKm: 1.6, lat: 30.4319, lng: 31.0332 },
  { id: 'lm_masaken', nameAr: 'منطقة المساكن الشعبية', areaAr: 'شرق الباجور', isRural: false, distanceFromCenterKm: 2.4, lat: 30.4292, lng: 31.0412 },
  { id: 'lm_mawqaf', nameAr: 'مجمع مواقف الباجور الجديد', areaAr: 'مدخل المدينة', isRural: false, distanceFromCenterKm: 2.0, lat: 30.4272, lng: 31.0384 },
  { id: 'lm_kafr_bagour', nameAr: 'قرية كفر الباجور', areaAr: 'القرى الجنوبية', isRural: true, distanceFromCenterKm: 3.2, lat: 30.4152, lng: 31.0241 },
  { id: 'lm_shantana', nameAr: 'قرية شنتنا الحجر', areaAr: 'القرى الشمالية', isRural: true, distanceFromCenterKm: 5.2, lat: 30.4648, lng: 31.0524 },
  { id: 'lm_grawan', nameAr: 'قرية جروان', areaAr: 'القرى الجنوبية', isRural: true, distanceFromCenterKm: 4.5, lat: 30.3914, lng: 31.0168 },
  { id: 'lm_meet_afif', nameAr: 'قرية ميت عفيف', areaAr: 'القرى الشمالية', isRural: true, distanceFromCenterKm: 6.0, lat: 30.4536, lng: 31.0442 },
  { id: 'lm_subk_eldahhak', nameAr: 'قرية سبك الضحاك', areaAr: 'القرى الشرقية', isRural: true, distanceFromCenterKm: 7.0, lat: 30.4388, lng: 31.0924 },
  { id: 'lm_shebin_uni', nameAr: 'جامعة المنوفية - شبين الكوم', areaAr: 'ربط المراكز', isRural: false, distanceFromCenterKm: 11.0, lat: 30.5586, lng: 31.0112 },
];

export const DEMO_PERSONAS: DemoUser[] = [
  {
    id: 'usr_cust_1',
    name: 'أحمد سعيد المنوفي',
    phone: '01012345678',
    role: 'customer',
    roleBadgeAr: 'عميل مشوار',
    avatar: '👨‍💼',
  },
  {
    id: 'usr_capt_1',
    name: 'كابتن محمود الصياد',
    phone: '01198765432',
    role: 'captain',
    roleBadgeAr: 'كابتن توصيل ومشاوير',
    avatar: '🛵',
    vehicleInfo: 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
    captainRecordId: 'cpt_02',
  },
  {
    id: 'usr_merch_basha',
    name: 'الحاج سعيد الباشا',
    phone: '01233445566',
    role: 'merchant',
    roleBadgeAr: 'تاجر (مطعم ومشاوي الباشا)',
    avatar: '🍖',
    merchantId: 'merchant_basha',
  },
  {
    id: 'usr_merch_amana',
    name: 'د. مريم عبد الرحمن',
    phone: '01099887766',
    role: 'merchant',
    roleBadgeAr: 'تاجر (صيدلية الأمانة الكبرى)',
    avatar: '💊',
    merchantId: 'merchant_amana',
  },
  {
    id: 'usr_merch_khairat',
    name: 'أستاذ طارق الشاذلي',
    phone: '01555667788',
    role: 'merchant',
    roleBadgeAr: 'تاجر (سوبرماركت خيرات الباجور)',
    avatar: '🛒',
    merchantId: 'merchant_khairat',
  },
];

const INITIAL_STORES: StoreItem[] = [
  {
    id: 'merchant_basha',
    nameAr: 'مطعم ومشاوي الباشا',
    category: 'restaurant',
    categoryAr: 'مشويات وفطائر شرقية',
    ownerName: 'الحاج سعيد الباشا',
    phone: '01233445566',
    address: 'شارع الجمهورية - أمام بنك مصر، الباجور',
    landmark: 'أمام بنك مصر',
    rating: 4.9,
    reviewsCount: 342,
    deliveryTimeEst: '٢٠ - ٣٠ دقيقة',
    deliveryFeeEgp: 15,
    minOrderEgp: 50,
    isOpen: true,
    distanceKm: 1.4,
    lat: 30.4319,
    lng: 31.0332,
    zoneCluster: 'bagour_republic',
    badgeAr: 'الأكثر طلباً بالباجور',
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'merchant_amana',
    nameAr: 'صيدلية الأمانة الكبرى',
    category: 'pharmacy',
    categoryAr: 'أدوية ومستلزمات طبية وعناية',
    ownerName: 'د. مريم عبد الرحمن',
    phone: '01099887766',
    address: 'ميدان المحطة - بجوار مستشفى الباجور العام',
    landmark: 'ميدان المحطة',
    rating: 4.95,
    reviewsCount: 518,
    deliveryTimeEst: '١٠ - ٢٠ دقيقة',
    deliveryFeeEgp: 15,
    minOrderEgp: 25,
    isOpen: true,
    distanceKm: 1.1,
    lat: 30.4328,
    lng: 31.0339,
    zoneCluster: 'bagour_station',
    badgeAr: 'توصيل فوري ٢٤ ساعة',
    image: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'merchant_khairat',
    nameAr: 'سوبرماركت خيرات الباجور',
    category: 'supermarket',
    categoryAr: 'بقالة، ألبان، خضروات ومجمدات',
    ownerName: 'أستاذ طارق الشاذلي',
    phone: '01555667788',
    address: 'شارع الجيش - برج الشروق، الباجور',
    landmark: 'برج الشروق',
    rating: 4.8,
    reviewsCount: 215,
    deliveryTimeEst: '١٥ - ٢٥ دقيقة',
    deliveryFeeEgp: 15,
    minOrderEgp: 40,
    isOpen: true,
    distanceKm: 0.9,
    lat: 30.4305,
    lng: 31.0315,
    zoneCluster: 'bagour_gaish',
    badgeAr: 'أسعار الجملة',
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
  },
];

const INITIAL_PRODUCTS: ProductItem[] = [
  // 1. مطعم ومشاوي الباشا (merchant_basha)
  {
    id: 'prod_basha_1',
    storeId: 'merchant_basha',
    nameAr: 'وجبة نصف فرخة مشوية على الفحم',
    descriptionAr: 'تقدم مع أرز بسمتي بالمكسرات، سلطة خضراء، طحينة وعيش بلدي ساخن',
    priceEgp: 145,
    categoryName: 'المشويات',
    isAvailable: true,
    unit: 'وجبة',
  },
  {
    id: 'prod_basha_2',
    storeId: 'merchant_basha',
    nameAr: 'طبق كباب وكفتة ضاني (ربع كيلو)',
    descriptionAr: 'كباب وكفتة ضاني بلدي مشوية على الفحم مع بطاطس محمرة وسلطات',
    priceEgp: 175,
    categoryName: 'المشويات',
    isAvailable: true,
    unit: 'طبق',
  },
  {
    id: 'prod_basha_3',
    storeId: 'merchant_basha',
    nameAr: 'فطيرة مشلتت فلاحي بالسمن البلدي',
    descriptionAr: 'فطير فلاحي مورق مخبوز طازجاً يقدم مع عسل أسود وجبنة قديمة وقشطة',
    priceEgp: 110,
    categoryName: 'الفطائر الشرقية',
    isAvailable: true,
    unit: 'فطيرة وسط',
  },
  {
    id: 'prod_basha_4',
    storeId: 'merchant_basha',
    nameAr: 'حواوشي الباشا المخصوص بالجبنة الموتزاريلا',
    descriptionAr: 'رغيف حواوشي لحم بلدي متبل بالخلطة السرية والجبنة الموتزاريلا',
    priceEgp: 75,
    categoryName: 'السندوتشات',
    isAvailable: true,
    unit: 'رغيف كبير',
  },

  // 2. صيدلية الأمانة الكبرى (merchant_amana)
  {
    id: 'prod_amana_1',
    storeId: 'merchant_amana',
    nameAr: 'بانادول إكسترا (Panadol Extra)',
    descriptionAr: 'مسكن فعال للصداع والآلام وخافض للحرارة - علبة ٢٤ قرص',
    priceEgp: 55,
    categoryName: 'مسكنات وعناية',
    isAvailable: true,
    unit: 'علبة',
  },
  {
    id: 'prod_amana_2',
    storeId: 'merchant_amana',
    nameAr: 'فيتامين سي فوار ١٠٠٠ مجم (C-Retard)',
    descriptionAr: 'مكمل غذائي لدعم المناعة ونزلات البرد',
    priceEgp: 65,
    categoryName: 'فيتامينات',
    isAvailable: true,
    unit: 'أنبوبة',
  },
  {
    id: 'prod_amana_3',
    storeId: 'merchant_amana',
    nameAr: 'حفاضات أطفال بيبي جوي مقاس ٤ (عبوة التوفير)',
    descriptionAr: 'حفاضات أطفال فائقة الامتصاص - عبوة ٤٠ قطعة',
    priceEgp: 260,
    categoryName: 'عناية الطفل',
    isAvailable: true,
    unit: 'عبوة',
  },
  {
    id: 'prod_amana_4',
    storeId: 'merchant_amana',
    nameAr: 'حقيبة إسعافات أولية منزلية متكاملة',
    descriptionAr: 'شاش طبي، مطهر بيتادين، قطن، لاصق جروح، ومقياس حرارة رقمي',
    priceEgp: 190,
    categoryName: 'مستلزمات طبية',
    isAvailable: true,
    unit: 'حقيبة',
  },

  // 3. سوبرماركت خيرات الباجور (merchant_khairat)
  {
    id: 'prod_khairat_1',
    storeId: 'merchant_khairat',
    nameAr: 'كرتونة بيض أحمر مزارع طازج (٣٠ بيضة)',
    descriptionAr: 'بيض مزارع طازج إنتاج اليوم مفروز بعناية',
    priceEgp: 155,
    categoryName: 'الألبان والبيض',
    isAvailable: true,
    unit: 'طبق ٣٠ بيضة',
  },
  {
    id: 'prod_khairat_2',
    storeId: 'merchant_khairat',
    nameAr: 'أرز مصري فاخر عريض الحبة (شيكارة ٥ كجم)',
    descriptionAr: 'أرز مصري أبيض نقي درجة أولى خالي من الكسر',
    priceEgp: 165,
    categoryName: 'البقالة الجافة',
    isAvailable: true,
    unit: 'شيكارة ٥ كجم',
  },
  {
    id: 'prod_khairat_3',
    storeId: 'merchant_khairat',
    nameAr: 'جبنة براميلي دمياطي بالقشطة (نصف كيلو)',
    descriptionAr: 'جبنة بيضاء طبيعية ١٠٠٪ بخير مزارع المنوفية',
    priceEgp: 95,
    categoryName: 'الألبان والجبن',
    isAvailable: true,
    unit: '٥٠٠ جرام',
  },
  {
    id: 'prod_khairat_4',
    storeId: 'merchant_khairat',
    nameAr: 'زيت عباد الشمس نقي للقلي والطبخ (٢.٢ لتر)',
    descriptionAr: 'زيت عباد شمس صافي خفيف وصحي للأسرة',
    priceEgp: 185,
    categoryName: 'الزيوت والسمن',
    isAvailable: true,
    unit: 'زجاجة عائلية',
  },
];

const INITIAL_CAPTAINS: FleetCaptainItem[] = [
  {
    id: 'cpt_01',
    userId: 'usr_cpt_01',
    name: 'أحمد فتحي الديب',
    phone: '01012345671',
    vehicleType: 'موتوسيكل هوجان ١٥٠',
    plateNumber: 'م ن ف ٤٨١٢',
    status: 'active',
    statusAr: 'اشتراك نشط',
    daysRemaining: 18,
    cashHoldingPiasters: 25000, // 250.00 EGP
    cashCeilingPiasters: 100000, // 1,000.00 EGP
    rating: 4.9,
    isOnline: true,
    isFamilyTrusted: true,
    completedToday: 6,
  },
  {
    id: 'cpt_02',
    userId: 'usr_capt_1',
    name: 'كابتن محمود الصياد',
    phone: '01198765432',
    vehicleType: 'سكوتر بينيلي أسود',
    plateNumber: 'م ن ف ٤٩٢١',
    status: 'grace_period',
    statusAr: 'مهلة سماح (٦٠ ساعة)',
    daysRemaining: 2,
    cashHoldingPiasters: 45000, // 450.00 EGP
    cashCeilingPiasters: 100000,
    rating: 4.92,
    isOnline: true,
    isFamilyTrusted: true,
    completedToday: 4,
  },
  {
    id: 'cpt_03',
    userId: 'usr_cpt_03',
    name: 'طارق عبد المنعم الشيخ',
    phone: '01234567893',
    vehicleType: 'سيارة سوزوكي فان بضائع',
    plateNumber: 'م ن ف ٧٢١٤',
    status: 'expired',
    statusAr: 'اشتراك منتهي (الرادار معلق)',
    daysRemaining: 0,
    cashHoldingPiasters: 12000, // 120.00 EGP
    cashCeilingPiasters: 100000,
    rating: 4.6,
    isOnline: false,
    isFamilyTrusted: false,
    completedToday: 0,
  },
  {
    id: 'cpt_04',
    userId: 'usr_cpt_04',
    name: 'مصطفى كمال النجار',
    phone: '01098765434',
    vehicleType: 'موتوسيكل بوكسر',
    plateNumber: 'م ن ف ٦٣٢٨',
    status: 'suspended',
    statusAr: 'موقوف لتجاوز سقف النقدية',
    daysRemaining: 20,
    cashHoldingPiasters: 102000, // 1,020.00 EGP > 1,000.00 EGP ceiling
    cashCeilingPiasters: 100000,
    rating: 4.8,
    isOnline: false,
    isFamilyTrusted: false,
    completedToday: 8,
  },
];

const INITIAL_ORDERS: MarketplaceOrder[] = [
  {
    id: 'ord_seed_1',
    orderNumber: 'MSH-9401',
    serviceType: 'restaurant_store',
    serviceTypeAr: 'طلبات مطاعم ومتاجر',
    vehicleCategory: 'scooter',
    storeId: 'merchant_basha',
    storeName: 'مطعم ومشاوي الباشا',
    storeAddress: 'شارع الجمهورية - أمام بنك مصر، الباجور',
    pickupAddress: 'شارع الجمهورية - أمام بنك مصر، الباجور',
    deliveryAddress: 'شارع الجيش - برج الشروق، الدور الرابع، الباجور',
    distanceKm: 1.8,
    estimatedMinutes: '١٨ - ٢٢ دقيقة',
    estimatedDuration: 18,
    estimatedDurationMinutes: 18,
    isRural: false,
    customerId: 'usr_cust_1',
    customerName: 'أحمد سعيد المنوفي',
    customerPhone: '01012345678',
    items: [
      {
        productId: 'prod_basha_1',
        productName: 'وجبة نصف فرخة مشوية على الفحم',
        quantity: 1,
        unitPriceEgp: 145,
      },
      {
        productId: 'prod_basha_4',
        productName: 'حواوشي الباشا المخصوص بالجبنة الموتزاريلا',
        quantity: 2,
        unitPriceEgp: 75,
      },
    ],
    itemDescription: '١× وجبة نصف فرخة مشوية + ٢× حواوشي الباشا المخصوص',
    subtotalEgp: 295,
    deliveryFeeEgp: 15,
    platformFeeEgp: 2,
    ruralSurchargeEgp: 0,
    totalEgp: 312,
    totalFarePiasters: 31200,
    paymentMethod: 'cash',
    status: 'accepted_by_store',
    assignedCaptainId: 'usr_capt_1',
    assignedCaptainName: 'كابتن محمود الصياد',
    assignedCaptainPhone: '01198765432',
    assignedCaptainVehicle: 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
    assignedCaptainRating: 4.92,
    createdAt: formatArabicClockTime(new Date(Date.now() - 8 * 60 * 1000)),
    createdAtDate: new Date(Date.now() - 8 * 60 * 1000),
    acceptedAt: formatArabicClockTime(new Date(Date.now() - 5 * 60 * 1000)),
    acceptedAtIso: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    notes: 'يرجى زيادة الطحينة والخبز الساخن',
  },
  {
    id: 'ord_bagour_8102',
    orderNumber: 'MSH-8102',
    serviceType: 'package',
    serviceTypeAr: 'توصيل طرد وأمانات',
    vehicleCategory: 'motorcycle',
    storeId: 'direct_package',
    storeName: 'مشوار طرود وأمانات مباشر',
    storeAddress: 'مستشفى الباجور العام - قسم الاستقبال',
    pickupAddress: 'مستشفى الباجور العام - قسم الاستقبال',
    deliveryAddress: 'قرية شنتنا الحجر - المدخل القبلي',
    distanceKm: 4.8,
    estimatedMinutes: '١٥ - ٢٠ دقيقة',
    estimatedDuration: 15,
    estimatedDurationMinutes: 15,
    isRural: true,
    customerId: 'usr_cust_02',
    customerName: 'د. سحر عبد الحميد',
    customerPhone: '01244455582',
    items: [
      {
        productId: 'pkg_medical',
        productName: 'حقيبة مستلزمات وأدوية طبية عاجلة',
        quantity: 1,
        unitPriceEgp: 0,
      },
    ],
    itemDescription: 'مستلزمات وأدوية عاجلة إلى شنتنا الحجر',
    subtotalEgp: 0,
    deliveryFeeEgp: 28,
    platformFeeEgp: 2,
    ruralSurchargeEgp: 5,
    totalEgp: 35,
    totalFarePiasters: 3500,
    paymentMethod: 'cash',
    status: 'in_transit',
    assignedCaptainId: 'cpt_01',
    assignedCaptainName: 'أحمد فتحي الديب',
    assignedCaptainPhone: '01012345671',
    assignedCaptainVehicle: 'موتوسيكل هوجان ١٥٠ • م ن ف ٤٨١٢',
    assignedCaptainRating: 4.9,
    createdAt: formatArabicClockTime(new Date(Date.now() - 35 * 60 * 1000)),
    createdAtDate: new Date(Date.now() - 35 * 60 * 1000),
    acceptedAt: formatArabicClockTime(new Date(Date.now() - 28 * 60 * 1000)),
    acceptedAtIso: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    pickedUpAt: formatArabicClockTime(new Date(Date.now() - 15 * 60 * 1000)),
    notes: 'تسليم عاجل للصيدلي المناوب في شنتنا الحجر',
  },
  {
    id: 'ord_bagour_8103',
    orderNumber: 'MSH-8103',
    serviceType: 'errand',
    serviceTypeAr: 'مشوار خاص وتخليص فوري',
    vehicleCategory: 'scooter',
    storeId: 'direct_errand',
    storeName: 'مشوار خاص سريع بالباجور',
    storeAddress: 'ميدان المحطة - وسط الباجور',
    pickupAddress: 'ميدان المحطة - وسط الباجور',
    deliveryAddress: 'شارع الجيش - برج الشروق، الباجور',
    distanceKm: 1.5,
    estimatedMinutes: '١٠ - ١٤ دقيقة',
    estimatedDuration: 12,
    estimatedDurationMinutes: 12,
    isRural: false,
    customerId: 'usr_cust_03',
    customerName: 'م. إسلام عاشور',
    customerPhone: '01133344493',
    items: [
      {
        productId: 'errand_item',
        productName: 'استلام مظروف مستندات هندسية وتوصيله لبرج الشروق',
        quantity: 1,
        unitPriceEgp: 0,
      },
    ],
    itemDescription: 'استلام مظروف مستندات هندسية وتوصيله لبرج الشروق',
    subtotalEgp: 0,
    deliveryFeeEgp: 15,
    platformFeeEgp: 2,
    ruralSurchargeEgp: 0,
    totalEgp: 17,
    totalFarePiasters: 1700,
    paymentMethod: 'cash',
    status: 'searching_captain',
    createdAt: formatArabicClockTime(new Date(Date.now() - 6 * 60 * 1000)),
    createdAtDate: new Date(Date.now() - 6 * 60 * 1000),
    notes: 'بانتظار أقرب كابتن في ميدان المحطة',
  },
  {
    id: 'ord_bagour_8101',
    orderNumber: 'MSH-8101',
    serviceType: 'package',
    serviceTypeAr: 'توصيل طرد وأمانات',
    vehicleCategory: 'motorcycle',
    storeId: 'direct_package',
    storeName: 'مشوار طرود وأمانات مباشر',
    storeAddress: 'ميدان المحطة - وسط الباجور',
    pickupAddress: 'ميدان المحطة - وسط الباجور',
    deliveryAddress: 'قرية كفر الباجور - بجوار المسجد الكبير',
    distanceKm: 3.2,
    estimatedMinutes: '١٥ - ٢٠ دقيقة',
    estimatedDuration: 15,
    estimatedDurationMinutes: 15,
    isRural: true,
    customerId: 'usr_cust_1',
    customerName: 'أحمد سعيد المنوفي',
    customerPhone: '01012345678',
    items: [
      {
        productId: 'pkg_docs',
        productName: 'طرد أوراق رسمية وعقود موثقة',
        quantity: 1,
        unitPriceEgp: 0,
      },
    ],
    itemDescription: 'طرد أوراق رسمية وعقود موثقة إلى كفر الباجور',
    subtotalEgp: 0,
    deliveryFeeEgp: 23,
    platformFeeEgp: 2,
    ruralSurchargeEgp: 5,
    totalEgp: 30,
    totalFarePiasters: 3000,
    paymentMethod: 'cash',
    status: 'delivered',
    assignedCaptainId: 'usr_capt_1',
    assignedCaptainName: 'كابتن محمود الصياد',
    assignedCaptainPhone: '01198765432',
    assignedCaptainVehicle: 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
    assignedCaptainRating: 4.92,
    createdAt: '٠٩:١٥ ص',
    createdAtDate: new Date(Date.now() - 120 * 60 * 1000),
    acceptedAt: '٠٩:١٧ ص',
    acceptedAtIso: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
    deliveredAt: '٠٩:٣٦ ص',
    notes: 'تم التسليم والتحصيل كاش بنجاح',
  },
];

// ============================================================================
// 4. CONTEXT DEFINITION
// ============================================================================

interface SubmitRideOrPackageInput {
  serviceType: 'errand' | 'package' | 'ride';
  vehicleCategory: 'tuktuk' | 'car' | 'scooter' | 'motorcycle' | 'van';
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  isRural: boolean;
  itemDescription: string;
  recipientPhone: string;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
  notes?: string;
  scheduled_for?: string | null;
  hasVoiceNote?: boolean;
  voiceNoteDurationSec?: number;
  voiceNoteTranscript?: string;
  driverTipEgp?: number;
  cashChangeForEgp?: CashChangeOptionEgp;
  promoCode?: string;
  discountEgp?: number;
  requiresFamilyTrustedDriver?: boolean;
  quoteData?: {
    quoteId: string;
    signature: string;
    baseFarePiasters: number;
    distanceFarePiasters: number;
    ruralSurchargePiasters: number;
    platformFeePiasters: number;
    totalFarePiasters: number;
    estimatedDurationMinutes: string;
  };
}

export interface CartStoreGroup {
  store: StoreItem;
  items: CartItem[];
  subtotalEgp: number;
}

interface MarketplaceContextType {
  // Active Auth Persona & Firebase User
  currentUser: DemoUser;
  firebaseUser: User | null;
  isFirestoreRealtimeActive: boolean;
  isFirestoreStoresLive: boolean;
  switchDemoUser: (user: DemoUser) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;

  // Stores & Products
  stores: StoreItem[];
  toggleStoreStatus: (storeId: string) => void;
  products: ProductItem[];
  toggleProductAvailability: (productId: string) => void;
  updateProductPrice: (productId: string, newPriceEgp: number) => void;

  // Favorites List
  favoriteProductIds: string[];
  favoriteStoreIds: string[];
  favoriteServiceKeys: string[];
  toggleFavoriteProduct: (productId: string) => void;
  toggleFavoriteStore: (storeId: string) => void;
  toggleFavoriteService: (serviceKey: string) => void;
  isFavoriteProduct: (productId: string) => boolean;
  isFavoriteStore: (storeId: string) => boolean;
  isFavoriteService: (serviceKey: string) => boolean;

  // Customer Multi-Stop Combined Cart (up to 4 stores in 1 trip)
  cartItems: CartItem[];
  cartStoreId: string | null;
  cartStoreIds: string[];
  cartStoreGroups: CartStoreGroup[];
  cartMultiStopSavingsEgp: number;
  cartProximityKm: number;
  cartProximitySavedEgp: number;
  cartDeliveryFeeBreakdownAr: string;
  addToCart: (product: ProductItem, store: StoreItem) => { success: boolean; conflictStore?: string; limitReached?: boolean };
  addExtractedItemsToCart: (
    storeId: string,
    extractedItems: { nameAr: string; quantity?: string; unit?: string; notes?: string; priceEgp?: number }[]
  ) => { addedCount: number; limitReached?: boolean };
  removeFromCart: (productId: string) => void;
  updateCartItemQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  forceAddToCartNewStore: (product: ProductItem, store: StoreItem) => void;
  cartSubtotalEgp: number;
  cartDeliveryFeeEgp: number;
  cartPlatformFeeEgp: number;
  cartTotalEgp: number;

  // Orders & Lifecycle Progression
  orders: MarketplaceOrder[];
  submitNewOrder: (params: {
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    hasVoiceNote?: boolean;
    voiceNoteDurationSec?: number;
    voiceNoteTranscript?: string;
    driverTipEgp?: number;
    cashChangeForEgp?: CashChangeOptionEgp;
    promoCode?: string;
    discountEgp?: number;
  }) => MarketplaceOrder | null;
  submitDirectStoreOrder: (params: {
    storeId: string;
    items: { product: ProductItem; quantity: number }[];
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    hasVoiceNote?: boolean;
    voiceNoteDurationSec?: number;
    voiceNoteTranscript?: string;
    driverTipEgp?: number;
    cashChangeForEgp?: CashChangeOptionEgp;
    promoCode?: string;
    discountEgp?: number;
  }) => MarketplaceOrder | null;
  submitPrescriptionOrder: (params: {
    storeId: string;
    extractedItems: string[];
    prescriptionSummary: string;
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    voiceNoteTranscript?: string;
    cashChangeForEgp?: CashChangeOptionEgp;
    driverTipEgp?: number;
  }) => MarketplaceOrder | null;
  submitRideOrPackageOrder: (params: SubmitRideOrPackageInput) => MarketplaceOrder;
  simulateInstantCaptainAccept: (orderId: string) => void;
  customerCancelOrder: (orderId: string, reason?: string) => void;
  customerApproveOrderQuote: (orderId: string) => void;
  rateOrderCaptain: (orderId: string, rating: number) => void;
  updateOrderNotes: (orderId: string, orderNotes: string) => void;
  updateOrderFeedback: (orderId: string, feedback: string) => void;
  updateOrderDriverTip: (orderId: string, tipEgp: number) => void;
  driverRatings: DriverRatingEntry[];
  submitDriverReview: (
    orderId: string,
    input: { rating: number; tags: string[]; feedback: string }
  ) => Promise<void>;

  // Merchant Actions
  merchantAcceptOrder: (orderId: string) => void;
  merchantSubmitOrderQuote: (orderId: string, quoteTotalEgp: number, quoteNotes?: string) => void;
  merchantMarkReady: (orderId: string) => void;
  merchantRejectOrder: (orderId: string, reason?: string) => void;

  // Captain State & Actions
  isCaptainOnline: boolean;
  setIsCaptainOnline: (online: boolean) => void;
  captainEarningsEgp: number;
  captainCompletedDeliveries: number;
  captainCashHoldingEgp: number;
  captainAcceptDelivery: (orderId: string) => { success: boolean; messageAr?: string };
  captainVerifyRidePinAndStart: (orderId: string, enteredPin: string) => { success: boolean; messageAr: string };
  captainUpdateStep: (orderId: string, nextStatus: 'at_pickup' | 'picked_up' | 'in_transit' | 'delivered') => void;
  captainConfirmCashCollection: (orderId: string) => void;

  // Customer Wallet, Proof Verification & Promos/Referrals
  customerWalletBalanceEgp: number;
  walletTransactions: WalletTransaction[];
  topUpCustomerWallet: (amountEgp: number, methodAr: string) => void;
  topUpCustomerWalletWithProof: (
    amountEgp: number,
    methodAr: string,
    proofRef: string
  ) => Promise<{ success: boolean; messageAr: string }>;
  referralCode: string;
  referredByCode: string | null;
  applyPromoCode: (
    code: string,
    orderTotalEgp: number
  ) => Promise<{ valid: boolean; code: string; discountEgp: number; titleAr: string; errorAr?: string }>;
  redeemReferralCode: (code: string) => { success: boolean; messageAr: string };

  // Daily Village-to-Center Commute Subscriptions
  commuteSubscriptions: CommuteSubscriptionItem[];
  createCommuteSubscription: (input: {
    fromLandmark: string;
    toLandmark: string;
    scheduleDays: string[];
    morningTime: string;
    returnTime?: string;
    vehicleTier: 'tuktuk' | 'car';
    planType: 'weekly' | 'monthly';
  }) => { success: boolean; subscription?: CommuteSubscriptionItem; errorAr?: string };
  toggleCommuteSubscriptionStatus: (subId: string) => void;
  advanceCommuteSlotStatus: (subId: string, slotId: string) => void;
  toggleSkipCommuteSlot: (subId: string, slotId: string) => void;

  // Loyalty Points & Cashback System
  loyaltyPoints: number;
  loyaltyCashbackBalanceEgp: number;
  loyaltyTier: LoyaltyTier;
  loyaltyTierLabelAr: string;
  loyaltyDeliveryPercent: number;
  loyaltyRidePercent: number;
  nextTierPointsTarget: number | null;
  loyaltyHistory: LoyaltyCashbackEntry[];
  redeemLoyaltyCashbackToWallet: () => { success: boolean; transferredEgp: number };
  awardLoyaltyForOrder: (orderId: string) => void;

  // Notifications & Support Complaints
  notifications: AppNotification[];
  markAllNotificationsRead: () => void;
  captainNotifications: CaptainInAppNotification[];
  latestCaptainAlert: CaptainInAppNotification | null;
  dismissLatestCaptainAlert: () => void;
  markCaptainNotificationRead: (notifId: string) => void;
  markAllCaptainNotificationsRead: () => void;
  captainCustomSound: CaptainAlertSoundType;
  updateCaptainCustomSound: (sound: CaptainAlertSoundType) => void;
  simulateElBagourCaptainDispatchAlert: () => CaptainInAppNotification;
  complaints: SupportComplaint[];
  submitComplaint: (input: {
    orderNumber?: string;
    categoryAr: string;
    subjectAr: string;
    descriptionAr: string;
  }) => SupportComplaint;

  // Unified Fleet Captains, System Settings & Audit Logs (Shared with Operations Dashboard)
  captains: FleetCaptainItem[];
  systemSettings: PlatformSystemSettings;
  auditLogs: PlatformAuditLog[];
  adminAssignCaptain: (orderId: string, captainId: string, actorName: string, actorRole: string) => { success: boolean; message: string };
  adminEmergencyCancelOrder: (orderId: string, reason: string, actorName: string, actorRole: string) => { success: boolean; message: string };
  adminSettleCaptainCash: (
    captainId: string,
    amountPiasters: number,
    actorName: string,
    actorRole: string,
    settlementReference?: string
  ) => { success: boolean; message: string; remittedAmountPiasters?: number; remainingCashPiasters?: number };
  adminRenewCaptainSubscription: (captainId: string, actorName: string, actorRole: string) => void;
  adminToggleCaptainFamilyTrusted: (captainId: string, actorName: string, actorRole: string) => void;
  adminUpdateSettings: (newSettings: PlatformSystemSettings, actorName: string, actorRole: string) => void;

  // Chat Messages
  chatMessages: ChatMessage[];
  sendChatMessage: (orderId: string, text: string) => void;
  activeChatThreadId: string | null;
  setActiveChatThreadId: (threadId: string | null) => void;

  // Battery Saver & Adaptive GPS Tracking Rate (< 20% reduces GPS frequency)
  batteryLevelPercent: number;
  hardwareBatterySupported: boolean;
  isCharging: boolean;
  batterySaverPreference: 'auto' | 'always_on' | 'off';
  setBatterySaverPreference: (pref: 'auto' | 'always_on' | 'off') => void;
  simulatedBatteryPercent: number | null;
  setSimulatedBatteryPercent: (percent: number | null) => void;
  isBatteryLow: boolean;
  isBatterySaverActive: boolean;
  gpsUpdateIntervalMs: number;
  gpsHighAccuracy: boolean;
  gpsTrackingLocation: {
    lat: number;
    lng: number;
    accuracyMeters: number | null;
    source: 'gps' | 'bagour_hub';
    lastUpdatedAt: string;
    updatesCount: number;
  };
  forceGpsSyncNow: () => void;

  // Active Customer Order Shortcut & Real-Time Tracking Card State
  activeCustomerOrder: MarketplaceOrder | null;
  activeOrderTrackingCard: {
    order: MarketplaceOrder;
    stageKey: OrderTrackingStageKey;
    stageIndex: number;
    labelAr: string;
    labelEn: string;
    progressPercent: number;
    isCancelled: boolean;
  } | null;
  advanceOrderTrackingStage: (orderId: string) => void;
  refreshOrderStatus: (orderId?: string) => Promise<MarketplaceOrder | null>;
  customerNavTab: 'home' | 'ride_booking' | 'stores' | 'history' | 'profile';
  setCustomerNavTab: (tab: 'home' | 'ride_booking' | 'stores' | 'history' | 'profile') => void;
  navigateToCustomerHistory: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ORDERS: 'mashwar_bagour_orders_v2',
  WALLET_BALANCE: 'mashwar_bagour_wallet_balance_v2',
  WALLET_TX: 'mashwar_bagour_wallet_tx_v2',
  LOYALTY_POINTS: 'mashwar_bagour_loyalty_points_v2',
  LOYALTY_CASHBACK: 'mashwar_bagour_loyalty_cashback_v2',
  LOYALTY_HISTORY: 'mashwar_bagour_loyalty_history_v2',
  FAVORITES: 'mashwar_bagour_favorites_v2',
  COMMUTE_SUBS: 'mashwar_bagour_commute_subs_v2',
  REFERRED_BY: 'mashwar_bagour_referred_by_v1',
  DRIVER_RATINGS: 'mashwar_bagour_driver_ratings_v1',
  BATTERY_PREF: 'mashwar_bagour_battery_pref_v1',
};

function buildTodayCommuteSlots(
  subId: string,
  morningTime: string,
  returnTime?: string
): CommuteSlotItem[] {
  const dateIso = new Date().toISOString().slice(0, 10);
  const slots: CommuteSlotItem[] = [
    {
      id: `${subId}_am_${dateIso.replace(/-/g, '')}`,
      subscriptionId: subId,
      slotType: 'morning_go',
      slotLabelAr: 'رحلة الذهاب الصباحية',
      dateIso,
      scheduledTime: morningTime,
      status: 'scheduled',
      ridePin: generateFourDigitPin(),
    },
  ];
  if (returnTime && returnTime.trim()) {
    slots.push({
      id: `${subId}_pm_${dateIso.replace(/-/g, '')}`,
      subscriptionId: subId,
      slotType: 'evening_return',
      slotLabelAr: 'رحلة العودة المسائية',
      dateIso,
      scheduledTime: returnTime.trim(),
      status: 'scheduled',
      ridePin: generateFourDigitPin(),
    });
  }
  return slots;
}

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<DemoUser>(DEMO_PERSONAS[0]);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirestoreStoresLive, setIsFirestoreStoresLive] = useState<boolean>(false);
  const [firestoreOrderIds, setFirestoreOrderIds] = useState<string[]>([]);
  const [firestoreSubIds, setFirestoreSubIds] = useState<string[]>([]);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [customerNavTab, setCustomerNavTab] = useState<'home' | 'ride_booking' | 'stores' | 'history' | 'profile'>('home');

  // Battery Saver Mode & Adaptive GPS Polling State
  const [hardwareBatterySupported, setHardwareBatterySupported] = useState<boolean>(false);
  const [hardwareBatteryPercent, setHardwareBatteryPercent] = useState<number>(85);
  const [isCharging, setIsCharging] = useState<boolean>(false);
  const [simulatedBatteryPercent, setSimulatedBatteryPercent] = useState<number | null>(null);
  const [batterySaverPreference, setBatterySaverPreference] = useState<'auto' | 'always_on' | 'off'>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.BATTERY_PREF) : null;
      if (saved === 'auto' || saved === 'always_on' || saved === 'off') return saved;
    } catch {
      // Fallback
    }
    return 'auto';
  });
  const [gpsTrackingLocation, setGpsTrackingLocation] = useState<{
    lat: number;
    lng: number;
    accuracyMeters: number | null;
    source: 'gps' | 'bagour_hub';
    lastUpdatedAt: string;
    updatesCount: number;
  }>({
    lat: 30.4312,
    lng: 31.0365,
    accuracyMeters: 18,
    source: 'bagour_hub',
    lastUpdatedAt: formatArabicClockTime(new Date()),
    updatesCount: 1,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

  const [stores, setStores] = useState<StoreItem[]>(INITIAL_STORES);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [orders, setOrders] = useState<MarketplaceOrder[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.ORDERS) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((o: any) => ({
            ...o,
            status: o.status === 'merchant_accepted' ? 'accepted_by_store' : o.status,
            createdAtDate: o.createdAtDate ? new Date(o.createdAtDate) : new Date(),
          }));
        }
      }
    } catch {
      // Fallback to INITIAL_ORDERS
    }
    return INITIAL_ORDERS;
  });

  // Multi-Stop Combined Cart state (up to 4 stores in 1 combined delivery trip)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Favorites state (persisted in localStorage)
  const [favoritesState, setFavoritesState] = useState<{
    productIds: string[];
    storeIds: string[];
    serviceKeys: string[];
  }>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.FAVORITES) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            productIds: Array.isArray(parsed.productIds) ? parsed.productIds : [],
            storeIds: Array.isArray(parsed.storeIds) ? parsed.storeIds : [],
            serviceKeys: Array.isArray(parsed.serviceKeys) ? parsed.serviceKeys : [],
          };
        }
      }
    } catch {
      // Fallback
    }
    return {
      productIds: ['prod_basha_1'],
      storeIds: ['merchant_basha'],
      serviceKeys: ['ride_tuktuk'],
    };
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favoritesState));
      }
    } catch {
      // Ignore storage errors
    }
  }, [favoritesState]);

  const toggleFavoriteProduct = (productId: string) => {
    setFavoritesState((prev) => {
      const exists = prev.productIds.includes(productId);
      return {
        ...prev,
        productIds: exists
          ? prev.productIds.filter((id) => id !== productId)
          : [productId, ...prev.productIds],
      };
    });
  };

  const toggleFavoriteStore = (storeId: string) => {
    setFavoritesState((prev) => {
      const exists = prev.storeIds.includes(storeId);
      return {
        ...prev,
        storeIds: exists
          ? prev.storeIds.filter((id) => id !== storeId)
          : [storeId, ...prev.storeIds],
      };
    });
  };

  const toggleFavoriteService = (serviceKey: string) => {
    setFavoritesState((prev) => {
      const exists = prev.serviceKeys.includes(serviceKey);
      return {
        ...prev,
        serviceKeys: exists
          ? prev.serviceKeys.filter((k) => k !== serviceKey)
          : [serviceKey, ...prev.serviceKeys],
      };
    });
  };

  const isFavoriteProduct = (productId: string) => favoritesState.productIds.includes(productId);
  const isFavoriteStore = (storeId: string) => favoritesState.storeIds.includes(storeId);
  const isFavoriteService = (serviceKey: string) => favoritesState.serviceKeys.includes(serviceKey);

  // Captain operational metrics
  const [isCaptainOnline, setIsCaptainOnlineState] = useState<boolean>(true);
  const [captainEarningsEgp, setCaptainEarningsEgp] = useState<number>(195);
  const [captainCompletedDeliveries, setCaptainCompletedDeliveries] = useState<number>(8);
  const [captainCashHoldingEgp, setCaptainCashHoldingEgp] = useState<number>(450);

  // Commute Subscriptions (persisted in localStorage, with automated daily slots)
  const [commuteSubscriptions, setCommuteSubscriptions] = useState<CommuteSubscriptionItem[]>(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.COMMUTE_SUBS) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((sub: CommuteSubscriptionItem) => ({
            ...sub,
            slots:
              Array.isArray(sub.slots) && sub.slots.length > 0
                ? sub.slots
                : buildTodayCommuteSlots(sub.id, sub.morningTime, sub.returnTime),
          }));
        }
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'sub_seed_1',
        fromLandmark: 'قرية كفر الباجور',
        toLandmark: 'جامعة المنوفية - شبين الكوم',
        scheduleDays: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
        morningTime: '07:45',
        returnTime: '14:30',
        vehicleTier: 'car',
        planType: 'weekly',
        priceEgp: 420,
        status: 'active',
        createdAtAr: 'منذ يومين',
        slots: [
          {
            id: `sub_seed_1_am_${todayIso.replace(/-/g, '')}`,
            subscriptionId: 'sub_seed_1',
            slotType: 'morning_go',
            slotLabelAr: 'رحلة الذهاب الصباحية',
            dateIso: todayIso,
            scheduledTime: '07:45',
            status: 'driver_assigned',
            captainName: 'كابتن أحمد فتحي الديب',
            ridePin: '4821',
          },
          {
            id: `sub_seed_1_pm_${todayIso.replace(/-/g, '')}`,
            subscriptionId: 'sub_seed_1',
            slotType: 'evening_return',
            slotLabelAr: 'رحلة العودة المسائية',
            dateIso: todayIso,
            scheduledTime: '14:30',
            status: 'scheduled',
            ridePin: '7390',
          },
        ],
      },
    ];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.COMMUTE_SUBS, JSON.stringify(commuteSubscriptions));
      }
    } catch {
      // Ignore storage errors
    }
  }, [commuteSubscriptions]);

  // Driver Ratings Ledger (persisted locally + live synced via Firestore)
  const [driverRatings, setDriverRatings] = useState<DriverRatingEntry[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.DRIVER_RATINGS) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.DRIVER_RATINGS, JSON.stringify(driverRatings));
      }
    } catch {
      // Ignore storage errors
    }
  }, [driverRatings]);

  // Referral Tracking
  const [referredByCode, setReferredByCode] = useState<string | null>(() => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.REFERRED_BY) : null;
    } catch {
      return null;
    }
  });
  const referralCode = firebaseUser?.uid
    ? `MSH-${firebaseUser.uid.slice(0, 6).toUpperCase()}`
    : 'MSH-BAGOUR1';

  // Customer Wallet State (persisted in localStorage)
  const [customerWalletBalanceEgp, setCustomerWalletBalanceEgp] = useState<number>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.WALLET_BALANCE) : null;
      if (saved !== null) {
        const num = Number(saved);
        if (Number.isFinite(num) && num >= 0) return num;
      }
    } catch {
      // Fallback
    }
    return 245;
  });
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.WALLET_TX) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'wtx_1',
        titleAr: 'شحن رصيد عبر إنستاباي (مرجع موثق)',
        type: 'credit',
        amountEgp: 200,
        methodAr: 'إنستاباي',
        timestampAr: 'أمس • ٠٨:٣٠ م',
      },
      {
        id: 'wtx_2',
        titleAr: 'رصيد ترحيبي لعملاء مركز الباجور',
        type: 'credit',
        amountEgp: 75,
        methodAr: 'مكافأة مشوار',
        timestampAr: 'منذ ٣ أيام',
      },
      {
        id: 'wtx_3',
        titleAr: 'سداد مشوار توصيل طرد #MSH-8101',
        type: 'debit',
        amountEgp: 30,
        methodAr: 'خصم محفظة',
        timestampAr: 'اليوم • ٠٩:٣٦ ص',
        orderNumber: 'MSH-8101',
      },
    ];
  });

  // Loyalty Points & Cashback State (persisted in localStorage)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.LOYALTY_POINTS) : null;
      if (saved !== null) {
        const num = Number(saved);
        if (Number.isFinite(num) && num >= 0) return num;
      }
    } catch {
      // Fallback
    }
    return 125;
  });

  const [loyaltyCashbackBalanceEgp, setLoyaltyCashbackBalanceEgp] = useState<number>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.LOYALTY_CASHBACK) : null;
      if (saved !== null) {
        const num = Number(saved);
        if (Number.isFinite(num) && num >= 0) return num;
      }
    } catch {
      // Fallback
    }
    return 15;
  });

  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyCashbackEntry[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.LOYALTY_HISTORY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [
      {
        id: 'loy_seed_1',
        orderId: 'ord_seed_3',
        orderNumber: 'MSH-8101',
        serviceTypeAr: 'توصيل طرد ومستندات',
        orderTotalEgp: 30,
        cashbackPercent: 3,
        cashbackAmountEgp: 1,
        pointsEarned: 15,
        createdAtAr: 'اليوم • ٠٩:٣٦ ص',
      },
      {
        id: 'loy_welcome',
        orderId: 'welcome_bonus',
        orderNumber: 'WELCOME',
        serviceTypeAr: 'مكافأة انضمام مشوار الباجور',
        orderTotalEgp: 0,
        cashbackPercent: 4,
        cashbackAmountEgp: 14,
        pointsEarned: 110,
        createdAtAr: 'منذ ٣ أيام',
      },
    ];
  });

  // Real-time Firestore scoped listeners when authenticated
  useEffect(() => {
    if (!firebaseUser) {
      setIsFirestoreStoresLive(false);
      return;
    }

    const unsubStores = subscribeToStoresFromFirestore((remoteStores) => {
      if (!remoteStores || remoteStores.length === 0) return;
      setIsFirestoreStoresLive(true);
      setStores((prev) =>
        prev.map((s) => {
          const found = remoteStores.find((rs) => String(rs.id) === s.id);
          if (!found) return s;
          return {
            ...s,
            isOpen: typeof found.isOpen === 'boolean' ? found.isOpen : s.isOpen,
            rating: typeof found.rating === 'number' ? found.rating : s.rating,
            deliveryFeeEgp:
              typeof found.deliveryFeePiasters === 'number'
                ? Math.round(found.deliveryFeePiasters / 100)
                : s.deliveryFeeEgp,
            minOrderEgp:
              typeof found.minOrderPiasters === 'number'
                ? Math.round(found.minOrderPiasters / 100)
                : s.minOrderEgp,
            deliveryTimeEst:
              typeof found.prepTimeText === 'string' && found.prepTimeText
                ? found.prepTimeText
                : s.deliveryTimeEst,
            landmark:
              typeof found.landmark === 'string' && found.landmark ? found.landmark : s.landmark,
            lat: typeof found.lat === 'number' ? found.lat : s.lat,
            lng: typeof found.lng === 'number' ? found.lng : s.lng,
            zoneCluster:
              typeof found.zoneCluster === 'string' && found.zoneCluster
                ? found.zoneCluster
                : s.zoneCluster,
          };
        })
      );
    });

    const unsubRatings = subscribeToDriverRatingsFromFirestore((remoteRatings) => {
      if (!remoteRatings || remoteRatings.length === 0) return;
      const mapped: DriverRatingEntry[] = remoteRatings.map((rr) => {
        const r = rr as Record<string, any>;
        return {
          id: String(r.id || ''),
          orderId: String(r.orderId || ''),
          driverId: String(r.driverId || 'cpt_02'),
          driverName: String(r.driverName || 'كابتن مشوار'),
          rating: Number(r.rating) || 5,
          tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
          feedback: String(r.feedback || ''),
          createdAtAr: 'موثق عبر Firestore',
        };
      });
      setDriverRatings((prev) => {
        const map = new Map<string, DriverRatingEntry>();
        for (const localItem of prev) map.set(localItem.id, localItem);
        for (const remoteItem of mapped) {
          if (remoteItem.id) map.set(remoteItem.id, remoteItem);
        }
        return Array.from(map.values());
      });
    });

    const unsubOrders = subscribeToScopedOrdersInFirestore({
      role: currentUser.role,
      onOrders: (remoteDocs) => {
        if (!remoteDocs || remoteDocs.length === 0) return;
        const remoteIds = remoteDocs.map((d) => String((d as Record<string, any>).id || '')).filter(Boolean);
        setFirestoreOrderIds((prev) => Array.from(new Set([...prev, ...remoteIds])));
        setOrders((prev) => {
          const map = new Map<string, MarketplaceOrder>();
          for (const localOrd of prev) {
            map.set(localOrd.id, localOrd);
          }
          for (const rd of remoteDocs) {
            const r = rd as Record<string, any>;
            const orderIdStr = String(r.id || '');
            if (!orderIdStr) continue;
            const totalEgp = Math.round((Number(r.totalFarePiasters) || 0) / 100);
            const deliveryEgp = Math.round((Number(r.deliveryFeePiasters) || 1500) / 100);
            const platformEgp = Math.round((Number(r.platformFeePiasters) || 200) / 100);
            const subtotalEgp = Math.round((Number(r.subtotalPiasters) || 0) / 100);
            const ruralEgp = Math.round((Number(r.ruralSurchargePiasters) || 0) / 100);
            const tipEgp = Math.round((Number(r.driverTipPiasters) || 0) / 100);
            const discountEgp = Math.round((Number(r.discountPiasters) || 0) / 100);
            const createdDt =
              typeof r.createdAt?.toDate === 'function' ? (r.createdAt.toDate() as Date) : new Date();
            const existing = map.get(orderIdStr);
            const remoteStoreNames: string[] | undefined = Array.isArray(r.storeNames)
              ? r.storeNames.map(String)
              : existing?.storeNames;
            const remoteStoreIds: string[] | undefined = Array.isArray(r.storeIds)
              ? r.storeIds.map(String)
              : existing?.storeIds;
            const resolvedStoreName =
              (typeof r.storeName === 'string' && r.storeName) ||
              (remoteStoreNames && remoteStoreNames.length > 0 ? remoteStoreNames.join(' + ') : '') ||
              existing?.storeName ||
              'متجر الباجور';

            map.set(orderIdStr, {
              id: orderIdStr,
              orderNumber: String(r.orderNumber || existing?.orderNumber || orderIdStr.slice(-8)),
              serviceType: (r.serviceType as OrderServiceType) || existing?.serviceType || 'restaurant_store',
              serviceTypeAr:
                String(r.serviceTypeAr || '') ||
                existing?.serviceTypeAr ||
                (r.serviceType === 'prescription_list' ? 'روشتة / قائمة مقاضي ذكية' : 'طلب مشوار'),
              vehicleCategory: (r.vehicleCategory as MarketplaceOrder['vehicleCategory']) || existing?.vehicleCategory || 'scooter',
              storeId:
                String(r.storeId || '') ||
                (remoteStoreIds && remoteStoreIds[0]) ||
                existing?.storeId ||
                'merchant_basha',
              storeName: resolvedStoreName,
              storeIds: remoteStoreIds,
              storeNames: remoteStoreNames,
              storeAddress: String(r.storeAddress || r.pickupLandmark || r.pickupAddress || existing?.storeAddress || 'مركز الباجور'),
              pickupAddress: String(r.pickupLandmark || r.pickupAddress || existing?.pickupAddress || 'مركز الباجور'),
              deliveryAddress: String(r.dropoffLandmark || r.deliveryAddress || existing?.deliveryAddress || 'الباجور'),
              distanceKm: Number(r.distanceKm) || existing?.distanceKm || 1.8,
              estimatedMinutes: existing?.estimatedMinutes || '١٥ - ٢٥ دقيقة',
              estimatedDuration: existing?.estimatedDuration || 20,
              estimatedDurationMinutes: existing?.estimatedDurationMinutes || 20,
              isRural: Boolean(r.isRural),
              customerId: String(r.customerId || r.customerUid || existing?.customerId || 'usr_cust_1'),
              customerName: String(r.customerName || existing?.customerName || 'عميل مشوار'),
              customerPhone: String(r.customerPhone || existing?.customerPhone || '01012345678'),
              items: Array.isArray(r.items) && r.items.length > 0 ? r.items : existing?.items || [],
              itemDescription: String(r.itemsSummary || r.itemDescription || existing?.itemDescription || 'طلب عبر مشوار'),
              aiExtractedItems: Array.isArray(r.aiExtractedItems) ? r.aiExtractedItems.map(String) : existing?.aiExtractedItems,
              prescriptionSummary:
                typeof r.prescriptionSummary === 'string' ? r.prescriptionSummary : existing?.prescriptionSummary,
              quoteTotalEgp: r.quoteTotalPiasters ? Math.round(Number(r.quoteTotalPiasters) / 100) : existing?.quoteTotalEgp,
              quoteNotes: typeof r.quoteNotes === 'string' ? r.quoteNotes : existing?.quoteNotes,
              subtotalEgp,
              deliveryFeeEgp: deliveryEgp,
              platformFeeEgp: platformEgp,
              ruralSurchargeEgp: ruralEgp,
              discountEgp,
              promoCode: typeof r.promoCode === 'string' ? r.promoCode : existing?.promoCode,
              cashChangeForEgp: (r.cashChangeForEgp as CashChangeOptionEgp) ?? existing?.cashChangeForEgp,
              ridePin: typeof r.ridePin === 'string' ? r.ridePin : existing?.ridePin,
              requiresFamilyTrustedDriver: Boolean(r.requiresFamilyTrustedDriver ?? existing?.requiresFamilyTrustedDriver),
              driverTipEgp: tipEgp,
              totalEgp: totalEgp > 0 ? totalEgp : existing?.totalEgp || 0,
              totalFarePiasters: Number(r.totalFarePiasters) || existing?.totalFarePiasters || 0,
              paymentMethod: (r.paymentMethod as MarketplaceOrder['paymentMethod']) || existing?.paymentMethod || 'cash',
              status: (r.status as OrderStatus) || existing?.status || 'created',
              assignedCaptainId: typeof r.assignedCaptainId === 'string' ? r.assignedCaptainId : existing?.assignedCaptainId,
              assignedCaptainName: typeof r.assignedCaptainName === 'string' ? r.assignedCaptainName : existing?.assignedCaptainName,
              assignedCaptainPhone: typeof r.assignedCaptainPhone === 'string' ? r.assignedCaptainPhone : existing?.assignedCaptainPhone,
              assignedCaptainVehicle: typeof r.assignedCaptainVehicle === 'string' ? r.assignedCaptainVehicle : existing?.assignedCaptainVehicle,
              assignedCaptainRating: existing?.assignedCaptainRating,
              createdAt: existing?.createdAt || formatArabicClockTime(createdDt),
              createdAtDate: existing?.createdAtDate || createdDt,
              acceptedAt: existing?.acceptedAt,
              acceptedAtIso: existing?.acceptedAtIso,
              notes: typeof r.notes === 'string' ? r.notes : existing?.notes,
              scheduled_for:
                (typeof r.scheduledFor === 'string' && r.scheduledFor !== 'now' ? r.scheduledFor : null) ??
                (typeof r.scheduled_for === 'string' ? r.scheduled_for : null) ??
                existing?.scheduled_for ??
                null,
              hasVoiceNote: Boolean(r.hasVoiceNote || r.voiceNoteTranscript || existing?.hasVoiceNote),
              voiceNoteTranscript: String(r.voiceNoteTranscript || existing?.voiceNoteTranscript || ''),
            });
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAtDate).getTime() - new Date(a.createdAtDate).getTime()
          );
        });
      },
    });

    const unsubSubs = subscribeToCommuteSubscriptionsInFirestore((remoteSubs) => {
      if (!remoteSubs || remoteSubs.length === 0) return;
      const remoteSubIds = remoteSubs.map((rs) => String((rs as Record<string, any>).id || '')).filter(Boolean);
      setFirestoreSubIds((prev) => Array.from(new Set([...prev, ...remoteSubIds])));
      setCommuteSubscriptions((prev) => {
        const map = new Map<string, CommuteSubscriptionItem>();
        for (const s of prev) map.set(s.id, s);
        for (const rs of remoteSubs) {
          const sObj = rs as Record<string, any>;
          const subId = String(sObj.id || '');
          if (!subId) continue;
          const prevSub = map.get(subId);
          const mTime = String(sObj.morningTime || '08:00');
          const rTime = String(sObj.returnTime || '');
          map.set(subId, {
            id: subId,
            fromLandmark: String(sObj.fromLandmark || 'مركز الباجور'),
            toLandmark: String(sObj.toLandmark || 'شبين الكوم'),
            scheduleDays: Array.isArray(sObj.scheduleDays) ? sObj.scheduleDays.map(String) : [],
            morningTime: mTime,
            returnTime: rTime,
            vehicleTier: sObj.vehicleTier === 'car' ? 'car' : 'tuktuk',
            planType: sObj.planType === 'monthly' ? 'monthly' : 'weekly',
            priceEgp: Math.round((Number(sObj.pricePiasters) || 0) / 100),
            status: sObj.status === 'paused' ? 'paused' : 'active',
            createdAtAr: 'متزامن لحظياً',
            slots:
              prevSub?.slots && prevSub.slots.length > 0
                ? prevSub.slots
                : buildTodayCommuteSlots(subId, mTime, rTime),
          });
        }
        return Array.from(map.values());
      });
    });

    const seenRemoteNotifIds = new Set<string>();
    let initialNotifSnapshotHandled = false;
    const unsubCaptainNotifs = subscribeToCaptainNotificationsInFirestore((remoteNotifs) => {
      if (!remoteNotifs) return;
      const mapped: CaptainInAppNotification[] = remoteNotifs.map((rn) => {
        const r = rn as Record<string, any>;
        const dt = typeof r.createdAt?.toDate === 'function' ? (r.createdAt.toDate() as Date) : new Date();
        const soundRaw = String(r.soundProfile || 'radar_pulse');
        const soundProfile: CaptainAlertSoundType =
          soundRaw === 'bagour_chime' ||
          soundRaw === 'urgent_dispatch' ||
          soundRaw === 'soft_bell'
            ? soundRaw
            : 'radar_pulse';
        return {
          id: String(r.id || ''),
          orderId: String(r.orderId || ''),
          orderNumber: String(r.orderNumber || 'MSH-LIVE'),
          zoneArea: String(r.zoneArea || 'مركز الباجور'),
          titleAr: String(r.titleAr || 'طلب جديد في الباجور'),
          bodyAr: String(r.bodyAr || 'طلب توصيل جديد جاهز للاستلام'),
          serviceType: (r.serviceType as OrderServiceType) || 'ride',
          estimatedEarningsEgp: Math.round((Number(r.estimatedEarningsPiasters) || 0) / 100),
          soundProfile,
          timeAr: formatArabicClockTime(dt),
          isRead: Boolean(r.isRead),
          source: 'firestore',
        };
      });

      const newlyArrivedUnread = mapped.filter(
        (m) => m.id && !m.isRead && !seenRemoteNotifIds.has(m.id)
      );
      mapped.forEach((m) => {
        if (m.id) seenRemoteNotifIds.add(m.id);
      });

      setCaptainNotifications((prev) => {
        const map = new Map<string, CaptainInAppNotification>();
        for (const item of mapped) {
          if (item.id) map.set(item.id, item);
        }
        for (const localItem of prev) {
          if (localItem.id && !map.has(localItem.id)) {
            map.set(localItem.id, localItem);
          }
        }
        return Array.from(map.values());
      });

      if (initialNotifSnapshotHandled && newlyArrivedUnread.length > 0) {
        const newest = newlyArrivedUnread[0];
        setLatestCaptainAlert(newest);
        playDispatchChime('captain', getCaptainCustomSound());
      }
      initialNotifSnapshotHandled = true;
    });

    return () => {
      unsubStores();
      unsubRatings();
      unsubOrders();
      unsubSubs();
      unsubCaptainNotifs();
    };
  }, [firebaseUser, currentUser.role]);

  // Real-time Firestore Chat Thread Subscription for active order/ride
  useEffect(() => {
    if (!firebaseUser || !activeChatThreadId) return;
    if (!firestoreOrderIds.includes(activeChatThreadId)) return;

    const unsubChat = subscribeToThreadMessagesInFirestore(activeChatThreadId, (remoteMsgs) => {
      if (!remoteMsgs || remoteMsgs.length === 0) return;
      const mapped: ChatMessage[] = remoteMsgs.map((rm) => {
        const r = rm as Record<string, any>;
        const dt = typeof r.createdAt?.toDate === 'function' ? (r.createdAt.toDate() as Date) : new Date();
        return {
          id: String(r.id || ''),
          orderId: activeChatThreadId,
          senderRole:
            r.senderRole === 'captain' || r.senderRole === 'merchant' ? r.senderRole : 'customer',
          senderName: String(r.senderName || 'مستخدم مشوار'),
          text: String(r.text || ''),
          time: formatArabicClockTime(dt),
        };
      });
      setChatMessages((prev) => {
        const others = prev.filter((m) => m.orderId !== activeChatThreadId);
        const existingThisThread = prev.filter((m) => m.orderId === activeChatThreadId);
        const mergedMap = new Map<string, ChatMessage>();
        for (const m of existingThisThread) mergedMap.set(m.id, m);
        for (const m of mapped) {
          if (m.id) mergedMap.set(m.id, m);
        }
        return [...others, ...Array.from(mergedMap.values())];
      });
    });

    return () => unsubChat();
  }, [firebaseUser, activeChatThreadId, firestoreOrderIds]);

  // Real-time Firestore Commute Slots Subscription
  useEffect(() => {
    if (!firebaseUser || firestoreSubIds.length === 0) return;
    const unsubs = firestoreSubIds.map((subId) =>
      subscribeToCommuteSlotsInFirestore(subId, (remoteSlots) => {
        if (!remoteSlots || remoteSlots.length === 0) return;
        setCommuteSubscriptions((prev) =>
          prev.map((sub) => {
            if (sub.id !== subId) return sub;
            const slotMap = new Map<string, CommuteSlotItem>();
            for (const s of sub.slots || []) slotMap.set(s.id, s);
            for (const rs of remoteSlots) {
              const r = rs as Record<string, any>;
              const slotId = String(r.id || '');
              if (!slotId) continue;
              const slotType = r.slotType === 'evening_return' ? 'evening_return' : 'morning_go';
              slotMap.set(slotId, {
                id: slotId,
                subscriptionId: subId,
                slotType,
                slotLabelAr: slotType === 'evening_return' ? 'رحلة العودة المسائية' : 'رحلة الذهاب الصباحية',
                dateIso: String(r.dateIso || new Date().toISOString().slice(0, 10)),
                scheduledTime: String(r.scheduledTime || sub.morningTime),
                status: (r.status as CommuteSlotStatus) || 'scheduled',
                captainName: typeof r.captainName === 'string' ? r.captainName : undefined,
                ridePin: typeof r.ridePin === 'string' ? r.ridePin : undefined,
              });
            }
            return { ...sub, slots: Array.from(slotMap.values()) };
          })
        );
      })
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [firebaseUser, firestoreSubIds]);

  // Automated Daily Commute Subscription Slot Progression Timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      setCommuteSubscriptions((prev) => {
        let changed = false;
        const next = prev.map((sub) => {
          if (sub.status !== 'active' || !sub.slots || sub.slots.length === 0) return sub;
          const updatedSlots = [...sub.slots];
          const firstSchedIdx = updatedSlots.findIndex((s) => s.status === 'scheduled');
          if (firstSchedIdx !== -1) {
            changed = true;
            const target = updatedSlots[firstSchedIdx];
            const promoted: CommuteSlotItem = {
              ...target,
              status: 'driver_assigned',
              captainName: target.captainName || 'كابتن أحمد فتحي الديب',
              ridePin: target.ridePin || generateFourDigitPin(),
            };
            updatedSlots[firstSchedIdx] = promoted;
            if (firestoreSubIds.includes(sub.id)) {
              syncCommuteSlotToFirestore(sub.id, promoted).catch(() => {});
            }
            return { ...sub, slots: updatedSlots };
          }
          const assignedIdx = updatedSlots.findIndex((s) => s.status === 'driver_assigned');
          if (assignedIdx !== -1) {
            changed = true;
            const target = updatedSlots[assignedIdx];
            const promoted: CommuteSlotItem = {
              ...target,
              status: 'en_route',
            };
            updatedSlots[assignedIdx] = promoted;
            if (firestoreSubIds.includes(sub.id)) {
              syncCommuteSlotToFirestore(sub.id, promoted).catch(() => {});
            }
            return { ...sub, slots: updatedSlots };
          }
          return sub;
        });
        return changed ? next : prev;
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [firestoreSubIds]);

  // Real Battery Status API Listener & Adaptive GPS Polling Engine
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.BATTERY_PREF, batterySaverPreference);
      }
    } catch {
      // Ignore storage error
    }
  }, [batterySaverPreference]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const navWithBattery = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (type: string, listener: () => void) => void;
        removeEventListener: (type: string, listener: () => void) => void;
      }>;
    };
    if (typeof navWithBattery.getBattery !== 'function') return;

    let mounted = true;
    let batteryRef: {
      level: number;
      charging: boolean;
      addEventListener: (type: string, listener: () => void) => void;
      removeEventListener: (type: string, listener: () => void) => void;
    } | null = null;

    const syncBattery = () => {
      if (!mounted || !batteryRef) return;
      setHardwareBatterySupported(true);
      setHardwareBatteryPercent(Math.max(1, Math.min(100, Math.round(batteryRef.level * 100))));
      setIsCharging(Boolean(batteryRef.charging));
    };

    navWithBattery
      .getBattery()
      .then((bat) => {
        if (!mounted) return;
        batteryRef = bat;
        syncBattery();
        bat.addEventListener('levelchange', syncBattery);
        bat.addEventListener('chargingchange', syncBattery);
      })
      .catch(() => {
        // Browser blocked or unsupported Battery API; fallback stays active
      });

    return () => {
      mounted = false;
      if (batteryRef) {
        batteryRef.removeEventListener('levelchange', syncBattery);
        batteryRef.removeEventListener('chargingchange', syncBattery);
      }
    };
  }, []);

  const batteryLevelPercent = simulatedBatteryPercent ?? hardwareBatteryPercent;
  const isBatteryLow = batteryLevelPercent < 20 && !isCharging;
  const isBatterySaverActive =
    batterySaverPreference === 'always_on' ||
    (batterySaverPreference === 'auto' && batteryLevelPercent < 20 && !isCharging);
  const gpsUpdateIntervalMs = isBatterySaverActive ? 15000 : 3000;
  const gpsHighAccuracy = !isBatterySaverActive;

  const forceGpsSyncNow = React.useCallback(() => {
    const stamp = formatArabicClockTime(new Date());
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsTrackingLocation((prev) => ({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracyMeters: Math.round(pos.coords.accuracy || (gpsHighAccuracy ? 12 : 45)),
            source: 'gps',
            lastUpdatedAt: stamp,
            updatesCount: prev.updatesCount + 1,
          }));
        },
        () => {
          setGpsTrackingLocation((prev) => ({
            ...prev,
            accuracyMeters: gpsHighAccuracy ? 15 : 48,
            source: 'bagour_hub',
            lastUpdatedAt: stamp,
            updatesCount: prev.updatesCount + 1,
          }));
        },
        {
          enableHighAccuracy: gpsHighAccuracy,
          maximumAge: isBatterySaverActive ? 15000 : 2000,
          timeout: 4000,
        }
      );
    } else {
      setGpsTrackingLocation((prev) => ({
        ...prev,
        accuracyMeters: gpsHighAccuracy ? 15 : 48,
        source: 'bagour_hub',
        lastUpdatedAt: stamp,
        updatesCount: prev.updatesCount + 1,
      }));
    }
  }, [gpsHighAccuracy, isBatterySaverActive]);

  useEffect(() => {
    const hasActiveTrackingNeed =
      isCaptainOnline ||
      orders.some((o) => !['delivered', 'cancelled'].includes(o.status));
    if (!hasActiveTrackingNeed) return;

    const timer = window.setInterval(() => {
      forceGpsSyncNow();
    }, gpsUpdateIntervalMs);

    return () => window.clearInterval(timer);
  }, [gpsUpdateIntervalMs, isCaptainOnline, orders, forceGpsSyncNow]);

  // Persist orders, wallet & loyalty across page reloads
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [orders]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.WALLET_BALANCE, String(customerWalletBalanceEgp));
        window.localStorage.setItem(STORAGE_KEYS.WALLET_TX, JSON.stringify(walletTransactions));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [customerWalletBalanceEgp, walletTransactions]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.LOYALTY_POINTS, String(loyaltyPoints));
        window.localStorage.setItem(STORAGE_KEYS.LOYALTY_CASHBACK, String(loyaltyCashbackBalanceEgp));
        window.localStorage.setItem(STORAGE_KEYS.LOYALTY_HISTORY, JSON.stringify(loyaltyHistory));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [loyaltyPoints, loyaltyCashbackBalanceEgp, loyaltyHistory]);

  const currentLoyaltyTierInfo = getLoyaltyTierFromPoints(loyaltyPoints);

  // Notifications (Customer/Merchant general + Dedicated Firestore El Bagour Captain Alerts)
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'ntf_1',
      recipientRole: 'customer',
      titleAr: 'تم قبول طلبك #MSH-9401 من مطعم ومشاوي الباشا',
      bodyAr: 'بدأ المتجر في تجهيز طلبك وتم إسناد الكابتن محمود الصياد للاستلام.',
      timeAr: 'منذ ٥ دقائق',
      orderNumber: 'MSH-9401',
      isRead: false,
    },
    {
      id: 'ntf_2',
      recipientRole: 'captain',
      titleAr: 'طلب مشوار خاص جديد #MSH-8103 في ميدان المحطة',
      bodyAr: 'مشوار سريع من ميدان المحطة إلى برج الشروق بقيمة ١٧.٠٠ ج.م (٠٪ عمولة).',
      timeAr: 'منذ ٤ دقائق',
      orderNumber: 'MSH-8103',
      isRead: false,
    },
  ]);

  const [captainCustomSound, setCaptainCustomSoundState] = useState<CaptainAlertSoundType>(() =>
    getCaptainCustomSound()
  );
  const [captainNotifications, setCaptainNotifications] = useState<CaptainInAppNotification[]>([
    {
      id: 'ntf_cpt_seed_1',
      orderId: 'ord_seed_3',
      orderNumber: 'MSH-8103',
      zoneArea: 'ميدان المحطة - وسط الباجور',
      titleAr: 'طلب توصيل جديد في وسط الباجور #MSH-8103',
      bodyAr: 'من ميدان المحطة إلى برج الشروق • صافي الربح +١٥ ج.م (٠٪ عمولة)',
      serviceType: 'errand',
      estimatedEarningsEgp: 15,
      soundProfile: getCaptainCustomSound(),
      timeAr: 'منذ ٣ دقائق',
      isRead: false,
      source: 'local',
    },
  ]);
  const [latestCaptainAlert, setLatestCaptainAlert] = useState<CaptainInAppNotification | null>(null);

  const updateCaptainCustomSound = (sound: CaptainAlertSoundType) => {
    setCaptainCustomSoundState(sound);
    setCaptainCustomSound(sound);
  };

  // Complaints
  const [complaints, setComplaints] = useState<SupportComplaint[]>([
    {
      id: 'cmp_1001',
      ticketNumber: 'TKT-1001',
      orderNumber: 'MSH-8102',
      customerName: 'د. سحر عبد الحميد',
      customerPhone: '01244455582',
      categoryAr: 'تأخر أو متابعة خط سير',
      subjectAr: 'متابعة موعد وصول مستلزمات شنتنا الحجر',
      descriptionAr: 'يرجى التأكيد على الكابتن بسلوك طريق بنها الزراعي لسرعة الوصول.',
      status: 'under_review',
      createdAtAr: 'منذ ٢٠ دقيقة',
      resolutionNotesAr: 'تم التواصل مع الكابتن أحمد فتحي وهو على مسافة أقل من ٥ دقائق من الوجهة.',
    },
  ]);

  // Captains Fleet, System Settings & Audit Logs
  const [captains, setCaptains] = useState<FleetCaptainItem[]>(INITIAL_CAPTAINS);
  const [systemSettings, setSystemSettings] = useState<PlatformSystemSettings>({
    baseFarePiasters: 1500,
    ratePerKmPiasters: 400,
    ruralSurchargePiasters: 500,
    platformFeePiasters: 200,
    cashCeilingPiasters: 100000,
    gracePeriodHours: 72,
    passengerLockEnabled: false,
  });

  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([
    {
      id: 'aud_01',
      timestamp: 'اليوم ١٠:٠٠ ص',
      actorName: 'د. علاء',
      actorRole: 'owner',
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      target: 'إعدادات المنظومة',
      descriptionAr: 'اعتماد تسعيرة الانطلاق لمركز الباجور وقراها وتفعيل كباتن العائلات الموثوقين واشتراكات المشوار اليومي.',
    },
    {
      id: 'aud_02',
      timestamp: 'اليوم ١٠:٢٥ ص',
      actorName: 'أحمد المنوفي',
      actorRole: 'operations_dispatcher',
      actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
      target: 'طلب MSH-8102',
      descriptionAr: 'تعيين الكابتن أحمد فتحي الديب لنقل شحنة مستلزمات طبية عاجلة إلى شنتنا الحجر.',
    },
  ]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_1',
      orderId: 'ord_seed_1',
      senderRole: 'customer',
      senderName: 'أحمد سعيد المنوفي',
      text: 'يا كابتن محمود، أنا في برج الشروق بجوار صيدلية الشفاء الدور الرابع.',
      time: '١٠:٤٠ ص',
    },
    {
      id: 'msg_2',
      orderId: 'ord_seed_1',
      senderRole: 'captain',
      senderName: 'كابتن محمود الصياد',
      text: 'تمام يا أستاذ أحمد، المطعم بيقفل التغليف وخلال دقائق هكون عندك إن شاء الله.',
      time: '١٠:٤١ ص',
    },
  ]);

  // Sync live store open status from backend /api/v1/stores on initial mount
  useEffect(() => {
    fetch('/api/v1/stores')
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && Array.isArray(res.data?.stores)) {
          const backendStores = res.data.stores;
          setStores((prev) =>
            prev.map((s) => {
              const found = backendStores.find((bs: any) => bs.id === s.id);
              return found ? { ...s, isOpen: found.isOpen } : s;
            })
          );
        }
      })
      .catch(() => {
        // Keep local seed if offline
      });
  }, []);

  const pushNotification = (notif: Omit<AppNotification, 'id' | 'timeAr' | 'isRead'>) => {
    setNotifications((prev) => [
      {
        ...notif,
        id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timeAr: 'الآن',
        isRead: false,
      },
      ...prev,
    ]);
  };

  const dispatchElBagourCaptainNotification = (params: {
    orderId: string;
    orderNumber: string;
    zoneArea: string;
    titleAr: string;
    bodyAr: string;
    serviceType: OrderServiceType;
    estimatedEarningsEgp: number;
    playSoundImmediately?: boolean;
  }): CaptainInAppNotification => {
    const activeSound = getCaptainCustomSound();
    const notifId = `cptntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: CaptainInAppNotification = {
      id: notifId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      zoneArea: params.zoneArea,
      titleAr: params.titleAr,
      bodyAr: params.bodyAr,
      serviceType: params.serviceType,
      estimatedEarningsEgp: Math.max(0, Math.round(params.estimatedEarningsEgp)),
      soundProfile: activeSound,
      timeAr: formatArabicClockTime(new Date()),
      isRead: false,
      source: firebaseUser ? 'firestore' : 'local',
    };

    setCaptainNotifications((prev) => [item, ...prev.slice(0, 29)]);
    setLatestCaptainAlert(item);
    if (params.playSoundImmediately !== false && isCaptainOnline) {
      playDispatchChime('captain', activeSound);
    }

    if (firebaseUser) {
      createCaptainNotificationInFirestore({
        notifId,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        zoneArea: params.zoneArea,
        titleAr: params.titleAr,
        bodyAr: params.bodyAr,
        serviceType: params.serviceType,
        estimatedEarningsPiasters: Math.max(0, Math.round(params.estimatedEarningsEgp * 100)),
        soundProfile: activeSound,
      }).catch(() => {});
    }

    return item;
  };

  const dismissLatestCaptainAlert = () => setLatestCaptainAlert(null);

  const markCaptainNotificationRead = (notifId: string) => {
    setCaptainNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
    setLatestCaptainAlert((prev) => (prev?.id === notifId ? null : prev));
    if (firebaseUser) {
      markCaptainNotificationReadInFirestore(notifId).catch(() => {});
    }
  };

  const markAllCaptainNotificationsRead = () => {
    const unreadIds = captainNotifications.filter((n) => !n.isRead).map((n) => n.id);
    setCaptainNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setLatestCaptainAlert(null);
    if (firebaseUser) {
      for (const nid of unreadIds) {
        markCaptainNotificationReadInFirestore(nid).catch(() => {});
      }
    }
  };

  const simulateElBagourCaptainDispatchAlert = (): CaptainInAppNotification => {
    const sampleNum = `MSH-${Math.floor(8500 + Math.random() * 499)}`;
    return dispatchElBagourCaptainNotification({
      orderId: `ord_alert_${Date.now()}`,
      orderNumber: sampleNum,
      zoneArea: 'ميدان المحطة ↔ شارع الجيش، الباجور',
      titleAr: `طلب جديد وارد في الباجور #${sampleNum}`,
      bodyAr: 'توصيل فوري داخل مركز الباجور • صافي الربح المتوقع +٢٢ ج.م (٠٪ عمولة)',
      serviceType: 'ride',
      estimatedEarningsEgp: 22,
      playSoundImmediately: true,
    });
  };

  const setIsCaptainOnline = (online: boolean) => {
    setIsCaptainOnlineState(online);
    setCaptains((prev) =>
      prev.map((c) => (c.id === 'cpt_02' ? { ...c, isOnline: online } : c))
    );
  };

  // Switch active user
  const switchDemoUser = (user: DemoUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  // Store management
  const toggleStoreStatus = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, isOpen: !s.isOpen } : s))
    );
  };

  const toggleProductAvailability = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  const updateProductPrice = (productId: string, newPriceEgp: number) => {
    if (newPriceEgp <= 0) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, priceEgp: newPriceEgp } : p))
    );
  };

  // Multi-Stop Combined Cart Operations (up to 4 stores in 1 combined delivery fee)
  const cartStoreIds = Array.from(new Set(cartItems.map((ci) => ci.product.storeId)));
  const cartStoreId = cartStoreIds[0] || null;
  const cartStoreGroups: CartStoreGroup[] = cartStoreIds
    .map((sid) => {
      const store = stores.find((s) => s.id === sid);
      if (!store) return null;
      const items = cartItems.filter((ci) => ci.product.storeId === sid);
      const subtotalEgp = items.reduce((sum, ci) => sum + ci.product.priceEgp * ci.quantity, 0);
      return { store, items, subtotalEgp };
    })
    .filter((g): g is CartStoreGroup => g !== null);

  const addToCart = (
    product: ProductItem,
    store: StoreItem
  ): { success: boolean; conflictStore?: string; limitReached?: boolean } => {
    const isNewStore = !cartStoreIds.includes(store.id);
    if (isNewStore && cartStoreIds.length >= BLUEPRINT_LIMITS.MAX_ORDER_STOPS) {
      return {
        success: false,
        limitReached: true,
        conflictStore: `الحد الأقصى ${BLUEPRINT_LIMITS.MAX_ORDER_STOPS} متاجر في السلة المجمعة`,
      };
    }

    setCartItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    return { success: true };
  };

  const addExtractedItemsToCart = (
    storeId: string,
    extractedItems: { nameAr: string; quantity?: string; unit?: string; notes?: string; priceEgp?: number }[]
  ): { addedCount: number; limitReached?: boolean } => {
    const targetStore = stores.find((s) => s.id === storeId) || stores[1] || stores[0];
    if (!targetStore || extractedItems.length === 0) {
      return { addedCount: 0 };
    }
    const isNewStore = !cartStoreIds.includes(targetStore.id);
    if (isNewStore && cartStoreIds.length >= BLUEPRINT_LIMITS.MAX_ORDER_STOPS) {
      return { addedCount: 0, limitReached: true };
    }

    const newProductsToRegister: ProductItem[] = [];
    const additions: { product: ProductItem; qty: number; notes?: string }[] = [];

    extractedItems.forEach((item, idx) => {
      const cleanName = item.nameAr.trim();
      if (!cleanName) return;
      const numericQtyMatch = String(item.quantity || '1').match(/\d+/);
      const parsedQty = numericQtyMatch ? Math.max(1, Math.min(20, parseInt(numericQtyMatch[0], 10))) : 1;

      const existingMatch = products.find(
        (p) =>
          p.storeId === targetStore.id &&
          (p.nameAr.toLowerCase().includes(cleanName.toLowerCase()) ||
            cleanName.toLowerCase().includes(p.nameAr.toLowerCase()))
      );

      if (existingMatch) {
        additions.push({ product: existingMatch, qty: parsedQty, notes: item.notes });
      } else {
        const estimatedPrice =
          typeof item.priceEgp === 'number' && item.priceEgp > 0
            ? Math.round(item.priceEgp)
            : targetStore.category === 'pharmacy'
            ? 65
            : targetStore.category === 'restaurant'
            ? 85
            : 35;
        const createdProd: ProductItem = {
          id: `prod_ai_${Date.now()}_${idx}`,
          storeId: targetStore.id,
          nameAr: cleanName,
          descriptionAr: item.notes?.trim() || 'صنف مستخرج بالذكاء الاصطناعي من الصورة/القائمة',
          priceEgp: estimatedPrice,
          categoryName: 'أصناف مسحوبة بالذكاء الاصطناعي',
          isAvailable: true,
          unit: item.unit?.trim() || 'عبوة / وحدة',
        };
        newProductsToRegister.push(createdProd);
        additions.push({ product: createdProd, qty: parsedQty, notes: item.notes });
      }
    });

    if (newProductsToRegister.length > 0) {
      setProducts((prev) => [...newProductsToRegister, ...prev]);
    }

    if (additions.length > 0) {
      setCartItems((prev) => {
        const updated = [...prev];
        for (const add of additions) {
          const existingIdx = updated.findIndex((i) => i.product.id === add.product.id);
          if (existingIdx !== -1) {
            updated[existingIdx] = {
              ...updated[existingIdx],
              quantity: updated[existingIdx].quantity + add.qty,
              notes: add.notes || updated[existingIdx].notes,
            };
          } else {
            updated.push({
              product: add.product,
              quantity: add.qty,
              notes: add.notes,
            });
          }
        }
        return updated;
      });
    }

    return { addedCount: additions.length };
  };

  const forceAddToCartNewStore = (product: ProductItem, _store: StoreItem) => {
    setCartItems([{ product, quantity: 1 }]);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateCartItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: qty } : i))
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  // Multi-Stop Cart Calculations using Haversine Store Proximity in El Bagour
  const cartSubtotalEgp = cartItems.reduce(
    (sum, item) => sum + item.product.priceEgp * item.quantity,
    0
  );
  const maxStoreDistanceKm = cartStoreGroups.reduce(
    (mx, g) => Math.max(mx, g.store.distanceKm || 1.4),
    1.4
  );
  const cartProximityPricing = calculateElBagourProximityDeliveryFeePiasters({
    stores: cartStoreGroups.map((g) => ({
      lat: g.store.lat,
      lng: g.store.lng,
      zoneCluster: g.store.zoneCluster,
    })),
    isRural: false,
    extraDistanceKm: maxStoreDistanceKm,
  });
  const cartDeliveryFeeEgp =
    cartItems.length > 0 ? Math.round(cartProximityPricing.feePiasters / 100) : 0;
  const cartProximityKm = cartItems.length > 0 ? cartProximityPricing.proximityKm : 0;
  const cartProximitySavedEgp =
    cartStoreGroups.length > 1 ? Math.round(cartProximityPricing.savedPiasters / 100) : 0;
  const cartDeliveryFeeBreakdownAr =
    cartItems.length > 0 ? cartProximityPricing.breakdownAr : '';
  const individualDeliverySumEgp = cartStoreGroups.reduce(
    (s, g) => s + (g.store.deliveryFeeEgp ?? 15),
    0
  );
  const cartMultiStopSavingsEgp =
    cartStoreGroups.length > 1
      ? Math.max(cartProximitySavedEgp, Math.max(0, individualDeliverySumEgp - cartDeliveryFeeEgp))
      : 0;
  const cartPlatformFeeEgp =
    cartItems.length > 0 ? Math.round(systemSettings.platformFeePiasters / 100) : 0;
  const cartTotalEgp = cartSubtotalEgp + cartDeliveryFeeEgp + cartPlatformFeeEgp;

  // Submit new Multi-Stop / Single-Store Order from Customer Cart
  const submitNewOrder = (params: {
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    hasVoiceNote?: boolean;
    voiceNoteDurationSec?: number;
    voiceNoteTranscript?: string;
    driverTipEgp?: number;
    cashChangeForEgp?: CashChangeOptionEgp;
    promoCode?: string;
    discountEgp?: number;
  }): MarketplaceOrder | null => {
    if (cartItems.length === 0 || cartStoreGroups.length === 0) return null;

    const primaryStore = cartStoreGroups[0].store;
    const allStoreIds = cartStoreGroups.map((g) => g.store.id);
    const allStoreNames = cartStoreGroups.map((g) => g.store.nameAr);
    const isMultiStop = cartStoreGroups.length > 1;
    const isRural = params.deliveryAddress.includes('قرية');
    const ruralSurchargeEgp = isRural ? Math.round(systemSettings.ruralSurchargePiasters / 100) : 0;

    const orderNum = `MSH-${Math.floor(9402 + Math.random() * 500)}`;
    const now = new Date();
    const timeStr = formatArabicClockTime(now);
    const itemsSummary = cartItems
      .map((ci) => `${ci.quantity}× ${ci.product.nameAr}`)
      .join(' + ');
    const safeTipEgp = Math.max(0, Math.min(500, Math.round(params.driverTipEgp || 0)));
    const safeDiscountEgp = Math.max(0, Math.min(250, Math.round(params.discountEgp || 0)));
    const finalTotalEgp = Math.max(
      10,
      cartTotalEgp + ruralSurchargeEgp + safeTipEgp - safeDiscountEgp
    );

    if (params.paymentMethod === 'wallet' && customerWalletBalanceEgp >= finalTotalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - finalTotalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          titleAr: `سداد طلب ${isMultiStop ? 'سلة الباجور المجمعة' : primaryStore.nameAr} (${orderNum})`,
          type: 'debit',
          amountEgp: finalTotalEgp,
          methodAr: 'خصم محفظة مشوار',
          timestampAr: `اليوم • ${timeStr}`,
          orderNumber: orderNum,
        },
        ...prev,
      ]);
    }

    const orderId = `ord_${Date.now()}`;
    const newOrder: MarketplaceOrder = {
      id: orderId,
      orderNumber: orderNum,
      serviceType: 'restaurant_store',
      serviceTypeAr: isMultiStop ? `سلة الباجور المجمعة (${cartStoreGroups.length} متاجر)` : 'طلبات مطاعم ومتاجر',
      vehicleCategory: 'scooter',
      storeId: primaryStore.id,
      storeName: isMultiStop ? allStoreNames.join(' + ') : primaryStore.nameAr,
      storeIds: allStoreIds,
      storeNames: allStoreNames,
      storeAddress: allStoreNames.join(' ← '),
      pickupAddress: allStoreNames.join(' ← '),
      deliveryAddress: params.deliveryAddress,
      distanceKm: maxStoreDistanceKm,
      estimatedMinutes: isMultiStop ? '٢٥ - ٣٥ دقيقة' : primaryStore.deliveryTimeEst,
      estimatedDuration: isMultiStop ? 30 : 20,
      estimatedDurationMinutes: isMultiStop ? 30 : 20,
      isRural,
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr_cust_1',
      customerName: currentUser.role === 'customer' ? currentUser.name : 'أحمد سعيد المنوفي',
      customerPhone: currentUser.role === 'customer' ? currentUser.phone : '01012345678',
      items: cartItems.map((ci) => {
        const st = stores.find((s) => s.id === ci.product.storeId);
        return {
          productId: ci.product.id,
          productName: ci.product.nameAr,
          quantity: ci.quantity,
          unitPriceEgp: ci.product.priceEgp,
          storeId: ci.product.storeId,
          storeName: st?.nameAr,
        };
      }),
      itemDescription: itemsSummary,
      subtotalEgp: cartSubtotalEgp,
      deliveryFeeEgp: cartDeliveryFeeEgp,
      platformFeeEgp: cartPlatformFeeEgp,
      ruralSurchargeEgp,
      discountEgp: safeDiscountEgp,
      promoCode: params.promoCode,
      cashChangeForEgp: params.paymentMethod === 'cash' ? (params.cashChangeForEgp ?? 0) : 0,
      driverTipEgp: safeTipEgp,
      totalEgp: finalTotalEgp,
      totalFarePiasters: finalTotalEgp * 100,
      paymentMethod: params.paymentMethod,
      status: 'created',
      createdAt: timeStr,
      createdAtDate: now,
      notes: params.notes,
      scheduled_for: params.scheduled_for ?? null,
      hasVoiceNote: Boolean(params.hasVoiceNote || params.voiceNoteTranscript),
      voiceNoteDurationSec: params.voiceNoteDurationSec ?? 0,
      voiceNoteTranscript: params.voiceNoteTranscript?.trim() || '',
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    // Sync to Firestore if authenticated
    syncDeliveryOrderToFirestore({
      orderId,
      orderNumber: orderNum,
      serviceType: 'restaurant_store',
      storeName: newOrder.storeName,
      storeIds: allStoreIds,
      storeNames: allStoreNames,
      pickupLandmark: newOrder.pickupAddress,
      dropoffLandmark: newOrder.deliveryAddress,
      itemsSummary: params.notes ? `${itemsSummary} • ${params.notes}` : itemsSummary,
      isRural,
      distanceKm: newOrder.distanceKm,
      subtotalPiasters: cartSubtotalEgp * 100,
      deliveryFeePiasters: cartDeliveryFeeEgp * 100,
      driverTipPiasters: safeTipEgp * 100,
      discountPiasters: safeDiscountEgp * 100,
      promoCode: params.promoCode,
      cashChangeForEgp: newOrder.cashChangeForEgp,
      totalFarePiasters: finalTotalEgp * 100,
      paymentMethod: params.paymentMethod,
      scheduledFor: params.scheduled_for,
      hasVoiceNote: newOrder.hasVoiceNote,
      voiceNoteDurationSec: newOrder.voiceNoteDurationSec,
      voiceNoteTranscript: newOrder.voiceNoteTranscript,
    })
      .then((ok) => {
        if (ok) setFirestoreOrderIds((prev) => Array.from(new Set([...prev, orderId])));
      })
      .catch(() => {});

    pushNotification({
      recipientRole: 'merchant',
      titleAr: `طلب جديد وارد #${orderNum} (${newOrder.storeName})`,
      bodyAr: `${itemsSummary} • الإجمالي ${finalTotalEgp} ج.م${safeTipEgp > 0 ? ` (يشمل ${safeTipEgp} ج إكرامية)` : ''}`,
      orderNumber: orderNum,
    });

    dispatchElBagourCaptainNotification({
      orderId,
      orderNumber: orderNum,
      zoneArea: params.deliveryAddress || 'مركز الباجور',
      titleAr: `طلب متاجر جديد في الباجور #${orderNum}`,
      bodyAr: `${newOrder.storeName} ← ${params.deliveryAddress} • ربح الكابتن +${cartDeliveryFeeEgp + safeTipEgp} ج.م`,
      serviceType: 'restaurant_store',
      estimatedEarningsEgp: cartDeliveryFeeEgp + safeTipEgp,
    });

    return newOrder;
  };

  // Submit Direct Store Order from Multi-Step Wizard
  const submitDirectStoreOrder = (params: {
    storeId: string;
    items: { product: ProductItem; quantity: number }[];
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    hasVoiceNote?: boolean;
    voiceNoteDurationSec?: number;
    voiceNoteTranscript?: string;
    driverTipEgp?: number;
    cashChangeForEgp?: CashChangeOptionEgp;
    promoCode?: string;
    discountEgp?: number;
  }): MarketplaceOrder | null => {
    const store = stores.find((s) => s.id === params.storeId);
    if (!store || params.items.length === 0) return null;

    const orderNum = `MSH-${Math.floor(9402 + Math.random() * 500)}`;
    const now = new Date();
    const timeStr = formatArabicClockTime(now);
    const subtotalEgp = params.items.reduce((sum, ci) => sum + ci.product.priceEgp * ci.quantity, 0);
    const deliveryFeeEgp = store.deliveryFeeEgp ?? 15;
    const platformFeeEgp = Math.round(systemSettings.platformFeePiasters / 100);
    const isRural = params.deliveryAddress.includes('قرية');
    const ruralSurchargeEgp = isRural ? Math.round(systemSettings.ruralSurchargePiasters / 100) : 0;
    const safeTipEgp = Math.max(0, Math.min(500, Math.round(params.driverTipEgp || 0)));
    const safeDiscountEgp = Math.max(0, Math.min(250, Math.round(params.discountEgp || 0)));
    const totalEgp = Math.max(
      10,
      subtotalEgp + deliveryFeeEgp + platformFeeEgp + ruralSurchargeEgp + safeTipEgp - safeDiscountEgp
    );
    const itemsSummary = params.items.map((ci) => `${ci.quantity}× ${ci.product.nameAr}`).join(' + ');

    if (params.paymentMethod === 'wallet' && customerWalletBalanceEgp >= totalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - totalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          titleAr: `سداد طلب متجر ${store.nameAr} (${orderNum})`,
          type: 'debit',
          amountEgp: totalEgp,
          methodAr: 'خصم محفظة مشوار',
          timestampAr: `اليوم • ${timeStr}`,
          orderNumber: orderNum,
        },
        ...prev,
      ]);
    }

    const orderId = `ord_${Date.now()}`;
    const newOrder: MarketplaceOrder = {
      id: orderId,
      orderNumber: orderNum,
      serviceType: 'restaurant_store',
      serviceTypeAr: 'توصيل متاجر ومطاعم',
      vehicleCategory: 'scooter',
      storeId: store.id,
      storeName: store.nameAr,
      storeIds: [store.id],
      storeNames: [store.nameAr],
      storeAddress: store.address,
      pickupAddress: store.address,
      deliveryAddress: params.deliveryAddress,
      distanceKm: store.distanceKm,
      estimatedMinutes: store.deliveryTimeEst,
      estimatedDuration: 20,
      estimatedDurationMinutes: 20,
      isRural,
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr_cust_1',
      customerName: currentUser.role === 'customer' ? currentUser.name : 'أحمد سعيد المنوفي',
      customerPhone: currentUser.role === 'customer' ? currentUser.phone : '01012345678',
      items: params.items.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.nameAr,
        quantity: ci.quantity,
        unitPriceEgp: ci.product.priceEgp,
        storeId: store.id,
        storeName: store.nameAr,
      })),
      itemDescription: itemsSummary,
      subtotalEgp,
      deliveryFeeEgp,
      platformFeeEgp,
      ruralSurchargeEgp,
      discountEgp: safeDiscountEgp,
      promoCode: params.promoCode,
      cashChangeForEgp: params.paymentMethod === 'cash' ? (params.cashChangeForEgp ?? 0) : 0,
      driverTipEgp: safeTipEgp,
      totalEgp,
      totalFarePiasters: totalEgp * 100,
      paymentMethod: params.paymentMethod,
      status: 'created',
      createdAt: timeStr,
      createdAtDate: now,
      notes: params.notes,
      scheduled_for: params.scheduled_for ?? null,
      hasVoiceNote: Boolean(params.hasVoiceNote || params.voiceNoteTranscript),
      voiceNoteDurationSec: params.voiceNoteDurationSec ?? 0,
      voiceNoteTranscript: params.voiceNoteTranscript?.trim() || '',
    };

    setOrders((prev) => [newOrder, ...prev]);

    syncDeliveryOrderToFirestore({
      orderId,
      orderNumber: orderNum,
      serviceType: 'restaurant_store',
      storeName: store.nameAr,
      storeIds: [store.id],
      storeNames: [store.nameAr],
      pickupLandmark: store.address,
      dropoffLandmark: params.deliveryAddress,
      itemsSummary: params.notes ? `${itemsSummary} • ${params.notes}` : itemsSummary,
      isRural,
      distanceKm: store.distanceKm,
      subtotalPiasters: subtotalEgp * 100,
      deliveryFeePiasters: deliveryFeeEgp * 100,
      driverTipPiasters: safeTipEgp * 100,
      discountPiasters: safeDiscountEgp * 100,
      promoCode: params.promoCode,
      cashChangeForEgp: newOrder.cashChangeForEgp,
      totalFarePiasters: totalEgp * 100,
      paymentMethod: params.paymentMethod,
      scheduledFor: params.scheduled_for,
      hasVoiceNote: newOrder.hasVoiceNote,
      voiceNoteDurationSec: newOrder.voiceNoteDurationSec,
      voiceNoteTranscript: newOrder.voiceNoteTranscript,
    })
      .then((ok) => {
        if (ok) setFirestoreOrderIds((prev) => Array.from(new Set([...prev, orderId])));
      })
      .catch(() => {});

    pushNotification({
      recipientRole: 'merchant',
      titleAr: `طلب جديد وارد #${orderNum} لـ ${store.nameAr}`,
      bodyAr: `${itemsSummary} • الإجمالي ${totalEgp} ج.م${safeTipEgp > 0 ? ` (يشمل ${safeTipEgp} ج إكرامية)` : ''}`,
      orderNumber: orderNum,
    });

    dispatchElBagourCaptainNotification({
      orderId,
      orderNumber: orderNum,
      zoneArea: params.deliveryAddress || 'مركز الباجور',
      titleAr: `طلب جديد في الباجور #${orderNum} (${store.nameAr})`,
      bodyAr: `من ${store.landmark} إلى ${params.deliveryAddress} • ربح الكابتن +${deliveryFeeEgp + safeTipEgp} ج.م`,
      serviceType: 'restaurant_store',
      estimatedEarningsEgp: deliveryFeeEgp + safeTipEgp,
    });

    return newOrder;
  };

  // Submit AI Photo Prescription or Handwritten Grocery List Order (Starts in awaiting_quote)
  const submitPrescriptionOrder = (params: {
    storeId: string;
    extractedItems: string[];
    prescriptionSummary: string;
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
    scheduled_for?: string | null;
    voiceNoteTranscript?: string;
    cashChangeForEgp?: CashChangeOptionEgp;
    driverTipEgp?: number;
  }): MarketplaceOrder | null => {
    const store = stores.find((s) => s.id === params.storeId) || stores[1] || stores[0];
    if (!store || params.extractedItems.length === 0) return null;

    const orderNum = `RX-${Math.floor(4100 + Math.random() * 899)}`;
    const now = new Date();
    const timeStr = formatArabicClockTime(now);
    const isRural = params.deliveryAddress.includes('قرية');
    const deliveryFeeEgp = store.deliveryFeeEgp ?? 15;
    const platformFeeEgp = Math.round(systemSettings.platformFeePiasters / 100);
    const ruralSurchargeEgp = isRural ? Math.round(systemSettings.ruralSurchargePiasters / 100) : 0;
    const safeTipEgp = Math.max(0, Math.min(500, Math.round(params.driverTipEgp || 0)));
    const initialTotalEgp = deliveryFeeEgp + platformFeeEgp + ruralSurchargeEgp + safeTipEgp;
    const itemsSummary = params.extractedItems.join(' + ');

    const orderId = `ord_rx_${Date.now()}`;
    const newOrder: MarketplaceOrder = {
      id: orderId,
      orderNumber: orderNum,
      serviceType: 'prescription_list',
      serviceTypeAr: store.category === 'pharmacy' ? 'روشتة طبية (بانتظار التسعير)' : 'ورقة مقاضي ذكية (بانتظار التسعير)',
      vehicleCategory: 'scooter',
      storeId: store.id,
      storeName: store.nameAr,
      storeIds: [store.id],
      storeNames: [store.nameAr],
      storeAddress: store.address,
      pickupAddress: store.address,
      deliveryAddress: params.deliveryAddress,
      distanceKm: store.distanceKm,
      estimatedMinutes: store.deliveryTimeEst,
      estimatedDuration: 20,
      estimatedDurationMinutes: 20,
      isRural,
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr_cust_1',
      customerName: currentUser.role === 'customer' ? currentUser.name : 'أحمد سعيد المنوفي',
      customerPhone: currentUser.role === 'customer' ? currentUser.phone : '01012345678',
      items: params.extractedItems.map((itemText, idx) => ({
        productId: `rx_item_${idx}`,
        productName: itemText,
        quantity: 1,
        unitPriceEgp: 0,
        storeId: store.id,
        storeName: store.nameAr,
      })),
      itemDescription: itemsSummary,
      aiExtractedItems: params.extractedItems,
      prescriptionSummary: params.prescriptionSummary,
      subtotalEgp: 0,
      deliveryFeeEgp,
      platformFeeEgp,
      ruralSurchargeEgp,
      cashChangeForEgp: params.paymentMethod === 'cash' ? (params.cashChangeForEgp ?? 0) : 0,
      driverTipEgp: safeTipEgp,
      totalEgp: initialTotalEgp,
      totalFarePiasters: initialTotalEgp * 100,
      paymentMethod: params.paymentMethod,
      status: 'awaiting_quote',
      createdAt: timeStr,
      createdAtDate: now,
      notes: params.notes,
      scheduled_for: params.scheduled_for ?? null,
      hasVoiceNote: Boolean(params.voiceNoteTranscript),
      voiceNoteTranscript: params.voiceNoteTranscript?.trim() || '',
    };

    setOrders((prev) => [newOrder, ...prev]);

    syncDeliveryOrderToFirestore({
      orderId,
      orderNumber: orderNum,
      serviceType: 'prescription_list',
      initialStatus: 'awaiting_quote',
      storeName: store.nameAr,
      storeIds: [store.id],
      storeNames: [store.nameAr],
      pickupLandmark: store.address,
      dropoffLandmark: params.deliveryAddress,
      itemsSummary: params.notes ? `${itemsSummary} • ${params.notes}` : itemsSummary,
      aiExtractedItems: params.extractedItems,
      prescriptionSummary: params.prescriptionSummary,
      isRural,
      distanceKm: store.distanceKm,
      subtotalPiasters: 0,
      deliveryFeePiasters: deliveryFeeEgp * 100,
      driverTipPiasters: safeTipEgp * 100,
      cashChangeForEgp: newOrder.cashChangeForEgp,
      totalFarePiasters: initialTotalEgp * 100,
      paymentMethod: params.paymentMethod,
      scheduledFor: params.scheduled_for,
      hasVoiceNote: newOrder.hasVoiceNote,
      voiceNoteTranscript: newOrder.voiceNoteTranscript,
    })
      .then((ok) => {
        if (ok) setFirestoreOrderIds((prev) => Array.from(new Set([...prev, orderId])));
      })
      .catch(() => {});

    pushNotification({
      recipientRole: 'merchant',
      titleAr: `طلب روشتة/قائمة للتسعير #${orderNum}`,
      bodyAr: `${store.nameAr} • ${params.extractedItems.length} أصناف مستخرجة بانتظار تسعيرك`,
      orderNumber: orderNum,
    });

    return newOrder;
  };

  // Submit Direct Ride / Special Errand / Package Order
  const submitRideOrPackageOrder = (params: SubmitRideOrPackageInput): MarketplaceOrder => {
    const orderNum = `MSH-${Math.floor(8200 + Math.random() * 799)}`;
    const now = new Date();
    const timeStr = formatArabicClockTime(now);

    const baseFareEgp = params.quoteData
      ? Math.round(params.quoteData.baseFarePiasters / 100)
      : params.vehicleCategory === 'car'
      ? 28
      : Math.round(systemSettings.baseFarePiasters / 100);
    const distFareEgp = params.quoteData
      ? Math.round(params.quoteData.distanceFarePiasters / 100)
      : Math.round(
          Math.max(0, params.distanceKm - 1.5) *
            (params.vehicleCategory === 'car' ? 7.5 : systemSettings.ratePerKmPiasters / 100)
        );
    const ruralEgp = params.quoteData
      ? Math.round(params.quoteData.ruralSurchargePiasters / 100)
      : params.isRural
      ? Math.round(systemSettings.ruralSurchargePiasters / 100)
      : 0;
    const platformEgp = params.quoteData
      ? Math.round(params.quoteData.platformFeePiasters / 100)
      : Math.round(systemSettings.platformFeePiasters / 100);
    const vehicleExtraEgp = params.vehicleCategory === 'van' ? 10 : 0;

    const safeTipEgp = Math.max(0, Math.min(500, Math.round(params.driverTipEgp || 0)));
    const safeDiscountEgp = Math.max(0, Math.min(100, Math.round(params.discountEgp || 0)));
    const deliveryFeeEgp = baseFareEgp + distFareEgp + ruralEgp + vehicleExtraEgp;
    const totalEgp = Math.max(10, deliveryFeeEgp + platformEgp + safeTipEgp - safeDiscountEgp);
    const totalFarePiasters = totalEgp * 100;

    // 4-Digit Security PIN for passenger rides
    const ridePin = params.serviceType === 'ride' ? generateFourDigitPin() : undefined;

    if (params.paymentMethod === 'wallet' && customerWalletBalanceEgp >= totalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - totalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          titleAr: `سداد ${
            params.serviceType === 'ride'
              ? params.vehicleCategory === 'car'
                ? 'مشوار سيارة'
                : 'مشوار توكتوك'
              : params.serviceType === 'errand'
              ? 'مشوار خاص'
              : 'توصيل طرد'
          } (${orderNum})`,
          type: 'debit',
          amountEgp: totalEgp,
          methodAr: 'خصم محفظة مشوار',
          timestampAr: `اليوم • ${timeStr}`,
          orderNumber: orderNum,
        },
        ...prev,
      ]);
    }

    const serviceLabel =
      params.serviceType === 'ride'
        ? params.vehicleCategory === 'car'
          ? 'مشوار سيارة ملاكي'
          : 'مشوار توكتوك الباجور'
        : params.serviceType === 'errand'
        ? 'مشوار خاص وتخليص فوري'
        : 'توصيل طرد وأمانات';

    const orderId = `ord_ride_${Date.now()}`;
    const newOrder: MarketplaceOrder = {
      id: orderId,
      orderNumber: orderNum,
      serviceType: params.serviceType,
      serviceTypeAr: serviceLabel,
      vehicleCategory: params.vehicleCategory,
      storeId:
        params.serviceType === 'ride'
          ? `direct_ride_${params.vehicleCategory}`
          : params.serviceType === 'errand'
          ? 'direct_errand'
          : 'direct_package',
      storeName: serviceLabel,
      storeAddress: params.pickupAddress,
      pickupAddress: params.pickupAddress,
      deliveryAddress: params.deliveryAddress,
      distanceKm: params.distanceKm,
      estimatedMinutes: params.quoteData?.estimatedDurationMinutes
        ? `${params.quoteData.estimatedDurationMinutes} دقيقة`
        : params.isRural
        ? '١٨ - ٢٤ دقيقة'
        : '١٠ - ١٥ دقيقة',
      estimatedDuration: params.quoteData?.estimatedDurationMinutes
        ? parseInt(String(params.quoteData.estimatedDurationMinutes), 10) || 15
        : params.isRural
        ? 18
        : 12,
      estimatedDurationMinutes: params.quoteData?.estimatedDurationMinutes
        ? parseInt(String(params.quoteData.estimatedDurationMinutes), 10) || 15
        : params.isRural
        ? 18
        : 12,
      isRural: params.isRural,
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr_cust_1',
      customerName: currentUser.role === 'customer' ? currentUser.name : 'أحمد سعيد المنوفي',
      customerPhone: params.recipientPhone || currentUser.phone || '01012345678',
      items: [
        {
          productId: `srv_${params.serviceType}`,
          productName: params.itemDescription || serviceLabel,
          quantity: 1,
          unitPriceEgp: 0,
        },
      ],
      itemDescription: params.itemDescription || serviceLabel,
      subtotalEgp: 0,
      deliveryFeeEgp,
      platformFeeEgp: platformEgp,
      ruralSurchargeEgp: ruralEgp,
      discountEgp: safeDiscountEgp,
      promoCode: params.promoCode,
      cashChangeForEgp: params.paymentMethod === 'cash' ? (params.cashChangeForEgp ?? 0) : 0,
      ridePin,
      requiresFamilyTrustedDriver: Boolean(params.requiresFamilyTrustedDriver),
      driverTipEgp: safeTipEgp,
      totalEgp,
      totalFarePiasters,
      paymentMethod: params.paymentMethod,
      status: 'searching_captain',
      createdAt: timeStr,
      createdAtDate: now,
      quoteId: params.quoteData?.quoteId,
      quoteSignature: params.quoteData?.signature,
      notes: params.notes,
      scheduled_for: params.scheduled_for ?? null,
      hasVoiceNote: Boolean(params.hasVoiceNote || params.voiceNoteTranscript),
      voiceNoteDurationSec: params.voiceNoteDurationSec ?? 0,
      voiceNoteTranscript: params.voiceNoteTranscript?.trim() || '',
    };

    setOrders((prev) => [newOrder, ...prev]);

    if (params.serviceType === 'ride') {
      syncRideToFirestore({
        rideId: orderId,
        rideNumber: orderNum,
        vehicleTier: params.vehicleCategory === 'car' ? 'car' : 'tuktuk',
        pickupLandmark: params.pickupAddress,
        dropoffLandmark: params.deliveryAddress,
        distanceKm: params.distanceKm,
        estimatedFarePiasters: totalFarePiasters,
        driverTipPiasters: safeTipEgp * 100,
        cashChangeForEgp: newOrder.cashChangeForEgp,
        discountPiasters: safeDiscountEgp * 100,
        promoCode: params.promoCode,
        ridePin,
        requiresFamilyTrustedDriver: Boolean(params.requiresFamilyTrustedDriver),
        scheduledFor: params.scheduled_for,
        paymentMethod: params.paymentMethod,
      }).catch(() => {});
    } else {
      syncDeliveryOrderToFirestore({
        orderId,
        orderNumber: orderNum,
        serviceType: params.serviceType === 'errand' ? 'errand' : 'package',
        initialStatus: 'searching_captain',
        storeName: serviceLabel,
        pickupLandmark: params.pickupAddress,
        dropoffLandmark: params.deliveryAddress,
        itemsSummary: params.notes ? `${newOrder.itemDescription} • ${params.notes}` : newOrder.itemDescription,
        isRural: params.isRural,
        distanceKm: params.distanceKm,
        subtotalPiasters: 0,
        deliveryFeePiasters: deliveryFeeEgp * 100,
        driverTipPiasters: safeTipEgp * 100,
        discountPiasters: safeDiscountEgp * 100,
        promoCode: params.promoCode,
        cashChangeForEgp: newOrder.cashChangeForEgp,
        totalFarePiasters,
        paymentMethod: params.paymentMethod,
        scheduledFor: params.scheduled_for,
        hasVoiceNote: newOrder.hasVoiceNote,
        voiceNoteDurationSec: newOrder.voiceNoteDurationSec,
        voiceNoteTranscript: newOrder.voiceNoteTranscript,
      })
        .then((ok) => {
          if (ok) setFirestoreOrderIds((prev) => Array.from(new Set([...prev, orderId])));
        })
        .catch(() => {});
    }

    pushNotification({
      recipientRole: 'captain',
      titleAr: `طلب ${serviceLabel} جديد #${orderNum}`,
      bodyAr: `من ${params.pickupAddress} إلى ${params.deliveryAddress} • الأجرة ${totalEgp} ج.م${
        params.requiresFamilyTrustedDriver ? ' • كابتن عائلات موثوق' : ''
      }`,
      orderNumber: orderNum,
    });

    dispatchElBagourCaptainNotification({
      orderId,
      orderNumber: orderNum,
      zoneArea: `${params.pickupAddress} ← ${params.deliveryAddress}`,
      titleAr: `طلب ${serviceLabel} جديد بالباجور #${orderNum}`,
      bodyAr: `من ${params.pickupAddress} إلى ${params.deliveryAddress} (${params.distanceKm} كم) • صافي الكابتن +${deliveryFeeEgp + safeTipEgp} ج.م`,
      serviceType: params.serviceType,
      estimatedEarningsEgp: deliveryFeeEgp + safeTipEgp,
    });

    return newOrder;
  };

  // Simulate immediate captain acceptance (for smooth 1-click customer testing)
  const simulateInstantCaptainAccept = (orderId: string) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: 'usr_capt_1',
              assignedCaptainName: 'كابتن محمود الصياد',
              assignedCaptainPhone: '01198765432',
              assignedCaptainVehicle: 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
              assignedCaptainRating: 4.92,
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, {
      status: 'captain_assigned',
      assignedCaptainId: 'usr_capt_1',
      assignedCaptainName: 'كابتن محمود الصياد',
    }).catch(() => {});

    const targetOrder = orders.find((o) => o.id === orderId);
    if (targetOrder) {
      pushNotification({
        recipientRole: 'customer',
        titleAr: `وافق الكابتن محمود الصياد على طلبك #${targetOrder.orderNumber}`,
        bodyAr: `وقت القبول: ${nowTimeAr} • الكابتن في طريقه لنقطة الانطلاق الآن.`,
        orderNumber: targetOrder.orderNumber,
      });
    }
  };

  // Customer cancels own order and updates status to 'cancelled'
  const customerCancelOrder = (orderId: string, reason: string = 'إلغاء بناءً على رغبة العميل') => {
    setOrders((prev) =>
      prev.map((o) =>
        (o.id === orderId || o.orderNumber === orderId) && o.status !== 'delivered'
          ? { ...o, status: 'cancelled', notes: `${o.notes ? o.notes + ' | ' : ''}[ملغي: ${reason}]` }
          : o
      )
    );
    updateDeliveryOrderInFirestore(orderId, { status: 'cancelled' }).catch(() => {});
  };

  // Customer approves Merchant/Pharmacist quote on prescription_list orders
  const customerApproveOrderQuote = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!target || target.status !== 'quote_ready') return;
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);

    if (target.paymentMethod === 'wallet' && customerWalletBalanceEgp >= target.totalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - target.totalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_rx_${Date.now()}`,
          titleAr: `سداد طلب مسعّر ${target.storeName} (${target.orderNumber})`,
          type: 'debit',
          amountEgp: target.totalEgp,
          methodAr: 'خصم محفظة مشوار',
          timestampAr: `اليوم • ${nowTimeAr}`,
          orderNumber: target.orderNumber,
        },
        ...prev,
      ]);
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === target.id
          ? {
              ...o,
              status: 'accepted_by_store',
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(target.id, { status: 'accepted_by_store' }).catch(() => {});

    pushNotification({
      recipientRole: 'merchant',
      titleAr: `وافق العميل على تسعيرة #${target.orderNumber}`,
      bodyAr: `تم اعتماد مبلغ ${target.totalEgp} ج.م — يرجى تجهيز الأصناف للاستلام.`,
      orderNumber: target.orderNumber,
    });
  };

  // Customer rates captain performance post-delivery on a 1-5 star scale
  const rateOrderCaptain = (orderId: string, rating: number) => {
    const clampedRating = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, customerRating: clampedRating }
          : o
      )
    );
  };

  // Full Post-Ride / Post-Delivery Rating & Feedback persisted to Firestore driverRatings
  const submitDriverReview = async (
    orderId: string,
    input: { rating: number; tags: string[]; feedback: string }
  ): Promise<void> => {
    const clampedRating = Math.max(1, Math.min(5, Math.round(Number(input.rating) || 5)));
    const cleanTags = input.tags.map((t) => t.trim()).filter(Boolean).slice(0, 5);
    const cleanFeedback = input.feedback.trim().slice(0, BLUEPRINT_LIMITS.RATING_FEEDBACK_MAX);
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const resolvedOrderId = targetOrder?.id || orderId;
    const driverId = targetOrder?.assignedCaptainId || 'cpt_02';
    const driverName = targetOrder?.assignedCaptainName || 'كابتن محمود الصياد';
    const ratingId = `rat_${resolvedOrderId.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? {
              ...o,
              customerRating: clampedRating,
              customerRatingTags: cleanTags,
              customerFeedback: cleanFeedback || o.customerFeedback,
              orderFeedback: cleanFeedback || o.orderFeedback,
            }
          : o
      )
    );

    const newEntry: DriverRatingEntry = {
      id: ratingId,
      orderId: resolvedOrderId,
      driverId,
      driverName,
      rating: clampedRating,
      tags: cleanTags,
      feedback: cleanFeedback,
      createdAtAr: `اليوم • ${formatArabicClockTime(new Date())}`,
    };
    setDriverRatings((prev) => [newEntry, ...prev.filter((r) => r.id !== ratingId)]);

    setCaptains((prev) =>
      prev.map((c) => {
        if (c.id === driverId || c.userId === driverId || c.name === driverName) {
          const updatedAvg = Number(((c.rating * 10 + clampedRating) / 11).toFixed(2));
          return { ...c, rating: updatedAvg };
        }
        return c;
      })
    );

    if (firebaseUser) {
      await submitDriverRatingToFirestore({
        ratingId,
        orderId: resolvedOrderId,
        driverId,
        driverName,
        rating: clampedRating,
        tags: cleanTags,
        feedback: cleanFeedback,
      }).catch(() => {});
    }

    pushNotification({
      recipientRole: 'captain',
      titleAr: `تقييم جديد ${clampedRating} نجوم من العميل`,
      bodyAr: cleanFeedback
        ? `تعليق العميل على #${targetOrder?.orderNumber || resolvedOrderId}: "${cleanFeedback}"`
        : `شكراً على خدمة التوصيل المتميزة لطلب #${targetOrder?.orderNumber || resolvedOrderId}.`,
      orderNumber: targetOrder?.orderNumber,
    });
  };

  // Customer updates orderNotes on an active or existing order
  const updateOrderNotes = (orderId: string, nextOrderNotes: string) => {
    setOrders((prev) => {
      const updated = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, notes: nextOrderNotes, orderNotes: nextOrderNotes }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
      }
      return updated;
    });
  };

  // Customer leaves post-delivery Order Feedback comment
  const updateOrderFeedback = (orderId: string, feedback: string) => {
    setOrders((prev) => {
      const updated = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, customerFeedback: feedback, orderFeedback: feedback }
          : o
      );
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
      }
      return updated;
    });
  };

  // Customer updates Driver Tip amount on an order and keeps totalEgp / totalFarePiasters synchronized
  const updateOrderDriverTip = (orderId: string, tipEgp: number) => {
    const safeTip = Math.max(0, Math.min(500, Math.round(Number(tipEgp) || 0)));
    let nextTotalForSync = 0;
    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const previousTip = Math.max(0, Math.round(o.driverTipEgp || 0));
        const nextTotal = Math.max(0, o.totalEgp - previousTip + safeTip);
        nextTotalForSync = nextTotal;
        return {
          ...o,
          driverTipEgp: safeTip,
          totalEgp: nextTotal,
          totalFarePiasters: nextTotal * 100,
        };
      });
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
        } catch {
          // ignore storage quota errors
        }
      }
      return updated;
    });
    if (nextTotalForSync > 0) {
      updateDeliveryOrderInFirestore(orderId, {
        driverTipPiasters: safeTip * 100,
        totalFarePiasters: nextTotalForSync * 100,
      }).catch(() => {});
    }
  };

  // Merchant Transitions
  const merchantAcceptOrder = (orderId: string) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'accepted_by_store',
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, { status: 'accepted_by_store' }).catch(() => {});

    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      pushNotification({
        recipientRole: 'customer',
        titleAr: `قبل المتجر (${ord.storeName}) طلبك #${ord.orderNumber}`,
        bodyAr: `وقت القبول: ${nowTimeAr} • جاري تحضير الأصناف الآن.`,
        orderNumber: ord.orderNumber,
      });
    }
  };

  const merchantSubmitOrderQuote = (
    orderId: string,
    quoteTotalEgp: number,
    quoteNotes?: string
  ) => {
    const cleanQuote = Math.max(1, Math.round(Number(quoteTotalEgp) || 0));
    const target = orders.find((o) => o.id === orderId);
    if (!target || cleanQuote <= 0) return;

    const tipEgp = Math.max(0, target.driverTipEgp || 0);
    const discountEgp = Math.max(0, target.discountEgp || 0);
    const nextTotalEgp = Math.max(
      10,
      cleanQuote + target.deliveryFeeEgp + target.platformFeeEgp + target.ruralSurchargeEgp + tipEgp - discountEgp
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'quote_ready',
              quoteTotalEgp: cleanQuote,
              quoteNotes: quoteNotes?.trim() || o.quoteNotes,
              subtotalEgp: cleanQuote,
              totalEgp: nextTotalEgp,
              totalFarePiasters: nextTotalEgp * 100,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, {
      status: 'quote_ready',
      quoteTotalPiasters: cleanQuote * 100,
      quoteNotes: quoteNotes?.trim(),
      subtotalPiasters: cleanQuote * 100,
      totalFarePiasters: nextTotalEgp * 100,
    }).catch(() => {});

    pushNotification({
      recipientRole: 'customer',
      titleAr: `تسعيرة جديدة لطلبك #${target.orderNumber}`,
      bodyAr: `سعّر ${target.storeName} الأصناف بمبلغ ${cleanQuote} ج.م (الإجمالي بالتوصيل ${nextTotalEgp} ج.م). يرجى الاعتماد.`,
      orderNumber: target.orderNumber,
    });
  };

  const merchantMarkReady = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'ready_for_pickup' } : o
      )
    );
    updateDeliveryOrderInFirestore(orderId, { status: 'ready_for_pickup' }).catch(() => {});

    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      pushNotification({
        recipientRole: 'captain',
        titleAr: `طلب جاهز للاستلام الفوري #${ord.orderNumber}`,
        bodyAr: `المتجر: ${ord.storeName} • الأجرة للكابتن: +${ord.deliveryFeeEgp} ج.م`,
        orderNumber: ord.orderNumber,
      });

      dispatchElBagourCaptainNotification({
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        zoneArea: ord.deliveryAddress || 'مركز الباجور',
        titleAr: `طلب جاهز للاستلام الفوري #${ord.orderNumber}`,
        bodyAr: `${ord.storeName} جاهز للاستلام ← ${ord.deliveryAddress} • +${ord.deliveryFeeEgp + (ord.driverTipEgp || 0)} ج.م`,
        serviceType: ord.serviceType,
        estimatedEarningsEgp: ord.deliveryFeeEgp + (ord.driverTipEgp || 0),
      });
    }
  };

  const merchantRejectOrder = (orderId: string, reason?: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', notes: reason ? `سبب الإلغاء: ${reason}` : o.notes }
          : o
      )
    );
    updateDeliveryOrderInFirestore(orderId, { status: 'cancelled' }).catch(() => {});
  };

  // Captain Transitions (Enforces Cash Ceiling + Family Trusted verification)
  const captainAcceptDelivery = (orderId: string): { success: boolean; messageAr?: string } => {
    const targetOrder = orders.find((o) => o.id === orderId);
    const currentCap =
      captains.find(
        (c) => c.id === (currentUser.captainRecordId || 'cpt_02') || c.userId === currentUser.id
      ) || captains[1];

    const currentCashPiasters = Math.max(
      captainCashHoldingEgp * 100,
      currentCap?.cashHoldingPiasters || 0
    );
    const ceilingPiasters = currentCap?.cashCeilingPiasters || systemSettings.cashCeilingPiasters;

    if (targetOrder?.paymentMethod === 'cash' && currentCashPiasters >= ceilingPiasters) {
      return {
        success: false,
        messageAr: `تم إيقاف استقبال طلبات الكاش مؤقتاً: عهدتك الحالية (${Math.round(currentCashPiasters / 100)} ج.م) وصلت للحد الأقصى (${Math.round(ceilingPiasters / 100)} ج.م). يرجى التوريد للإدارة أولاً.`,
      };
    }

    if (targetOrder?.requiresFamilyTrustedDriver && currentCap && !currentCap.isFamilyTrusted) {
      return {
        success: false,
        messageAr: 'هذا المشوار يتطلب كابتن موثوق للعائلات ومعتمد من الإدارة.',
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);
    const assignedId = currentUser.role === 'captain' ? currentUser.id : 'usr_capt_1';
    const assignedName = currentUser.role === 'captain' ? currentUser.name : 'كابتن محمود الصياد';

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: assignedId,
              assignedCaptainName: assignedName,
              assignedCaptainPhone: currentUser.role === 'captain' ? currentUser.phone : '01198765432',
              assignedCaptainVehicle: currentUser.vehicleInfo || 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
              assignedCaptainRating: 4.92,
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, {
      status: 'captain_assigned',
      assignedCaptainId: assignedId,
      assignedCaptainName: assignedName,
    }).catch(() => {});

    if (targetOrder) {
      pushNotification({
        recipientRole: 'customer',
        titleAr: `تم تعيين الكابتن لطلبك #${targetOrder.orderNumber}`,
        bodyAr: `وقت القبول: ${targetOrder.acceptedAt || nowTimeAr} • الكابتن في الطريق للاستلام.`,
        orderNumber: targetOrder.orderNumber,
      });
    }

    return { success: true };
  };

  // Captain verifies 4-digit security PIN before starting a passenger ride
  const captainVerifyRidePinAndStart = (
    orderId: string,
    enteredPin: string
  ): { success: boolean; messageAr: string } => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return { success: false, messageAr: 'الطلب غير موجود.' };
    }
    const cleanPin = enteredPin.trim();
    if (targetOrder.ridePin && targetOrder.ridePin !== cleanPin) {
      return {
        success: false,
        messageAr: 'كود الأمان غير صحيح. اطلب من العميل الرقم السري المكون من ٤ أرقام على شاشته.',
      };
    }

    const nowTimeAr = formatArabicClockTime(new Date());
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'in_transit',
              pickedUpAt: o.pickedUpAt || nowTimeAr,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, { status: 'in_transit' }).catch(() => {});
    pushNotification({
      recipientRole: 'customer',
      titleAr: `بدأت رحلتك الآمنة #${targetOrder.orderNumber}`,
      bodyAr: `تم التحقق من كود الأمان (${cleanPin}) — نتمنى لك رحلة سعيدة بالباجور.`,
      orderNumber: targetOrder.orderNumber,
    });

    return { success: true, messageAr: 'تم مطابقة كود الأمان وبدء الرحلة بنجاح.' };
  };

  const awardLoyaltyForOrder = (orderId: string, overrideOrder?: MarketplaceOrder) => {
    const target = overrideOrder || orders.find((o) => o.id === orderId);
    if (!target) return;
    if (loyaltyHistory.some((entry) => entry.orderId === target.id)) return;

    const { cashbackPercent, cashbackAmountEgp, pointsEarned } = calculateOrderCashback(
      target.totalEgp,
      target.serviceType,
      loyaltyPoints
    );
    const nowTimeAr = formatArabicClockTime(new Date());

    setLoyaltyPoints((prev) => prev + pointsEarned);
    setLoyaltyCashbackBalanceEgp((prev) => prev + cashbackAmountEgp);
    setLoyaltyHistory((prev) => [
      {
        id: `loy_${Date.now()}_${target.id.slice(-4)}`,
        orderId: target.id,
        orderNumber: target.orderNumber.replace(/^#/, ''),
        serviceTypeAr: target.serviceTypeAr,
        orderTotalEgp: target.totalEgp,
        cashbackPercent,
        cashbackAmountEgp,
        pointsEarned,
        createdAtAr: `اليوم • ${nowTimeAr}`,
      },
      ...prev,
    ]);

    pushNotification({
      recipientRole: 'customer',
      titleAr: `مكافأة ولاء: +${cashbackAmountEgp} ج.م كاش باك (${cashbackPercent}%)`,
      bodyAr: `اكتسبت ${pointsEarned} نقطة ولاء عن إتمام طلب #${target.orderNumber.replace(/^#/, '')}.`,
      orderNumber: target.orderNumber,
    });
  };

  const redeemLoyaltyCashbackToWallet = (): { success: boolean; transferredEgp: number } => {
    const amount = Math.floor(loyaltyCashbackBalanceEgp);
    if (amount < 1) return { success: false, transferredEgp: 0 };
    const nowTimeAr = formatArabicClockTime(new Date());

    setLoyaltyCashbackBalanceEgp((prev) => Math.max(0, prev - amount));
    setCustomerWalletBalanceEgp((prev) => prev + amount);
    setWalletTransactions((prev) => [
      {
        id: `wtx_loy_${Date.now()}`,
        titleAr: 'تحويل رصيد كاش باك نقاط الولاء إلى المحفظة',
        type: 'credit',
        amountEgp: amount,
        methodAr: 'كاش باك ولاء مشوار',
        timestampAr: `اليوم • ${nowTimeAr}`,
      },
      ...prev,
    ]);

    return { success: true, transferredEgp: amount };
  };

  const captainUpdateStep = (
    orderId: string,
    nextStatus: 'at_pickup' | 'picked_up' | 'in_transit' | 'delivered'
  ) => {
    const nowTimeAr = formatArabicClockTime(new Date());
    const targetOrder = orders.find((o) => o.id === orderId);
    // Enforce 4-digit security PIN verification before starting passenger rides
    if (
      targetOrder?.serviceType === 'ride' &&
      targetOrder.ridePin &&
      nextStatus === 'in_transit'
    ) {
      return;
    }
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              acceptedAt: o.acceptedAt,
              acceptedAtIso: o.acceptedAtIso,
              pickedUpAt:
                nextStatus === 'picked_up' || nextStatus === 'in_transit'
                  ? o.pickedUpAt || nowTimeAr
                  : o.pickedUpAt,
              deliveredAt: nextStatus === 'delivered' ? nowTimeAr : o.deliveredAt,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, { status: nextStatus }).catch(() => {});

    if (nextStatus === 'delivered' && targetOrder) {
      awardLoyaltyForOrder(orderId, targetOrder);
    }
  };

  const captainConfirmCashCollection = (orderId: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;
    const nowTimeAr = formatArabicClockTime(new Date());

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'delivered', deliveredAt: nowTimeAr } : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, { status: 'delivered' }).catch(() => {});

    // 100% of delivery fee + tip goes to captain (0% commission invariant)
    const captainEarned = targetOrder.deliveryFeeEgp + (targetOrder.driverTipEgp || 0);
    setCaptainEarningsEgp((prev) => prev + captainEarned);
    setCaptainCompletedDeliveries((prev) => prev + 1);
    if (targetOrder.paymentMethod === 'cash') {
      setCaptainCashHoldingEgp((prev) => prev + targetOrder.totalEgp);
    }

    setCaptains((prev) =>
      prev.map((c) =>
        c.id === 'cpt_02' || c.userId === targetOrder.assignedCaptainId
          ? {
              ...c,
              cashHoldingPiasters:
                targetOrder.paymentMethod === 'cash'
                  ? c.cashHoldingPiasters + targetOrder.totalEgp * 100
                  : c.cashHoldingPiasters,
              completedToday: c.completedToday + 1,
            }
          : c
      )
    );

    pushNotification({
      recipientRole: 'customer',
      titleAr: `تم تسليم طلبك #${targetOrder.orderNumber} بنجاح`,
      bodyAr: `شكراً لاستخدامك مشوار الباجور! تم تحصيل ${targetOrder.totalEgp}.00 ج.م.`,
      orderNumber: targetOrder.orderNumber,
    });

    awardLoyaltyForOrder(orderId, targetOrder);
  };

  // Legacy direct wallet topup helper (kept for compatibility, delegates safely)
  const topUpCustomerWallet = (amountEgp: number, methodAr: string) => {
    const sanitizedAmount = Math.round(Number(amountEgp));
    if (!Number.isFinite(sanitizedAmount) || sanitizedAmount < 10 || sanitizedAmount > 5000) return;
    const nowTimeAr = formatArabicClockTime(new Date());
    setCustomerWalletBalanceEgp((prev) => prev + sanitizedAmount);
    setWalletTransactions((prev) => [
      {
        id: `wtx_${Date.now()}`,
        titleAr: `شحن رصيد (${methodAr})`,
        type: 'credit',
        amountEgp: sanitizedAmount,
        methodAr,
        timestampAr: `اليوم • ${nowTimeAr}`,
      },
      ...prev,
    ]);
  };

  // Real Proof-Verified Wallet Top-Up via backend /api/v1/payments/verify-proof + Firestore
  const topUpCustomerWalletWithProof = async (
    amountEgp: number,
    methodAr: string,
    proofRef: string
  ): Promise<{ success: boolean; messageAr: string }> => {
    const sanitizedAmount = Math.round(Number(amountEgp));
    const trimmedRef = proofRef.trim();
    if (!Number.isFinite(sanitizedAmount) || sanitizedAmount < 10 || sanitizedAmount > 5000) {
      return { success: false, messageAr: 'يرجى إدخال مبلغ شحن بين ١٠ و ٥٠٠٠ ج.م.' };
    }
    if (trimmedRef.length < 4) {
      return { success: false, messageAr: 'يرجى إدخال رقم مرجع التحويل الصحيح (مثال: IPN-849201).' };
    }

    try {
      const resp = await fetch('/api/v1/payments/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountEgp: sanitizedAmount,
          method: methodAr.includes('فودافون') ? 'vodafone_cash' : 'instapay',
          referenceCode: trimmedRef,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        return {
          success: false,
          messageAr: json?.errorAr || 'تعذر التحقق من مرجع التحويل، تأكد من الرقم.',
        };
      }

      const nowTimeAr = formatArabicClockTime(new Date());
      const topUpTxId = `wtx_${Date.now()}`;
      const topUpTitleAr = `شحن رصيد موثق (${methodAr} • مرجع ${trimmedRef})`;
      setCustomerWalletBalanceEgp((prev) => prev + sanitizedAmount);
      setWalletTransactions((prev) => [
        {
          id: topUpTxId,
          titleAr: topUpTitleAr,
          type: 'credit',
          amountEgp: sanitizedAmount,
          methodAr,
          timestampAr: `اليوم • ${nowTimeAr}`,
        },
        ...prev,
      ]);

      submitWalletTopUpProofInFirestore({
        txId: topUpTxId,
        amountPiasters: sanitizedAmount * 100,
        proofRef: trimmedRef,
        titleAr: topUpTitleAr,
      }).catch(() => {});

      return {
        success: true,
        messageAr: json?.data?.messageAr || `تم شحن ${sanitizedAmount} ج.م بنجاح (${trimmedRef}).`,
      };
    } catch {
      return {
        success: false,
        messageAr: 'تعذر الاتصال بخادم التحقق حالياً، حاول مرة أخرى.',
      };
    }
  };

  // Validate Promo Coupon against backend /api/v1/promos/validate
  const applyPromoCode = async (
    code: string,
    orderTotalEgp: number
  ): Promise<{ valid: boolean; code: string; discountEgp: number; titleAr: string; errorAr?: string }> => {
    const clean = code.trim().toUpperCase();
    if (!clean) {
      return { valid: false, code: '', discountEgp: 0, titleAr: '', errorAr: 'أدخل كود الخصم أولاً' };
    }
    try {
      const resp = await fetch('/api/v1/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean, orderTotalEgp }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        return {
          valid: false,
          code: clean,
          discountEgp: 0,
          titleAr: '',
          errorAr: json?.errorAr || 'كود الخصم غير صالح أو لم يبلغ الحد الأدنى',
        };
      }
      return {
        valid: true,
        code: json.data.code,
        discountEgp: json.data.discountEgp,
        titleAr: json.data.titleAr,
      };
    } catch {
      return {
        valid: false,
        code: clean,
        discountEgp: 0,
        titleAr: '',
        errorAr: 'تعذر التحقق من الكود، يرجى المحاولة لاحقاً',
      };
    }
  };

  // Redeem Friend Referral Code (+15 EGP Wallet Credit)
  const redeemReferralCode = (code: string): { success: boolean; messageAr: string } => {
    const clean = code.trim().toUpperCase();
    if (referredByCode) {
      return { success: false, messageAr: `تم استخدام كود دعوة بالفعل (${referredByCode}).` };
    }
    if (!clean.startsWith('MSH-') || clean.length < 6) {
      return { success: false, messageAr: 'صيغة كود الدعوة غير صحيحة (يبدأ بـ MSH-).' };
    }
    if (clean === referralCode) {
      return { success: false, messageAr: 'لا يمكنك استخدام كود الدعوة الخاص بك.' };
    }

    const bonusEgp = 15;
    const nowTimeAr = formatArabicClockTime(new Date());
    setReferredByCode(clean);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEYS.REFERRED_BY, clean);
      } catch {
        // ignore
      }
    }
    setCustomerWalletBalanceEgp((prev) => prev + bonusEgp);
    setWalletTransactions((prev) => [
      {
        id: `wtx_ref_${Date.now()}`,
        titleAr: `مكافأة دعوة صديق (${clean})`,
        type: 'credit',
        amountEgp: bonusEgp,
        methodAr: 'دعوة أصدقاء مشوار',
        timestampAr: `اليوم • ${nowTimeAr}`,
      },
      ...prev,
    ]);

    return {
      success: true,
      messageAr: `تم تفعيل كود الدعوة ${clean} وإضافة ${bonusEgp} ج.م لمحفظتك بنجاح!`,
    };
  };

  // Daily Village-to-Center Commute Subscriptions
  const createCommuteSubscription = (input: {
    fromLandmark: string;
    toLandmark: string;
    scheduleDays: string[];
    morningTime: string;
    returnTime?: string;
    vehicleTier: 'tuktuk' | 'car';
    planType: 'weekly' | 'monthly';
  }): { success: boolean; subscription?: CommuteSubscriptionItem; errorAr?: string } => {
    if (!input.fromLandmark || !input.toLandmark || input.scheduleDays.length === 0) {
      return { success: false, errorAr: 'اختر نقطة الانطلاق والوصول وأيام الأسبوع أولاً.' };
    }
    if (input.fromLandmark === input.toLandmark) {
      return { success: false, errorAr: 'يجب أن تختلف نقطة الوصول عن نقطة الانطلاق.' };
    }

    const fromLm = EL_BAGOUR_LANDMARKS_LIST.find((l) => l.nameAr === input.fromLandmark);
    const toLm = EL_BAGOUR_LANDMARKS_LIST.find((l) => l.nameAr === input.toLandmark);
    const estDistanceKm = Math.max(
      2.5,
      Math.abs((fromLm?.distanceFromCenterKm || 3) - (toLm?.distanceFromCenterKm || 1)) + 2
    );

    const pricePiasters = calculateCommuteSubscriptionPricePiasters({
      distanceKm: estDistanceKm,
      vehicleTier: input.vehicleTier,
      planType: input.planType,
      daysCount: input.scheduleDays.length,
      hasReturnTrip: Boolean(input.returnTime),
    });
    const priceEgp = Math.round(pricePiasters / 100);

    const newSubId = `sub_${Date.now()}`;
    const generatedSlots = buildTodayCommuteSlots(newSubId, input.morningTime, input.returnTime);
    const newSub: CommuteSubscriptionItem = {
      id: newSubId,
      fromLandmark: input.fromLandmark,
      toLandmark: input.toLandmark,
      scheduleDays: input.scheduleDays,
      morningTime: input.morningTime,
      returnTime: input.returnTime,
      vehicleTier: input.vehicleTier,
      planType: input.planType,
      priceEgp,
      status: 'active',
      createdAtAr: 'الآن',
      slots: generatedSlots,
    };

    setCommuteSubscriptions((prev) => [newSub, ...prev]);

    createCommuteSubscriptionInFirestore({
      id: newSub.id,
      fromLandmark: input.fromLandmark,
      toLandmark: input.toLandmark,
      scheduleDays: input.scheduleDays,
      morningTime: input.morningTime,
      returnTime: input.returnTime,
      vehicleTier: input.vehicleTier,
      planType: input.planType,
      pricePiasters,
    })
      .then((ok) => {
        if (ok) {
          setFirestoreSubIds((prev) => Array.from(new Set([...prev, newSub.id])));
          for (const sl of generatedSlots) {
            syncCommuteSlotToFirestore(newSub.id, sl).catch(() => {});
          }
        }
      })
      .catch(() => {});

    pushNotification({
      recipientRole: 'customer',
      titleAr: `تم تفعيل اشتراك المشوار اليومي (${input.planType === 'monthly' ? 'شهري' : 'أسبوعي'})`,
      bodyAr: `من ${input.fromLandmark} إلى ${input.toLandmark} • ${priceEgp} ج.م`,
    });

    return { success: true, subscription: newSub };
  };

  const toggleCommuteSubscriptionStatus = (subId: string) => {
    setCommuteSubscriptions((prev) =>
      prev.map((s) =>
        s.id === subId ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s
      )
    );
  };

  const advanceCommuteSlotStatus = (subId: string, slotId: string) => {
    const orderFlow: CommuteSlotStatus[] = ['scheduled', 'driver_assigned', 'en_route', 'completed'];
    let promotedForSync: CommuteSlotItem | null = null;
    setCommuteSubscriptions((prev) =>
      prev.map((sub) => {
        if (sub.id !== subId) return sub;
        const slots = (sub.slots || []).map((sl) => {
          if (sl.id !== slotId || sl.status === 'completed' || sl.status === 'skipped') return sl;
          const idx = orderFlow.indexOf(sl.status);
          const nextStatus = orderFlow[Math.min(orderFlow.length - 1, idx + 1)] || 'completed';
          const updated: CommuteSlotItem = {
            ...sl,
            status: nextStatus,
            captainName: sl.captainName || 'كابتن أحمد فتحي الديب',
            ridePin: sl.ridePin || generateFourDigitPin(),
          };
          promotedForSync = updated;
          return updated;
        });
        return { ...sub, slots };
      })
    );
    if (promotedForSync && firestoreSubIds.includes(subId)) {
      syncCommuteSlotToFirestore(subId, promotedForSync).catch(() => {});
    }
  };

  const toggleSkipCommuteSlot = (subId: string, slotId: string) => {
    let updatedForSync: CommuteSlotItem | null = null;
    setCommuteSubscriptions((prev) =>
      prev.map((sub) => {
        if (sub.id !== subId) return sub;
        const slots = (sub.slots || []).map((sl) => {
          if (sl.id !== slotId || sl.status === 'completed') return sl;
          const nextStatus: CommuteSlotStatus = sl.status === 'skipped' ? 'scheduled' : 'skipped';
          const updated: CommuteSlotItem = { ...sl, status: nextStatus };
          updatedForSync = updated;
          return updated;
        });
        return { ...sub, slots };
      })
    );
    if (updatedForSync && firestoreSubIds.includes(subId)) {
      syncCommuteSlotToFirestore(subId, updatedForSync).catch(() => {});
    }
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const submitComplaint = (input: {
    orderNumber?: string;
    categoryAr: string;
    subjectAr: string;
    descriptionAr: string;
  }): SupportComplaint => {
    const newTicket: SupportComplaint = {
      id: `cmp_${Date.now()}`,
      ticketNumber: `TKT-${Math.floor(1002 + Math.random() * 899)}`,
      orderNumber: input.orderNumber,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      categoryAr: input.categoryAr,
      subjectAr: input.subjectAr,
      descriptionAr: input.descriptionAr,
      status: 'open',
      createdAtAr: 'الآن',
    };
    setComplaints((prev) => [newTicket, ...prev]);

    fetch('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'other',
        subjectAr: input.subjectAr,
        descriptionAr: input.descriptionAr,
      }),
    }).catch(() => {});

    return newTicket;
  };

  // Operations / Admin Actions (Synchronized with Mobile Preview)
  const adminAssignCaptain = (
    orderId: string,
    captainId: string,
    actorName: string,
    actorRole: string
  ): { success: boolean; message: string } => {
    const captain = captains.find((c) => c.id === captainId);
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!captain || !targetOrder) {
      return { success: false, message: 'الكابتن أو الطلب غير موجود.' };
    }
    if (targetOrder.status === 'delivered' || targetOrder.status === 'cancelled') {
      return {
        success: false,
        message: `غير مسموح بالتوجيه الإداري: الطلب في حالة نهائية (${targetOrder.status}).`,
      };
    }

    const allowedDispatchStatuses =
      targetOrder.serviceType === 'restaurant_store' || targetOrder.serviceType === 'prescription_list'
        ? ['searching_captain', 'ready_for_pickup', 'accepted_by_store']
        : ['searching_captain', 'ready_for_pickup', 'created'];

    if (!allowedDispatchStatuses.includes(targetOrder.status)) {
      return {
        success: false,
        message: `انتقال حالة غير صالح للتوجيه اليدوي: لا يمكن تعيين كابتن والطلب في حالة (${targetOrder.status}).`,
      };
    }

    if (!captain.isOnline) {
      return {
        success: false,
        message: `عذراً: الكابتن (${captain.name}) غير متصل حالياً (Offline).`,
      };
    }

    if (captain.status === 'expired' || captain.status === 'suspended') {
      return {
        success: false,
        message: `عذراً: الكابتن غير مؤهل لاستلام الطلبات حالياً (${captain.statusAr}).`,
      };
    }

    if (targetOrder.paymentMethod === 'cash' && captain.cashHoldingPiasters >= captain.cashCeilingPiasters) {
      return {
        success: false,
        message: `عذراً: الكابتن تجاوز سقف العهدة النقدية المسموح به للطلبات النقدية.`,
      };
    }

    if (targetOrder.requiresFamilyTrustedDriver && !captain.isFamilyTrusted) {
      return {
        success: false,
        message: `عذراً: هذا الطلب يشترط كابتن موثوق للعائلات.`,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: captain.userId || captain.id,
              assignedCaptainName: captain.name,
              assignedCaptainPhone: captain.phone,
              assignedCaptainVehicle: `${captain.vehicleType} • ${captain.plateNumber}`,
              assignedCaptainRating: captain.rating,
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, {
      status: 'captain_assigned',
      assignedCaptainId: captain.userId || captain.id,
      assignedCaptainName: captain.name,
    }).catch(() => {});

    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
        target: `طلب ${targetOrder.orderNumber}`,
        descriptionAr: `تدخل يدوي من العمليات: تعيين الكابتن ${captain.name} للطلب ${targetOrder.orderNumber}.`,
      },
      ...prev,
    ]);

    return {
      success: true,
      message: `تم تعيين الكابتن ${captain.name} للطلب ${targetOrder.orderNumber} بنجاح.`,
    };
  };

  const adminEmergencyCancelOrder = (
    orderId: string,
    reason: string,
    actorName: string,
    actorRole: string
  ): { success: boolean; message: string } => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) {
      return { success: false, message: 'الطلب غير موجود.' };
    }
    if (targetOrder.status === 'delivered' || targetOrder.status === 'cancelled') {
      return {
        success: false,
        message: `لا يمكن إلغاء طلب في حالة نهائية (${targetOrder.status}).`,
      };
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', notes: `[إلغاء إداري: ${reason}]` }
          : o
      )
    );

    updateDeliveryOrderInFirestore(orderId, { status: 'cancelled' }).catch(() => {});

    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'ORDER_EMERGENCY_CANCELLED',
        target: `طلب ${targetOrder.orderNumber}`,
        descriptionAr: `إلغاء إداري للطلب ${targetOrder.orderNumber}. السبب: ${reason}.`,
      },
      ...prev,
    ]);

    return {
      success: true,
      message: `تم إلغاء الطلب ${targetOrder.orderNumber} بنجاح.`,
    };
  };

  const adminSettleCaptainCash = (
    captainId: string,
    amountPiasters: number,
    actorName: string,
    actorRole: string,
    settlementReference?: string
  ): { success: boolean; message: string; remittedAmountPiasters?: number; remainingCashPiasters?: number } => {
    const captain = captains.find((c) => c.id === captainId);
    if (!captain) {
      return { success: false, message: 'الكابتن غير موجود في النظام.' };
    }
    if (
      typeof amountPiasters !== 'number' ||
      !Number.isFinite(amountPiasters) ||
      !Number.isInteger(amountPiasters) ||
      amountPiasters <= 0
    ) {
      return {
        success: false,
        message: 'قيمة المبلغ بالقروش غير صالحة. يجب أن تكون عدداً صحيحاً موجباً بالقروش.',
      };
    }
    if (amountPiasters > captain.cashHoldingPiasters) {
      return {
        success: false,
        message: `المبلغ المطلوب تسويته (${amountPiasters} قرش / ${(amountPiasters / 100).toFixed(2)} ج.م) يتجاوز العهدة النقدية المسجلة للكابتن (${captain.cashHoldingPiasters} قرش / ${(captain.cashHoldingPiasters / 100).toFixed(2)} ج.م).`,
      };
    }

    const newHolding = captain.cashHoldingPiasters - amountPiasters;

    setCaptains((prev) =>
      prev.map((c) => {
        if (c.id === captainId) {
          const newStatus =
            c.status === 'suspended' && newHolding < c.cashCeilingPiasters
              ? 'active'
              : c.status;
          return {
            ...c,
            cashHoldingPiasters: newHolding,
            status: newStatus,
            statusAr: newStatus === 'active' ? 'اشتراك نشط' : c.statusAr,
          };
        }
        return c;
      })
    );

    if (captain.id === 'cpt_02') {
      setCaptainCashHoldingEgp(Math.round(newHolding / 100));
    }

    const refSuffix = settlementReference ? ` [مرجع: ${settlementReference}]` : '';
    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'CAPTAIN_CASH_SETTLED',
        target: `كابتن ${captain.name}`,
        descriptionAr: `توريد وتسوية نقدية بمبلغ ${amountPiasters} قرش (${(amountPiasters / 100).toFixed(2)} ج.م) للكابتن ${captain.name}. المتبقي في العهدة: ${newHolding} قرش (${(newHolding / 100).toFixed(2)} ج.م).${refSuffix}`,
      },
      ...prev,
    ]);

    return {
      success: true,
      message: `تم استلام وتسوية ${amountPiasters} قرش (${(amountPiasters / 100).toFixed(2)} ج.م) من ${captain.name} بنجاح.`,
      remittedAmountPiasters: amountPiasters,
      remainingCashPiasters: newHolding,
    };
  };

  const adminRenewCaptainSubscription = (
    captainId: string,
    actorName: string,
    actorRole: string
  ) => {
    const captain = captains.find((c) => c.id === captainId);
    if (!captain) return;

    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId
          ? {
              ...c,
              status: 'active',
              statusAr: 'اشتراك نشط',
              daysRemaining: 30,
            }
          : c
      )
    );

    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'CAPTAIN_SUBSCRIPTION_RENEWED',
        target: `كابتن ${captain.name}`,
        descriptionAr: `تجديد الاشتراك الشهري للكابتن ${captain.name} لمدة ٣٠ يوماً (بنسبة ٠٪ عمولة على الرحلات).`,
      },
      ...prev,
    ]);
  };

  const adminToggleCaptainFamilyTrusted = (
    captainId: string,
    actorName: string,
    actorRole: string
  ) => {
    const captain = captains.find((c) => c.id === captainId);
    if (!captain) return;
    const nextTrusted = !captain.isFamilyTrusted;

    setCaptains((prev) =>
      prev.map((c) =>
        c.id === captainId ? { ...c, isFamilyTrusted: nextTrusted } : c
      )
    );

    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'CAPTAIN_FAMILY_TRUST_UPDATED',
        target: `كابتن ${captain.name}`,
        descriptionAr: nextTrusted
          ? `اعتماد الكابتن ${captain.name} ضمن قائمة كباتن العائلات الموثوقين بالباجور.`
          : `إلغاء شارة كباتن العائلات عن الكابتن ${captain.name}.`,
      },
      ...prev,
    ]);
  };

  const adminUpdateSettings = (
    newSettings: PlatformSystemSettings,
    actorName: string,
    actorRole: string
  ) => {
    setSystemSettings({ ...newSettings });
    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'PRICING_CONFIG_UPDATED',
        target: 'تعريفة مركز الباجور',
        descriptionAr: `تعديل معايير التسعيرة: الأجرة الأساسية ${(newSettings.baseFarePiasters / 100).toFixed(2)} ج.م، الكيلومتر ${(newSettings.ratePerKmPiasters / 100).toFixed(2)} ج.م، بدل القرى ${(newSettings.ruralSurchargePiasters / 100).toFixed(2)} ج.م.`,
      },
      ...prev,
    ]);
  };

  const sendChatMessage = (orderId: string, text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    const nowStr = formatArabicClockTime(new Date());
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const senderRole: 'customer' | 'captain' | 'merchant' =
      currentUser.role === 'captain'
        ? 'captain'
        : currentUser.role === 'merchant'
        ? 'merchant'
        : 'customer';
    const newMsg: ChatMessage = {
      id: msgId,
      orderId,
      senderRole,
      senderName: currentUser.name,
      text: cleanText,
      time: nowStr,
    };
    setChatMessages((prev) => [...prev, newMsg]);

    if (firebaseUser && firestoreOrderIds.includes(orderId)) {
      sendThreadMessageToFirestore({
        threadId: orderId,
        msgId,
        senderRole,
        senderName: currentUser.name,
        text: cleanText,
      }).catch(() => {});
    }
  };

  // Active order for current customer
  const activeCustomerOrder =
    orders.find(
      (o) =>
        (o.customerId === currentUser.id || o.customerId === 'usr_cust_1') &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    ) || null;

  const latestTrackedOrder =
    activeCustomerOrder ||
    orders.find((o) => o.customerId === currentUser.id || o.customerId === 'usr_cust_1') ||
    null;

  const activeOrderTrackingCard = latestTrackedOrder
    ? {
        order: latestTrackedOrder,
        ...getOrderTrackingProgress(latestTrackedOrder.status),
      }
    : null;

  const advanceOrderTrackingStage = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.status === 'delivered' || target.status === 'cancelled') return;
    if (target.status === 'quote_ready') {
      customerApproveOrderQuote(orderId);
      return;
    }
    const { stageIndex } = getOrderTrackingProgress(target.status);
    if (stageIndex === 0) {
      merchantAcceptOrder(orderId);
      return;
    }
    if (stageIndex === 1) {
      if (!target.assignedCaptainId) {
        simulateInstantCaptainAccept(orderId);
      } else if (target.serviceType === 'ride' && target.ridePin) {
        captainVerifyRidePinAndStart(orderId, target.ridePin);
      } else {
        captainUpdateStep(orderId, 'in_transit');
      }
      return;
    }
    if (stageIndex === 2) {
      captainUpdateStep(orderId, 'delivered');
    }
  };

  const navigateToCustomerHistory = () => {
    const customerPersona = DEMO_PERSONAS.find((p) => p.role === 'customer');
    if (customerPersona && currentUser.role !== 'customer') {
      setCurrentUser(customerPersona);
    }
    setCustomerNavTab('history');
  };

  const refreshOrderStatus = async (orderId?: string): Promise<MarketplaceOrder | null> => {
    let latestOrders = orders;
    try {
      const saved =
        typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEYS.ORDERS) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          latestOrders = parsed.map((o: any) => ({
            ...o,
            status: o.status === 'merchant_accepted' ? 'accepted_by_store' : o.status,
            createdAtDate: o.createdAtDate ? new Date(o.createdAtDate) : new Date(),
          }));
          setOrders(latestOrders);
        }
      }
    } catch {
      // Keep in-memory orders if localStorage read fails
    }

    if (orderId) {
      const matched = latestOrders.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (matched) return matched;
    }

    return (
      latestOrders.find(
        (o) =>
          (o.customerId === currentUser.id || o.customerId === 'usr_cust_1') &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      ) ||
      latestOrders[0] ||
      null
    );
  };

  return (
    <MarketplaceContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isFirestoreRealtimeActive: Boolean(firebaseUser),
        isFirestoreStoresLive,
        switchDemoUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        stores,
        toggleStoreStatus,
        products,
        toggleProductAvailability,
        updateProductPrice,
        favoriteProductIds: favoritesState.productIds,
        favoriteStoreIds: favoritesState.storeIds,
        favoriteServiceKeys: favoritesState.serviceKeys,
        toggleFavoriteProduct,
        toggleFavoriteStore,
        toggleFavoriteService,
        isFavoriteProduct,
        isFavoriteStore,
        isFavoriteService,
        cartItems,
        cartStoreId,
        cartStoreIds,
        cartStoreGroups,
        cartMultiStopSavingsEgp,
        cartProximityKm,
        cartProximitySavedEgp,
        cartDeliveryFeeBreakdownAr,
        addToCart,
        addExtractedItemsToCart,
        removeFromCart,
        updateCartItemQty,
        clearCart,
        forceAddToCartNewStore,
        cartSubtotalEgp,
        cartDeliveryFeeEgp,
        cartPlatformFeeEgp,
        cartTotalEgp,
        orders,
        submitNewOrder,
        submitDirectStoreOrder,
        submitPrescriptionOrder,
        submitRideOrPackageOrder,
        simulateInstantCaptainAccept,
        customerCancelOrder,
        customerApproveOrderQuote,
        rateOrderCaptain,
        updateOrderNotes,
        updateOrderFeedback,
        updateOrderDriverTip,
        driverRatings,
        submitDriverReview,
        merchantAcceptOrder,
        merchantSubmitOrderQuote,
        merchantMarkReady,
        merchantRejectOrder,
        isCaptainOnline,
        setIsCaptainOnline,
        captainEarningsEgp,
        captainCompletedDeliveries,
        captainCashHoldingEgp,
        captainAcceptDelivery,
        captainVerifyRidePinAndStart,
        captainUpdateStep,
        captainConfirmCashCollection,
        customerWalletBalanceEgp,
        walletTransactions,
        topUpCustomerWallet,
        topUpCustomerWalletWithProof,
        referralCode,
        referredByCode,
        applyPromoCode,
        redeemReferralCode,
        commuteSubscriptions,
        createCommuteSubscription,
        toggleCommuteSubscriptionStatus,
        advanceCommuteSlotStatus,
        toggleSkipCommuteSlot,
        loyaltyPoints,
        loyaltyCashbackBalanceEgp,
        loyaltyTier: currentLoyaltyTierInfo.tier,
        loyaltyTierLabelAr: currentLoyaltyTierInfo.tierLabelAr,
        loyaltyDeliveryPercent: currentLoyaltyTierInfo.deliveryPercent,
        loyaltyRidePercent: currentLoyaltyTierInfo.ridePercent,
        nextTierPointsTarget: currentLoyaltyTierInfo.nextTierPointsTarget,
        loyaltyHistory,
        redeemLoyaltyCashbackToWallet,
        awardLoyaltyForOrder,
        notifications,
        markAllNotificationsRead,
        captainNotifications,
        latestCaptainAlert,
        dismissLatestCaptainAlert,
        markCaptainNotificationRead,
        markAllCaptainNotificationsRead,
        captainCustomSound,
        updateCaptainCustomSound,
        simulateElBagourCaptainDispatchAlert,
        complaints,
        submitComplaint,
        captains,
        systemSettings,
        auditLogs,
        adminAssignCaptain,
        adminEmergencyCancelOrder,
        adminSettleCaptainCash,
        adminRenewCaptainSubscription,
        adminToggleCaptainFamilyTrusted,
        adminUpdateSettings,
        chatMessages,
        sendChatMessage,
        activeChatThreadId,
        setActiveChatThreadId,
        batteryLevelPercent,
        hardwareBatterySupported,
        isCharging,
        batterySaverPreference,
        setBatterySaverPreference,
        simulatedBatteryPercent,
        setSimulatedBatteryPercent,
        isBatteryLow,
        isBatterySaverActive,
        gpsUpdateIntervalMs,
        gpsHighAccuracy,
        gpsTrackingLocation,
        forceGpsSyncNow,
        activeCustomerOrder,
        activeOrderTrackingCard,
        advanceOrderTrackingStage,
        refreshOrderStatus,
        customerNavTab,
        setCustomerNavTab,
        navigateToCustomerHistory,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = (): MarketplaceContextType => {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return ctx;
};

