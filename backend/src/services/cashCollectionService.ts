/**
 * Mashwar — Transactional Cash Collection & Financial Ledger Service
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Unit: Egyptian Piasters (integer minor units, 1 EGP = 100 Piasters)
 *
 * Enforces:
 * - Real PostgreSQL transactions with atomic row-locking (SELECT ... FOR UPDATE)
 * - Multi-process race condition safety via PostgreSQL database locks
 * - Database-enforced idempotency key uniqueness constraint
 * - Strict captain ownership verification (assigned_captain_id === calling_captain.id)
 * - Strict cash-on-delivery payment method invariant
 * - Immutable financial ledger recording
 * - Automatic suspension upon exceeding 1,000 EGP (100,000 piasters) cash ceiling
 * - Clean rollback of all mutations if any invariant or constraint fails
 */

import crypto from 'node:crypto';
import { Kysely } from 'kysely';
import { Order, CaptainProfile } from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';
import { AuditLogger } from '../security/auditLogger.js';
import { Database } from '../database/schema.js';
import { getDb } from '../database/db.js';

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

interface IdempotencyCacheEntry {
  result: CashCollectionResult;
  orderId: string;
  captainId: string;
  amountPiasters: number;
}

export class CashCollectionService {
  // Order mutex lock table simulating PostgreSQL row-level locks for in-memory testing
  private static orderLocks: Map<string, Promise<void>> = new Map();

  // In-memory idempotency cache synchronized with persistent ledger for in-memory testing
  private static idempotencyCache: Map<string, IdempotencyCacheEntry> = new Map();

  /**
   * Primary entry point: Routes to PostgreSQL transactional engine if DB is available,
   * otherwise falls back to memory mutex engine for offline testing.
   */
  public static async recordCashCollection(
    request: CashCollectionRequest,
    customDb?: Kysely<Database> | null
  ): Promise<CashCollectionResult> {
    const db = customDb !== undefined ? customDb : getDb();
    if (db) {
      return this.recordCashCollectionPostgres(db, request);
    }
    return this.recordCashCollectionInMemory(request);
  }

  /**
   * Production-grade PostgreSQL Transactional Execution.
   * Uses real database transactions, row-level locks (SELECT ... FOR UPDATE),
   * and database-level unique constraint on idempotency keys.
   */
  public static async recordCashCollectionPostgres(
    db: Kysely<Database>,
    request: CashCollectionRequest
  ): Promise<CashCollectionResult> {
    const { orderId, captain, amountPiasters, idempotencyKey, customerConfirmed = true, notes } = request;

    // 1. Monetary validation (must be positive integer minor units)
    if (!Number.isInteger(amountPiasters) || amountPiasters <= 0) {
      const err = new Error('مبلغ التحصيل بالقرش غير صالح (يجب أن يكون رقماً صحيحاً موجباً).');
      (err as any).code = 'INVALID_PIASTERS_AMOUNT';
      (err as any).statusCode = 400;
      throw err;
    }

    const effectiveKey = idempotencyKey || `cash_${orderId}_${captain.id}`;

    // 2. Execute within an ACID PostgreSQL transaction with READ COMMITTED isolation
    return await db.transaction().setIsolationLevel('read committed').execute(async (trx) => {
      // 2a. Check database-backed idempotency table first
      const existingCollection = await trx
        .selectFrom('cash_collections')
        .where('idempotency_key', '=', effectiveKey)
        .selectAll()
        .executeTakeFirst();

      if (existingCollection) {
        // Enforce idempotency payload safety: reject reuse of same key with different payload
        if (
          existingCollection.order_id !== orderId ||
          existingCollection.captain_id !== captain.id ||
          existingCollection.amount_piasters !== amountPiasters
        ) {
          const err = new Error('مفتاح عدم التكرار (Idempotency Key) مستخدم مسبقاً لطلب أو بمبلغ مختلف.');
          (err as any).code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          (err as any).statusCode = 409;
          throw err;
        }

        // Idempotent replay: Fetch order and captain rows to construct authoritative receipt
        const orderRow = await trx
          .selectFrom('orders')
          .where('id', '=', existingCollection.order_id)
          .selectAll()
          .executeTakeFirst();

        const captainRow = await trx
          .selectFrom('captains')
          .where('id', '=', existingCollection.captain_id)
          .selectAll()
          .executeTakeFirst();

        const currentCash = captainRow ? captainRow.cash_holding_piasters : existingCollection.amount_piasters;
        const maxCash = captainRow ? captainRow.max_cash_holding_piasters : 100000;

        return {
          success: true,
          orderId: existingCollection.order_id,
          amountCollectedPiasters: existingCollection.amount_piasters,
          formattedAmountEgp: `${(existingCollection.amount_piasters / 100).toFixed(2)} ج.م`,
          captainCurrentCashPiasters: currentCash,
          formattedCaptainCashEgp: `${(currentCash / 100).toFixed(2)} ج.م`,
          ceilingExceeded: currentCash > maxCash,
          customerConfirmed: existingCollection.customer_confirmed,
          idempotencyKey: effectiveKey,
          isIdempotentReplay: true,
          ledgerEntryId: `ledger_replay_${existingCollection.id}`,
          recordedAt: existingCollection.created_at,
        };
      }

      // 2b. Atomic Row-Level Lock on Order (PostgreSQL: SELECT ... FOR UPDATE)
      const order = await trx
        .selectFrom('orders')
        .where('id', '=', orderId)
        .forUpdate()
        .selectAll()
        .executeTakeFirst();

      if (!order) {
        const err = new Error('الطلب غير موجود لتسجيل التحصيل النقدي.');
        (err as any).code = 'ORDER_NOT_FOUND';
        (err as any).statusCode = 404;
        throw err;
      }

      // 2c. Atomic Row-Level Lock on Captain (PostgreSQL: SELECT ... FOR UPDATE)
      const captainRow = await trx
        .selectFrom('captains')
        .where('id', '=', captain.id)
        .forUpdate()
        .selectAll()
        .executeTakeFirst();

      if (!captainRow) {
        const err = new Error('سجل الكابتن غير موجود.');
        (err as any).code = 'CAPTAIN_NOT_FOUND';
        (err as any).statusCode = 404;
        throw err;
      }

      // 2d. Invariant: Verify payment method is cash on delivery
      if (order.payment_method !== 'cash_on_delivery') {
        const err = new Error('الطلب ليس دفعاً عند الاستلام؛ لا يمكن تحصيل نقدية على طلب إلكتروني.');
        (err as any).code = 'INVALID_PAYMENT_METHOD_FOR_CASH';
        (err as any).statusCode = 400;
        throw err;
      }

      // 2e. Invariant: Verify Captain Ownership (fail-closed authorization)
      if (order.assigned_captain_id !== captain.id) {
        const err = new Error(
          'غير مصرح لك بتسجيل تحصيل هذا الطلب: الكابتن الحالي ليس الكابتن المسند له الطلب.'
        );
        (err as any).code = 'UNAUTHORIZED_CAPTAIN_ACTION';
        (err as any).statusCode = 403;
        throw err;
      }

      // 2f. Invariant: Order status must be in an active delivery state
      if (order.status === 'cancelled') {
        const err = new Error('لا يمكن تحصيل قيمة نقدية لطلب ملغي.');
        (err as any).code = 'ORDER_CANCELLED';
        (err as any).statusCode = 400;
        throw err;
      }

      const eligibleDeliveryStatuses = ['picked_up', 'in_transit', 'arrived_dropoff', 'delivered'];
      if (!eligibleDeliveryStatuses.includes(order.status)) {
        const err = new Error('لا يمكن تحصيل نقدية قبل استلام الشحنة وتوصيلها.');
        (err as any).code = 'ORDER_NOT_IN_DELIVERY';
        (err as any).statusCode = 400;
        throw err;
      }

      // 2f. Invariant: Prevent double collection if already paid
      if (order.is_paid && order.cash_collected_piasters !== null && order.cash_collected_piasters > 0) {
        const err = new Error('تم تحصيل قيمة هذا الطلب مسبقاً.');
        (err as any).code = 'ORDER_ALREADY_PAID';
        (err as any).statusCode = 409;
        throw err;
      }

      // 2g. Invariant: Amount must strictly match authoritative order fare
      if (amountPiasters !== order.total_fare_piasters) {
        const err = new Error(
          `المبلغ المحصل (${amountPiasters} قرش) غير مطابق لإجمالي تسعيرة الطلب المعتمدة (${order.total_fare_piasters} قرش).`
        );
        (err as any).code = 'FARE_MISMATCH';
        (err as any).statusCode = 422;
        throw err;
      }

      // 2h. Calculate balance and check 100,000 piasters (1,000 EGP) ceiling
      const previousHolding = captainRow.cash_holding_piasters;
      const newHolding = previousHolding + amountPiasters;
      const ceilingExceeded = newHolding > captainRow.max_cash_holding_piasters;
      const newSubscriptionStatus = (ceilingExceeded && captainRow.subscription_status === 'active')
        ? 'suspended'
        : captainRow.subscription_status;

      const nowIso = new Date().toISOString();
      const collectionId = `col_${crypto.randomBytes(8).toString('hex')}`;
      const ledgerId = `ledger_${crypto.randomBytes(8).toString('hex')}`;

      // 2i. Insert cash_collections record (enforces UNIQUE idempotency_key constraint)
      await trx
        .insertInto('cash_collections')
        .values({
          id: collectionId,
          order_id: order.id,
          captain_id: captainRow.id,
          amount_piasters: amountPiasters,
          idempotency_key: effectiveKey,
          customer_confirmed: Boolean(customerConfirmed),
          notes: notes || null,
          created_at: nowIso,
        })
        .execute();

      // 2j. Update order state (mark is_paid, set cash_collected_piasters, transition status)
      const targetStatus = order.status === 'in_transit' ? 'delivered' : order.status;
      await trx
        .updateTable('orders')
        .set({
          is_paid: true,
          cash_collected_piasters: amountPiasters,
          status: targetStatus,
          updated_at: nowIso,
        })
        .where('id', '=', order.id)
        .execute();

      // 2k. Update captain balance and suspension state
      await trx
        .updateTable('captains')
        .set({
          cash_holding_piasters: newHolding,
          subscription_status: newSubscriptionStatus,
          updated_at: nowIso,
        })
        .where('id', '=', captainRow.id)
        .execute();

      // 2l. Insert append-only immutable financial ledger entry
      await trx
        .insertInto('financial_ledger')
        .values({
          id: ledgerId,
          transaction_type: 'CASH_COLLECTED',
          order_id: order.id,
          captain_id: captainRow.id,
          amount_piasters: amountPiasters,
          balance_after_piasters: newHolding,
          actor_id: captainRow.user_id,
          actor_role: 'captain',
          notes: notes || (ceilingExceeded ? 'تجاوز حد العهدة المسموح به (1,000 ج.م) وتم تعليق الحساب مؤقتاً لحين التوريد' : null),
          created_at: nowIso,
        })
        .execute();

      return {
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
        ledgerEntryId: ledgerId,
        recordedAt: nowIso,
      };
    });
  }

  /**
   * In-memory critical section fallback used for unit tests and offline development.
   */
  public static async recordCashCollectionInMemory(
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
      if (
        cached.orderId !== orderId ||
        cached.captainId !== captain.id ||
        cached.amountPiasters !== amountPiasters
      ) {
        const err = new Error('مفتاح عدم التكرار (Idempotency Key) مستخدم مسبقاً لطلب أو بمبلغ مختلف.');
        (err as any).code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
        (err as any).statusCode = 409;
        throw err;
      }
      return {
        ...cached.result,
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
      // 3b. Re-check Idempotency Key inside critical section for concurrent identical requests
      if (this.idempotencyCache.has(effectiveKey)) {
        const cached = this.idempotencyCache.get(effectiveKey)!;
        if (
          cached.orderId !== orderId ||
          cached.captainId !== captain.id ||
          cached.amountPiasters !== amountPiasters
        ) {
          const err = new Error('مفتاح عدم التكرار (Idempotency Key) مستخدم مسبقاً لطلب أو بمبلغ مختلف.');
          (err as any).code = 'IDEMPOTENCY_PAYLOAD_MISMATCH';
          (err as any).statusCode = 409;
          throw err;
        }
        return {
          ...cached.result,
          isIdempotentReplay: true,
        };
      }

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

      // 7. Verify Order Status is in active delivery state
      if (order.status === 'cancelled') {
        const err = new Error('لا يمكن تحصيل قيمة نقدية لطلب ملغي.');
        (err as any).code = 'ORDER_CANCELLED';
        (err as any).statusCode = 400;
        throw err;
      }

      const eligibleDeliveryStatuses = ['picked_up', 'in_transit', 'arrived_dropoff', 'delivered'];
      if (!eligibleDeliveryStatuses.includes(order.status)) {
        const err = new Error('لا يمكن تحصيل نقدية قبل استلام الشحنة وتوصيلها.');
        (err as any).code = 'ORDER_NOT_IN_DELIVERY';
        (err as any).statusCode = 400;
        throw err;
      }

      // 7b. Prevent duplicate cash collection if order is already marked paid with a different idempotency key
      if (order.isPaid && order.cashCollectedPiasters !== undefined && order.cashCollectedPiasters > 0) {
        const err = new Error('تم تحصيل قيمة هذا الطلب مسبقاً.');
        (err as any).code = 'ORDER_ALREADY_PAID';
        (err as any).statusCode = 409;
        throw err;
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

      this.idempotencyCache.set(effectiveKey, {
        result,
        orderId,
        captainId: captain.id,
        amountPiasters,
      });
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
