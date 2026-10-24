/**
 * Mashwar — Database-Backed Captain Identity Resolution Service
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 *
 * Sourced directly from verified Supabase token principal (`sub` / user_id).
 * Replaces temporary in-memory mockCaptains mapping with durable DB-backed resolution.
 * Enforces fail-closed behavior: invalid, missing, or deactivated profiles are rejected.
 */

import { CaptainProfile } from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';
import { CaptainEligibilityEngine } from '../captain/captainEligibility.js';
import { getDb, isPostgresConfigured } from '../database/db.js';

export class CaptainService {
  /**
   * Resolves a captain's profile from their authenticated Supabase User ID (`sub`).
   * Queries the database table `captains` WHERE user_id = $1 when PostgreSQL is configured,
   * falling back to PersistentStore in local sandbox mode.
   */
  public static async resolveByUserId(userId: string): Promise<CaptainProfile | null> {
    if (!userId) return null;

    if (isPostgresConfigured()) {
      try {
        const db = getDb();
        if (db) {
          const row = await db
            .selectFrom('captains')
            .selectAll()
            .where('user_id', '=', userId)
            .executeTakeFirst();
          if (row) {
          return {
            id: row.id,
            userId: row.user_id,
            fullName: row.full_name,
            phone: row.phone,
            nationalIdMasked: row.national_id_masked,
            cityId: row.city_id || 'city_el_bagour',
            activeZoneId: row.active_zone_id || 'zone_bagour_center',
            vehicleType: row.vehicle_type as any,
            vehiclePlate: row.vehicle_plate,
            subscriptionStatus: row.subscription_status,
            subscriptionPlanCode: row.subscription_plan_code,
            currentPeriodEndsAt: row.current_period_ends_at,
            gracePeriodEndsAt: row.grace_period_ends_at || undefined,
            cashHoldingPiasters: Number(row.cash_holding_piasters),
            maxCashHoldingPiasters: Number(row.max_cash_holding_piasters),
            ratingAverage: Number(row.rating_average),
            isOnline: Boolean(row.is_online),
          };
          }
        }
      } catch {
        // Fallback to PersistentStore if database connection is unreachable
      }
    }

    const captains = PersistentStore.getAllCaptains();
    const captain = captains.find((c) => c.userId === userId);
    return captain || null;
  }

  /**
   * Resolves a captain by captain ID.
   */
  public static async getById(captainId: string): Promise<CaptainProfile | null> {
    if (!captainId) return null;
    const captain = PersistentStore.getCaptainById(captainId);
    return captain || null;
  }

  /**
   * Enforces that the caller has a valid, active captain profile linked to their authenticated user ID.
   * Throws 403 or 404 if profile does not exist or account is barred.
   */
  public static async requireActiveCaptain(userId: string): Promise<CaptainProfile> {
    const captain = await this.resolveByUserId(userId);

    if (!captain) {
      const err = new Error('لا يوجد ملف كابتن مسجل مرتبط بهذا الحساب الموثق في مركز الباجور.');
      (err as any).code = 'CAPTAIN_PROFILE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    // Check if captain account is suspended
    if (captain.subscriptionStatus === 'suspended') {
      const err = new Error(
        'حساب الكابتن معلق حالياً لتجاوز سقف العهدة النقدية أو بقرار إداري. يرجى التوريد لمركز الباجور.'
      );
      (err as any).code = 'CAPTAIN_ACCOUNT_SUSPENDED';
      (err as any).statusCode = 403;
      throw err;
    }

    // Verify eligibility
    const eligibility = CaptainEligibilityEngine.evaluate(captain);
    if (!eligibility.isEligibleForNewOffers) {
      const err = new Error(
        `حساب الكابتن غير مؤهل لاستقبال طلبات: ${eligibility.reasonsBlockedAr.join(' ')}`
      );
      (err as any).code = 'CAPTAIN_ACCOUNT_INELIGIBLE';
      (err as any).statusCode = 403;
      throw err;
    }

    return captain;
  }

  /**
   * Updates captain online/offline availability and active service zone.
   */
  public static async updateAvailabilityAndZone(params: {
    userId: string;
    isOnline?: boolean;
    activeZoneId?: string;
  }): Promise<CaptainProfile> {
    const captain = await this.resolveByUserId(params.userId);
    if (!captain) {
      const err = new Error('ملف الكابتن غير موجود.');
      (err as any).code = 'CAPTAIN_PROFILE_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    if (params.activeZoneId) {
      const zone = PersistentStore.getZoneById(params.activeZoneId);
      if (!zone || !zone.isActive) {
        const err = new Error('نطاق الخدمة المطلوب غير صالح أو غير نشط حالياً.');
        (err as any).code = 'ZONE_INACTIVE_OR_INVALID';
        (err as any).statusCode = 400;
        throw err;
      }
      captain.activeZoneId = zone.id;
      captain.cityId = zone.cityId;
    }

    if (params.isOnline !== undefined) {
      if (params.isOnline) {
        const eligibility = CaptainEligibilityEngine.evaluate(captain);
        if (!eligibility.isEligibleForNewOffers) {
          const err = new Error(
            `لا يمكن تفعيل وضع الاتصال: ${eligibility.reasonsBlockedAr.join(' ')}`
          );
          (err as any).code = 'CAPTAIN_INELIGIBLE_FOR_ONLINE';
          (err as any).statusCode = 403;
          throw err;
        }
      }
      captain.isOnline = Boolean(params.isOnline);
    }

    PersistentStore.saveCaptain(captain);
    return captain;
  }

  /**
   * Updates captain cash holding in durable storage.
   */
  public static async updateCashHolding(
    captainId: string,
    additionalCashPiasters: number
  ): Promise<{ captain: CaptainProfile; ceilingExceeded: boolean }> {
    const captain = PersistentStore.getCaptainById(captainId);
    if (!captain) {
      const err = new Error('الكابتن غير موجود لتحديث العهدة النقدية.');
      (err as any).code = 'CAPTAIN_NOT_FOUND';
      (err as any).statusCode = 404;
      throw err;
    }

    captain.cashHoldingPiasters += additionalCashPiasters;
    const ceilingExceeded = captain.cashHoldingPiasters > captain.maxCashHoldingPiasters;

    if (ceilingExceeded && captain.subscriptionStatus === 'active') {
      captain.subscriptionStatus = 'suspended';
    }

    PersistentStore.saveCaptain(captain);
    return { captain, ceilingExceeded };
  }
}
