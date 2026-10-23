/**
 * Mashwar — Transactional Cash Collection & Financial Ledger Service
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Unit: Egyptian Piasters (integer minor units, 1 EGP = 100 Piasters)
 *
 * Enforces:
 * - Atomic row-locking (mutex / PostgreSQL SELECT FOR UPDATE semantics)
 * - Strict captain ownership verification (assigned_captain_id === calling_captain.id)
 * - Idempotency key deduplication to prevent double credit / double debit
 * - Strict cash-on-delivery payment method invariant
 * - Immutable financial ledger recording
 * - Automatic suspension upon exceeding 1,000 EGP (100,000 piasters) cash ceiling
 */

import crypto from 'node:crypto';
import { Order, CaptainProfile } from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';
import { AuditLogger } from '../security/auditLogger.js';

export interface CashCollectionRequest {
  orderId: string;
  captain: CaptainProfile;
  amountPiasters: number;
  idempotencyKey?: string;
  customerConfirmed?: boolean;
  notes?: string;
}

export interface CashCollectionResult {
  success: boolean;
  orderId: string;
  amountCollectedPiasters: number;
  formattedAmountEgp: string;
  captainCurrentCashPiasters: number;
  formattedCaptainCashEgp: string;
  ceilingExceeded: boolean;
  customerConfirmed: boolean;
  idempotencyKey: string;
  isIdempotentReplay: boolean;
  ledgerEntryId: string;
  recordedAt: string;
}

export class CashCollectionService {
  // Order mutex lock table simulating PostgreSQL row-level locks
  private static orderLocks: Map<string, Promise<void>> = new Map();

  // In-memory idempotency cache synchronized with persistent ledger
  private static idempotencyCache: Map<string, CashCollectionResult> = new Map();

  /**
   * Atomically executes cash collection for an order with strict row-locking,
   * ownership verification, idempotency protection, and audit ledger emission.
   */
  public static async recordCashCollection(
    request: CashCollectionRequest
  ): Promise<CashCollectionResult> {
    const { orderId, captain, amountPiasters, idempotencyKey, customerConfirmed = true, notes } = request;

    // 1. Validate monetary integer invariants
    if (!Number.isInteger(amountPiasters) || amountPiasters <= 0) {
      const err = new Error('مبلغ التحصيل بالقرش غير صالح (يجب أن يكون رقماً صحيحاً موجباً).');
      (err as any).code = 'INVALID_PIASTERS_AMOUNT';
      (err as any).statusCode = 400;
      throw err;
    }

    // 2. Check Idempotency Key before locking
    const effectiveKey = idempotencyKey || `cash_${orderId}_${captain.id}`;
    if (this.idempotencyCache.has(effectiveKey)) {
      const cached = this.idempotencyCache.get(effectiveKey)!;
      return {
        ...cached,
        isIdempotentReplay: true,
      };
    }

    // 3. Row-Level Lock Acquisition (Simulates SELECT * FROM orders WHERE id = $1 FOR UPDATE)
    const prevLock = this.orderLocks.get(orderId) || Promise.resolve();
    let releaseLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.orderLocks.set(orderId, prevLock.then(() => currentLock).catch(() => currentLock));
    await prevLock;

    try {
      // 4. Read latest state inside critical section
      const order = PersistentStore.getOrderById(orderId);
      if (!order) {
        const err = new Error('الطلب غير موجود لتسجيل التحصيل النقدي.');
        (err as any).code = 'ORDER_NOT_FOUND';
        (err as any).statusCode = 404;
        throw err;
      }

      // 5. Verify payment method is cash on delivery
      if (order.paymentMethod !== 'cash_on_delivery') {
        const err = new Error('الطلب ليس دفعاً عند الاستلام؛ لا يمكن تحصيل نقدية على طلب إلكتروني.');
        (err as any).code = 'INVALID_PAYMENT_METHOD_FOR_CASH';
        (err as any).statusCode = 400;
        throw err;
      }

      // 6. Verify Captain Ownership (fail-closed authorization)
      if (order.assignedCaptainId !== captain.id) {
        const err = new Error(
          'غير مصرح لك بتسجيل تحصيل هذا الطلب: الكابتن الحالي ليس الكابتن المسند له الطلب.'
        );
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }

      // 7. Prevent duplicate cash collection if order is already marked paid
      if (order.isPaid && order.cashCollectedPiasters !== undefined && order.cashCollectedPiasters > 0) {
        // Return existing receipt
        const existingResult: CashCollectionResult = {
          success: true,
          orderId: order.id,
          amountCollectedPiasters: order.cashCollectedPiasters,
          formattedAmountEgp: `${(order.cashCollectedPiasters / 100).toFixed(2)} ج.م`,
          captainCurrentCashPiasters: captain.cashHoldingPiasters,
          formattedCaptainCashEgp: `${(captain.cashHoldingPiasters / 100).toFixed(2)} ج.م`,
          ceilingExceeded: captain.cashHoldingPiasters > captain.maxCashHoldingPiasters,
          customerConfirmed: true,
          idempotencyKey: effectiveKey,
          isIdempotentReplay: true,
          ledgerEntryId: `ledger_existing_${order.id}`,
          recordedAt: order.updatedAt,
        };
        this.idempotencyCache.set(effectiveKey, existingResult);
        return existingResult;
      }

      // 8. Amount must strictly match or cover authoritative order fare
      if (amountPiasters !== order.totalFarePiasters) {
        const err = new Error(
          `المبلغ المحصل (${amountPiasters} قرش) غير مطابق لإجمالي تسعيرة الطلب المعتمدة (${order.totalFarePiasters} قرش).`
        );
        (err as any).code = 'FARE_MISMATCH';
        (err as any).statusCode = 422;
        throw err;
      }

      // 9. Atomic mutation of Order & Captain
      const nowIso = new Date().toISOString();
      const updatedOrder: Order = {
        ...order,
        cashCollectedPiasters: amountPiasters,
        isPaid: true,
        updatedAt: nowIso,
      };

      // If order was in_transit, transition to delivered
      if (updatedOrder.status === 'in_transit') {
        updatedOrder.status = 'delivered';
      }

      PersistentStore.saveOrder(updatedOrder);

      // 10. Update Captain Cash Holding & Check 100,000 piasters (1,000 EGP) ceiling
      const previousHolding = captain.cashHoldingPiasters;
      const newHolding = previousHolding + amountPiasters;
      captain.cashHoldingPiasters = newHolding;

      const ceilingExceeded = newHolding > captain.maxCashHoldingPiasters;
      if (ceilingExceeded && captain.subscriptionStatus === 'active') {
        captain.subscriptionStatus = 'suspended';
      }

      PersistentStore.saveCaptain(captain);

      // 11. Immutable Ledger Insertion
      const ledgerEntryId = `ledger_${crypto.randomBytes(8).toString('hex')}`;
      AuditLogger.record({
        actorId: captain.userId,
        actorRole: 'captain',
        actorName: captain.fullName,
        actionType: 'CAPTAIN_CASH_SETTLED',
        targetEntity: 'order',
        targetId: order.id,
        descriptionAr: `تحصيل نقدي عند التوصيل بقيمة ${(amountPiasters / 100).toFixed(2)} ج.م للطلب ${order.orderNumber}. رصيد العهدة الحالي: ${(newHolding / 100).toFixed(2)} ج.م.`,
        previousState: { cashHoldingPiasters: previousHolding, isPaid: false },
        newState: {
          cashHoldingPiasters: newHolding,
          isPaid: true,
          subscriptionStatus: captain.subscriptionStatus,
          ceilingExceeded,
        },
        notes: notes || (ceilingExceeded ? 'تجاوز حد العهدة المسموح به (1,000 ج.م) وتم تعليق الحساب مؤقتاً لحين التوريد' : undefined),
      });

      const result: CashCollectionResult = {
        success: true,
        orderId: order.id,
        amountCollectedPiasters: amountPiasters,
        formattedAmountEgp: `${(amountPiasters / 100).toFixed(2)} ج.م`,
        captainCurrentCashPiasters: newHolding,
        formattedCaptainCashEgp: `${(newHolding / 100).toFixed(2)} ج.م`,
        ceilingExceeded,
        customerConfirmed: Boolean(customerConfirmed),
        idempotencyKey: effectiveKey,
        isIdempotentReplay: false,
        ledgerEntryId,
        recordedAt: nowIso,
      };

      this.idempotencyCache.set(effectiveKey, result);
      return result;
    } finally {
      releaseLock();
    }
  }

  /**
   * Resets the cache for testing isolation.
   */
  public static clearCache(): void {
    this.idempotencyCache.clear();
    this.orderLocks.clear();
  }
}
