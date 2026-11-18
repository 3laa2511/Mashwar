export const BOOTSTRAPPED_OWNER_EMAIL = 'Alaa.moagaza2016@gmail.com';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  ID_MAX: 128,
  CITY_ID_MAX: 64,
  DISPLAY_NAME_MAX: 80,
  EMAIL_MAX: 160,
  PHONE_MAX: 24,
  LANDMARK_MAX: 140,
  ITEMS_SUMMARY_MAX: 500,
  AI_ITEM_MAX: 160,
  AI_ITEMS_COUNT_MAX: 20,
  PRESCRIPTION_SUMMARY_MAX: 240,
  QUOTE_NOTES_MAX: 240,
  PROMO_CODE_MAX: 24,
  PROOF_REF_MAX: 64,
  RIDE_PIN_MIN: 4,
  RIDE_PIN_MAX: 6,
  VOICE_TRANSCRIPT_MAX: 300,
  VOICE_DURATION_MAX_SEC: 120,
  STORE_NAME_MAX: 100,
  MAX_ORDER_STOPS: 4,
  MAX_DISTANCE_KM: 75,
  CHAT_TEXT_MAX: 400,
  PLATE_LABEL_MAX: 32,
  SCHEDULED_FOR_MAX: 40,
  WELCOME_BONUS_PIASTERS: 2500,
  REFERRAL_BONUS_PIASTERS: 1500,
} as const;

export type AppRole = 'customer' | 'captain' | 'merchant' | 'owner';
export type VehicleTier = 'tuktuk' | 'scooter' | 'car';
export type DriverVehicleType = 'tuktuk' | 'scooter' | 'motorcycle' | 'car';
export type StoreCategory = 'restaurant' | 'pharmacy' | 'supermarket';
export type PaymentMethod = 'cash' | 'wallet' | 'vodafone_cash' | 'instapay';
export type CashChangeOptionEgp = 0 | 50 | 100 | 200;

export interface CityHub {
  id: string;
  nameAr: string;
  governorateAr: string;
}

export interface MenoufiaLandmark {
  id: string;
  cityId: string;
  nameAr: string;
  categoryAr: string;
  isRural: boolean;
  kmFromHub: number;
}

export const MENOUFIA_CITIES: CityHub[] = [
  { id: 'city_el_bagour', nameAr: 'الباجور', governorateAr: 'المنوفية' },
  { id: 'city_shebin', nameAr: 'شبين الكوم', governorateAr: 'المنوفية' },
  { id: 'city_menouf', nameAr: 'منوف', governorateAr: 'المنوفية' },
  { id: 'city_ashmoun', nameAr: 'أشمون', governorateAr: 'المنوفية' },
  { id: 'city_quweisna', nameAr: 'قويسنا', governorateAr: 'المنوفية' },
];

export const EL_BAGOUR_LANDMARKS: MenoufiaLandmark[] = [
  { id: 'lm_bagour_station', cityId: 'city_el_bagour', nameAr: 'ميدان المحطة - وسط الباجور', categoryAr: 'محطة', isRural: false, kmFromHub: 0.8 },
  { id: 'lm_bagour_hospital', cityId: 'city_el_bagour', nameAr: 'مستشفى الباجور العام', categoryAr: 'مستشفى', isRural: false, kmFromHub: 1.6 },
  { id: 'lm_bagour_council', cityId: 'city_el_bagour', nameAr: 'مجلس مدينة الباجور', categoryAr: 'مرفق', isRural: false, kmFromHub: 1.2 },
  { id: 'lm_bagour_gaish', cityId: 'city_el_bagour', nameAr: 'شارع الجيش - برج الشروق', categoryAr: 'شارع رئيسي', isRural: false, kmFromHub: 1.5 },
  { id: 'lm_bagour_mawqaf', cityId: 'city_el_bagour', nameAr: 'مجمع مواقف الباجور الجديد', categoryAr: 'موقف', isRural: false, kmFromHub: 2.1 },
  { id: 'lm_kafr_bagour', cityId: 'city_el_bagour', nameAr: 'قرية كفر الباجور - المسجد الكبير', categoryAr: 'قرية', isRural: true, kmFromHub: 3.4 },
  { id: 'lm_shantana', cityId: 'city_el_bagour', nameAr: 'قرية شنتنا الحجر - الوحدة الصحية', categoryAr: 'قرية', isRural: true, kmFromHub: 5.2 },
  { id: 'lm_garawan', cityId: 'city_el_bagour', nameAr: 'قرية جروان - كوبري الترعة', categoryAr: 'قرية', isRural: true, kmFromHub: 6.5 },
  { id: 'lm_meet_afif', cityId: 'city_el_bagour', nameAr: 'قرية ميت عفيف - السوق العمومي', categoryAr: 'قرية', isRural: true, kmFromHub: 4.8 },
  { id: 'lm_subk_eldahhak', cityId: 'city_el_bagour', nameAr: 'قرية سبك الضحاك - مدخل القرية', categoryAr: 'قرية', isRural: true, kmFromHub: 7.0 },
  { id: 'lm_shebin_uni', cityId: 'city_shebin', nameAr: 'جامعة المنوفية - شبين الكوم', categoryAr: 'جامعة', isRural: false, kmFromHub: 11.0 },
  { id: 'lm_menouf_station', cityId: 'city_menouf', nameAr: 'محطة قطار منوف - الوسط', categoryAr: 'محطة', isRural: false, kmFromHub: 14.5 },
  { id: 'lm_ashmoun_center', cityId: 'city_ashmoun', nameAr: 'ميدان الخالدين - أشمون', categoryAr: 'ميدان', isRural: false, kmFromHub: 18.0 },
  { id: 'lm_quweisna_ind', cityId: 'city_quweisna', nameAr: 'موقف قويسنا العمومي', categoryAr: 'موقف', isRural: false, kmFromHub: 16.0 },
];

export const RIDE_TIER_PRICING: Record<
  VehicleTier,
  { labelAr: string; subtitleAr: string; basePiasters: number; perKmPiasters: number; etaMin: number }
> = {
  tuktuk: {
    labelAr: 'توكتوك معتمد',
    subtitleAr: 'مثالي للشوارع الجانبية والقرى',
    basePiasters: 1500,
    perKmPiasters: 450,
    etaMin: 3,
  },
  scooter: {
    labelAr: 'سكوتر مشوار',
    subtitleAr: 'أسرع توصيل فردي وسط الزحام',
    basePiasters: 1200,
    perKmPiasters: 350,
    etaMin: 4,
  },
  car: {
    labelAr: 'سيارة ملاكي مكيفة',
    subtitleAr: 'للعائلات والمشاوير بين المراكز',
    basePiasters: 2800,
    perKmPiasters: 750,
    etaMin: 6,
  },
};

export function clampStr(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function sanitizeDocId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export function generateFourDigitPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function formatEgpFromPiasters(piasters: number): string {
  const egp = Math.max(0, Math.round(piasters)) / 100;
  return Number.isInteger(egp) ? `${egp} ج.م` : `${egp.toFixed(2)} ج.م`;
}

export function estimateLandmarkDistanceKm(pickupName: string, dropoffName: string): number {
  if (pickupName === dropoffName) return 1.2;
  const p = EL_BAGOUR_LANDMARKS.find((l) => l.nameAr === pickupName);
  const d = EL_BAGOUR_LANDMARKS.find((l) => l.nameAr === dropoffName);
  if (p && d) {
    return Number(Math.max(1.4, Math.min(35, Math.abs(p.kmFromHub - d.kmFromHub) + 1.8)).toFixed(1));
  }
  return 2.6;
}

export function calculateDeliveryFeePiasters(params: {
  distanceKm: number;
  stopsCount: number;
  isRural: boolean;
}): number {
  const base = 1500;
  const extraKm = Math.max(0, params.distanceKm - 1.5);
  const distanceCost = Math.round(extraKm * 400);
  const extraStopsCost = Math.max(0, params.stopsCount - 1) * 700;
  const ruralFee = params.isRural ? 500 : 0;
  return base + distanceCost + extraStopsCost + ruralFee;
}

export function calculateRideFarePiasters(tier: VehicleTier, distanceKm: number): number {
  const cfg = RIDE_TIER_PRICING[tier];
  const extraKm = Math.max(0, distanceKm - 1.5);
  return Math.max(1000, cfg.basePiasters + Math.round(extraKm * cfg.perKmPiasters));
}

export function calculateCommuteSubscriptionPricePiasters(params: {
  distanceKm: number;
  vehicleTier: 'tuktuk' | 'car';
  planType: 'weekly' | 'monthly';
  daysCount: number;
  hasReturnTrip: boolean;
}): number {
  const singleRide = calculateRideFarePiasters(params.vehicleTier, params.distanceKm);
  const tripsPerWeek = Math.max(1, params.daysCount) * (params.hasReturnTrip ? 2 : 1);
  const weeks = params.planType === 'monthly' ? 4 : 1;
  const discountFactor = params.planType === 'monthly' ? 0.78 : 0.85;
  return Math.round(singleRide * tripsPerWeek * weeks * discountFactor);
}
