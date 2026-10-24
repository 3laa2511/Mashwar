/**
 * Mashwar — Authoritative Server-Side Pricing Engine
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Units: Egyptian Piasters (قروش) — Integer Minor Units (1 EGP = 100 Piasters)
 */

import crypto from 'node:crypto';
import { FareQuote, ServiceTypeId } from '../types/index.js';
import { PersistentStore } from '../store/persistentStore.js';

export interface PricingConfig {
  baseFarePiasters: number; // 1500 (15.00 EGP) for first 1.5 km
  baseIncludedKm: number; // 1.5 km
  ratePerKmPiasters: number; // 400 (4.00 EGP per subsequent km)
  ruralSurchargePiasters: number; // 500 (5.00 EGP for unpaved / village roads)
  platformFeePiasters: number; // 200 (2.00 EGP service fee)
  quoteValidityMinutes: number; // 15 minutes
  hmacSecret: string;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  baseFarePiasters: 1500,
  baseIncludedKm: 1.5,
  ratePerKmPiasters: 400,
  ruralSurchargePiasters: 500,
  platformFeePiasters: 200,
  quoteValidityMinutes: 15,
  hmacSecret: process.env.PRICING_HMAC_SECRET || 'mashwar_el_bagour_authoritative_quote_secret_2026',
};

export class PricingEngine {
  constructor(private config: PricingConfig = DEFAULT_PRICING_CONFIG) {}

  /**
   * Calculates an authoritative fare quote and returns a tamper-evident signed quote object.
   * Supports zone-specific tariffs (El Bagour, Shebin El-Kom, Menouf, etc.) and optional store item subtotals.
   */
  public generateQuote(params: {
    serviceTypeId: ServiceTypeId;
    distanceKm: number;
    isRuralOrVillage?: boolean;
    zoneId?: string;
    cityId?: string;
    itemsSubtotalPiasters?: number;
    pickupLandmark?: string;
    dropoffLandmark?: string;
  }): FareQuote {
    const {
      serviceTypeId,
      distanceKm,
      isRuralOrVillage = false,
      zoneId,
      cityId,
      itemsSubtotalPiasters = 0,
    } = params;

    // Invariant 1: Regulatory lock on passenger mobility
    if (serviceTypeId === 'passenger') {
      const err = new Error(
        'عذراً، خدمة نقل الركاب معلقة حالياً لحين استيفاء الاشتراطات والتراخيص القانونية وفقاً للقانون رقم ٧٣ لسنة ٢٠١٨.'
      );
      (err as any).code = 'REGULATORY_COMPLIANCE_LOCK';
      (err as any).statusCode = 403;
      throw err;
    }

    // Invariant 2: Distance must be non-negative and realistic
    if (distanceKm < 0 || Number.isNaN(distanceKm)) {
      const err = new Error('المسافة لا يمكن أن تكون قيمة سالبة.');
      (err as any).code = 'INVALID_DISTANCE';
      (err as any).statusCode = 400;
      throw err;
    }

    if (distanceKm > 75) {
      const err = new Error('المسافة تتجاوز النطاق التشغيلي الأقصى لمركز الباجور والمحافظات المجاورة.');
      (err as any).code = 'OUT_OF_BOUNDS_DISTANCE';
      (err as any).statusCode = 400;
      throw err;
    }

    if (itemsSubtotalPiasters < 0 || !Number.isInteger(itemsSubtotalPiasters)) {
      const err = new Error('قيمة مشتريات المتجر بالقرش يجب أن تكون عدداً صحيحاً غير سالب.');
      (err as any).code = 'INVALID_ITEMS_SUBTOTAL';
      (err as any).statusCode = 400;
      throw err;
    }

    // Resolve zone-specific tariff if zoneId is provided
    let baseFarePiasters = this.config.baseFarePiasters;
    let baseIncludedKm = this.config.baseIncludedKm;
    let ratePerKmPiasters = this.config.ratePerKmPiasters;
    let configuredRuralSurcharge = this.config.ruralSurchargePiasters;
    let platformFeePiasters = this.config.platformFeePiasters;
    let resolvedCityId = cityId || 'city_el_bagour';
    let resolvedZoneId = zoneId || (isRuralOrVillage ? 'zone_bagour_villages' : 'zone_bagour_center');
    let effectiveRural = isRuralOrVillage;

    if (zoneId) {
      const zone = PersistentStore.getZoneById(zoneId);
      if (!zone) {
        const err = new Error(`نطاق الخدمة المطلوب (${zoneId}) غير مسجل بالنظام.`);
        (err as any).code = 'ZONE_NOT_FOUND';
        (err as any).statusCode = 404;
        throw err;
      }

      const city = PersistentStore.getCityById(zone.cityId);
      if (!zone.isActive || (city && !city.isActive)) {
        const err = new Error(`نطاق الخدمة (${zone.nameAr}) غير مفعل للتشغيل حالياً.`);
        (err as any).code = 'ZONE_INACTIVE';
        (err as any).statusCode = 403;
        throw err;
      }

      resolvedCityId = zone.cityId;
      resolvedZoneId = zone.id;
      if (zone.isRural) {
        effectiveRural = true;
      }

      const tariff = PersistentStore.getZoneTariff(zone.id, serviceTypeId);
      if (tariff) {
        if (!tariff.isActive) {
          const err = new Error(`تعريفة الخدمة لهذه المنطقة غير مفعلة حالياً.`);
          (err as any).code = 'TARIFF_INACTIVE';
          (err as any).statusCode = 403;
          throw err;
        }
        baseFarePiasters = tariff.baseFarePiasters;
        baseIncludedKm = tariff.baseIncludedKm;
        ratePerKmPiasters = tariff.ratePerKmPiasters;
        configuredRuralSurcharge = tariff.ruralSurchargePiasters;
        platformFeePiasters = tariff.platformFeePiasters;
      }
    }

    // Fare calculation in pure integer piasters (no floating point representation errors)
    const chargeableKm = distanceKm > baseIncludedKm ? distanceKm - baseIncludedKm : 0;
    const distanceFarePiasters = Math.round(chargeableKm * ratePerKmPiasters);
    const ruralSurchargePiasters = effectiveRural ? configuredRuralSurcharge : 0;

    const totalFarePiasters =
      baseFarePiasters +
      distanceFarePiasters +
      ruralSurchargePiasters +
      platformFeePiasters +
      itemsSubtotalPiasters;

    const quoteId = `quote_${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.quoteValidityMinutes * 60 * 1000).toISOString();

    // Estimate duration: 25 km/h in urban delta + 5 min pickup buffer
    const minMinutes = Math.ceil(distanceKm * 2.4 + 5);
    const maxMinutes = minMinutes + 5;
    const estimatedDurationMinutes = `${minMinutes}-${maxMinutes}`;

    const formattedTotalEgp = `${(totalFarePiasters / 100).toFixed(2)} ج.م`;

    const lineItems = [
      {
        title: `الأجرة الأساسية (أول ${baseIncludedKm} كم)`,
        amountPiasters: baseFarePiasters,
      },
    ];

    if (distanceFarePiasters > 0) {
      lineItems.push({
        title: `تكلفة المسافة (${chargeableKm.toFixed(1)} كم إضافي)`,
        amountPiasters: distanceFarePiasters,
      });
    }

    if (ruralSurchargePiasters > 0) {
      lineItems.push({
        title: 'بدل طرق غير ممهدة / قرى المراكز',
        amountPiasters: ruralSurchargePiasters,
      });
    }

    if (itemsSubtotalPiasters > 0) {
      lineItems.push({
        title: 'إجمالي منتجات المتجر (بدون عمولة إضافية)',
        amountPiasters: itemsSubtotalPiasters,
      });
    }

    lineItems.push({
      title: 'رسوم تشغيل المنصة ودعم الأسطول',
      amountPiasters: platformFeePiasters,
    });

    const signaturePayload = `${quoteId}:${serviceTypeId}:${totalFarePiasters}:${expiresAt}`;
    const signature = crypto
      .createHmac('sha256', this.config.hmacSecret)
      .update(signaturePayload)
      .digest('hex');

    return {
      quoteId,
      serviceTypeId,
      cityId: resolvedCityId,
      zoneId: resolvedZoneId,
      distanceKm,
      baseFarePiasters,
      distanceFarePiasters,
      ruralSurchargePiasters,
      platformFeePiasters,
      ...(itemsSubtotalPiasters > 0 ? { itemsSubtotalPiasters } : {}),
      totalFarePiasters,
      formattedTotalEgp,
      currency: 'EGP',
      estimatedDurationMinutes,
      expiresAt,
      signature,
      lineItems,
    };
  }

  /**
   * Verifies the authenticity and validity of a fare quote.
   * Throws if expired, tampered, or invalid.
   */
  public verifyQuote(quote: {
    quoteId: string;
    serviceTypeId: ServiceTypeId;
    totalFarePiasters: number;
    expiresAt: string;
    signature: string;
  }): boolean {
    const { quoteId, serviceTypeId, totalFarePiasters, expiresAt, signature } = quote;

    // Check expiration
    const expiresTime = new Date(expiresAt).getTime();
    if (Date.now() > expiresTime) {
      const err = new Error('عذراً، انتهت صلاحية تسعيرة التوصيل. يرجى طلب تسعيرة جديدة.');
      (err as any).code = 'QUOTE_EXPIRED';
      (err as any).statusCode = 400;
      throw err;
    }

    // Verify cryptographic signature
    const signaturePayload = `${quoteId}:${serviceTypeId}:${totalFarePiasters}:${expiresAt}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.config.hmacSecret)
      .update(signaturePayload)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      const err = new Error('عذراً، التسعيرة غير مطابقة أو تم التلاعب بها.');
      (err as any).code = 'QUOTE_SIGNATURE_TAMPERED';
      (err as any).statusCode = 400;
      throw err;
    }

    return true;
  }
}
