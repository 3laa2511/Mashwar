/**
 * Mashwar — Captain Subscription & Dispatch Eligibility Engine
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Business Model: Fixed Monthly Subscription (Zero Commission Invariant)
 */

import { CaptainProfile, SubscriptionStatus } from '../types/index.js';

export interface EligibilityEvaluation {
  isEligibleForNewOffers: boolean;
  canAcceptCashOrders: boolean;
  subscriptionStatus: SubscriptionStatus;
  statusMessageAr: string;
  isGracePeriod: boolean;
  hoursRemainingInGrace?: number;
  cashHoldingPiasters: number;
  maxCashHoldingPiasters: number;
  cashCeilingBreached: boolean;
  reasonsBlockedAr: string[];
}

export class CaptainEligibilityEngine {
  public static readonly DEFAULT_MAX_CASH_HOLDING_PIASTERS = 100000; // 1,000.00 EGP
  public static readonly GRACE_PERIOD_HOURS = 72; // 3 days grace window

  /**
   * Evaluates if a captain is eligible to receive and accept order dispatches.
   */
  public static evaluate(captain: CaptainProfile, referenceTime: Date = new Date()): EligibilityEvaluation {
    const reasons: string[] = [];
    let isEligible = true;
    let canAcceptCash = true;
    let isGrace = false;
    let hoursRemainingInGrace: number | undefined;

    const maxCash = captain.maxCashHoldingPiasters || this.DEFAULT_MAX_CASH_HOLDING_PIASTERS;
    const cashBreached = captain.cashHoldingPiasters >= maxCash;

    // Check cash ceiling
    if (cashBreached) {
      canAcceptCash = false;
      // If cash holding is breached, they cannot accept cash orders (and in high-risk delta dispatch, blocked from new orders)
      reasons.push(
        `تم الوصول إلى الحد الأقصى للنقدية المحصلة (${(captain.cashHoldingPiasters / 100).toFixed(2)} ج.م / الحد: ${(maxCash / 100).toFixed(2)} ج.م). يرجى توريد النقدية بمكتب الباجور لتنشيط الرادار.`
      );
    }

    // Check subscription status
    const periodEnd = new Date(captain.currentPeriodEndsAt).getTime();
    const now = referenceTime.getTime();

    switch (captain.subscriptionStatus) {
      case 'trial':
      case 'active':
        if (now > periodEnd) {
          // Check if within 72h grace window
          const graceEnd = periodEnd + this.GRACE_PERIOD_HOURS * 3600 * 1000;
          if (now <= graceEnd) {
            isGrace = true;
            hoursRemainingInGrace = Math.max(0, Math.ceil((graceEnd - now) / (3600 * 1000)));
          } else {
            isEligible = false;
            reasons.push('انتهت صلاحية الاشتراك الشهري وفترة السماح (72 ساعة). يرجى تجديد الاشتراك فوراً.');
          }
        }
        break;

      case 'grace_period':
        if (captain.gracePeriodEndsAt) {
          const graceEnd = new Date(captain.gracePeriodEndsAt).getTime();
          if (now <= graceEnd) {
            isGrace = true;
            hoursRemainingInGrace = Math.max(0, Math.ceil((graceEnd - now) / (3600 * 1000)));
          } else {
            isEligible = false;
            reasons.push('انتهت فترة السماح. تم حظر استقبال الطلبات الجديدة حتى تجديد الاشتراك.');
          }
        } else {
          isGrace = true;
        }
        break;

      case 'expired':
        isEligible = false;
        reasons.push('الاشتراك الشهري منتهي الصلاحية. الرادار متوقف حتى التجديد.');
        break;

      case 'suspended':
        isEligible = false;
        reasons.push('حساب الكابتن موقوف إدارياً من إدارة العمليات لمخالفة معايير الجودة.');
        break;

      case 'cancelled':
        isEligible = false;
        reasons.push('تم إلغاء اشتراك الكابتن بناءً على طلبه.');
        break;
    }

    // If cash ceiling is breached, block new offers
    if (cashBreached) {
      isEligible = false;
    }

    let statusMessageAr = 'الكابتن مؤهل وجاهز لاستقبال الطلبات.';
    if (!isEligible) {
      statusMessageAr = reasons.join(' ');
    } else if (isGrace) {
      statusMessageAr = `تنبيه: أنت في فترة السماح (متبقي ${hoursRemainingInGrace} ساعة). يرجى تجديد الاشتراك لتجنب إيقاف الرادار.`;
    }

    return {
      isEligibleForNewOffers: isEligible,
      canAcceptCashOrders: canAcceptCash && isEligible,
      subscriptionStatus: isGrace ? 'grace_period' : captain.subscriptionStatus,
      statusMessageAr,
      isGracePeriod: isGrace,
      hoursRemainingInGrace,
      cashHoldingPiasters: captain.cashHoldingPiasters,
      maxCashHoldingPiasters: maxCash,
      cashCeilingBreached: cashBreached,
      reasonsBlockedAr: reasons,
    };
  }
}
