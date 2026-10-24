/**
 * Mashwar — Authoritative REST API Router implementation
 * Launch Hub: El Bagour, Menoufia Governorate, Egypt (with multi-city Menoufia expansion)
 * Base URL: /api/v1
 *
 * Security Model:
 * - Fail-closed token verification (Supabase Auth / Bearer JWT)
 * - Server-derived identity (customerId, captainId, merchantUserId derived from auth principal)
 * - Strict ownership checks (Customer, Captain, Merchant, Admin)
 * - Zero trust in client-supplied X-Actor-* or body identity parameters
 * - Transactional, idempotent cash collection in integer Egyptian Piasters
 * - Sliding-window rate limiting on sensitive endpoints
 */

import { Router, Request, Response } from 'express';
import { PricingEngine } from '../pricing/pricingEngine.js';
import { OrderFsm } from '../orders/orderFsm.js';
import { CaptainEligibilityEngine } from '../captain/captainEligibility.js';
import { AssignmentService } from '../dispatch/assignmentService.js';
import { WebhookService } from '../payments/webhookService.js';
import { AccessControlGuard, UserRole } from '../security/rbac.js';
import { AuditLogger, AuditActionType } from '../security/auditLogger.js';
import { PersistentStore } from '../store/persistentStore.js';
import { authenticate, requireRoles } from '../security/auth.js';
import { createRateLimiter, resetAllRateLimiters } from '../security/rateLimiter.js';
import { CaptainService } from '../services/captainService.js';
import { CashCollectionService } from '../services/cashCollectionService.js';
import { MerchantService } from '../services/merchantService.js';
import { ComplaintService } from '../services/complaintService.js';
import { isPostgresConfigured } from '../database/db.js';
import { verifyOrRunMigrations } from '../database/migrator.js';
import {
  Order,
  OrderItem,
  CaptainProfile,
  ServiceTypeId,
  OrderStatus,
  WebhookEventPayload,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from '../types/index.js';

export const router = Router();
const pricingEngine = new PricingEngine();

// Rate limiters for sensitive endpoints
const quoteRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60, scope: 'quotes' });
const orderCreateRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30, scope: 'orders_create' });
const webhookRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 60, scope: 'webhooks' });

// Initialize persistent store
PersistentStore.initialize();

// In-memory repositories synchronized with PersistentStore
const ordersDb = new Map<string, Order>();
const idempotencyStore = new Map<string, { orderId: string; payloadFingerprint: string; responseBody: any }>();
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
    cityId: 'city_el_bagour',
    activeZoneId: 'zone_bagour_center',
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
    cityId: 'city_el_bagour',
    activeZoneId: 'zone_bagour_center',
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
      version: 'v1.1.0',
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
      version: 'v1.1.0',
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
// 1. Health, Multi-City Zones & Hub Status (Public)
// ----------------------------------------------------------------------------
router.get('/health', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'healthy',
    hub: 'El Bagour Operations Center',
    governorate: 'Menoufia',
    activeCitiesCount: PersistentStore.getAllCities(false).length,
    activeZonesCount: PersistentStore.getZonesByCity(undefined, false).length,
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
    database: {
      postgresConfigured: isPostgresConfigured(),
      persistenceMode: isPostgresConfigured() ? 'postgresql_kysely' : 'in_memory_persistent_store',
    },
    systemTime: new Date().toISOString(),
  });
});

// 1.2 Public Multi-City & Service Zones Discovery
router.get('/zones', (req: Request, res: Response) => {
  const cityId = req.query.cityId as string | undefined;
  const includeInactive = req.query.includeInactive === 'true';

  const cities = PersistentStore.getAllCities(includeInactive);
  const zones = PersistentStore.getZonesByCity(cityId, includeInactive);
  const tariffs = PersistentStore.getAllZoneTariffs().filter((t) =>
    zones.some((z) => z.id === t.zoneId)
  );

  return sendSuccess(res, {
    cities,
    zones,
    tariffs,
  });
});

// ----------------------------------------------------------------------------
// 2. Authoritative Pricing Quotes (Public or Authenticated, Rate-Limited)
// ----------------------------------------------------------------------------
router.post('/quotes', quoteRateLimiter, (req: Request, res: Response) => {
  try {
    const {
      serviceTypeId,
      distanceKm,
      isRuralOrVillage,
      zoneId,
      cityId,
      itemsSubtotalPiasters,
      pickupLandmark,
      dropoffLandmark,
    } = req.body;

    if (!serviceTypeId || distanceKm === undefined) {
      return sendError(res, 'INVALID_INPUT', 'نوع الخدمة والمسافة بالكيلومتر مطلوبة.', 400);
    }

    const quote = pricingEngine.generateQuote({
      serviceTypeId: serviceTypeId as ServiceTypeId,
      distanceKm: Number(distanceKm),
      isRuralOrVillage: Boolean(isRuralOrVillage),
      zoneId,
      cityId,
      itemsSubtotalPiasters: itemsSubtotalPiasters !== undefined ? Number(itemsSubtotalPiasters) : 0,
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
// 2.5 Merchant Stores & Catalog Discovery (Public Read, Strict RBAC Write)
// ----------------------------------------------------------------------------
router.get('/stores', (req: Request, res: Response) => {
  const cityId = req.query.cityId as string | undefined;
  const zoneId = req.query.zoneId as string | undefined;
  const category = req.query.category as string | undefined;
  const onlyOpen = req.query.onlyOpen === 'true';

  const stores = MerchantService.listStores({ cityId, zoneId, category, onlyOpen });
  return sendSuccess(res, {
    count: stores.length,
    stores,
  });
});

router.get('/stores/:storeId/catalog', (req: Request, res: Response) => {
  try {
    const onlyAvailable = req.query.onlyAvailable === 'true';
    const catalog = MerchantService.getStoreCatalog(req.params.storeId, onlyAvailable);
    return sendSuccess(res, catalog);
  } catch (err: any) {
    return sendError(res, err.code || 'STORE_ERROR', err.message, err.statusCode || 404);
  }
});

// Merchant Store Status & Settings Update (Strict Store Ownership)
router.patch('/merchant/stores/:storeId/status', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    const { isOpen, prepTimeMinutes, minOrderPiasters } = req.body;

    const updatedStore = MerchantService.updateStoreStatus({
      storeId: req.params.storeId,
      actorId,
      actorRole,
      actorName,
      isOpen,
      prepTimeMinutes,
      minOrderPiasters,
    });

    return sendSuccess(res, updatedStore);
  } catch (err: any) {
    return sendError(res, err.code || 'STORE_UPDATE_FAILED', err.message, err.statusCode || 400);
  }
});

// Merchant Create Menu Item (Strict Store Ownership + Integer Piasters)
router.post('/merchant/stores/:storeId/menu-items', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    const { categoryId, categoryNameAr, nameAr, descriptionAr, pricePiasters, unitAr, isAvailable } = req.body;

    const item = MerchantService.createMenuItem({
      storeId: req.params.storeId,
      actorId,
      actorRole,
      actorName,
      categoryId,
      categoryNameAr,
      nameAr,
      descriptionAr,
      pricePiasters: Number(pricePiasters),
      unitAr,
      isAvailable,
    });

    return sendSuccess(res, item, 201);
  } catch (err: any) {
    return sendError(res, err.code || 'MENU_ITEM_CREATE_FAILED', err.message, err.statusCode || 400);
  }
});

// Merchant Update Menu Item (Strict Store Ownership + Integer Piasters)
router.patch('/merchant/stores/:storeId/menu-items/:itemId', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    const { nameAr, descriptionAr, pricePiasters, isAvailable } = req.body;

    const item = MerchantService.updateMenuItem({
      storeId: req.params.storeId,
      itemId: req.params.itemId,
      actorId,
      actorRole,
      actorName,
      nameAr,
      descriptionAr,
      pricePiasters: pricePiasters !== undefined ? Number(pricePiasters) : undefined,
      isAvailable,
    });

    return sendSuccess(res, item);
  } catch (err: any) {
    return sendError(res, err.code || 'MENU_ITEM_UPDATE_FAILED', err.message, err.statusCode || 400);
  }
});

// Merchant List Own Store Orders
router.get('/merchant/orders', authenticate, requireRoles('merchant', 'owner', 'operations_dispatcher'), (req: Request, res: Response) => {
  const user = req.user!;
  const allOrders = PersistentStore.getAllOrders();

  const orders =
    user.role === 'merchant'
      ? allOrders.filter((o) => o.merchantUserId === user.id || o.customerId === user.id)
      : allOrders.filter((o) => o.serviceTypeId === 'restaurant_store');

  return sendSuccess(res, {
    count: orders.length,
    orders,
  });
});

// ----------------------------------------------------------------------------
// 3. Order Creation & Life Cycle (Authenticated)
// ----------------------------------------------------------------------------
router.post('/orders', authenticate, orderCreateRateLimiter, (req: Request, res: Response) => {
  try {
    // Role check: Only customer, merchant, or admin can place orders
    const user = req.user!;
    if (user.role !== 'customer' && user.role !== 'merchant' && user.role !== 'owner') {
      return sendError(res, 'FORBIDDEN_ROLE', 'غير مصرح لهذا الحساب بإنشاء طلبات.', 403);
    }

    const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string | undefined;
    const scopedIdempotencyKey = idempotencyKey ? `${user.id}:${idempotencyKey}` : undefined;

    const {
      serviceTypeId,
      quoteId,
      cityId,
      zoneId,
      storeId,
      items,
      pickup,
      dropoff,
      itemDescription,
      specialInstructions,
      totalFarePiasters,
      paymentMethod = 'cash_on_delivery',
      quoteExpiresAt,
      quoteSignature,
    } = req.body;

    const orderPayloadFingerprint = JSON.stringify({
      serviceTypeId,
      quoteId,
      storeId: storeId || null,
      totalFarePiasters: Number(totalFarePiasters),
      paymentMethod,
    });

    if (scopedIdempotencyKey && idempotencyStore.has(scopedIdempotencyKey)) {
      const cached = idempotencyStore.get(scopedIdempotencyKey)!;
      if (cached.payloadFingerprint !== orderPayloadFingerprint) {
        return sendError(
          res,
          'IDEMPOTENCY_PAYLOAD_MISMATCH',
          'مفتاح عدم التكرار (Idempotency Key) مستخدم مسبقاً لطلب ببيانات أو تسعيرة مختلفة.',
          409
        );
      }
      return res.status(200).json(cached.responseBody);
    }

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

    // If storeId or items are provided, validate store and compute authoritative item prices
    let resolvedStoreName: string | undefined;
    let resolvedMerchantUserId: string | undefined;
    let resolvedCityId = cityId || 'city_el_bagour';
    let resolvedZoneId = zoneId || 'zone_bagour_center';
    let orderItems: OrderItem[] | undefined;
    let itemsSubtotalPiasters = 0;

    if (storeId) {
      const store = PersistentStore.getStoreById(storeId);
      if (!store || !store.isActive) {
        return sendError(res, 'STORE_NOT_FOUND', 'المتجر المحدد غير موجود أو غير نشط.', 404);
      }
      if (!store.isOpen) {
        return sendError(res, 'STORE_CLOSED', `عذراً، متجر (${store.nameAr}) مغلق حالياً ولا يستقبل طلبات.`, 422);
      }
      resolvedStoreName = store.nameAr;
      resolvedMerchantUserId = store.merchantUserId;
      resolvedCityId = store.cityId;
      resolvedZoneId = store.zoneId;
    }

    const now = new Date().toISOString();
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (Array.isArray(items) && items.length > 0) {
      orderItems = [];
      for (const rawItem of items) {
        const menuItem = PersistentStore.getMenuItemById(rawItem.menuItemId);
        if (!menuItem) {
          return sendError(res, 'MENU_ITEM_NOT_FOUND', `الصنف المطلوب (${rawItem.menuItemId}) غير موجود.`, 404);
        }
        if (!menuItem.isAvailable) {
          return sendError(res, 'MENU_ITEM_UNAVAILABLE', `عذراً، الصنف (${menuItem.nameAr}) غير متاح حالياً.`, 422);
        }
        const qty = Math.max(1, Math.floor(Number(rawItem.quantity || 1)));
        const lineTotal = menuItem.pricePiasters * qty;
        itemsSubtotalPiasters += lineTotal;
        orderItems.push({
          id: `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          orderId,
          menuItemId: menuItem.id,
          nameAr: menuItem.nameAr,
          quantity: qty,
          unitPricePiasters: menuItem.pricePiasters,
          totalPricePiasters: lineTotal,
          notes: rawItem.notes,
        });
      }
    }

    // Server-derived identity: customerId MUST strictly come from req.user.id!
    const customerId = user.id;
    const customerName = user.fullName || req.body.customerName || 'عميل مشوار الباجور';
    const customerPhone = user.phone || req.body.customerPhone || '01000000000';

    const orderNumber = `MSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      customerId,
      customerName,
      customerPhone,
      serviceTypeId: serviceTypeId as ServiceTypeId,
      status: 'created',
      cityId: resolvedCityId,
      zoneId: resolvedZoneId,
      storeId,
      storeName: resolvedStoreName,
      merchantUserId: resolvedMerchantUserId,
      quoteId,
      pickup,
      dropoff,
      itemDescription,
      items: orderItems,
      itemsSubtotalPiasters: itemsSubtotalPiasters > 0 ? itemsSubtotalPiasters : undefined,
      specialInstructions,
      totalFarePiasters: Number(totalFarePiasters),
      paymentMethod,
      isPaid: paymentMethod !== 'cash_on_delivery',
      createdAt: now,
      updatedAt: now,
    };

    ordersDb.set(newOrder.id, newOrder);
    PersistentStore.saveOrder(newOrder);
    PersistentStore.recordOrderStateHistory({
      orderId: newOrder.id,
      fromStatus: null,
      toStatus: 'created',
      actorId: customerId,
      actorRole: user.role,
      notes: 'تم إنشاء الطلب وتوثيق التسعيرة الرقمية بنجاح.',
    });

    if (resolvedMerchantUserId) {
      PersistentStore.addNotification({
        recipientUserId: resolvedMerchantUserId,
        recipientRole: 'merchant',
        titleAr: `طلب جديد للمتجر #${orderNumber}`,
        bodyAr: `طلب جديد من ${customerName}: ${itemDescription}`,
        orderId: newOrder.id,
      });
    }

    const responsePayload = {
      success: true,
      data: newOrder,
      meta: {
        timestamp: now,
        hub: 'El Bagour, Menoufia',
        version: 'v1.1.0',
      },
    };

    if (scopedIdempotencyKey) {
      idempotencyStore.set(scopedIdempotencyKey, {
        orderId: newOrder.id,
        payloadFingerprint: orderPayloadFingerprint,
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

// 3.1 List Authenticated User's Orders
router.get('/orders', authenticate, async (req: Request, res: Response) => {
  const user = req.user!;
  const allOrders = PersistentStore.getAllOrders();

  if (user.role === 'customer') {
    const customerOrders = allOrders.filter((o) => o.customerId === user.id);
    return sendSuccess(res, { count: customerOrders.length, orders: customerOrders });
  }

  if (user.role === 'merchant') {
    const merchantOrders = allOrders.filter(
      (o) => o.merchantUserId === user.id || o.customerId === user.id
    );
    return sendSuccess(res, { count: merchantOrders.length, orders: merchantOrders });
  }

  if (user.role === 'captain') {
    const captain = await CaptainService.resolveByUserId(user.id);
    const captainOrders = captain
      ? allOrders.filter(
          (o) =>
            o.assignedCaptainId === captain.id ||
            o.status === 'searching_captain' ||
            o.status === 'ready_for_pickup'
        )
      : [];
    return sendSuccess(res, { count: captainOrders.length, orders: captainOrders });
  }

  return sendSuccess(res, { count: allOrders.length, orders: allOrders });
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

  // 2. Captain: can only read if assigned to them or if currently in searching_captain / ready_for_pickup
  if (user.role === 'captain') {
    const captain = await CaptainService.resolveByUserId(user.id);
    if (!captain) {
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'ملف الكابتن غير مسجل بالنظام.', 403);
    }

    const isAssigned = order.assignedCaptainId === captain.id;
    const isBroadcast =
      !order.assignedCaptainId &&
      (order.status === 'searching_captain' ||
        order.status === 'created' ||
        order.status === 'ready_for_pickup');

    if (!isAssigned && !isBroadcast) {
      return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بالاطلاع على طلب مسند لكابتن آخر.', 403);
    }
  }

  // 3. Merchant: can only read own order or order placed at their store
  if (
    user.role === 'merchant' &&
    order.customerId !== user.id &&
    order.merchantUserId !== user.id
  ) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح للمتجر بالاطلاع على طلبات متجر آخر.', 403);
  }

  // Admin/Owner/Support can read all orders
  return sendSuccess(res, order);
});

// 3.2.b Read Order State History
router.get('/orders/:id/history', authenticate, async (req: Request, res: Response) => {
  const order = ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id);
  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'عذراً، الطلب المطلوب غير موجود.', 404);
  }

  const user = req.user!;
  if (user.role === 'customer' && order.customerId !== user.id) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بالاطلاع على سجل طلب لا يخص حسابك.', 403);
  }
  if (user.role === 'captain') {
    const captain = await CaptainService.resolveByUserId(user.id);
    if (!captain || order.assignedCaptainId !== captain.id) {
      return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح للكابتن بالاطلاع على سجل طلب غير مسند إليه.', 403);
    }
  }
  if (
    user.role === 'merchant' &&
    order.customerId !== user.id &&
    order.merchantUserId !== user.id
  ) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح للمتجر بالاطلاع على سجل طلب متجر آخر.', 403);
  }

  const history = PersistentStore.getOrderStateHistory(order.id);
  return sendSuccess(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    currentStatus: order.status,
    history,
  });
});

// 3.3 Transition Order (Authenticated with actor role & ownership check)
router.post('/orders/:id/transitions', authenticate, async (req: Request, res: Response) => {
  try {
    const order = ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود لإجراء التغيير.', 404);
    }

    const user = req.user!;
    const { targetStatus, cashCollectedPiasters, cancellationReason, notes } = req.body;

    // Captain transition ownership check (must be the assigned captain)
    let resolvedActorId = user.id;
    if (user.role === 'captain') {
      const captain = await CaptainService.requireActiveCaptain(user.id);
      if (!order.assignedCaptainId || order.assignedCaptainId !== captain.id) {
        return sendError(res, 'UNAUTHORIZED_CAPTAIN_ACTION', 'غير مصرح لك بتحديث حالة طلب غير مسند إليك.', 403);
      }
      resolvedActorId = captain.id;
    }

    // Customer ownership & transition check
    if (user.role === 'customer') {
      if (order.customerId !== user.id) {
        return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بتحديث حالة طلب لا يخص حسابك.', 403);
      }
      if (targetStatus !== 'cancelled') {
        return sendError(res, 'FORBIDDEN_ACTION', 'العميل لا يمكنه تغيير مسار الطلب التشغيلي.', 403);
      }
      if (!AccessControlGuard.canCancelOrder('customer', order.status)) {
        return sendError(res, 'CANCELLATION_NOT_ALLOWED', 'لا يمكن للعميل إلغاء الطلب بعد بدء تجهيزه أو تحرك الكابتن.', 403);
      }
    }

    // Merchant ownership check
    if (user.role === 'merchant') {
      if (!order.merchantUserId || order.merchantUserId !== user.id) {
        return sendError(res, 'UNAUTHORIZED_MERCHANT_ACTION', 'غير مصرح للتاجر بتحديث حالة طلب يخص متجراً آخر.', 403);
      }
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
    PersistentStore.recordOrderStateHistory({
      orderId: result.order.id,
      fromStatus: result.previousStatus,
      toStatus: result.newStatus,
      actorId: resolvedActorId,
      actorRole: user.role,
      notes: result.auditLog.notes,
    });

    // Notify customer of status update
    PersistentStore.addNotification({
      recipientUserId: result.order.customerId,
      recipientRole: 'customer',
      titleAr: `تحديث حالة الطلب #${result.order.orderNumber}`,
      bodyAr: `تم انتقال حالة طلبك من (${result.previousStatus}) إلى (${result.newStatus}).`,
      orderId: result.order.id,
    });

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

// 3.4 Cancel Order (Authenticated with customer/merchant ownership)
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
          'لا يمكن للعميل إلغاء الطلب بعد بدء تجهيزه أو تحرك الكابتن.',
          403
        );
      }
    } else if (user.role === 'merchant') {
      if (!order.merchantUserId || order.merchantUserId !== user.id) {
        return sendError(res, 'FORBIDDEN_RESOURCE', 'لا يمكن للمتجر إلغاء طلب يخص متجراً آخر.', 403);
      }
      if (!AccessControlGuard.canCancelOrder('merchant', order.status)) {
        return sendError(
          res,
          'CANCELLATION_NOT_ALLOWED',
          'لا يمكن للمتجر إلغاء الطلب بعد استلام الكابتن للشحنة.',
          403
        );
      }
    } else {
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
    PersistentStore.recordOrderStateHistory({
      orderId: result.order.id,
      fromStatus: result.previousStatus,
      toStatus: 'cancelled',
      actorId: user.id,
      actorRole: user.role,
      notes: reason,
    });

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
// 4. Captain Fleet, Eligibility, Availability & Dispatch Acceptance
// ----------------------------------------------------------------------------

// 4.1 Eligibility (Database-backed from verified token)
router.get('/captain/eligibility', authenticate, async (req: Request, res: Response) => {
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
      return sendError(res, 'CAPTAIN_NOT_FOUND', 'سجل الكابتن غير موجود بالنظام.', 404);
    }

    const eligibility = CaptainEligibilityEngine.evaluate(captain);
    return sendSuccess(res, {
      captainId: captain.id,
      fullName: captain.fullName,
      cityId: captain.cityId,
      activeZoneId: captain.activeZoneId,
      isOnline: captain.isOnline,
      subscriptionStatus: captain.subscriptionStatus,
      eligibility,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'ELIGIBILITY_ERROR', err.message, err.statusCode || 400);
  }
});

// 4.1.b Captain Online/Offline Availability & Active Zone Update
router.post('/captain/availability', authenticate, requireRoles('captain'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { isOnline, activeZoneId } = req.body;

    const updatedCaptain = await CaptainService.updateAvailabilityAndZone({
      userId: user.id,
      isOnline,
      activeZoneId,
    });

    mockCaptains.set(updatedCaptain.id, updatedCaptain);

    return sendSuccess(res, {
      captainId: updatedCaptain.id,
      isOnline: updatedCaptain.isOnline,
      cityId: updatedCaptain.cityId,
      activeZoneId: updatedCaptain.activeZoneId,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'AVAILABILITY_UPDATE_FAILED', err.message, err.statusCode || 400);
  }
});

// 4.1.c Available Broadcast Orders in Captain's Zone
router.get('/captain/orders/available', authenticate, requireRoles('captain'), async (req: Request, res: Response) => {
  try {
    const captain = await CaptainService.requireActiveCaptain(req.user!.id);
    const allOrders = PersistentStore.getAllOrders();

    const available = allOrders.filter((o) => {
      const isBroadcastStatus =
        o.status === 'searching_captain' ||
        o.status === 'ready_for_pickup' ||
        o.status === 'created';
      const matchesCity = !o.cityId || !captain.cityId || o.cityId === captain.cityId;
      return isBroadcastStatus && !o.assignedCaptainId && matchesCity;
    });

    return sendSuccess(res, {
      captainId: captain.id,
      cityId: captain.cityId,
      activeZoneId: captain.activeZoneId,
      count: available.length,
      orders: available,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'AVAILABLE_ORDERS_ERROR', err.message, err.statusCode || 400);
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
    const history = PersistentStore.getCaptainSubscriptionHistory(captain.id);

    return sendSuccess(res, {
      captainId: captain.id,
      planCode: captain.subscriptionPlanCode,
      commissionModel: '0% Order Commission (100% of Delivery Fare retained by Captain)',
      currentPeriodEndsAt: captain.currentPeriodEndsAt,
      gracePeriodEndsAt: captain.gracePeriodEndsAt,
      eligibility,
      history,
    });
  } catch (err: any) {
    return sendError(res, err.code || 'SUBSCRIPTION_ERROR', err.message, err.statusCode || 400);
  }
});

// 4.3 Claim / Accept Order (Authenticated Captain only, server-derived captainId)
router.post('/captain/orders/:id/accept', authenticate, requireRoles('captain'), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const captain = await CaptainService.requireActiveCaptain(user.id);

    const orderId = req.params.id;
    const order = ordersDb.get(orderId) || PersistentStore.getOrderById(orderId);
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود للقبول.', 404);
    }

    const previousStatus = order.status;
    const result = await AssignmentService.claimOrder(
      () => ordersDb.get(req.params.id) || PersistentStore.getOrderById(req.params.id)!,
      captain,
      (updatedOrder) => {
        ordersDb.set(updatedOrder.id, updatedOrder);
        PersistentStore.saveOrder(updatedOrder);
        PersistentStore.recordOrderStateHistory({
          orderId: updatedOrder.id,
          fromStatus: previousStatus,
          toStatus: updatedOrder.status,
          actorId: captain.id,
          actorRole: 'captain',
          notes: `قبول الطلب من الكابتن ${captain.fullName}`,
        });
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
// 5. Customer Support & Complaints Endpoints
// ----------------------------------------------------------------------------
router.post('/complaints', authenticate, (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { orderId, storeId, category, priority, subjectAr, descriptionAr } = req.body;

    // Validate order ownership if customer specifies orderId
    if (orderId && user.role === 'customer') {
      const ord = ordersDb.get(orderId) || PersistentStore.getOrderById(orderId);
      if (ord && ord.customerId !== user.id) {
        return sendError(res, 'FORBIDDEN_ORDER_COMPLAINT', 'لا يمكنك تقديم شكوى على طلب لا يخص حسابك.', 403);
      }
    }

    const complaint = ComplaintService.createComplaint({
      reporterUserId: user.id,
      reporterName: user.fullName || 'مستخدم مشوار',
      reporterPhone: user.phone || '01000000000',
      reporterRole:
        user.role === 'captain' || user.role === 'merchant' ? user.role : 'customer',
      orderId,
      storeId,
      category: (category as ComplaintCategory) || 'other',
      priority: (priority as ComplaintPriority) || 'medium',
      subjectAr,
      descriptionAr,
    });

    return sendSuccess(res, complaint, 201);
  } catch (err: any) {
    return sendError(res, err.code || 'COMPLAINT_CREATE_FAILED', err.message, err.statusCode || 400);
  }
});

router.get('/complaints', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  const statusFilter = req.query.status as ComplaintStatus | undefined;

  const complaints = ComplaintService.listComplaints({
    actorId: user.id,
    actorRole: user.role,
    statusFilter,
  });

  return sendSuccess(res, {
    count: complaints.length,
    complaints,
  });
});

router.post('/admin/complaints/:id/assign', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manage_complaints');

    const { assignedAgentId, assignedAgentName } = req.body;
    const updated = ComplaintService.assignComplaint({
      complaintId: req.params.id,
      actorId,
      actorRole,
      actorName,
      assignedAgentId: assignedAgentId || actorId,
      assignedAgentName: assignedAgentName || actorName,
    });

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.code || 'COMPLAINT_ASSIGN_FAILED', err.message, err.statusCode || 400);
  }
});

router.post('/admin/complaints/:id/resolve', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manage_complaints');

    const { targetStatus = 'resolved', resolutionNotesAr, refundAmountPiasters } = req.body;
    const updated = ComplaintService.updateComplaintResolution({
      complaintId: req.params.id,
      actorId,
      actorRole,
      actorName,
      targetStatus: targetStatus as ComplaintStatus,
      resolutionNotesAr,
      refundAmountPiasters: refundAmountPiasters !== undefined ? Number(refundAmountPiasters) : undefined,
    });

    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, err.code || 'COMPLAINT_RESOLVE_FAILED', err.message, err.statusCode || 400);
  }
});

// ----------------------------------------------------------------------------
// 6. Payment Intents & Verified Webhooks
// ----------------------------------------------------------------------------
const PAYMENT_INTENT_ALLOWED_ROLES: ReadonlyArray<UserRole> = [
  'customer',
  'merchant',
  'owner',
  'operations_dispatcher',
];

const ALLOWED_PAYMENT_PROVIDERS = ['paymob', 'fawry', 'vodafone_cash'] as const;

router.post('/payments/intents', authenticate, (req: Request, res: Response) => {
  const user = req.user;
  // 1. Explicit allowlist of roles permitted to create payment intents; deny all unlisted roles by default
  if (!user || !PAYMENT_INTENT_ALLOWED_ROLES.includes(user.role)) {
    return sendError(
      res,
      'FORBIDDEN_ROLE',
      'غير مصرح لهذا الدور بإصدار تفويض دفع.',
      403
    );
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return sendError(res, 'INVALID_INPUT', 'بيانات طلب إصدار تفويض الدفع غير صالحة.', 400);
  }

  const {
    orderId,
    provider = 'paymob',
    amountPiasters,
    totalFarePiasters,
    amount,
    customerId: clientCustomerId,
    merchantUserId: clientMerchantUserId,
    storeId: clientStoreId,
    role: clientSuppliedRole,
    status: clientSuppliedStatus,
    isPaid: clientSuppliedIsPaid,
  } = req.body;

  // 2. Reject any attempt by the client to supply privileged state/role fields
  if (
    clientSuppliedRole !== undefined ||
    clientSuppliedStatus !== undefined ||
    clientSuppliedIsPaid !== undefined
  ) {
    return sendError(
      res,
      'UNTRUSTED_CLIENT_STATE_FORBIDDEN',
      'لا يُسمح للعميل بتمرير حالة الدفع أو حالة الطلب أو الدور الأمني.',
      422
    );
  }

  // 3. Validate orderId identifier format (reject missing or malformed resource IDs)
  if (
    typeof orderId !== 'string' ||
    orderId.trim().length === 0 ||
    !/^[a-zA-Z0-9_-]{3,128}$/.test(orderId.trim())
  ) {
    return sendError(
      res,
      'INVALID_ORDER_ID',
      'معرف الطلب (orderId) مفقود أو بصيغة غير صالحة.',
      400
    );
  }

  // 4. Validate payment provider against explicit allowlist
  if (
    typeof provider !== 'string' ||
    !(ALLOWED_PAYMENT_PROVIDERS as ReadonlyArray<string>).includes(provider)
  ) {
    return sendError(
      res,
      'INVALID_PAYMENT_PROVIDER',
      'بوابة الدفع المحددة غير مدعومة.',
      400
    );
  }

  const normalizedOrderId = orderId.trim();
  const order = ordersDb.get(normalizedOrderId) || PersistentStore.getOrderById(normalizedOrderId);

  if (!order) {
    return sendError(res, 'ORDER_NOT_FOUND', 'الطلب غير موجود لإصدار تفويض دفع.', 404);
  }

  // 5. Reject client-supplied ownership spoofing
  if (clientCustomerId !== undefined && clientCustomerId !== order.customerId) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'تعارض في ملكية العميل للطلب.', 403);
  }
  if (clientMerchantUserId !== undefined && clientMerchantUserId !== order.merchantUserId) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'تعارض في ملكية المتجر للطلب.', 403);
  }
  if (clientStoreId !== undefined && clientStoreId !== order.storeId) {
    return sendError(res, 'FORBIDDEN_RESOURCE', 'تعارض في معرف المتجر للطلب.', 403);
  }

  // 6. Strict Server-Verified Ownership Enforcement
  if (user.role === 'customer') {
    if (order.customerId !== user.id) {
      return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح لك بإصدار دفع لطلب عميل آخر.', 403);
    }
  } else if (user.role === 'merchant') {
    // Verify store ownership against authoritative store record as well as order.merchantUserId
    const store = order.storeId ? PersistentStore.getStoreById(order.storeId) : undefined;
    const authoritativeMerchantUserId = store ? store.merchantUserId : order.merchantUserId;
    if (
      !authoritativeMerchantUserId ||
      authoritativeMerchantUserId !== user.id ||
      (order.merchantUserId && order.merchantUserId !== user.id)
    ) {
      return sendError(res, 'FORBIDDEN_RESOURCE', 'غير مصرح للمتجر بإصدار دفع لطلب لا يخص متجره.', 403);
    }
  }

  // 7. Enforce valid order & payment states
  if (order.status === 'cancelled' || order.status === 'delivered') {
    return sendError(
      res,
      'INVALID_ORDER_STATE',
      `لا يمكن إصدار تفويض دفع لطلب في حالة نهائية (${order.status}).`,
      409
    );
  }

  if (
    order.isPaid === true ||
    (typeof order.cashCollectedPiasters === 'number' && order.cashCollectedPiasters > 0)
  ) {
    return sendError(
      res,
      'ORDER_ALREADY_PAID',
      'تم سداد قيمة هذا الطلب مسبقاً ولا يمكن إصدار تفويض دفع مكرر.',
      409
    );
  }

  if (!Number.isInteger(order.totalFarePiasters) || order.totalFarePiasters <= 0) {
    return sendError(
      res,
      'INVALID_ORDER_AMOUNT',
      'إجمالي تسعيرة الطلب بالقرش غير صالح لإصدار تفويض دفع.',
      422
    );
  }

  // 8. Detect and reject client amount manipulation
  const clientSuppliedAmount =
    amountPiasters !== undefined
      ? amountPiasters
      : totalFarePiasters !== undefined
        ? totalFarePiasters
        : amount;

  if (clientSuppliedAmount !== undefined) {
    if (
      typeof clientSuppliedAmount !== 'number' ||
      !Number.isInteger(clientSuppliedAmount) ||
      clientSuppliedAmount <= 0 ||
      clientSuppliedAmount !== order.totalFarePiasters
    ) {
      return sendError(
        res,
        'AMOUNT_MANIPULATION_DETECTED',
        'المبلغ المرسل من العميل غير صالح أو لا يطابق إجمالي تسعيرة الطلب المعتمدة بالقرش.',
        422
      );
    }
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

router.post('/webhooks/payments/:provider', webhookRateLimiter, async (req: Request, res: Response) => {
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
// 7. Owner & Operations Admin Endpoints (RBAC Guarded & Authenticated)
// ----------------------------------------------------------------------------

// 7.1 Hub Overview & KPIs
router.get('/admin/overview', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const orders = PersistentStore.getAllOrders();
  const captains = PersistentStore.getAllCaptains();
  const stores = PersistentStore.getAllStores();
  const complaints = PersistentStore.getAllComplaints();
  const cities = PersistentStore.getAllCities(true);
  const zones = PersistentStore.getZonesByCity(undefined, true);
  const settings = PersistentStore.getSettings();

  const activeOrders = orders.filter(
    (o) =>
      o.status === 'searching_captain' ||
      o.status === 'accepted_by_store' ||
      o.status === 'preparing' ||
      o.status === 'ready_for_pickup' ||
      o.status === 'captain_assigned' ||
      o.status === 'at_pickup' ||
      o.status === 'picked_up' ||
      o.status === 'in_transit'
  );
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const availableCaptains = captains.filter(
    (c) => c.isOnline && (c.subscriptionStatus === 'active' || c.subscriptionStatus === 'grace_period')
  );
  const openComplaints = complaints.filter((c) => c.status === 'open' || c.status === 'under_review');

  const totalPlatformFeesPiasters = deliveredOrders.reduce((sum) => sum + 200, 0);
  const totalUnremittedCashPiasters = captains.reduce((sum, c) => sum + c.cashHoldingPiasters, 0);

  return sendSuccess(res, {
    hubName: settings.hubNameAr,
    kpis: {
      activeOrdersCount: activeOrders.length,
      availableCaptainsCount: availableCaptains.length,
      totalCaptainsCount: captains.length,
      activeStoresCount: stores.length,
      openComplaintsCount: openComplaints.length,
      activeCitiesCount: cities.filter((c) => c.isActive).length,
      activeZonesCount: zones.filter((z) => z.isActive).length,
      completedOrdersToday: deliveredOrders.length,
      totalPlatformFeesPiasters,
      formattedPlatformFeesEgp: `${(totalPlatformFeesPiasters / 100).toFixed(2)} ج.م`,
      totalUnremittedCashPiasters,
      formattedUnremittedCashEgp: `${(totalUnremittedCashPiasters / 100).toFixed(2)} ج.م`,
      blockedPassengerInquiriesCount: 0,
      passengerMobilityStatus: 'LOCKED_BY_REGULATION_LAW_73',
    },
    settings,
  });
});

// 7.2 Admin Orders List
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

// 7.3 Admin Captains Fleet List
router.get('/admin/captains', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const captains = PersistentStore.getAllCaptains();
  return sendSuccess(res, {
    count: captains.length,
    captains,
  });
});

// 7.4 Manual Dispatch Override
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

    ordersDb.set(updatedOrder.id, updatedOrder);

    return sendSuccess(res, updatedOrder);
  } catch (err: any) {
    return sendError(res, err.code || 'DISPATCH_OVERRIDE_FAILED', err.message, err.statusCode || 400);
  }
});

// 7.5 Emergency Order Cancellation
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

// 7.6 Settle Captain Cash Remittance
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

// 7.7 Renew Captain Subscription
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

// 7.8 Get System & Tariff Settings
router.get('/admin/settings', authenticate, (req: Request, res: Response) => {
  const { actorRole } = getActorFromAuth(req);
  AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

  const settings = PersistentStore.getSettings();
  return sendSuccess(res, settings);
});

// 7.9 Update Tariff Settings (Owner Only)
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

// 7.9.b Update Specific Zone Tariff (Owner / Operations Dispatcher)
router.put('/admin/zones/:zoneId/tariffs', authenticate, (req: Request, res: Response) => {
  try {
    const { actorId, actorRole, actorName } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'manage_zones');

    const { serviceTypeId = 'package', ...updates } = req.body;
    const updatedTariff = PersistentStore.updateZoneTariff(
      req.params.zoneId,
      serviceTypeId,
      updates,
      actorId,
      actorName
    );
    return sendSuccess(res, updatedTariff);
  } catch (err: any) {
    return sendError(res, err.code || 'ZONE_TARIFF_UPDATE_FAILED', err.message, err.statusCode || 400);
  }
});

// 7.10 Query Audit Ledger
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

// 7.11 Database & Migration Status
router.get('/admin/database-status', authenticate, async (req: Request, res: Response) => {
  try {
    const { actorRole } = getActorFromAuth(req);
    AccessControlGuard.checkPermission(actorRole, 'view_hub_analytics');

    const migrationReport = await verifyOrRunMigrations(false);
    return sendSuccess(res, {
      postgresConfigured: isPostgresConfigured(),
      migrationReport,
    });
  } catch (err: any) {
    return sendError(res, 'DB_STATUS_ERROR', err.message, 500);
  }
});

// Reset method for testing
export function resetTestDatabases() {
  ordersDb.clear();
  idempotencyStore.clear();
  mockCaptains.clear();
  WebhookService.clearCache();
  CashCollectionService.clearCache();
  resetAllRateLimiters();
  PersistentStore.resetAll();
  syncWithStore();
}

export { ordersDb, mockCaptains };
