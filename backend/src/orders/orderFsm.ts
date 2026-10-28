/**
 * Mashwar — Authoritative Order Finite State Machine (FSM)
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 */

import { Order, OrderStatus, OrderTransitionRequest } from '../types/index.js';

export interface StateTransitionResult {
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  order: Order;
  auditLog: {
    orderId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    actorId: string;
    actorRole: string;
    timestamp: string;
    notes?: string;
  };
}

// Strict state transition map supporting both direct delivery and store/restaurant fulfillment
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['accepted_by_store', 'searching_captain', 'cancelled'],
  accepted_by_store: ['preparing', 'ready_for_pickup', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['searching_captain', 'captain_assigned', 'at_pickup', 'cancelled'],
  searching_captain: ['captain_assigned', 'cancelled'],
  captain_assigned: ['at_pickup', 'picked_up', 'cancelled'],
  at_pickup: ['picked_up', 'in_transit', 'cancelled'],
  picked_up: ['in_transit', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

const STORE_STAGE_TARGETS: OrderStatus[] = ['accepted_by_store', 'preparing', 'ready_for_pickup'];
const CAPTAIN_DELIVERY_TARGETS: OrderStatus[] = ['at_pickup', 'picked_up', 'in_transit'];

export class OrderFsm {
  /**
   * Evaluates if a transition from current status to target status is topologically valid.
   */
  public static canTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Applies an authoritative transition to an order with strict precondition validation.
   */
  public static transition(order: Order, request: OrderTransitionRequest): StateTransitionResult {
    const { targetStatus, actorId, actorRole, notes, cashCollectedPiasters, cancellationReason } = request;
    const currentStatus = order.status;

    // Invariant 1: Check if already in terminal state
    if (currentStatus === 'delivered' || currentStatus === 'cancelled') {
      const err = new Error(
        `لا يمكن تعديل حالة الطلب نظراً لوصوله إلى حالة نهائية (${currentStatus === 'delivered' ? 'تم التسليم' : 'ملغي'}).`
      );
      (err as any).code = 'TERMINAL_STATE_MUTATION_FORBIDDEN';
      (err as any).statusCode = 422;
      throw err;
    }

    // Invariant 1b: Validate existing acceptance timestamp integrity if present
    if (
      order.acceptedAt !== undefined &&
      (typeof order.acceptedAt !== 'string' ||
        order.acceptedAt.trim().length === 0 ||
        Number.isNaN(Date.parse(order.acceptedAt)))
    ) {
      const err = new Error('طابع وقت القبول المسجل بالطلب غير صالح (يجب أن يكون بصيغة ISO-8601 صحيحة).');
      (err as any).code = 'INVALID_ORDER_TIMESTAMP';
      (err as any).statusCode = 422;
      throw err;
    }

    // Invariant 2: Check legal transition in FSM graph
    if (!this.canTransition(currentStatus, targetStatus)) {
      const err = new Error(
        `انتقال غير صالح لحالة الطلب من '${currentStatus}' إلى '${targetStatus}'. يرجى اتباع دورة حياة الطلب الرسمية.`
      );
      (err as any).code = 'INVALID_STATE_TRANSITION';
      (err as any).statusCode = 422;
      throw err;
    }

    // Invariant 3: Store preparation stage role & ownership checks
    if (STORE_STAGE_TARGETS.includes(targetStatus)) {
      const allowedStoreRoles = ['merchant', 'owner', 'operations_dispatcher', 'operations'];
      if (!allowedStoreRoles.includes(actorRole)) {
        const err = new Error('غير مصرح لهذا الحساب بتحديث مراحل تجهيز المتجر.');
        (err as any).code = 'UNAUTHORIZED_STORE_STAGE_ACTOR';
        (err as any).statusCode = 403;
        throw err;
      }

      if (actorRole === 'merchant' && (!order.merchantUserId || order.merchantUserId !== actorId)) {
        const err = new Error('غير مصرح للتاجر بتحديث حالة طلب يخص متجراً آخر.');
        (err as any).code = 'UNAUTHORIZED_MERCHANT_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // Invariant 4: Precondition check for Captain Assignment
    if (targetStatus === 'captain_assigned') {
      if (typeof order.assignedCaptainId !== 'string' || order.assignedCaptainId.trim().length === 0) {
        const err = new Error('لا يمكن تحويل الطلب إلى "تم إسناد الكابتن" بدون تحديد هوية كابتن معتمد.');
        (err as any).code = 'MISSING_ASSIGNED_CAPTAIN';
        (err as any).statusCode = 422;
        throw err;
      }
      if (actorRole === 'captain' && order.assignedCaptainId !== actorId) {
        const err = new Error('غير مصرح لك بتأكيد إسناد طلب مسند لكابتن آخر.');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // Invariant 4a: Ownership & role check for searching_captain dispatch broadcast
    if (targetStatus === 'searching_captain') {
      if (actorRole === 'captain') {
        const err = new Error('غير مصرح للكابتن بإعادة بث الطلب للبحث عن كابتن.');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
      if (actorRole === 'customer' && order.customerId !== actorId) {
        const err = new Error('غير مصرح لك بتحديث حالة طلب لا يخص حسابك.');
        (err as any).code = 'FORBIDDEN_RESOURCE';
        (err as any).statusCode = 403;
        throw err;
      }
      if (actorRole === 'merchant' && (!order.merchantUserId || order.merchantUserId !== actorId)) {
        const err = new Error('غير مصرح للتاجر بتحديث حالة طلب يخص متجراً آخر.');
        (err as any).code = 'UNAUTHORIZED_MERCHANT_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // Invariant 4b: Cancellation ownership & stage restrictions
    if (targetStatus === 'cancelled') {
      if (actorRole === 'captain') {
        const err = new Error('غير مصرح للكابتن بإلغاء الطلب مباشرة.');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
      if (actorRole === 'customer') {
        if (order.customerId !== actorId) {
          const err = new Error('لا يمكنك إلغاء طلب لا يخص حسابك.');
          (err as any).code = 'FORBIDDEN_RESOURCE';
          (err as any).statusCode = 403;
          throw err;
        }
        if (currentStatus !== 'created' && currentStatus !== 'searching_captain') {
          const err = new Error('لا يمكن للعميل إلغاء الطلب بعد بدء تجهيزه أو تحرك الكابتن.');
          (err as any).code = 'CANCELLATION_NOT_ALLOWED';
          (err as any).statusCode = 403;
          throw err;
        }
      }
      if (actorRole === 'merchant') {
        if (!order.merchantUserId || order.merchantUserId !== actorId) {
          const err = new Error('لا يمكن للمتجر إلغاء طلب يخص متجراً آخر.');
          (err as any).code = 'UNAUTHORIZED_MERCHANT_ACTION';
          (err as any).statusCode = 403;
          throw err;
        }
        const allowedMerchantCancelStages: OrderStatus[] = [
          'created',
          'accepted_by_store',
          'preparing',
          'ready_for_pickup',
          'searching_captain',
        ];
        if (!allowedMerchantCancelStages.includes(currentStatus)) {
          const err = new Error('لا يمكن للمتجر إلغاء الطلب بعد استلام الكابتن للشحنة.');
          (err as any).code = 'CANCELLATION_NOT_ALLOWED';
          (err as any).statusCode = 403;
          throw err;
        }
      }
    }

    // Invariant 5: Actor authorization check for captain delivery steps
    if (CAPTAIN_DELIVERY_TARGETS.includes(targetStatus)) {
      if (actorRole === 'merchant' || actorRole === 'customer') {
        const err = new Error('غير مصرح للتاجر أو العميل بتحديث خطوات التوصيل الميدانية الخاصة بالكابتن.');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_STAGE_ACTOR';
        (err as any).statusCode = 403;
        throw err;
      }
      if (actorRole === 'captain' && (!order.assignedCaptainId || order.assignedCaptainId !== actorId)) {
        const err = new Error('غير مصرح لك بتحديث حالة هذا الطلب (الكابتن غير مطابق للكابتن المسند).');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // Invariant 6: Cash on Delivery verification precondition for 'delivered'
    let updatedCashCollected = order.cashCollectedPiasters;
    let updatedIsPaid = order.isPaid;

    if (targetStatus === 'delivered') {
      if (actorRole === 'merchant' || actorRole === 'customer') {
        const err = new Error('إتمام التسليم النهائي يتم حصرياً بواسطة الكابتن المسند أو غرفة العمليات.');
        (err as any).code = 'UNAUTHORIZED_DELIVERY_COMPLETION';
        (err as any).statusCode = 403;
        throw err;
      }
      if (actorRole === 'captain' && (!order.assignedCaptainId || order.assignedCaptainId !== actorId)) {
        const err = new Error('غير مصرح لك بإتمام تسليم طلب غير مسند إليك.');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }

      if (order.paymentMethod === 'cash_on_delivery') {
        const amountCollected = cashCollectedPiasters ?? order.cashCollectedPiasters;
        if (amountCollected === undefined || amountCollected === null) {
          const err = new Error(
            'لا يمكن إتمام تسليم الطلب نقداً بدون تسجيل المبلغ المحصل من العميل عند باب المنزل.'
          );
          (err as any).code = 'MISSING_CASH_COLLECTION';
          (err as any).statusCode = 422;
          throw err;
        }

        if (amountCollected < order.totalFarePiasters) {
          const err = new Error(
            `المبلغ المسجل المحصل (${(amountCollected / 100).toFixed(2)} ج.م) أقل من إجمالي الأجرة المطلوبة (${(order.totalFarePiasters / 100).toFixed(2)} ج.م).`
          );
          (err as any).code = 'INSUFFICIENT_CASH_COLLECTED';
          (err as any).statusCode = 422;
          throw err;
        }

        updatedCashCollected = amountCollected;
        updatedIsPaid = true;
      } else {
        // Electronic payment: must already be paid
        if (!order.isPaid) {
          const err = new Error(
            'لا يمكن إتمام التسليم لأن الدفع الإلكتروني لم يتم تأكيده بعد من بوابة الدفع.'
          );
          (err as any).code = 'ELECTRONIC_PAYMENT_UNCONFIRMED';
          (err as any).statusCode = 422;
          throw err;
        }
      }
    }

    // Prepare updated order object
    const nowIso = new Date().toISOString();
    const isAcceptanceTransition =
      targetStatus === 'accepted_by_store' || targetStatus === 'captain_assigned';
    const updatedOrder: Order = {
      ...order,
      status: targetStatus,
      acceptedAt: isAcceptanceTransition ? order.acceptedAt || nowIso : order.acceptedAt,
      cashCollectedPiasters: updatedCashCollected,
      isPaid: updatedIsPaid,
      specialInstructions: cancellationReason
        ? `${order.specialInstructions ? order.specialInstructions + ' | ' : ''}سبب الإلغاء: ${cancellationReason}`
        : order.specialInstructions,
      updatedAt: nowIso,
    };

    const auditLog = {
      orderId: order.id,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      actorId,
      actorRole,
      timestamp: nowIso,
      notes: notes || (cancellationReason ? `إلغاء: ${cancellationReason}` : undefined),
    };

    return {
      previousStatus: currentStatus,
      newStatus: targetStatus,
      order: updatedOrder,
      auditLog,
    };
  }
}
