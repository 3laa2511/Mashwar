/**
 * Mashwar — Dispatch Assignment Service & Concurrency Guard
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 *
 * Implements atomic row-level assignment locking (simulating PostgreSQL SELECT FOR UPDATE)
 * to prevent race conditions when multiple captains accept the same order simultaneously.
 */

import { CaptainProfile, Order } from '../types/index.js';
import { CaptainEligibilityEngine } from '../captain/captainEligibility.js';

export interface AssignmentResult {
  success: boolean;
  order: Order;
  assignedCaptainId: string;
  assignedAt: string;
}

export class AssignmentService {
  // Map of orderId to running lock promise
  private static orderLocks: Map<string, Promise<void>> = new Map();

  /**
   * Concurrently-safe method for a captain to claim an order broadcast.
   * Supports passing an Order or a getter function to ensure the latest state
   * is read after acquiring the row lock.
   */
  public static async claimOrder(
    orderOrGetter: Order | (() => Order),
    captain: CaptainProfile,
    mutateOrderState: (updated: Order) => Promise<void> | void
  ): Promise<AssignmentResult> {
    // 1. Verify captain eligibility before attempting lock acquisition
    const eligibility = CaptainEligibilityEngine.evaluate(captain);
    if (!eligibility.isEligibleForNewOffers) {
      const err = new Error(
        `لا يمكن إسناد الطلب للكابتن: ${eligibility.reasonsBlockedAr.join(' ')}`
      );
      (err as any).code = 'CAPTAIN_INELIGIBLE_FOR_DISPATCH';
      (err as any).statusCode = 403;
      throw err;
    }

    const initialOrder = typeof orderOrGetter === 'function' ? orderOrGetter() : orderOrGetter;
    const orderId = initialOrder.id;

    // 2. Chained Lock Synchronization (simulates SELECT * FROM orders WHERE id = $1 FOR UPDATE)
    const prevLock = this.orderLocks.get(orderId) || Promise.resolve();
    let releaseLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    // Update queue head
    this.orderLocks.set(
      orderId,
      prevLock.then(() => currentLock).catch(() => currentLock)
    );

    await prevLock;

    try {
      // 3. Read latest committed state inside the critical section
      const currentOrder = typeof orderOrGetter === 'function' ? orderOrGetter() : orderOrGetter;

      const claimableStatuses = ['searching_captain', 'created', 'ready_for_pickup'];
      if (!claimableStatuses.includes(currentOrder.status)) {
        const err = new Error(
          `عذراً، الطلب لم يعد متاحاً للإسناد (الحالة الحالية: ${currentOrder.status}).`
        );
        (err as any).code = 'ORDER_NOT_AVAILABLE_FOR_CLAIM';
        (err as any).statusCode = 409;
        throw err;
      }

      if (currentOrder.assignedCaptainId) {
        const err = new Error(
          'عذراً، تم قبول هذا الطلب بالفعل من قبل كابتن آخر في محيط المنطقة.'
        );
        (err as any).code = 'ASSIGNMENT_ALREADY_CLAIMED';
        (err as any).statusCode = 409;
        throw err;
      }

      if (
        currentOrder.cityId &&
        captain.cityId &&
        currentOrder.cityId !== captain.cityId
      ) {
        const err = new Error(
          'عذراً، هذا الطلب خارج النطاق الجغرافي للمدينة المسجل بها الكابتن.'
        );
        (err as any).code = 'CAPTAIN_ZONE_MISMATCH';
        (err as any).statusCode = 422;
        throw err;
      }

      // 4. Atomically commit assignment
      const nowIso = new Date().toISOString();
      const updatedOrder: Order = {
        ...currentOrder,
        status: 'captain_assigned',
        acceptedAt: currentOrder.acceptedAt || nowIso,
        assignedCaptainId: captain.id,
        captainName: captain.fullName,
        captainPhone: captain.phone,
        captainVehicle: `${captain.vehicleType === 'motorcycle' ? 'دراجة نارية' : 'مركبة'} (${captain.vehiclePlate})`,
        updatedAt: nowIso,
      };

      await mutateOrderState(updatedOrder);

      return {
        success: true,
        order: updatedOrder,
        assignedCaptainId: captain.id,
        assignedAt: nowIso,
      };
    } finally {
      releaseLock();
    }
  }
}
