import React, { createContext, useContext, useState, useEffect } from 'react';

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
  badgeAr?: string;
  image: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
  notes?: string;
}

export type OrderStatus =
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

export type OrderServiceType = 'restaurant_store' | 'package' | 'errand';

export interface MarketplaceOrder {
  id: string;
  orderNumber: string;
  serviceType: OrderServiceType;
  serviceTypeAr: string;
  vehicleCategory?: 'scooter' | 'motorcycle' | 'van';
  storeId: string;
  storeName: string;
  storeAddress: string;
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  estimatedMinutes: string;
  isRural: boolean;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unitPriceEgp: number;
  }[];
  itemDescription: string;
  subtotalEgp: number;
  deliveryFeeEgp: number;
  platformFeeEgp: number;
  ruralSurchargeEgp: number;
  totalEgp: number;
  totalFarePiasters: number;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
  status: OrderStatus;
  assignedCaptainId?: string;
  assignedCaptainName?: string;
  assignedCaptainPhone?: string;
  assignedCaptainVehicle?: string;
  assignedCaptainRating?: number;
  createdAt: string;
  createdAtDate: Date;
  acceptedAt?: string;
  acceptedAtIso?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  quoteId?: string;
  quoteSignature?: string;
  notes?: string;
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

export interface AppNotification {
  id: string;
  recipientRole: PersonaRole | 'all';
  titleAr: string;
  bodyAr: string;
  timeAr: string;
  orderNumber?: string;
  isRead: boolean;
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
  completedToday: number;
}

export interface PlatformSystemSettings {
  baseFarePiasters: number; // 1500 = 15 EGP
  ratePerKmPiasters: number; // 400 = 4 EGP
  ruralSurchargePiasters: number; // 500 = 5 EGP
  platformFeePiasters: number; // 200 = 2 EGP
  cashCeilingPiasters: number; // 100000 = 1000 EGP
  gracePeriodHours: number; // 72 hours
  passengerLockEnabled: boolean; // Always true per Law No. 73 of 2018
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
  if (!acceptedAtIso) return acceptedAtLabel || null;

  const dt = new Date(acceptedAtIso);
  if (isNaN(dt.getTime())) return acceptedAtLabel || null;

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

// ============================================================================
// 3. REALISTIC SEED DATA (EL BAGOUR, MENOUFIA)
// ============================================================================

export const EL_BAGOUR_LANDMARKS_LIST: {
  id: string;
  nameAr: string;
  areaAr: string;
  isRural: boolean;
  distanceFromCenterKm: number;
}[] = [
  { id: 'lm_station', nameAr: 'ميدان المحطة - وسط الباجور', areaAr: 'وسط المدينة', isRural: false, distanceFromCenterKm: 0.5 },
  { id: 'lm_shorouk', nameAr: 'شارع الجيش - برج الشروق', areaAr: 'حي وسط التجاري', isRural: false, distanceFromCenterKm: 1.4 },
  { id: 'lm_hospital', nameAr: 'مستشفى الباجور العام', areaAr: 'شارع المستشفى', isRural: false, distanceFromCenterKm: 2.1 },
  { id: 'lm_council', nameAr: 'مجلس مدينة الباجور', areaAr: 'شارع الجمهورية', isRural: false, distanceFromCenterKm: 1.2 },
  { id: 'lm_banque_misr', nameAr: 'شارع الجمهورية - أمام بنك مصر', areaAr: 'وسط البلد', isRural: false, distanceFromCenterKm: 1.6 },
  { id: 'lm_masaken', nameAr: 'منطقة المساكن الشعبية', areaAr: 'شرق الباجور', isRural: false, distanceFromCenterKm: 2.4 },
  { id: 'lm_mawqaf', nameAr: 'مجمع مواقف الباجور الجديد', areaAr: 'مدخل المدينة', isRural: false, distanceFromCenterKm: 2.0 },
  { id: 'lm_kafr_bagour', nameAr: 'قرية كفر الباجور', areaAr: 'القرى الجنوبية', isRural: true, distanceFromCenterKm: 3.2 },
  { id: 'lm_shantana', nameAr: 'قرية شنتنا الحجر', areaAr: 'القرى الشمالية', isRural: true, distanceFromCenterKm: 5.2 },
  { id: 'lm_grawan', nameAr: 'قرية جروان', areaAr: 'القرى الجنوبية', isRural: true, distanceFromCenterKm: 4.5 },
  { id: 'lm_meet_afif', nameAr: 'قرية ميت عفيف', areaAr: 'القرى الشمالية', isRural: true, distanceFromCenterKm: 6.0 },
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
  {
    id: 'usr_ops_admin',
    name: 'د. علاء (غرفة العمليات)',
    phone: '01000000001',
    role: 'operations',
    roleBadgeAr: 'إدارة العمليات المركزية',
    avatar: '🛡️',
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
  serviceType: 'errand' | 'package';
  vehicleCategory: 'scooter' | 'motorcycle' | 'van';
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm: number;
  isRural: boolean;
  itemDescription: string;
  recipientPhone: string;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
  notes?: string;
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

interface MarketplaceContextType {
  // Active Auth Persona
  currentUser: DemoUser;
  switchDemoUser: (user: DemoUser) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;

  // Stores & Products
  stores: StoreItem[];
  toggleStoreStatus: (storeId: string) => void;
  products: ProductItem[];
  toggleProductAvailability: (productId: string) => void;
  updateProductPrice: (productId: string, newPriceEgp: number) => void;

  // Customer Cart (Single-Store Constraint)
  cartItems: CartItem[];
  cartStoreId: string | null;
  addToCart: (product: ProductItem, store: StoreItem) => { success: boolean; conflictStore?: string };
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
  }) => MarketplaceOrder | null;
  submitRideOrPackageOrder: (params: SubmitRideOrPackageInput) => MarketplaceOrder;
  simulateInstantCaptainAccept: (orderId: string) => void;
  customerCancelOrder: (orderId: string, reason?: string) => void;

  // Merchant Actions
  merchantAcceptOrder: (orderId: string) => void;
  merchantMarkReady: (orderId: string) => void;
  merchantRejectOrder: (orderId: string, reason?: string) => void;

  // Captain State & Actions
  isCaptainOnline: boolean;
  setIsCaptainOnline: (online: boolean) => void;
  captainEarningsEgp: number;
  captainCompletedDeliveries: number;
  captainCashHoldingEgp: number;
  captainAcceptDelivery: (orderId: string) => void;
  captainUpdateStep: (orderId: string, nextStatus: 'at_pickup' | 'picked_up' | 'in_transit' | 'delivered') => void;
  captainConfirmCashCollection: (orderId: string) => void;

  // Customer Wallet & Transactions
  customerWalletBalanceEgp: number;
  walletTransactions: WalletTransaction[];
  topUpCustomerWallet: (amountEgp: number, methodAr: string) => void;

  // Notifications & Support Complaints
  notifications: AppNotification[];
  markAllNotificationsRead: () => void;
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
  adminEmergencyCancelOrder: (orderId: string, reason: string, actorName: string, actorRole: string) => void;
  adminSettleCaptainCash: (captainId: string, amountPiasters: number, actorName: string, actorRole: string) => void;
  adminRenewCaptainSubscription: (captainId: string, actorName: string, actorRole: string) => void;
  adminUpdateSettings: (newSettings: PlatformSystemSettings, actorName: string, actorRole: string) => void;

  // Chat Messages
  chatMessages: ChatMessage[];
  sendChatMessage: (orderId: string, text: string) => void;

  // Active Customer Order Shortcut
  activeCustomerOrder: MarketplaceOrder | null;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  ORDERS: 'mashwar_bagour_orders_v2',
  WALLET_BALANCE: 'mashwar_bagour_wallet_balance_v2',
  WALLET_TX: 'mashwar_bagour_wallet_tx_v2',
};

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<DemoUser>(DEMO_PERSONAS[0]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

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

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartStoreId, setCartStoreId] = useState<string | null>(null);

  // Captain operational metrics
  const [isCaptainOnline, setIsCaptainOnlineState] = useState<boolean>(true);
  const [captainEarningsEgp, setCaptainEarningsEgp] = useState<number>(195);
  const [captainCompletedDeliveries, setCaptainCompletedDeliveries] = useState<number>(8);
  const [captainCashHoldingEgp, setCaptainCashHoldingEgp] = useState<number>(450);

  // Customer Wallet State (Prototype Simulation persisted in localStorage)
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
        titleAr: 'شحن رصيد تجريبي عبر إنستاباي (InstaPay Prototype)',
        type: 'credit',
        amountEgp: 200,
        methodAr: 'إنستاباي (محاكاة)',
        timestampAr: 'أمس • ٠٨:٣٠ م',
      },
      {
        id: 'wtx_2',
        titleAr: 'رصيد ترحيبي تجريبي لعملاء مركز الباجور',
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

  // Persist orders & wallet across page reloads
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

  // Notifications
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
    passengerLockEnabled: true,
  });

  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([
    {
      id: 'aud_01',
      timestamp: 'اليوم ١٠:٠٠ ص',
      actorName: 'د. علاء',
      actorRole: 'owner',
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      target: 'إعدادات المنظومة',
      descriptionAr: 'اعتماد تسعيرة الانطلاق لمركز الباجور وقفل نقل الركاب طبقاً للقانون رقم ٧٣ لسنة ٢٠١٨.',
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

  // Cart Operations (Single-store enforcement)
  const addToCart = (product: ProductItem, store: StoreItem): { success: boolean; conflictStore?: string } => {
    if (cartStoreId && cartStoreId !== store.id && cartItems.length > 0) {
      const currentStore = stores.find((s) => s.id === cartStoreId);
      return {
        success: false,
        conflictStore: currentStore ? currentStore.nameAr : 'متجر آخر',
      };
    }

    setCartStoreId(store.id);
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

  const forceAddToCartNewStore = (product: ProductItem, store: StoreItem) => {
    setCartStoreId(store.id);
    setCartItems([{ product, quantity: 1 }]);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => {
      const updated = prev.filter((i) => i.product.id !== productId);
      if (updated.length === 0) setCartStoreId(null);
      return updated;
    });
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
    setCartStoreId(null);
  };

  // Cart Calculations
  const cartSubtotalEgp = cartItems.reduce(
    (sum, item) => sum + item.product.priceEgp * item.quantity,
    0
  );
  const activeCartStore = stores.find((s) => s.id === cartStoreId);
  const cartDeliveryFeeEgp = cartItems.length > 0 ? (activeCartStore?.deliveryFeeEgp ?? 15) : 0;
  const cartPlatformFeeEgp = cartItems.length > 0 ? Math.round(systemSettings.platformFeePiasters / 100) : 0;
  const cartTotalEgp = cartSubtotalEgp + cartDeliveryFeeEgp + cartPlatformFeeEgp;

  // Submit new Store Order from Customer Cart
  const submitNewOrder = (params: {
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash' | 'wallet';
    notes?: string;
  }): MarketplaceOrder | null => {
    if (cartItems.length === 0 || !activeCartStore) return null;

    const orderNum = `MSH-${Math.floor(9402 + Math.random() * 500)}`;
    const now = new Date();
    const timeStr = formatArabicClockTime(now);
    const itemsSummary = cartItems
      .map((ci) => `${ci.quantity}× ${ci.product.nameAr}`)
      .join(' + ');

    if (params.paymentMethod === 'wallet' && customerWalletBalanceEgp >= cartTotalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - cartTotalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          titleAr: `سداد طلب متجر ${activeCartStore.nameAr} (${orderNum})`,
          type: 'debit',
          amountEgp: cartTotalEgp,
          methodAr: 'خصم محفظة مشوار',
          timestampAr: `اليوم • ${timeStr}`,
          orderNumber: orderNum,
        },
        ...prev,
      ]);
    }

    const newOrder: MarketplaceOrder = {
      id: `ord_${Date.now()}`,
      orderNumber: orderNum,
      serviceType: 'restaurant_store',
      serviceTypeAr: 'طلبات مطاعم ومتاجر',
      vehicleCategory: 'scooter',
      storeId: activeCartStore.id,
      storeName: activeCartStore.nameAr,
      storeAddress: activeCartStore.address,
      pickupAddress: activeCartStore.address,
      deliveryAddress: params.deliveryAddress,
      distanceKm: activeCartStore.distanceKm,
      estimatedMinutes: activeCartStore.deliveryTimeEst,
      isRural: params.deliveryAddress.includes('قرية'),
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr_cust_1',
      customerName: currentUser.role === 'customer' ? currentUser.name : 'أحمد سعيد المنوفي',
      customerPhone: currentUser.role === 'customer' ? currentUser.phone : '01012345678',
      items: cartItems.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.nameAr,
        quantity: ci.quantity,
        unitPriceEgp: ci.product.priceEgp,
      })),
      itemDescription: itemsSummary,
      subtotalEgp: cartSubtotalEgp,
      deliveryFeeEgp: cartDeliveryFeeEgp,
      platformFeeEgp: cartPlatformFeeEgp,
      ruralSurchargeEgp: 0,
      totalEgp: cartTotalEgp,
      totalFarePiasters: cartTotalEgp * 100,
      paymentMethod: params.paymentMethod,
      status: 'created',
      createdAt: timeStr,
      createdAtDate: now,
      notes: params.notes,
    };

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    pushNotification({
      recipientRole: 'merchant',
      titleAr: `طلب جديد وارد #${orderNum} لـ ${activeCartStore.nameAr}`,
      bodyAr: `${itemsSummary} • الإجمالي ${cartTotalEgp} ج.م`,
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
      : Math.round(systemSettings.baseFarePiasters / 100);
    const distFareEgp = params.quoteData
      ? Math.round(params.quoteData.distanceFarePiasters / 100)
      : Math.round(Math.max(0, params.distanceKm - 1.5) * (systemSettings.ratePerKmPiasters / 100));
    const ruralEgp = params.quoteData
      ? Math.round(params.quoteData.ruralSurchargePiasters / 100)
      : params.isRural
      ? Math.round(systemSettings.ruralSurchargePiasters / 100)
      : 0;
    const platformEgp = params.quoteData
      ? Math.round(params.quoteData.platformFeePiasters / 100)
      : Math.round(systemSettings.platformFeePiasters / 100);
    const vehicleExtraEgp = params.vehicleCategory === 'van' ? 10 : 0;

    const deliveryFeeEgp = baseFareEgp + distFareEgp + ruralEgp + vehicleExtraEgp;
    const totalEgp = deliveryFeeEgp + platformEgp;
    const totalFarePiasters = totalEgp * 100;

    if (params.paymentMethod === 'wallet' && customerWalletBalanceEgp >= totalEgp) {
      setCustomerWalletBalanceEgp((prev) => prev - totalEgp);
      setWalletTransactions((prev) => [
        {
          id: `wtx_${Date.now()}`,
          titleAr: `سداد ${params.serviceType === 'errand' ? 'مشوار خاص' : 'توصيل طرد'} (${orderNum})`,
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
      params.serviceType === 'errand'
        ? 'مشوار خاص وتخليص فوري'
        : 'توصيل طرد وأمانات';

    const newOrder: MarketplaceOrder = {
      id: `ord_ride_${Date.now()}`,
      orderNumber: orderNum,
      serviceType: params.serviceType,
      serviceTypeAr: serviceLabel,
      vehicleCategory: params.vehicleCategory,
      storeId: params.serviceType === 'errand' ? 'direct_errand' : 'direct_package',
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
      totalEgp,
      totalFarePiasters,
      paymentMethod: params.paymentMethod,
      status: 'searching_captain',
      createdAt: timeStr,
      createdAtDate: now,
      quoteId: params.quoteData?.quoteId,
      quoteSignature: params.quoteData?.signature,
      notes: params.notes,
    };

    setOrders((prev) => [newOrder, ...prev]);

    pushNotification({
      recipientRole: 'captain',
      titleAr: `طلب ${serviceLabel} جديد #${orderNum}`,
      bodyAr: `من ${params.pickupAddress} إلى ${params.deliveryAddress} • الأجرة ${totalEgp} ج.م`,
      orderNumber: orderNum,
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

  // Customer cancels own order while in created or searching_captain
  const customerCancelOrder = (orderId: string, reason: string = 'إلغاء بناءً على رغبة العميل') => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId && (o.status === 'created' || o.status === 'searching_captain')
          ? { ...o, status: 'cancelled', notes: `${o.notes ? o.notes + ' | ' : ''}[ملغي: ${reason}]` }
          : o
      )
    );
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

  const merchantMarkReady = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: 'ready_for_pickup' } : o
      )
    );
    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      pushNotification({
        recipientRole: 'captain',
        titleAr: `طلب جاهز للاستلام الفوري #${ord.orderNumber}`,
        bodyAr: `المتجر: ${ord.storeName} • الأجرة للكابتن: +${ord.deliveryFeeEgp} ج.م`,
        orderNumber: ord.orderNumber,
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
  };

  // Captain Transitions
  const captainAcceptDelivery = (orderId: string) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTimeAr = formatArabicClockTime(now);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: currentUser.role === 'captain' ? currentUser.id : 'usr_capt_1',
              assignedCaptainName: currentUser.role === 'captain' ? currentUser.name : 'كابتن محمود الصياد',
              assignedCaptainPhone: currentUser.role === 'captain' ? currentUser.phone : '01198765432',
              assignedCaptainVehicle: currentUser.vehicleInfo || 'سكوتر بينيلي أسود • م ن ف ٤٩٢١',
              assignedCaptainRating: 4.92,
              acceptedAt: o.acceptedAt || nowTimeAr,
              acceptedAtIso: o.acceptedAtIso || nowIso,
            }
          : o
      )
    );

    const ord = orders.find((o) => o.id === orderId);
    if (ord) {
      pushNotification({
        recipientRole: 'customer',
        titleAr: `تم تعيين الكابتن لطلبك #${ord.orderNumber}`,
        bodyAr: `وقت القبول: ${ord.acceptedAt || nowTimeAr} • الكابتن في الطريق للاستلام.`,
        orderNumber: ord.orderNumber,
      });
    }
  };

  const captainUpdateStep = (
    orderId: string,
    nextStatus: 'at_pickup' | 'picked_up' | 'in_transit' | 'delivered'
  ) => {
    const nowTimeAr = formatArabicClockTime(new Date());
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
              // Preserve acceptedAt & acceptedAtIso immutably across all post-acceptance transitions
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

    // 100% of delivery fee goes to captain (0% commission invariant)
    setCaptainEarningsEgp((prev) => prev + targetOrder.deliveryFeeEgp);
    setCaptainCompletedDeliveries((prev) => prev + 1);
    setCaptainCashHoldingEgp((prev) => prev + targetOrder.totalEgp);

    // Also synchronize with the Fleet Captains table in Operations Dashboard
    setCaptains((prev) =>
      prev.map((c) =>
        c.id === 'cpt_02' || c.userId === targetOrder.assignedCaptainId
          ? {
              ...c,
              cashHoldingPiasters: c.cashHoldingPiasters + targetOrder.totalEgp * 100,
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
  };

  // Customer Wallet Top-up (Prototype Simulation with strict bounds validation)
  const topUpCustomerWallet = (amountEgp: number, methodAr: string) => {
    const sanitizedAmount = Math.round(Number(amountEgp));
    if (!Number.isFinite(sanitizedAmount) || sanitizedAmount < 10 || sanitizedAmount > 5000) return;
    const nowTimeAr = formatArabicClockTime(new Date());
    setCustomerWalletBalanceEgp((prev) => prev + sanitizedAmount);
    setWalletTransactions((prev) => [
      {
        id: `wtx_${Date.now()}`,
        titleAr: `شحن رصيد تجريبي (${methodAr} - Prototype)`,
        type: 'credit',
        amountEgp: sanitizedAmount,
        methodAr: `${methodAr} (محاكاة)`,
        timestampAr: `اليوم • ${nowTimeAr}`,
      },
      ...prev,
    ]);
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

    // Also send to real backend /api/v1/complaints if available
    fetch('/api/v1/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'other',
        subjectAr: input.subjectAr,
        descriptionAr: input.descriptionAr,
      }),
    }).catch(() => {
      // Keep local state synchronized
    });

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
    if (captain.status === 'expired' || captain.status === 'suspended') {
      return {
        success: false,
        message: `عذراً: الكابتن غير مؤهل لاستلام الطلبات حالياً (${captain.statusAr}).`,
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
  ) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', notes: `[إلغاء إداري: ${reason}]` }
          : o
      )
    );

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
  };

  const adminSettleCaptainCash = (
    captainId: string,
    amountPiasters: number,
    actorName: string,
    actorRole: string
  ) => {
    const captain = captains.find((c) => c.id === captainId);
    if (!captain || amountPiasters <= 0) return;

    setCaptains((prev) =>
      prev.map((c) => {
        if (c.id === captainId) {
          const newHolding = Math.max(0, c.cashHoldingPiasters - amountPiasters);
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
      setCaptainCashHoldingEgp((prev) => Math.max(0, prev - Math.round(amountPiasters / 100)));
    }

    setAuditLogs((prev) => [
      {
        id: `aud_${Date.now()}`,
        timestamp: 'الآن',
        actorName,
        actorRole,
        actionType: 'CAPTAIN_CASH_SETTLED',
        target: `كابتن ${captain.name}`,
        descriptionAr: `توريد وتسوية نقدية بمبلغ ${(amountPiasters / 100).toFixed(2)} ج.م للكابتن ${captain.name}. تم إيداع المبلغ بخزينة مركز الباجور.`,
      },
      ...prev,
    ]);
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

  const adminUpdateSettings = (
    newSettings: PlatformSystemSettings,
    actorName: string,
    actorRole: string
  ) => {
    setSystemSettings({ ...newSettings, passengerLockEnabled: true });
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
    if (!text.trim()) return;
    const nowStr = formatArabicClockTime(new Date());
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      orderId,
      senderRole:
        currentUser.role === 'captain'
          ? 'captain'
          : currentUser.role === 'merchant'
          ? 'merchant'
          : 'customer',
      senderName: currentUser.name,
      text: text.trim(),
      time: nowStr,
    };
    setChatMessages((prev) => [...prev, newMsg]);
  };

  // Active order for current customer
  const activeCustomerOrder =
    orders.find(
      (o) =>
        (o.customerId === currentUser.id || o.customerId === 'usr_cust_1') &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    ) || null;

  return (
    <MarketplaceContext.Provider
      value={{
        currentUser,
        switchDemoUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        stores,
        toggleStoreStatus,
        products,
        toggleProductAvailability,
        updateProductPrice,
        cartItems,
        cartStoreId,
        addToCart,
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
        submitRideOrPackageOrder,
        simulateInstantCaptainAccept,
        customerCancelOrder,
        merchantAcceptOrder,
        merchantMarkReady,
        merchantRejectOrder,
        isCaptainOnline,
        setIsCaptainOnline,
        captainEarningsEgp,
        captainCompletedDeliveries,
        captainCashHoldingEgp,
        captainAcceptDelivery,
        captainUpdateStep,
        captainConfirmCashCollection,
        customerWalletBalanceEgp,
        walletTransactions,
        topUpCustomerWallet,
        notifications,
        markAllNotificationsRead,
        complaints,
        submitComplaint,
        captains,
        systemSettings,
        auditLogs,
        adminAssignCaptain,
        adminEmergencyCancelOrder,
        adminSettleCaptainCash,
        adminRenewCaptainSubscription,
        adminUpdateSettings,
        chatMessages,
        sendChatMessage,
        activeCustomerOrder,
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
