/**
 * Mashwar — Persistent Data Foundation & Multi-Zone Platform Store
 * Launch Hub: El Bagour, Menoufia Governorate, Egypt (with multi-city expansion across Menoufia)
 * Monetary Units: Integer Egyptian Piasters (1 EGP = 100 Piasters)
 */

import {
  Order,
  CaptainProfile,
  City,
  ServiceZone,
  ZoneTariff,
  MerchantProfile,
  Store,
  MenuCategory,
  MenuItem,
  OrderStateHistoryEntry,
  Complaint,
  ComplaintEvent,
  NotificationRecord,
  CaptainSubscriptionRecord,
  OrderStatus,
} from '../types/index.js';
import { AuditLogger } from '../security/auditLogger.js';

export interface SystemSettings {
  hubNameAr: string; // مركز عمليات الباجور - المنوفية
  baseFarePiasters: number; // 1,500 piasters = 15.00 EGP
  baseIncludedKm: number; // 1.5 km
  ratePerKmPiasters: number; // 400 piasters = 4.00 EGP
  ruralSurchargePiasters: number; // 500 piasters = 5.00 EGP
  platformFeePiasters: number; // 200 piasters = 2.00 EGP
  captainCashCeilingPiasters: number; // 100,000 piasters = 1,000.00 EGP
  subscriptionGracePeriodHours: number; // 72 hours
  subscriptionMonthlyFeePiasters: number; // 30,000 piasters = 300.00 EGP
  passengerMobilityLocked: boolean; // Always true pursuant to Law No. 73 of 2018
  lastUpdated: string;
  updatedBy: string;
}

export const INITIAL_SYSTEM_SETTINGS: SystemSettings = {
  hubNameAr: 'مركز عمليات الباجور - المنوفية',
  baseFarePiasters: 1500,
  baseIncludedKm: 1.5,
  ratePerKmPiasters: 400,
  ruralSurchargePiasters: 500,
  platformFeePiasters: 200,
  captainCashCeilingPiasters: 100000,
  subscriptionGracePeriodHours: 72,
  subscriptionMonthlyFeePiasters: 30000,
  passengerMobilityLocked: true,
  lastUpdated: new Date().toISOString(),
  updatedBy: 'system_bootstrap',
};

export class PersistentStore {
  private static cities = new Map<string, City>();
  private static zones = new Map<string, ServiceZone>();
  private static zoneTariffs = new Map<string, ZoneTariff>();
  private static merchants = new Map<string, MerchantProfile>();
  private static stores = new Map<string, Store>();
  private static menuCategories = new Map<string, MenuCategory>();
  private static menuItems = new Map<string, MenuItem>();
  private static orders = new Map<string, Order>();
  private static orderStateHistory = new Map<string, OrderStateHistoryEntry[]>();
  private static captains = new Map<string, CaptainProfile>();
  private static captainSubscriptions = new Map<string, CaptainSubscriptionRecord[]>();
  private static complaints = new Map<string, Complaint>();
  private static notifications = new Map<string, NotificationRecord[]>();
  private static settings: SystemSettings = { ...INITIAL_SYSTEM_SETTINGS };
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;

    const nowIso = new Date().toISOString();

    // 1. Seed Cities (Al-Bagour primary launch hub + Menoufia expansion cities)
    const seedCities: City[] = [
      {
        id: 'city_el_bagour',
        code: 'EL_BAGOUR',
        nameAr: 'الباجور',
        nameEn: 'El Bagour',
        governorateAr: 'المنوفية',
        governorateEn: 'Menoufia',
        isActive: true,
        centerLat: 30.4322,
        centerLng: 31.0334,
        createdAt: nowIso,
      },
      {
        id: 'city_shebin_el_kom',
        code: 'SHEBIN_EL_KOM',
        nameAr: 'شبين الكوم',
        nameEn: 'Shebin El-Kom',
        governorateAr: 'المنوفية',
        governorateEn: 'Menoufia',
        isActive: true,
        centerLat: 30.5503,
        centerLng: 31.0106,
        createdAt: nowIso,
      },
      {
        id: 'city_menouf',
        code: 'MENOUF',
        nameAr: 'منوف',
        nameEn: 'Menouf',
        governorateAr: 'المنوفية',
        governorateEn: 'Menoufia',
        isActive: true,
        centerLat: 30.466,
        centerLng: 30.9315,
        createdAt: nowIso,
      },
      {
        id: 'city_sadat',
        code: 'SADAT_CITY',
        nameAr: 'مدينة السادات (توسع قادم)',
        nameEn: 'Sadat City',
        governorateAr: 'المنوفية',
        governorateEn: 'Menoufia',
        isActive: false, // Inactive expansion city for testing zone activation guards
        centerLat: 30.3652,
        centerLng: 30.5318,
        createdAt: nowIso,
      },
    ];

    for (const c of seedCities) {
      this.cities.set(c.id, c);
    }

    // 2. Seed Service Zones
    const seedZones: ServiceZone[] = [
      {
        id: 'zone_bagour_center',
        cityId: 'city_el_bagour',
        code: 'BAGOUR_URBAN_CENTER',
        nameAr: 'وسط مدينة الباجور',
        nameEn: 'El Bagour Urban Center',
        isRural: false,
        isActive: true,
        maxRadiusKm: 12,
        landmarksAr: [
          'ميدان المحطة - وسط الباجور',
          'مجلس مدينة الباجور',
          'شارع الجيش - برج الشروق',
          'مستشفى الباجور العام',
          'شارع الجمهورية - أمام بنك مصر',
          'منطقة المساكن الشعبية',
          'مجمع مواقف الباجور الجديد',
        ],
        createdAt: nowIso,
      },
      {
        id: 'zone_bagour_villages',
        cityId: 'city_el_bagour',
        code: 'BAGOUR_RURAL_VILLAGES',
        nameAr: 'قرى مركز الباجور (الريف)',
        nameEn: 'El Bagour Rural Villages',
        isRural: true,
        isActive: true,
        maxRadiusKm: 25,
        landmarksAr: [
          'قرية كفر الباجور',
          'قرية شنتنا الحجر',
          'قرية جروان',
          'قرية ميت عفيف',
          'قرية بهناي',
          'قرية سبك الضحاك',
          'طريق بنها - الباجور الزراعي',
        ],
        createdAt: nowIso,
      },
      {
        id: 'zone_shebin_center',
        cityId: 'city_shebin_el_kom',
        code: 'SHEBIN_URBAN_CORE',
        nameAr: 'شبين الكوم (حي شرق وغرب)',
        nameEn: 'Shebin El-Kom Core',
        isRural: false,
        isActive: true,
        maxRadiusKm: 15,
        landmarksAr: [
          'شارع الجلاء البحري - شبين الكوم',
          'شارع باريس التجاري',
          'ميدان شرف - شبين الكوم',
          'مجمع الكليات - جامعة المنوفية',
        ],
        createdAt: nowIso,
      },
      {
        id: 'zone_menouf_center',
        cityId: 'city_menouf',
        code: 'MENOUF_URBAN_CORE',
        nameAr: 'وسط مدينة منوف والقرى القريبة',
        nameEn: 'Menouf Center',
        isRural: false,
        isActive: true,
        maxRadiusKm: 18,
        landmarksAr: [
          'محطة قطار منوف',
          'شارع بورسعيد - منوف',
          'مستشفى منوف العام',
          'ميدان الحصوة',
        ],
        createdAt: nowIso,
      },
      {
        id: 'zone_sadat_industrial',
        cityId: 'city_sadat',
        code: 'SADAT_RESIDENTIAL_ZONE',
        nameAr: 'مدينة السادات - المناطق السكنية (مغلق مؤقتاً)',
        nameEn: 'Sadat Residential Zone',
        isRural: false,
        isActive: false,
        maxRadiusKm: 25,
        landmarksAr: ['المنطقة السكنية الأولى', 'ميدان السادات المركزي'],
        createdAt: nowIso,
      },
    ];

    for (const z of seedZones) {
      this.zones.set(z.id, z);
    }

    // 3. Seed Zone Tariffs (Integer Egyptian Piasters)
    const serviceTypes: Array<'package' | 'restaurant_store' | 'errand'> = [
      'package',
      'restaurant_store',
      'errand',
    ];

    const zoneBaseConfigs: Array<{
      zoneId: string;
      baseFarePiasters: number;
      baseIncludedKm: number;
      ratePerKmPiasters: number;
      ruralSurchargePiasters: number;
      platformFeePiasters: number;
      minFarePiasters: number;
      isActive: boolean;
    }> = [
      {
        zoneId: 'zone_bagour_center',
        baseFarePiasters: 1500, // 15.00 EGP
        baseIncludedKm: 1.5,
        ratePerKmPiasters: 400, // 4.00 EGP/km
        ruralSurchargePiasters: 500, // 5.00 EGP if rural flag set
        platformFeePiasters: 200, // 2.00 EGP
        minFarePiasters: 1700,
        isActive: true,
      },
      {
        zoneId: 'zone_bagour_villages',
        baseFarePiasters: 1500, // 15.00 EGP
        baseIncludedKm: 1.5,
        ratePerKmPiasters: 450, // 4.50 EGP/km for rural routes
        ruralSurchargePiasters: 500, // 5.00 EGP automatic rural surcharge
        platformFeePiasters: 200, // 2.00 EGP
        minFarePiasters: 2200,
        isActive: true,
      },
      {
        zoneId: 'zone_shebin_center',
        baseFarePiasters: 1800, // 18.00 EGP (Capital city tariff)
        baseIncludedKm: 1.5,
        ratePerKmPiasters: 450, // 4.50 EGP/km
        ruralSurchargePiasters: 500,
        platformFeePiasters: 250, // 2.50 EGP
        minFarePiasters: 2050,
        isActive: true,
      },
      {
        zoneId: 'zone_menouf_center',
        baseFarePiasters: 1600, // 16.00 EGP
        baseIncludedKm: 1.5,
        ratePerKmPiasters: 400, // 4.00 EGP/km
        ruralSurchargePiasters: 500,
        platformFeePiasters: 200, // 2.00 EGP
        minFarePiasters: 1800,
        isActive: true,
      },
      {
        zoneId: 'zone_sadat_industrial',
        baseFarePiasters: 2000,
        baseIncludedKm: 2.0,
        ratePerKmPiasters: 500,
        ruralSurchargePiasters: 0,
        platformFeePiasters: 300,
        minFarePiasters: 2300,
        isActive: false,
      },
    ];

    for (const cfg of zoneBaseConfigs) {
      for (const st of serviceTypes) {
        const id = `tariff_${cfg.zoneId}_${st}`;
        this.zoneTariffs.set(id, {
          id,
          zoneId: cfg.zoneId,
          serviceTypeId: st,
          baseFarePiasters: cfg.baseFarePiasters,
          baseIncludedKm: cfg.baseIncludedKm,
          ratePerKmPiasters: cfg.ratePerKmPiasters,
          ruralSurchargePiasters: cfg.ruralSurchargePiasters,
          platformFeePiasters: cfg.platformFeePiasters,
          minFarePiasters: cfg.minFarePiasters,
          isActive: cfg.isActive,
          updatedAt: nowIso,
        });
      }
    }

    // 4. Seed Merchants & Stores
    const seedMerchants: MerchantProfile[] = [
      {
        id: 'merch_basha',
        userId: 'usr_merch_basha',
        fullName: 'الحاج رأفت الباشا',
        phone: '01233445566',
        email: 'basha@mashwar.eg',
        nationalIdMasked: '278********311',
        subscriptionStatus: 'active',
        subscriptionPlanCode: 'MERCHANT_GOLD_ZERO_COMM',
        monthlyFeePiasters: 50000, // 500.00 EGP
        currentPeriodEndsAt: new Date(Date.now() + 25 * 86400000).toISOString(),
        isActive: true,
        createdAt: nowIso,
      },
      {
        id: 'merch_amana',
        userId: 'usr_merch_amana',
        fullName: 'د. سحر عبد الحميد',
        phone: '01044556677',
        email: 'amana@mashwar.eg',
        nationalIdMasked: '285********522',
        subscriptionStatus: 'active',
        subscriptionPlanCode: 'MERCHANT_GOLD_ZERO_COMM',
        monthlyFeePiasters: 50000,
        currentPeriodEndsAt: new Date(Date.now() + 22 * 86400000).toISOString(),
        isActive: true,
        createdAt: nowIso,
      },
      {
        id: 'merch_khairat',
        userId: 'usr_merch_khairat',
        fullName: 'كمال النجار',
        phone: '01155667788',
        email: 'khairat@mashwar.eg',
        nationalIdMasked: '281********904',
        subscriptionStatus: 'active',
        subscriptionPlanCode: 'MERCHANT_SILVER_ZERO_COMM',
        monthlyFeePiasters: 35000, // 350.00 EGP
        currentPeriodEndsAt: new Date(Date.now() + 19 * 86400000).toISOString(),
        isActive: true,
        createdAt: nowIso,
      },
      {
        id: 'merch_shebin_royal',
        userId: 'usr_merch_shebin',
        fullName: 'الشيف طارق المنوفي',
        phone: '01066778899',
        email: 'royal.shebin@mashwar.eg',
        nationalIdMasked: '279********118',
        subscriptionStatus: 'active',
        subscriptionPlanCode: 'MERCHANT_GOLD_ZERO_COMM',
        monthlyFeePiasters: 60000,
        currentPeriodEndsAt: new Date(Date.now() + 28 * 86400000).toISOString(),
        isActive: true,
        createdAt: nowIso,
      },
    ];

    for (const m of seedMerchants) {
      this.merchants.set(m.id, m);
    }

    const seedStores: Store[] = [
      {
        id: 'merchant_basha',
        merchantId: 'merch_basha',
        merchantUserId: 'usr_merch_basha',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_center',
        nameAr: 'مطعم ومشاوي الباشا',
        category: 'restaurant',
        categoryAr: 'مطاعم ومشويات',
        descriptionAr: 'مشويات طازجة على الفحم، كباب وكفتة بلدي، طواجن وحواوشي مخصوص على الطريقة المصرية الأصيلة.',
        phone: '01233445566',
        addressDetailed: 'شارع الجمهورية - أمام بنك مصر، الباجور',
        landmark: 'شارع الجمهورية - أمام بنك مصر',
        isOpen: true,
        isActive: true,
        minOrderPiasters: 4000, // 40.00 EGP
        prepTimeMinutes: 25,
        ratingAverage: 4.85,
        commissionRatePercent: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'merchant_amana',
        merchantId: 'merch_amana',
        merchantUserId: 'usr_merch_amana',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_center',
        nameAr: 'صيدلية الأمانة المركزية',
        category: 'pharmacy',
        categoryAr: 'صيدليات ومستلزمات طبية',
        descriptionAr: 'خدمة دوائية على مدار الساعة، مستلزمات طبية، أجهزة قياس، مكملات غذائية وفيتامينات أصلية.',
        phone: '01044556677',
        addressDetailed: 'ميدان المحطة - بجوار مستشفى الباجور العام',
        landmark: 'ميدان المحطة - وسط الباجور',
        isOpen: true,
        isActive: true,
        minOrderPiasters: 2000, // 20.00 EGP
        prepTimeMinutes: 12,
        ratingAverage: 4.92,
        commissionRatePercent: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'merchant_khairat',
        merchantId: 'merch_khairat',
        merchantUserId: 'usr_merch_khairat',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_center',
        nameAr: 'سوبرماركت الخيرات والبركة',
        category: 'supermarket',
        categoryAr: 'سوبرماركت وبقالة',
        descriptionAr: 'كافة متطلبات المنزل، ألبان وأجبان طازجة يومياً، معلبات، زيوت، حبوب ومنظفات بأسعار الجملة.',
        phone: '01155667788',
        addressDetailed: 'شارع الجيش - برج الشروق، الباجور',
        landmark: 'شارع الجيش - برج الشروق',
        isOpen: true,
        isActive: true,
        minOrderPiasters: 3000, // 30.00 EGP
        prepTimeMinutes: 15,
        ratingAverage: 4.74,
        commissionRatePercent: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'store_shebin_royal',
        merchantId: 'merch_shebin_royal',
        merchantUserId: 'usr_merch_shebin',
        cityId: 'city_shebin_el_kom',
        zoneId: 'zone_shebin_center',
        nameAr: 'مشويات القصر الملكي - شبين الكوم',
        category: 'restaurant',
        categoryAr: 'مطاعم ومشويات',
        descriptionAr: 'أفخم المشويات الشرقية والطواجن في قلب شبين الكوم بشارع باريس.',
        phone: '01066778899',
        addressDetailed: 'شارع باريس التجاري - شبين الكوم',
        landmark: 'شارع باريس التجاري',
        isOpen: true,
        isActive: true,
        minOrderPiasters: 5000, // 50.00 EGP
        prepTimeMinutes: 25,
        ratingAverage: 4.88,
        commissionRatePercent: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    for (const s of seedStores) {
      this.stores.set(s.id, s);
    }

    // 5. Seed Menu Categories & Menu Items (All prices in integer Piasters)
    const seedCategories: MenuCategory[] = [
      { id: 'cat_basha_grills', storeId: 'merchant_basha', nameAr: 'مشويات الفحم', sortOrder: 1, isActive: true },
      { id: 'cat_basha_meals', storeId: 'merchant_basha', nameAr: 'وجبات فردية وحواوشي', sortOrder: 2, isActive: true },
      { id: 'cat_amana_meds', storeId: 'merchant_amana', nameAr: 'عناية ومستلزمات طبية', sortOrder: 1, isActive: true },
      { id: 'cat_khairat_dairy', storeId: 'merchant_khairat', nameAr: 'ألبان وبقالة يومية', sortOrder: 1, isActive: true },
      { id: 'cat_shebin_grills', storeId: 'store_shebin_royal', nameAr: 'مشويات القصر', sortOrder: 1, isActive: true },
    ];

    for (const cat of seedCategories) {
      this.menuCategories.set(cat.id, cat);
    }

    const seedMenuItems: MenuItem[] = [
      {
        id: 'prod_basha_01',
        storeId: 'merchant_basha',
        categoryId: 'cat_basha_grills',
        categoryNameAr: 'مشويات الفحم',
        nameAr: 'طبق كباب وكفتة مشكل على الفحم (نصف كيلو)',
        descriptionAr: 'كفتة لحم بلدي متبلة مع كباب بتلو مشوي على الفحم مع طحينة وسلطة وعيش بلدي.',
        pricePiasters: 19500, // 195.00 EGP
        unitAr: 'طبق',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_basha_02',
        storeId: 'merchant_basha',
        categoryId: 'cat_basha_meals',
        categoryNameAr: 'وجبات فردية وحواوشي',
        nameAr: 'وجبة ربع فرخة مشوية مع أرز وسلطات',
        descriptionAr: 'ربع دجاجة متبلة مشوية مع أرز بسمتي مصري وبطاطس وسلطة طحينة.',
        pricePiasters: 8500, // 85.00 EGP
        unitAr: 'وجبة',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_basha_03',
        storeId: 'merchant_basha',
        categoryId: 'cat_basha_meals',
        categoryNameAr: 'وجبات فردية وحواوشي',
        nameAr: 'حواوشي بلدي مخصوص بالجبنة الموزاريلا',
        descriptionAr: 'رغيف حواوشي لحم بلدي متبل بالخلطة السرية والجبنة الموزاريلا.',
        pricePiasters: 5500, // 55.00 EGP
        unitAr: 'رغيف',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_amana_01',
        storeId: 'merchant_amana',
        categoryId: 'cat_amana_meds',
        categoryNameAr: 'عناية ومستلزمات طبية',
        nameAr: 'حقيبة إسعافات أولية منزلية متكاملة',
        descriptionAr: 'تحتوي على شاش طبي، مطهر، لاصق جروح، قطن طبي، ومقياس حرارة رقمي.',
        pricePiasters: 14500, // 145.00 EGP
        unitAr: 'حقيبة',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_amana_02',
        storeId: 'merchant_amana',
        categoryId: 'cat_amana_meds',
        categoryNameAr: 'عناية ومستلزمات طبية',
        nameAr: 'فيتامين سي 1000 مجم فوار للمناعة',
        descriptionAr: 'عبوة 20 قرص فوار بطعم البرتقال لدعم المناعة اليومية.',
        pricePiasters: 4800, // 48.00 EGP
        unitAr: 'عبوة',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_khairat_01',
        storeId: 'merchant_khairat',
        categoryId: 'cat_khairat_dairy',
        categoryNameAr: 'ألبان وبقالة يومية',
        nameAr: 'كرتونة بيض أحمر مزارع طازج (30 بيضة)',
        descriptionAr: 'بيض مزارع طازج إنتاج اليوم مفروز بعناية.',
        pricePiasters: 15500, // 155.00 EGP
        unitAr: 'طبق',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_khairat_02',
        storeId: 'merchant_khairat',
        categoryId: 'cat_khairat_dairy',
        categoryNameAr: 'ألبان وبقالة يومية',
        nameAr: 'أرز مصري فاخر عريض الحبة (شيكارة 5 كجم)',
        descriptionAr: 'أرز أبيض مصري نقي درجة أولى.',
        pricePiasters: 16500, // 165.00 EGP
        unitAr: 'شيكارة 5 كجم',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'prod_shebin_01',
        storeId: 'store_shebin_royal',
        categoryId: 'cat_shebin_grills',
        categoryNameAr: 'مشويات القصر',
        nameAr: 'صينية مشويات القصر العائلية (كيلو مشكل)',
        descriptionAr: 'كباب وكفتة وشيش طاووق وطرب على الفحم مع أرز بسمتي ومقبلات.',
        pricePiasters: 38000, // 380.00 EGP
        unitAr: 'صينية',
        isAvailable: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];

    for (const item of seedMenuItems) {
      this.menuItems.set(item.id, item);
    }

    // 6. Seed realistic Captains in El Bagour & Menoufia
    const seedCaptains: CaptainProfile[] = [
      {
        id: 'cpt_ahmed_fathy',
        userId: 'usr_cpt_01',
        fullName: 'أحمد فتحي الديب',
        phone: '01012345671',
        nationalIdMasked: '293********412',
        cityId: 'city_el_bagour',
        activeZoneId: 'zone_bagour_center',
        vehicleType: 'motorcycle',
        vehiclePlate: 'م ن ف ٤٨١٢',
        subscriptionStatus: 'active',
        subscriptionPlanCode: 'PLAN_BAGOUR_MONTHLY_ZERO_COMM',
        currentPeriodEndsAt: new Date(Date.now() + 18 * 24 * 3600 * 1000).toISOString(),
        cashHoldingPiasters: 25000, // 250.00 EGP
        maxCashHoldingPiasters: 100000,
        ratingAverage: 4.9,
        isOnline: true,
      },
      {
        id: 'cpt_mahmoud_ibrahim',
        userId: 'usr_cpt_02',
        fullName: 'محمود إبراهيم خطاب',
        phone: '01123456782',
        nationalIdMasked: '295********891',
        cityId: 'city_el_bagour',
        activeZoneId: 'zone_bagour_villages',
        vehicleType: 'scooter',
        vehiclePlate: 'م ن ف ٩١٥٣',
        subscriptionStatus: 'grace_period',
        subscriptionPlanCode: 'PLAN_BAGOUR_MONTHLY_ZERO_COMM',
        currentPeriodEndsAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(), // expired 12h ago
        gracePeriodEndsAt: new Date(Date.now() + 60 * 3600 * 1000).toISOString(), // 60h remaining
        cashHoldingPiasters: 45000, // 450.00 EGP
        maxCashHoldingPiasters: 100000,
        ratingAverage: 4.75,
        isOnline: true,
      },
      {
        id: 'cpt_tarek_el_sheikh',
        userId: 'usr_cpt_03',
        fullName: 'طارق عبد المنعم الشيخ',
        phone: '01234567893',
        nationalIdMasked: '290********673',
        cityId: 'city_el_bagour',
        activeZoneId: 'zone_bagour_center',
        vehicleType: 'light_commercial_van',
        vehiclePlate: 'م ن ف ٧٢١٤',
        subscriptionStatus: 'expired',
        subscriptionPlanCode: 'PLAN_BAGOUR_MONTHLY_ZERO_COMM',
        currentPeriodEndsAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), // expired 5 days ago
        gracePeriodEndsAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        cashHoldingPiasters: 12000, // 120.00 EGP
        maxCashHoldingPiasters: 100000,
        ratingAverage: 4.6,
        isOnline: false,
      },
      {
        id: 'cpt_moustafa_kamal',
        userId: 'usr_cpt_04',
        fullName: 'مصطفى كمال النجار',
        phone: '01098765434',
        nationalIdMasked: '298********159',
        cityId: 'city_el_bagour',
        activeZoneId: 'zone_bagour_center',
        vehicleType: 'motorcycle',
        vehiclePlate: 'م ن ف ٦٣٢٨',
        subscriptionStatus: 'suspended', // Suspended for cash ceiling
        subscriptionPlanCode: 'PLAN_BAGOUR_MONTHLY_ZERO_COMM',
        currentPeriodEndsAt: new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString(),
        cashHoldingPiasters: 102000, // 1,020.00 EGP > 1,000.00 EGP ceiling
        maxCashHoldingPiasters: 100000,
        ratingAverage: 4.8,
        isOnline: false,
      },
    ];

    for (const captain of seedCaptains) {
      this.captains.set(captain.id, captain);
    }

    // 7. Seed realistic Orders in El Bagour
    const seedOrders: Order[] = [
      {
        id: 'ord_bagour_8101',
        orderNumber: 'MSH-8101',
        customerId: 'usr_cust_01',
        customerName: 'الحاج عاطف رضوان',
        customerPhone: '01055566671',
        serviceTypeId: 'package',
        status: 'delivered',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_villages',
        quoteId: 'quote_seed_01',
        pickup: {
          landmarkName: 'ميدان المحطة - وسط الباجور',
          detailedAddress: 'بجوار صيدلية الأمل',
          contactPhone: '01055566671',
        },
        dropoff: {
          landmarkName: 'قرية كفر الباجور',
          detailedAddress: 'شارع داير الناحية - أمام المسجد الكبير',
          contactPhone: '01199988811',
        },
        itemDescription: 'أوراق رسمية وشهادات موثقة',
        totalFarePiasters: 3000, // 30.00 EGP (15 base + 8 distance + 5 rural + 2 fee)
        paymentMethod: 'cash_on_delivery',
        isPaid: true,
        assignedCaptainId: 'cpt_ahmed_fathy',
        captainName: 'أحمد فتحي الديب',
        captainPhone: '01012345671',
        captainVehicle: 'موتوسيكل (م ن ف ٤٨١٢)',
        cashCollectedPiasters: 3000,
        acceptedAt: new Date(Date.now() - 170 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: 'ord_bagour_8102',
        orderNumber: 'MSH-8102',
        customerId: 'usr_cust_02',
        customerName: 'د. سحر عبد الحميد',
        customerPhone: '01244455582',
        serviceTypeId: 'package',
        status: 'in_transit',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_villages',
        quoteId: 'quote_seed_02',
        pickup: {
          landmarkName: 'مستشفى الباجور العام',
          detailedAddress: 'قسم الاستقبال والطوارئ',
          contactPhone: '01244455582',
        },
        dropoff: {
          landmarkName: 'قرية شنتنا الحجر',
          detailedAddress: 'المدخل القبلي - بجوار الجمعية الزراعية',
          contactPhone: '01077788892',
        },
        itemDescription: 'مستلزمات وأدوية عاجلة',
        totalFarePiasters: 3500, // 35.00 EGP
        paymentMethod: 'cash_on_delivery',
        isPaid: false,
        assignedCaptainId: 'cpt_ahmed_fathy',
        captainName: 'أحمد فتحي الديب',
        captainPhone: '01012345671',
        captainVehicle: 'موتوسيكل (م ن ف ٤٨١٢)',
        acceptedAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'ord_bagour_8103',
        orderNumber: 'MSH-8103',
        customerId: 'usr_cust_03',
        customerName: 'م. إسلام عاشور',
        customerPhone: '01133344493',
        serviceTypeId: 'restaurant_store',
        status: 'searching_captain',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_center',
        storeId: 'merchant_basha',
        storeName: 'مطعم ومشاوي الباشا',
        merchantUserId: 'usr_merch_basha',
        quoteId: 'quote_seed_03',
        pickup: {
          landmarkName: 'شارع الجمهورية - أمام بنك مصر',
          detailedAddress: 'مطعم ومشاوي الباشا - الباجور',
          contactPhone: '01233445566',
        },
        dropoff: {
          landmarkName: 'شارع الجيش - برج الشروق',
          detailedAddress: 'عمارة النور - الدور الثالث',
          contactPhone: '01022233343',
        },
        itemDescription: 'وجبات عائلية ساخنة (طبق كباب وكفتة + حواوشي)',
        totalFarePiasters: 1700, // 17.00 EGP urban delivery fare
        paymentMethod: 'cash_on_delivery',
        isPaid: false,
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'ord_bagour_8104',
        orderNumber: 'MSH-8104',
        customerId: 'usr_cust_04',
        customerName: 'كريم ممدوح',
        customerPhone: '01566677704',
        serviceTypeId: 'errand',
        status: 'cancelled',
        cityId: 'city_el_bagour',
        zoneId: 'zone_bagour_center',
        quoteId: 'quote_seed_04',
        pickup: {
          landmarkName: 'مجلس مدينة الباجور',
          detailedAddress: 'شارع الإدارة الهندسية',
          contactPhone: '01566677704',
        },
        dropoff: {
          landmarkName: 'ميدان المحطة - وسط الباجور',
          detailedAddress: 'مكتبة النجاح',
          contactPhone: '01566677704',
        },
        itemDescription: 'شراء وتصوير خرائط ومخططات',
        totalFarePiasters: 1700,
        paymentMethod: 'cash_on_delivery',
        isPaid: false,
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
    ];

    for (const order of seedOrders) {
      this.orders.set(order.id, order);
      this.orderStateHistory.set(order.id, [
        {
          id: `hist_${order.id}_init`,
          orderId: order.id,
          fromStatus: null,
          toStatus: order.status,
          actorId: order.customerId,
          actorRole: 'customer',
          notes: 'تأسيس حالة الطلب الأولية',
          createdAt: order.createdAt,
        },
      ]);
    }

    // 8. Seed initial Complaint ticket
    const seedComplaint: Complaint = {
      id: 'cmp_bagour_1001',
      ticketNumber: 'TKT-1001',
      orderId: 'ord_bagour_8102',
      reporterUserId: 'usr_cust_02',
      reporterName: 'د. سحر عبد الحميد',
      reporterPhone: '01244455582',
      reporterRole: 'customer',
      category: 'delayed_delivery',
      priority: 'high',
      status: 'open',
      subjectAr: 'استفسار عن موعد وصول الأدوية لقرية شنتنا الحجر',
      descriptionAr: 'يرجى التأكد من التزام الكابتن بطريق بنها-الباجور لتجنب الزحام لأن الأدوية مطلوبة بشكل عاجل.',
      events: [
        {
          id: 'cevt_1001_1',
          complaintId: 'cmp_bagour_1001',
          actorId: 'usr_cust_02',
          actorRole: 'customer',
          actorName: 'د. سحر عبد الحميد',
          action: 'CREATED',
          toStatus: 'open',
          messageAr: 'تم فتح تذكرة الدعم الفني من قبل العميل.',
          createdAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this.complaints.set(seedComplaint.id, seedComplaint);

    // Seed bootstrap audit logs
    AuditLogger.record({
      actorId: 'usr_owner_01',
      actorRole: 'owner',
      actorName: 'د. علاء (مالك المنصة)',
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      targetEntity: 'system_settings',
      targetId: 'sys_settings_default',
      descriptionAr: 'تهيئة إعدادات مركز عمليات الباجور ومناطق التوسع بالمنوفية وتسعيرة الانطلاق وقفل نقل الركاب قانونياً.',
      newState: { ...this.settings },
      ipAddress: '197.38.12.84',
    });

    this.isInitialized = true;
  }

  // --- Cities & Zones Accessors ---
  public static getAllCities(includeInactive: boolean = false): City[] {
    this.initialize();
    const list = Array.from(this.cities.values());
    return includeInactive ? list : list.filter((c) => c.isActive);
  }

  public static getCityById(cityId: string): City | undefined {
    this.initialize();
    return this.cities.get(cityId);
  }

  public static getZonesByCity(cityId?: string, includeInactive: boolean = false): ServiceZone[] {
    this.initialize();
    let list = Array.from(this.zones.values());
    if (cityId) {
      list = list.filter((z) => z.cityId === cityId);
    }
    return includeInactive ? list : list.filter((z) => z.isActive);
  }

  public static getZoneById(zoneId: string): ServiceZone | undefined {
    this.initialize();
    return this.zones.get(zoneId);
  }

  public static getZoneTariff(zoneId: string, serviceTypeId: string): ZoneTariff | undefined {
    this.initialize();
    return this.zoneTariffs.get(`tariff_${zoneId}_${serviceTypeId}`);
  }

  public static getAllZoneTariffs(): ZoneTariff[] {
    this.initialize();
    return Array.from(this.zoneTariffs.values());
  }

  public static updateZoneTariff(
    zoneId: string,
    serviceTypeId: 'package' | 'restaurant_store' | 'errand',
    updates: Partial<Pick<ZoneTariff, 'baseFarePiasters' | 'ratePerKmPiasters' | 'ruralSurchargePiasters' | 'platformFeePiasters' | 'minFarePiasters' | 'isActive'>>,
    actorId: string,
    actorName: string
  ): ZoneTariff {
    this.initialize();
    const id = `tariff_${zoneId}_${serviceTypeId}`;
    const existing = this.zoneTariffs.get(id);
    if (!existing) {
      const err = new Error('تعريفة المنطقة غير موجودة.');
      (err as any).code = 'TARIFF_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    const updated: ZoneTariff = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.zoneTariffs.set(id, updated);

    AuditLogger.record({
      actorId,
      actorRole: 'owner',
      actorName,
      actionType: 'ZONE_TARIFF_UPDATED',
      targetEntity: 'zone',
      targetId: id,
      descriptionAr: `تحديث تعريفة المنطقة ${zoneId} لخدمة ${serviceTypeId}.`,
      previousState: existing,
      newState: updated,
    });

    return updated;
  }

  // --- Merchants & Stores Accessors ---
  public static getAllStores(filters?: { cityId?: string; zoneId?: string; category?: string; onlyOpen?: boolean }): Store[] {
    this.initialize();
    let list = Array.from(this.stores.values()).filter((s) => s.isActive);
    if (filters?.cityId) list = list.filter((s) => s.cityId === filters.cityId);
    if (filters?.zoneId) list = list.filter((s) => s.zoneId === filters.zoneId);
    if (filters?.category) list = list.filter((s) => s.category === filters.category);
    if (filters?.onlyOpen) list = list.filter((s) => s.isOpen);
    return list;
  }

  public static getStoreById(storeId: string): Store | undefined {
    this.initialize();
    return this.stores.get(storeId);
  }

  public static getStoresByMerchantUserId(merchantUserId: string): Store[] {
    this.initialize();
    return Array.from(this.stores.values()).filter((s) => s.merchantUserId === merchantUserId);
  }

  public static saveStore(store: Store): Store {
    this.initialize();
    const updated = { ...store, updatedAt: new Date().toISOString() };
    this.stores.set(updated.id, updated);
    return updated;
  }

  public static getMenuCategoriesByStore(storeId: string): MenuCategory[] {
    this.initialize();
    return Array.from(this.menuCategories.values())
      .filter((c) => c.storeId === storeId && c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public static getMenuItemsByStore(storeId: string, onlyAvailable: boolean = false): MenuItem[] {
    this.initialize();
    let items = Array.from(this.menuItems.values()).filter((m) => m.storeId === storeId);
    if (onlyAvailable) {
      items = items.filter((m) => m.isAvailable);
    }
    return items;
  }

  public static getMenuItemById(itemId: string): MenuItem | undefined {
    this.initialize();
    return this.menuItems.get(itemId);
  }

  public static saveMenuItem(item: MenuItem): MenuItem {
    this.initialize();
    const updated = { ...item, updatedAt: new Date().toISOString() };
    this.menuItems.set(updated.id, updated);
    return updated;
  }

  // --- Orders & History Accessors ---
  public static getAllOrders(): Order[] {
    this.initialize();
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getOrderById(id: string): Order | undefined {
    this.initialize();
    return this.orders.get(id);
  }

  public static saveOrder(order: Order): Order {
    this.initialize();
    const updated = {
      ...order,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(updated.id, updated);
    return updated;
  }

  public static recordOrderStateHistory(entry: Omit<OrderStateHistoryEntry, 'id' | 'createdAt'>): OrderStateHistoryEntry {
    this.initialize();
    const record: OrderStateHistoryEntry = {
      ...entry,
      id: `osh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    const list = this.orderStateHistory.get(entry.orderId) || [];
    list.push(record);
    this.orderStateHistory.set(entry.orderId, list);
    return record;
  }

  public static getOrderStateHistory(orderId: string): OrderStateHistoryEntry[] {
    this.initialize();
    return this.orderStateHistory.get(orderId) || [];
  }

  // --- Captains Accessors ---
  public static getAllCaptains(): CaptainProfile[] {
    this.initialize();
    return Array.from(this.captains.values());
  }

  public static getCaptainById(id: string): CaptainProfile | undefined {
    this.initialize();
    return this.captains.get(id);
  }

  public static saveCaptain(captain: CaptainProfile): CaptainProfile {
    this.initialize();
    this.captains.set(captain.id, captain);
    return captain;
  }

  // --- Complaints Accessors ---
  public static getAllComplaints(): Complaint[] {
    this.initialize();
    return Array.from(this.complaints.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public static getComplaintById(id: string): Complaint | undefined {
    this.initialize();
    return this.complaints.get(id);
  }

  public static saveComplaint(complaint: Complaint): Complaint {
    this.initialize();
    const updated = { ...complaint, updatedAt: new Date().toISOString() };
    this.complaints.set(updated.id, updated);
    return updated;
  }

  // --- Notifications Accessors ---
  public static addNotification(notif: Omit<NotificationRecord, 'id' | 'createdAt' | 'isRead'>): NotificationRecord {
    this.initialize();
    const record: NotificationRecord = {
      ...notif,
      id: `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    const existing = this.notifications.get(notif.recipientUserId) || [];
    existing.unshift(record);
    this.notifications.set(notif.recipientUserId, existing);
    return record;
  }

  public static getNotificationsForUser(userId: string): NotificationRecord[] {
    this.initialize();
    return this.notifications.get(userId) || [];
  }

  // --- Settings Accessors ---
  public static getSettings(): SystemSettings {
    this.initialize();
    return { ...this.settings };
  }

  public static updateSettings(
    newSettings: Partial<SystemSettings>,
    actorId: string,
    actorName: string
  ): SystemSettings {
    this.initialize();

    const previousState = { ...this.settings };

    // Invariant: Passenger mobility can NEVER be unlocked without legal clearance
    if (newSettings.passengerMobilityLocked === false) {
      const err = new Error(
        'محظور نظامياً: لا يمكن رفع الحظر عن نقل الركاب إلا بعد استيفاء التراخيص المرورية الرسمية واعتماد وثائق التأمين وفقاً للقانون رقم ٧٣ لسنة ٢٠١٨.'
      );
      (err as any).code = 'REGULATORY_COMPLIANCE_LOCK';
      (err as any).statusCode = 403;
      throw err;
    }

    this.settings = {
      ...this.settings,
      ...newSettings,
      passengerMobilityLocked: true, // Permanent lock
      lastUpdated: new Date().toISOString(),
      updatedBy: actorName,
    };

    AuditLogger.record({
      actorId,
      actorRole: 'owner',
      actorName,
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      targetEntity: 'system_settings',
      targetId: 'sys_settings_default',
      descriptionAr: 'تعديل الإعدادات التشغيلية ومعايير التسعيرة لمركز الباجور.',
      previousState,
      newState: { ...this.settings },
    });

    return { ...this.settings };
  }

  // --- Operations Actions with Audit Logging ---
  public static remitCaptainCash(
    captainId: string,
    amountPiasters: number,
    actorId: string,
    actorName: string,
    notes?: string
  ): CaptainProfile {
    this.initialize();
    const captain = this.captains.get(captainId);
    if (!captain) {
      const err = new Error('الكابتن غير موجود في النظام.');
      (err as any).statusCode = 404;
      throw err;
    }

    const previousHolding = captain.cashHoldingPiasters;
    const newHolding = Math.max(0, previousHolding - amountPiasters);
    captain.cashHoldingPiasters = newHolding;

    // If suspended due to cash ceiling, check if eligible for re-activation
    if (captain.subscriptionStatus === 'suspended' && newHolding < captain.maxCashHoldingPiasters) {
      captain.subscriptionStatus = 'active';
    }

    this.captains.set(captain.id, captain);

    AuditLogger.record({
      actorId,
      actorRole: 'owner',
      actorName,
      actionType: 'CAPTAIN_CASH_SETTLED',
      targetEntity: 'captain',
      targetId: captain.id,
      descriptionAr: `توريد وتسوية نقدية بمبلغ ${(amountPiasters / 100).toFixed(2)} ج.م للكابتن ${captain.fullName}. المتبقي في العهدة: ${(newHolding / 100).toFixed(2)} ج.م.`,
      previousState: { cashHoldingPiasters: previousHolding },
      newState: { cashHoldingPiasters: newHolding, subscriptionStatus: captain.subscriptionStatus },
      notes,
    });

    return captain;
  }

  public static renewCaptainSubscription(
    captainId: string,
    daysToAdd: number = 30,
    actorId: string,
    actorName: string
  ): CaptainProfile {
    this.initialize();
    const captain = this.captains.get(captainId);
    if (!captain) {
      const err = new Error('الكابتن غير موجود في النظام.');
      (err as any).statusCode = 404;
      throw err;
    }

    const prevExpiry = captain.currentPeriodEndsAt;
    const baseDate = new Date(captain.currentPeriodEndsAt).getTime() > Date.now()
      ? new Date(captain.currentPeriodEndsAt)
      : new Date();

    const newExpiry = new Date(baseDate.getTime() + daysToAdd * 24 * 3600 * 1000).toISOString();
    captain.subscriptionStatus = 'active';
    captain.currentPeriodEndsAt = newExpiry;
    captain.gracePeriodEndsAt = undefined;

    this.captains.set(captain.id, captain);

    // Record in captain subscription history
    const subHistory = this.captainSubscriptions.get(captain.id) || [];
    subHistory.unshift({
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      captainId: captain.id,
      planCode: captain.subscriptionPlanCode,
      feePiasters: this.settings.subscriptionMonthlyFeePiasters,
      status: 'active',
      periodStartsAt: baseDate.toISOString(),
      periodEndsAt: newExpiry,
      activatedByActorId: actorId,
      createdAt: new Date().toISOString(),
    });
    this.captainSubscriptions.set(captain.id, subHistory);

    AuditLogger.record({
      actorId,
      actorRole: 'owner',
      actorName,
      actionType: 'CAPTAIN_SUBSCRIPTION_RENEWED',
      targetEntity: 'captain',
      targetId: captain.id,
      descriptionAr: `تجديد الاشتراك الشهري (عمولة 0%) للكابتن ${captain.fullName} لمدة ${daysToAdd} يوماً حتى ${newExpiry.split('T')[0]}.`,
      previousState: { currentPeriodEndsAt: prevExpiry },
      newState: { currentPeriodEndsAt: newExpiry, subscriptionStatus: 'active' },
    });

    return captain;
  }

  public static getCaptainSubscriptionHistory(captainId: string): CaptainSubscriptionRecord[] {
    this.initialize();
    return this.captainSubscriptions.get(captainId) || [];
  }

  public static manualAssignCaptainToOrder(
    orderId: string,
    captainId: string,
    actorId: string,
    actorName: string,
    actorRole: any = 'operations_dispatcher'
  ): Order {
    this.initialize();
    const order = this.orders.get(orderId);
    if (!order) {
      const err = new Error('الطلب غير موجود.');
      (err as any).statusCode = 404;
      throw err;
    }

    const captain = this.captains.get(captainId);
    if (!captain) {
      const err = new Error('الكابتن المطلوب غير موجود.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (captain.subscriptionStatus === 'expired' || captain.subscriptionStatus === 'suspended') {
      const err = new Error(`لا يمكن تعيين الكابتن: حسابه غير مؤهل (${captain.subscriptionStatus}).`);
      (err as any).statusCode = 422;
      throw err;
    }

    const previousOrder = { ...order };
    const nowIso = new Date().toISOString();
    order.status = 'captain_assigned';
    order.acceptedAt = order.acceptedAt || nowIso;
    order.assignedCaptainId = captain.id;
    order.captainName = captain.fullName;
    order.captainPhone = captain.phone;
    order.captainVehicle = `${captain.vehicleType} (${captain.vehiclePlate})`;
    order.updatedAt = nowIso;

    this.orders.set(order.id, order);
    this.recordOrderStateHistory({
      orderId: order.id,
      fromStatus: previousOrder.status,
      toStatus: 'captain_assigned',
      actorId,
      actorRole,
      notes: `تعيين يدوي للكابتن ${captain.fullName}`,
    });

    AuditLogger.record({
      actorId,
      actorRole,
      actorName,
      actionType: 'MANUAL_DISPATCH_ASSIGNMENT',
      targetEntity: 'order',
      targetId: order.id,
      descriptionAr: `تدخل يدوي من العمليات: تعيين الكابتن ${captain.fullName} للطلب رقم ${order.orderNumber}.`,
      previousState: { status: previousOrder.status, assignedCaptainId: previousOrder.assignedCaptainId },
      newState: { status: order.status, assignedCaptainId: order.assignedCaptainId },
    });

    return order;
  }

  public static emergencyCancelOrder(
    orderId: string,
    reason: string,
    actorId: string,
    actorName: string,
    actorRole: any = 'operations_dispatcher'
  ): Order {
    this.initialize();
    const order = this.orders.get(orderId);
    if (!order) {
      const err = new Error('الطلب غير موجود.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (order.status === 'delivered') {
      const err = new Error('لا يمكن إلغاء طلب تم تسليمه بنجاح.');
      (err as any).statusCode = 422;
      throw err;
    }

    const prevStatus = order.status;
    order.status = 'cancelled';
    order.specialInstructions = `${order.specialInstructions || ''} [إلغاء إداري: ${reason}]`;
    order.updatedAt = new Date().toISOString();

    this.orders.set(order.id, order);
    this.recordOrderStateHistory({
      orderId: order.id,
      fromStatus: prevStatus,
      toStatus: 'cancelled',
      actorId,
      actorRole,
      notes: `إلغاء إداري: ${reason}`,
    });

    AuditLogger.record({
      actorId,
      actorRole,
      actorName,
      actionType: 'ORDER_EMERGENCY_CANCELLED',
      targetEntity: 'order',
      targetId: order.id,
      descriptionAr: `إلغاء إداري للطلب ${order.orderNumber}. السبب: ${reason}`,
      previousState: { status: prevStatus },
      newState: { status: 'cancelled' },
    });

    return order;
  }

  public static resetAll(): void {
    this.cities.clear();
    this.zones.clear();
    this.zoneTariffs.clear();
    this.merchants.clear();
    this.stores.clear();
    this.menuCategories.clear();
    this.menuItems.clear();
    this.orders.clear();
    this.orderStateHistory.clear();
    this.captains.clear();
    this.captainSubscriptions.clear();
    this.complaints.clear();
    this.notifications.clear();
    this.settings = { ...INITIAL_SYSTEM_SETTINGS };
    this.isInitialized = false;
    this.initialize();
  }
}
