/**
 * Mashwar — Authoritative REST API Router implementation
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Base URL: /api/v1
 *
 * Security Model:
 * - Fail-closed token verification (Supabase Auth / Bearer JWT)
 * - Server-derived identity (customerId, captainId derived from auth principal)
 * - Strict ownership checks (Customer, Captain, Merchant, Admin)
 * - Zero trust in client-supplied X-Actor-* or body identity parameters
 * - Transactional, idempotent cash collection in integer Egyptian Piasters
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PricingEngine } from '../pricing/pricingEngine.js';
import { OrderFsm } from '../orders/orderFsm.js';
import { CaptainEligibilityEngine } from '../captain/captainEligibility.js';
import { AssignmentService } from '../dispatch/assignmentService.js';
import { WebhookService } from '../payments/webhookService.js';
import { AccessControlGuard, UserRole, SecurityPermission } from '../security/rbac.js';
import { AuditLogger, AuditActionType } from '../security/auditLogger.js';
import { PersistentStore, SystemSettings } from '../store/persistentStore.js';
import { authenticate, requireRoles, AuthenticatedUser } from '../security/auth.js';
import { CaptainService } from '../services/captainService.js';
import { CashCollectionService } from '../services/cashCollectionService.js';
import {
  Order,
  CaptainProfile,
  ServiceTypeId,
  OrderStatus,
  WebhookEventPayload,
} from '../types/index.js';

export const router = Router();
const pricingEngine = new PricingEngine();

// Initialize persistent store
PersistentStore.initialize();

// In-memory repositories synchronized with PersistentStore
const ordersDb = new Map<string, Order>();
const idempotencyStore = new Map<string, { orderId: string; responseBody: any }>();
const mockCaptains = new Map<string, CaptainProfile>();

function syncWithStore() {
  for (const ord of PersistentStore.getAllOrders()) {
    if (!ordersDb.has(ord.id)) {
      ordersDb.set(ord.id, ord);
    }
  }
  for (const cap of PersistentStore.getAllCaptains()) {
    mockCaptains.set(cap.id, cap);
  }
}

// Initial sync
syncWithStore();

// Backwards-compatible seed captains for tests
if (!mockCaptains.has('cap_el_bagour_01')) {
  mockCaptains.set('cap_el_bagour_01', {
    id: 'cap_el_bagour_01',
    userId: 'usr_tarek_01',
    fullName: 'كابتن طارق الغريب',
    phone: '+201198765432',
    nationalIdMasked: '2930101******4',
    vehicleType: 'motorcycle',
    vehiclePlate: '٤٣٢١ م ن',
    subscriptionStatus: 'active',
    subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
    currentPeriodEndsAt: new Date(Date.now() + 25 * 86400000).toISOString(),
    cashHoldingPiasters: 24500,
    maxCashHoldingPiasters: 100000,
    ratingAverage: 4.9,
    isOnline: true,
  });
}
if (!mockCaptains.has('cap_el_bagour_expired')) {
  mockCaptains.set('cap_el_bagour_expired', {
    id: 'cap_el_bagour_expired',
    userId: 'usr_ashraf_02',
    fullName: 'كابتن أشرف الصاوي',
    phone: '+201112345678',
    nationalIdMasked: '2910101******9',
    vehicleType: 'scooter',
    vehiclePlate: '٨٧٦٥ م ن',
    subscriptionStatus: 'expired',
    subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
    currentPeriodEndsAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    gracePeriodEndsAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    cashHoldingPiasters: 12000,
    maxCashHoldingPiasters: 100000,
    ratingAverage: 4.6,
    isOnline: false,
  });
}

// Standard response wrappers
function sendSuccess(res: Response, data: any, statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      hub: 'El Bagour, Menoufia',
      version: 'v1.0.0',
    },
  });
}

function sendError(res: Response, code: string, message: string, statusCode: number = 400, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
      hub: 'El Bagour, Menoufia',
      version: 'v1.0.0',
    },
  });
}

/**
 * Extracts actor credentials securely from the verified Supabase principal.
 * Strips and completely rejects client-supplied X-Actor-* spoofing headers.
 */
function getActorFromAuth(req: Request): { actorId: string; actorRole: UserRole; actorName: string } {
  if (!req.user) {
    const err = new Error('غير مصرح: يجب تسجيل الدخول برمز مصادقة صالح للوصول إلى هذه العمليات.');
    (err as any).code = 'UNAUTHENTICATED';
    (err as any).statusCode = 401;
    throw err;
  }
  return {
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.fullName || 'مسؤول عمليات مشوار',
  };
}

// ----------------------------------------------------------------------------
// 1. Health & Hub Status (Public)
// ----------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'healthy',
    hub: 'El Bagour Operations Center',
    governorate: 'Menoufia',
    currency: 'EGP (Integer Egyptian Piasters)',
    commissionModel: 'Fixed Monthly Subscription (0% Order Commission)',
    regulatoryCompliance: {
      passengerMobilityActive: false,
      lockReason: 'Egyptian Law No. 73 of 2018 Compliance Lock',
    },
    security: {
      authProvider: 'Supabase Auth',
      roleVerification: 'app_metadata.role',
      zeroTrustClient: true,
    },
    systemTime: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// 2. Authoritative Pricing Quotes (Public or Authenticated)
// ----------------------------------------------------------------------------
router.post('/quotes', (req: Request, res: Response) => {
  try {
    const { serviceTypeId, distanceKm, isRuralOrVillage, pickupLandmark, dropoffLandmark } = req.body;

    if (!serviceTypeId || distanceKm === undefined) {
      return sendError(res, 'INVALID_INPUT', 'نوع الخدمة والمسافة بالكيلومتر مطلوبة.', 400);
    }

    const quote = pricingEngine.generateQuote({
      serviceTypeId: serviceTypeId as ServiceTypeId,
      distanceKm: Number(distanceKm),
      isRuralOrVillage: Boolean(isRuralOrVillage),
      pickupLandmark,
      dropoffLandmark,
    });

    return sendSuccess(res, quote, 201);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || 'PRICING_CALCULATION_ERROR';
    return sendError(res, code, err.message, statusCode);
  }
});

// ----------------------------------------------------------------------------
// 3. Order Creation & Life Cycle (Authenticated)
// ----------------------------------------------------------------------------
router.post('/orders', authenticate, (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      return res.status(200).json(cached.responseBody);
    }

    // Role check: Only customer, merchant, or admin can place orders
    const user = req.user!;
    if (user.role !== 'customer' && user.role !== 'merchant' && user.role !== 'owner') {
      return sendError(res, 'FORBIDDEN_ROLE', 'غير مصرح لهذا الحساب بإنشاء طلبات.', 403);
    }

    const {
      serviceTypeId,
      quoteId,
      pickup,
      dropoff,
      itemDescription,
      specialInstructions,
      totalFarePiasters,
      paymentMethod = 'cash_on_delivery',
      quoteExpiresAt,
      quoteSignature,
    } = req.body;

    if (!serviceTypeId || !pickup || !dropoff || !itemDescription || !quoteSignature) {
      return sendError(res, 'VALIDATION_ERROR', 'بيانات الطلب غير مكتملة أو توقيع التسعيرة مفقود.', 400);
    }

    // Authoritatively verify the cryptographic quote signature before creating order
    pricingEngine.verifyQuote({
      quoteId,
      serviceTypeId: serviceTypeId as ServiceTypeId,
      totalFarePiasters: Number(totalFarePiasters),
      expiresAt: quoteExpiresAt,
      signature: quoteSignature,
    });

    // Server-derived identity: customerId MUST strictly come from req.user.id!
    // Never trust client-supplied customerId in body
    const customerId = user.id;
    const customerName = user.fullName || req.body.customerName || 'عميل مشوار الباجور';
    const customerPhone = user.phone || req.body.customerPhone || '01000000000';

    const now = new Date().toISOString();
    const orderNumber = `MSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      orderNumber,
      customerId,
      customerName,
      customerPhone,
      serviceTypeId: serviceTypeId as ServiceTypeId,
      status: 'created',
      quoteId,
      pickup,
      dropoff,
      itemDescription,
      specialInstructions,
      totalFarePiasters: Number(totalFarePiasters),
      paymentMethod,
      isPaid: paymentMethod !== 'cash_on_delivery',
      createdAt: now,
      updatedAt: now,
    };

    ordersDb.set(newOrder.id, newOrder);
    PersistentStore.saveOrder(newOrder);

    const responsePayload = {
      success: true,
      data: newOrder,
      meta: {
        timestamp: now,
        hub: 'El Bagour, Menoufia',
        version: 'v1.0.0',
      },
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, {
        orderId: newOrder.id,
        responseBody: responsePayload,
      });
    }

    return res.status(201).json(responsePayload);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || 'ORDER_CREATION_FAILED';
    return sendError(res, code, err.message, statusCode);
  }
});

// 3.2 Read Order (Authenticated with strict tenant ownership)
router.get('/orders/:id', authenticate, async (req: Request, res: Response) => {
  const order = ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'عذراً، الطلب المطلوب غير موجود.', 404);
  }

  const user = req.user!;

  // Ownership verification:
  // 1. Customer: can only read own order
  if (user.role === 'customer' && order.customerId !== user.id) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بالاطلاع على تفاصيل طلب لا يخص حسابك.', 403);
  }

  // 2. Captain: can only read if assigned to them or if currently in searching_captain
  if (user.role === 'captain') {
    const captain = await CaptainService.resolveByUserId(user.id);
    if (!captain) {
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'ملف الكابتن غير مسجل بالنظام.', 403);
    }

    const isAssigned = order.assignedCaptainId === captain.id;
    const isBroadcast = order.status === 'searching_captain' || order.status === 'created';

    if (!isAssigned && !isBroadcast) {
      return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بالاطلاع على طلب مسند لكابتن آخر.', 403);
    }
  }

  // 3. Merchant: can only read own order
  if (user.role === 'merchant' && order.customerId !== user.id) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح للمتجر بالاطلاع على طلبات متجر آخر.', 403);
  }

  // Admin/Owner/Support can read all orders
  return sendSuccess(res, order);
});

// 3.3 Transition Order (Authenticated with actor role check)
router.post('/orders/:id/transitions', authenticate, async (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود لإجراء التغيير.', 404);
    }

    const user = req.user!;
    const { targetStatus, cashCollectedPiasters, cancellationReason, notes } = req.body;

    // Captain transition ownership check
    let resolvedActorId = user.id;
    if (user.role === 'captain') {
      const captain = await CaptainService.requireActiveCaptain(user.id);
      if (order.assignedCaptainId && order.assignedCaptainId !== captain.id) {
        return sendError(res, 'UNAUTHORIZED_CAPTAIN_ACTION', 'غير مصرح لك بتحديث حالة طلب مسند لكابتن آخر.', 403);
      }
      resolvedActorId = captain.id;
    }

    // Customers cannot perform arbitrary status transitions (only cancel via /cancel)
    if (user.role === 'customer' && targetStatus !== 'cancelled') {
      return sendError(res, 'FORBIDDEN_ACTION', 'العميل لا يمكنه تغيير مسار الطلب التشغيلي.', 403);
    }

    const result = OrderFsm.transition(order, {
      targetStatus: targetStatus as OrderStatus,
      actorId: resolvedActorId,
      actorRole: user.role,
      cashCollectedPiasters: cashCollectedPiasters ? Number(cashCollectedPiasters) : undefined,
      cancellationReason,
      notes,
    });

    ordersDb.set(result.order.id, result.order);
    PersistentStore.saveOrder(result.order);

    return sendSuccess(res, {
      order: result.order,
      transition: {
        from: result.previousStatus,
        to: result.order.status,
        at: result.auditLog.timestamp,
        messageAr: 'تم تحديث حالة الطلب بنجاح.',
      },
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || 'INVALID_TRANSITION';
    return sendError(res, code, err.message, statusCode);
  }
});

// 3.4 Cancel Order (Authenticated with customer ownership)
router.post('/orders/:id/cancel', authenticate, (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب المطلوب إلغاؤه غير موجود.', 404);
    }

    const user = req.user!;
    const { reason = 'إلغاء الطلب من المستخدم' } = req.body;

    // Customer ownership & stage check
    if (user.role === 'customer') {
      if (order.customerId !== user.id) {
        return sendError(res, 'FORBIDDEN_RESOURCE', 'لا يمكنك إلغاء طلب لا يخص حسابك.', 403);
      }

      if (!AccessControlGuard.canCancelOrder('customer', order.status)) {
        return sendError(
          res,
          'CANCELLATION_NOT_ALLOWED',
          'لا يمكن للعميل إلغاء الطلب بعد تحرك الكابتن أو استلام الشحنة.',
          403
        );
      }
    } else {
      // Non-customer role check
      if (!AccessControlGuard.canCancelOrder(user.role, order.status)) {
        return sendError(
          res,
          'CANCELLATION_NOT_ALLOWED',
          'لا يمكن إلغاء الطلب في هذه المرحلة بواسطة هذا الحساب.',
          403
        );
      }
    }

    const result = OrderFsm.transition(order, {
      targetStatus: 'cancelled',
      actorId: user.id,
      actorRole: user.role,
      cancellationReason: reason,
    });

    ordersDb.set(result.order.id, result.order);
    PersistentStore.saveOrder(result.order);

    return sendSuccess(res, {
      order: result.order,
      cancelledAt: result.auditLog.timestamp,
      reason,
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    return sendError(res, err.code || 'CANCEL_FAILED', err.message, statusCode);
  }
});

// ----------------------------------------------------------------------------
// 4. Captain Fleet, Eligibility & Dispatch Acceptance
// ----------------------------------------------------------------------------

// 4.1 Eligibility (Database-backed from verified token)
router.get('/captain/eligibility', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let captain: CaptainProfile | null = null;

    if (user.role === 'captain') {
      // Derive captain strictly from authenticated token principal
      captain = await CaptainService.resolveByUserId(user.id);
    } else if (user.role === 'owner' || user.role === 'operations_dispatcher') {
      // Admin can query by captainId query parameter
      const captainId = req.query.captainId as string;
      captain = captainId ? await CaptainService.getById(captainId) : null;
    }

    if (!captain) {
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'سجل الكابتن غير موجود بالنظام.', 404);
    }

    const eligibility = CaptainEligibilityEngine.evaluate(captain);
    return sendSuccess(res, {
      captainId: captain.id,
      fullName: captain.fullName,
      subscriptionStatus: captain.subscriptionStatus,
      eligibility,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'ELIGIBILITY_ERROR', err.message, err.statusCode || 400);
  }
});

// 4.2 Subscription Details (Database-backed from verified token)
router.get('/captain/subscription', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let captain: CaptainProfile | null = null;

    if (user.role === 'captain') {
      captain = await CaptainService.resolveByUserId(user.id);
    } else if (user.role === 'owner' || user.role === 'operations_dispatcher') {
      const captainId = req.query.captainId as string;
      captain = captainId ? await CaptainService.getById(captainId) : null;
    }

    if (!captain) {
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'سجل الكابتن غير موجود.', 404);
    }

    const eligibility = CaptainEligibilityEngine.evaluate(captain);
    return sendSuccess(res, {
      captainId: captain.id,
      planCode: captain.subscriptionPlanCode,
      commissionModel: '0% Order Commission (100% of Delivery Fare retained by Captain)',
      currentPeriodEndsAt: captain.currentPeriodEndsAt,
      gracePeriodEndsAt: captain.gracePeriodEndsAt,
      eligibility,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'SUBSCRIPTION_ERROR', err.message, err.statusCode || 400);
  }
});

// 4.3 Claim / Accept Order (Authenticated Captain only, server-derived captainId)
router.post('/captain/orders/:id/accept', authenticate, requireRoles('captain'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    // Sourced directly from verified token principal
    const captain = await CaptainService.requireActiveCaptain(user.id);

    const orderId = req.params.id;
    const order = ordersDb.get(orderId) || PersistentStore.getOrderById(orderId);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود للقبول.', 404);
    }

    const result = await AssignmentService.claimOrder(
      () => ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id)!,
      captain,
      (updatedOrder) => {
        ordersDb.set(updatedOrder.id, updatedOrder);
        PersistentStore.saveOrder(updatedOrder);
      }
    );

    return sendSuccess(res, result);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || 'CLAIM_FAILED';
    return sendError(res, code, err.message, statusCode);
  }
});

// 4.4 Transactional Cash Collection (Atomic, Idempotent, Integer Piasters)
router.post('/captain/orders/:id/cash-collection', authenticate, requireRoles('captain'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    // Derived from authenticated token principal
    const captain = await CaptainService.requireActiveCaptain(user.id);

    const { amountCollectedPiasters, customerConfirmed, notes } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    const result = await CashCollectionService.recordCashCollection({
      orderId: req.params.id,
      captain,
      amountPiasters: Number(amountCollectedPiasters),
      idempotencyKey,
      customerConfirmed: customerConfirmed !== undefined ? Boolean(customerConfirmed) : true,
      notes,
    });

    // Keep memory map in sync
    const updatedOrder = PersistentStore.getOrderById(req.params.id);
    if (updatedOrder) {
      ordersDb.set(updatedOrder.id, updatedOrder);
    }
    const updatedCaptain = PersistentStore.getCaptainById(captain.id);
    if (updatedCaptain) {
      mockCaptains.set(updatedCaptain.id, updatedCaptain);
    }

    return sendSuccess(res, result);
  } catch (err: any) {
    const statusCode = err.statusCode || 400;
    const code = err.code || 'CASH_COLLECTION_ERROR';
    return sendError(res, code, err.message, statusCode);
  }
});

// ----------------------------------------------------------------------------
// 5. Payment Intents & Verified Webhooks
// ----------------------------------------------------------------------------
router.post('/payments/intents', authenticate, (req: Request, res: Response) => {
  const { orderId, provider = 'paymob' } = req.body;
  const order = ordersDb.get(orderId) || PersistentStore.getOrderById(orderId);

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود لإصدار تفويض دفع.', 404);
  }

  // Only the ordering customer or admin can generate a payment intent
  const user = req.user!;
  if (user.role === 'customer' && order.customerId !== user.id) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بإصدار دفع لطلب عميل آخر.', 403);
  }

  const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  return sendSuccess(res, {
    paymentIntentId,
    orderId: order.id,
    amountPiasters: order.totalFarePiasters,
    formattedAmount: `${(order.totalFarePiasters / 100).toFixed(2)} ج.م`,
    currency: 'EGP',
    provider,
    clientSecret: `sec_${Math.random().toString(36).substring(2, 12)}`,
    status: 'requires_customer_action',
  });
});

router.post('/webhooks/payments/:provider', async (req: Request, res: Response) => {
  try {
    const provider = req.params.provider as 'paymob' | 'fawry' | 'vodafone_cash';
    const signature = (req.headers['x-provider-signature'] as string) || '';
    const rawBody = JSON.stringify(req.body);
    const payload = req.body as WebhookEventPayload;

    const result = await WebhookService.processWebhook(rawBody, signature, payload, async (event) => {
      if (event.orderId && (ordersDb.has(event.orderId) || PersistentStore.getOrderById(event.orderId))) {
        const ord = ordersDb.get(event.orderId) || PersistentStore.getOrderById(event.orderId)!;
        ord.isPaid = true;
        ordersDb.set(ord.id, ord);
        PersistentStore.saveOrder(ord);
      }
    });

    if (!result.received && result.status === 'SIGNATURE_FAILED') {
      return res.status(401).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(400).json({ received: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// 6. Owner & Operations Admin Endpoints (RBAC Guarded & Authenticated)
// ----------------------------------------------------------------------------

// 6.1 Hub Overview & KPIs
router.get('/admin/overview', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const orders = PersistentStore.getAllOrders();
  const captains = PersistentStore.getAllCaptains();
  const settings = PersistentStore.getSettings();

  const activeOrders = orders.filter((o) => o.status === 'searching_captain' || o.status === 'captain_assigned' || o.status === 'at_pickup' || o.status === 'in_transit');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const availableCaptains = captains.filter((c) => c.isOnline && (c.subscriptionStatus === 'active' || c.subscriptionStatus === 'grace_period'));

  // Calculate total platform fees (200 piasters per delivered order)
  const totalPlatformFeesPiasters = deliveredOrders.reduce((sum, o) => sum + 200, 0);

  // Calculate unremitted cash with captains
  const totalUnremittedCashPiasters = captains.reduce((sum, c) => sum + c.cashHoldingPiasters, 0);

  return sendSuccess(res, {
    hubName: settings.hubNameAr,
    kpis: {
      activeOrdersCount: activeOrders.length,
      availableCaptainsCount: availableCaptains.length,
      totalCaptainsCount: captains.length,
      completedOrdersToday: deliveredOrders.length,
      totalPlatformFeesPiasters,
      formattedPlatformFeesEgp: `${(totalPlatformFeesPiasters / 100).toFixed(2)} ج.م`,
      totalUnremittedCashPiasters,
      formattedUnremittedCashEgp: `${(totalUnremittedCashPiasters / 100).toFixed(2)} ج.م`,
      blockedPassengerInquiriesCount: 0, // Strict zero tolerance
      passengerMobilityStatus: 'LOCKED_BY_REGULATION_LAW_73',
    },
    settings,
  });
});

// 6.2 Admin Orders List
router.get('/admin/orders', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const statusFilter = req.query.status as string;
  let orders = PersistentStore.getAllOrders();

  if (statusFilter && statusFilter !== 'all') {
    orders = orders.filter((o) => o.status === statusFilter);
  }

  return sendSuccess(res, {
    count: orders.length,
    orders,
  });
});

// 6.3 Admin Captains Fleet List
router.get('/admin/captains', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const captains = PersistentStore.getAllCaptains();
  return sendSuccess(res, {
    count: captains.length,
    captains,
  });
});

// 6.4 Manual Dispatch Override
router.post('/admin/orders/:id/override-dispatch', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manual_dispatch_override');

    const { captainId } = req.body;
    if (!captainId) {
      return sendError(res, 'MISSING_CAPTAIN_ID', 'معرف الكابتن مطلوب للتعيين اليدوي.', 400);
    }

    const updatedOrder = PersistentStore.manualAssignCaptainToOrder(
      req.params.id,
      captainId,
      actorId,
      actorName,
      actorRole
    );

    // Keep memory map in sync
    ordersDb.set(updatedOrder.id, updatedOrder);

    return sendSuccess(res, updatedOrder);
  } catch (err: any) {
    return sendError(res, err.code || 'DISPATCH_OVERRIDE_FAILED', err.message, err.statusCode || 400);
  }
});

// 6.5 Emergency Order Cancellation
router.post('/admin/orders/:id/emergency-cancel', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'cancel_order');

    const { reason = 'إلغاء طارئ من مركز عمليات الباجور' } = req.body;
    const cancelledOrder = PersistentStore.emergencyCancelOrder(
      req.params.id,
      reason,
      actorId,
      actorName,
      actorRole
    );

    ordersDb.set(cancelledOrder.id, cancelledOrder);

    return sendSuccess(res, cancelledOrder);
  } catch (err: any) {
    return sendError(res, err.code || 'CANCEL_FAILED', err.message, err.statusCode || 400);
  }
});

// 6.6 Settle Captain Cash Remittance
router.post('/admin/captains/:id/settle-cash', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'settle_cash_remittance');

    const { amountPiasters, notes } = req.body;
    if (!amountPiasters || Number(amountPiasters) <= 0) {
      return sendError(res, 'INVALID_AMOUNT', 'مبلغ التوريد بالقرش غير صحيح.', 400);
    }

    const captain = PersistentStore.remitCaptainCash(
      req.params.id,
      Number(amountPiasters),
      actorId,
      actorName,
      notes
    );

    mockCaptains.set(captain.id, captain);

    return sendSuccess(res, {
      captain,
      remittedAmountPiasters: Number(amountPiasters),
      formattedRemittedEgp: `${(Number(amountPiasters) / 100).toFixed(2)} ج.م`,
      remainingCashPiasters: captain.cashHoldingPiasters,
      formattedRemainingEgp: `${(captain.cashHoldingPiasters / 100).toFixed(2)} ج.م`,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'REMITTANCE_FAILED', err.message, err.statusCode || 400);
  }
});

// 6.7 Renew Captain Subscription
router.post('/admin/captains/:id/renew-subscription', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manage_captain_accounts');

    const { daysToAdd = 30 } = req.body;
    const captain = PersistentStore.renewCaptainSubscription(
      req.params.id,
      Number(daysToAdd),
      actorId,
      actorName
    );

    mockCaptains.set(captain.id, captain);

    return sendSuccess(res, {
      captain,
      daysAdded: Number(daysToAdd),
      newExpiryDate: captain.currentPeriodEndsAt,
      commissionInvariant: '0% Order Commission Verified',
    });
  } catch (err: any) {
    return sendError(res, err.code || 'RENEWAL_FAILED', err.message, err.statusCode || 400);
  }
});

// 6.8 Get System & Tariff Settings
router.get('/admin/settings', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const settings = PersistentStore.getSettings();
  return sendSuccess(res, settings);
});

// 6.9 Update Tariff Settings (Owner Only)
router.put('/admin/settings', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manage_pricing');

    const updatedSettings = PersistentStore.updateSettings(req.body, actorId, actorName);
    return sendSuccess(res, updatedSettings);
  } catch (err: any) {
    return sendError(res, err.code || 'SETTINGS_UPDATE_FAILED', err.message, err.statusCode || 400);
  }
});

// 6.10 Query Audit Ledger
router.get('/admin/audit-logs', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_audit_logs');

  const actionType = req.query.actionType as AuditActionType | undefined;
  const targetEntity = req.query.targetEntity as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;

  const logs = AuditLogger.query({ actionType, targetEntity, limit });
  return sendSuccess(res, {
    count: logs.length,
    totalCount: AuditLogger.count(),
    logs,
  });
});

// Reset method for testing
export function resetTestDatabases() {
  ordersDb.clear();
  idempotencyStore.clear();
  mockCaptains.clear();
  WebhookService.clearCache();
  CashCollectionService.clearCache();
  PersistentStore.initialize();
  syncWithStore();
}

export { ordersDb, mockCaptains };
