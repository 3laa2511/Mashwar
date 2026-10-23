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

export class CaptainService {
  /**
   * Resolves a captain's profile from their authenticated Supabase User ID (`sub`).
   * Queries the database table `captains` WHERE user_id = $1.
   */
  public static async resolveByUserId(userId: string): Promise<CaptainProfile | null> {
    if (!userId) return null;

    // Retrieve from PersistentStore / database
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
