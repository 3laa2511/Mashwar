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

// Strict state transition map
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ['searching_captain', 'cancelled'],
  searching_captain: ['captain_assigned', 'cancelled'],
  captain_assigned: ['at_pickup', 'cancelled'],
  at_pickup: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
};

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

    // Invariant 2: Check legal transition in FSM graph
    if (!this.canTransition(currentStatus, targetStatus)) {
      const err = new Error(
        `انتقال غير صالح لحالة الطلب من '${currentStatus}' إلى '${targetStatus}'. يرجى اتباع دورة حياة الطلب الرسمية.`
      );
      (err as any).code = 'INVALID_STATE_TRANSITION';
      (err as any).statusCode = 422;
      throw err;
    }

    // Invariant 3: Precondition check for Captain Assignment
    if (targetStatus === 'captain_assigned') {
      if (!order.assignedCaptainId) {
        const err = new Error('لا يمكن تحويل الطلب إلى "تم إسناد الكابتن" بدون تحديد هوية كابتن معتمد.');
        (err as any).code = 'MISSING_ASSIGNED_CAPTAIN';
        (err as any).statusCode = 422;
        throw err;
      }
    }

    // Invariant 4: Actor authorization check for delivery steps
    if (['at_pickup', 'in_transit'].includes(targetStatus)) {
      if (actorRole === 'captain' && order.assignedCaptainId && order.assignedCaptainId !== actorId) {
        const err = new Error('غير مصرح لك بتحديث حالة هذا الطلب (الكابتن غير مطابق للكابتن المسند).');
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }
    }

    // Invariant 5: Cash on Delivery verification precondition for 'delivered'
    let updatedCashCollected = order.cashCollectedPiasters;
    let updatedIsPaid = order.isPaid;

    if (targetStatus === 'delivered') {
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
    const updatedOrder: Order = {
      ...order,
      status: targetStatus,
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
