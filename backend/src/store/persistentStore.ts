/**
 * Mashwar — Persistent Data Foundation & El Bagour Hub Store
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

import { Order, CaptainProfile, ServiceTypeId, OrderStatus, SubscriptionStatus, PaymentMethod } from '../types/index.js';
import { AuditLogger, AuditLogEntry } from '../security/auditLogger.js';

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
  private static orders = new Map<string, Order>();
  private static captains = new Map<string, CaptainProfile>();
  private static settings: SystemSettings = { ...INITIAL_SYSTEM_SETTINGS };
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;

    // Seed realistic Captains in El Bagour
    const seedCaptains: CaptainProfile[] = [
      {
        id: 'cpt_ahmed_fathy',
        userId: 'usr_cpt_01',
        fullName: 'أحمد فتحي الديب',
        phone: '01012345671',
        nationalIdMasked: '293********412',
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

    // Seed realistic Orders in El Bagour
    const seedOrders: Order[] = [
      {
        id: 'ord_bagour_8101',
        orderNumber: 'MSH-8101',
        customerId: 'usr_cust_01',
        customerName: 'الحاج عاطف رضوان',
        customerPhone: '01055566671',
        serviceTypeId: 'package',
        status: 'delivered',
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
        quoteId: 'quote_seed_03',
        pickup: {
          landmarkName: 'شارع الجيش - برج الشروق',
          detailedAddress: 'مطعم ليالي الشام - الباجور',
          contactPhone: '01133344493',
        },
        dropoff: {
          landmarkName: 'شارع الجمهورية - أمام بنك مصر',
          detailedAddress: 'عمارة النور - الدور الثالث',
          contactPhone: '01022233343',
        },
        itemDescription: 'وجبات عائلية ساخنة',
        totalFarePiasters: 1700, // 17.00 EGP urban trip
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
    }

    // Seed bootstrap audit logs
    AuditLogger.record({
      actorId: 'usr_owner_01',
      actorRole: 'owner',
      actorName: 'د. علاء (مالك المنصة)',
      actionType: 'SYSTEM_SETTINGS_UPDATED',
      targetEntity: 'system_settings',
      targetId: 'sys_settings_default',
      descriptionAr: 'تهيئة إعدادات مركز عمليات الباجور وتسعيرة الانطلاق وقفل نقل الركاب قانونياً.',
      newState: { ...this.settings },
      ipAddress: '197.38.12.84',
    });

    this.isInitialized = true;
  }

  // --- Orders Accessors ---
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
      descriptionAr: `توريد وتسوية نقدية بمبلغ ${(amountPiasters / 100).toFixed(2)} ج.م للكابتن ${captain.fullName}. المتبقي في العهدة: ${(newHolding / 100).toFixed(2)} ج.م.${notes ? ` ملاحظات: ${notes}` : ''}`,
      previousState: { cashHoldingPiasters: previousHolding },
      newState: { cashHoldingPiasters: newHolding, subscriptionStatus: captain.subscriptionStatus },
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
    order.status = 'captain_assigned';
    order.assignedCaptainId = captain.id;
    order.captainName = captain.fullName;
    order.captainPhone = captain.phone;
    order.captainVehicle = `${captain.vehicleType} (${captain.vehiclePlate})`;
    order.updatedAt = new Date().toISOString();

    this.orders.set(order.id, order);

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
}
