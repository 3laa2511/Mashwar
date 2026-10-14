/**
 * Mashwar — REST API Router implementation
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Base URL: /api/v1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PricingEngine } from '../pricing/pricingEngine.js';
import { OrderFsm } from '../orders/orderFsm.js';
import { CaptainEligibilityEngine } from '../captain/captainEligibility.js';
import { AssignmentService } from '../dispatch/assignmentService.js';
import { WebhookService } from '../payments/webhookService.js';
import {
  Order,
  CaptainProfile,
  ServiceTypeId,
  OrderStatus,
  WebhookEventPayload,
} from '../types/index.js';

export const router = Router();
const pricingEngine = new PricingEngine();

// In-memory repositories for prototype / local integration testing
const ordersDb = new Map<string, Order>();
const idempotencyStore = new Map<string, { orderId: string; responseBody: any }>();

// Initial mock captain profiles for El Bagour fleet testing
const mockCaptains = new Map<string, CaptainProfile>([
  [
    'cap_el_bagour_01',
    {
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
      cashHoldingPiasters: 24500, // 245.00 EGP
      maxCashHoldingPiasters: 100000, // 1000.00 EGP
      ratingAverage: 4.9,
      isOnline: true,
    },
  ],
  [
    'cap_el_bagour_expired',
    {
      id: 'cap_el_bagour_expired',
      userId: 'usr_expired_02',
      fullName: 'كابتن مصطفى الصياد',
      phone: '+201011223344',
      nationalIdMasked: '2900505******1',
      vehicleType: 'motorcycle',
      vehiclePlate: '٨٧٦٥ ط د',
      subscriptionStatus: 'expired',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
      cashHoldingPiasters: 0,
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.8,
      isOnline: true,
    },
  ],
  [
    'cap_el_bagour_cash_capped',
    {
      id: 'cap_el_bagour_cash_capped',
      userId: 'usr_capped_03',
      fullName: 'كابتن أحمد عبد الرازق',
      phone: '+201233445566',
      nationalIdMasked: '2951212******9',
      vehicleType: 'scooter',
      vehiclePlate: '١٢٣٤ ب ج',
      subscriptionStatus: 'active',
      subscriptionPlanCode: 'EL_BAGOUR_MONTHLY_STANDARD',
      currentPeriodEndsAt: new Date(Date.now() + 15 * 86400000).toISOString(),
      cashHoldingPiasters: 105000, // 1,050.00 EGP (Breached!)
      maxCashHoldingPiasters: 100000,
      ratingAverage: 4.7,
      isOnline: true,
    },
  ],
]);

// Helper for standard JSON responses
function sendSuccess(res: Response, data: any, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

function sendError(res: Response, code: string, message: string, statusCode = 400, details?: any) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

// ----------------------------------------------------------------------------
// 1. Health Endpoint
// ----------------------------------------------------------------------------
router.get('/health', (req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'ONLINE',
    service: 'mashwar-authoritative-api',
    region: 'El Bagour, Menoufia, Egypt',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// 2. Authoritative Fare Quote Endpoint
// ----------------------------------------------------------------------------
router.post('/quotes', (req: Request, res: Response) => {
  try {
    const { serviceTypeId, estimatedDistanceKm, distanceKm, isRuralOrVillage, pickupLandmark, dropoffLandmark } = req.body;
    const distance = Number(distanceKm ?? estimatedDistanceKm);

    if (isNaN(distance)) {
      return sendError(res, 'INVALID_INPUT', 'يرجى تزويد مسافة الرحلة بالكيلومتر بصورة صحيحة.', 400);
    }

    const quote = pricingEngine.generateQuote({
      serviceTypeId: serviceTypeId as ServiceTypeId,
      distanceKm: distance,
      isRuralOrVillage: Boolean(isRuralOrVillage),
      pickupLandmark,
      dropoffLandmark,
    });

    return sendSuccess(res, quote);
  } catch (err: any) {
    return sendError(res, err.code || 'PRICING_ERROR', err.message, err.statusCode || 400);
  }
});

// ----------------------------------------------------------------------------
// 3. Order Management Endpoints
// ----------------------------------------------------------------------------
router.post('/orders', (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.header('Idempotency-Key');
    if (idempotencyKey && idempotencyStore.has(idempotencyKey)) {
      const cached = idempotencyStore.get(idempotencyKey)!;
      return res.status(200).json(cached.responseBody);
    }

    const {
      serviceTypeId,
      quoteId,
      quoteSignature,
      quoteExpiresAt,
      totalFarePiasters,
      itemDescription,
      specialInstructions,
      pickup,
      dropoff,
      customerName = 'عميل الباجور',
      customerPhone = '+201012345678',
      paymentMethod = 'cash_on_delivery',
    } = req.body;

    if (!quoteId) {
      return sendError(res, 'MISSING_QUOTE', 'لا يمكن إنشاء الطلب بدون معرف تسعيرة معتمد من الخادم.', 400);
    }

    // Verify quote if signature provided
    if (quoteSignature && quoteExpiresAt && totalFarePiasters) {
      pricingEngine.verifyQuote({
        quoteId,
        serviceTypeId: serviceTypeId as ServiceTypeId,
        totalFarePiasters: Number(totalFarePiasters),
        expiresAt: quoteExpiresAt,
        signature: quoteSignature,
      });
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const orderNumber = `MSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();

    const order: Order = {
      id: orderId,
      orderNumber,
      customerId: 'usr_customer_demo',
      customerName,
      customerPhone,
      serviceTypeId: serviceTypeId as ServiceTypeId,
      status: 'created',
      quoteId,
      pickup: pickup || { landmarkName: 'ميدان المحطة', detailedAddress: '', contactPhone: customerPhone },
      dropoff: dropoff || { landmarkName: 'مستشفى الباجور العام', detailedAddress: '', contactPhone: customerPhone },
      itemDescription: itemDescription || 'طرد محلي',
      specialInstructions,
      totalFarePiasters: Number(totalFarePiasters) || 2500,
      paymentMethod,
      isPaid: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    ordersDb.set(orderId, order);

    const responsePayload = {
      success: true,
      data: order,
      meta: { timestamp: nowIso },
    };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, { orderId, responseBody: responsePayload });
    }

    return res.status(201).json(responsePayload);
  } catch (err: any) {
    return sendError(res, err.code || 'ORDER_CREATION_FAILED', err.message, err.statusCode || 400);
  }
});

router.get('/orders/:id', (req: Request, res: Response) => {
  const order = ordersDb.get(req.params.id);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'لم يتم العثور على الطلب المطلوب.', 404);
  }
  return sendSuccess(res, order);
});

// Update order status (Authoritative FSM transition)
router.post('/orders/:id/transitions', (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب المطلوب غير مسجل بالنظام.', 404);
    }

    const { targetStatus, actorId = 'act_system', actorRole = 'captain', notes, cashCollectedPiasters } = req.body;

    const transitionResult = OrderFsm.transition(order, {
      targetStatus: targetStatus as OrderStatus,
      actorId,
      actorRole,
      notes,
      cashCollectedPiasters: cashCollectedPiasters ? Number(cashCollectedPiasters) : undefined,
    });

    ordersDb.set(order.id, transitionResult.order);
    return sendSuccess(res, transitionResult);
  } catch (err: any) {
    return sendError(res, err.code || 'TRANSITION_ERROR', err.message, err.statusCode || 422);
  }
});

// Cancel order
router.post('/orders/:id/cancel', (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود.', 404);
    }

    const { cancellationReason = 'إلغاء من قبل المستخدم' } = req.body;
    const result = OrderFsm.transition(order, {
      targetStatus: 'cancelled',
      actorId: 'usr_customer',
      actorRole: 'customer',
      cancellationReason,
    });

    ordersDb.set(order.id, result.order);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.code || 'CANCELLATION_FAILED', err.message, err.statusCode || 422);
  }
});

// ----------------------------------------------------------------------------
// 4. Captain Fleet, Eligibility & Claim Endpoints
// ----------------------------------------------------------------------------
router.get('/captain/eligibility', (req: Request, res: Response) => {
  const captainId = (req.query.captainId as string) || 'cap_el_bagour_01';
  const captain = mockCaptains.get(captainId);

  if (!captain) {
    return sendError(res, 'CAPTAIN_NOT_FOUND', 'بيانات الكابتن غير مسجلة بقاعدة بيانات الأسطول.', 404);
  }

  const evaluation = CaptainEligibilityEngine.evaluate(captain);
  return sendSuccess(res, evaluation);
});

router.get('/captain/subscription', (req: Request, res: Response) => {
  const captainId = (req.query.captainId as string) || 'cap_el_bagour_01';
  const captain = mockCaptains.get(captainId);

  if (!captain) {
    return sendError(res, 'CAPTAIN_NOT_FOUND', 'بيانات الكابتن غير موجودة.', 404);
  }

  return sendSuccess(res, {
    captainId: captain.id,
    fullName: captain.fullName,
    subscriptionStatus: captain.subscriptionStatus,
    planCode: captain.subscriptionPlanCode,
    planNameAr: 'اشتراك الباجور الشهري الموحد (بدون أي عمولة)',
    pricePiasters: 25000,
    formattedPrice: '250.00 ج.م',
    currentPeriodEndsAt: captain.currentPeriodEndsAt,
    cashHoldingPiasters: captain.cashHoldingPiasters,
    maxCashHoldingPiasters: captain.maxCashHoldingPiasters,
  });
});

// Atomic order claim by a captain (Concurrency-safe)
router.post('/captain/orders/:id/accept', async (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب المطلوب غير موجود.', 404);
    }

    const { captainId = 'cap_el_bagour_01' } = req.body;
    const captain = mockCaptains.get(captainId);
    if (!captain) {
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'بيانات الكابتن غير مسجلة.', 404);
    }

    const result = await AssignmentService.claimOrder(
      () => ordersDb.get(req.params.id)!,
      captain,
      (updatedOrder) => {
        ordersDb.set(updatedOrder.id, updatedOrder);
      }
    );

    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.code || 'CLAIM_FAILED', err.message, err.statusCode || 409);
  }
});

// Doorstep cash collection record
router.post('/captain/orders/:id/cash-collection', (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود.', 404);
    }

    const { amountCollectedPiasters, customerConfirmed, notes } = req.body;
    const amount = Number(amountCollectedPiasters);

    if (isNaN(amount) || amount <= 0) {
      return sendError(res, 'INVALID_AMOUNT', 'المبلغ المحصل يجب أن يكون قيمة موجبة بالقرش المصري.', 400);
    }

    // Update order with recorded cash
    order.cashCollectedPiasters = amount;
    ordersDb.set(order.id, order);

    return sendSuccess(res, {
      orderId: order.id,
      amountCollectedPiasters: amount,
      formattedAmountEgp: `${(amount / 100).toFixed(2)} ج.م`,
      customerConfirmed: Boolean(customerConfirmed),
      notes,
      recordedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return sendError(res, 'CASH_COLLECTION_ERROR', err.message, 400);
  }
});

// ----------------------------------------------------------------------------
// 5. Payment Intents & Verified Webhooks
// ----------------------------------------------------------------------------
router.post('/payments/intents', (req: Request, res: Response) => {
  const { orderId, provider = 'paymob' } = req.body;
  const order = ordersDb.get(orderId);

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود لإصدار تفويض دفع.', 404);
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
      if (event.orderId && ordersDb.has(event.orderId)) {
        const ord = ordersDb.get(event.orderId)!;
        ord.isPaid = true;
        ordersDb.set(ord.id, ord);
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

// Reset method for testing
export function resetTestDatabases() {
  ordersDb.clear();
  idempotencyStore.clear();
  WebhookService.clearCache();
}

export { ordersDb, mockCaptains };
