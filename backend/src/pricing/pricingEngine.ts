/**
 * Mashwar — Authoritative Server-Side Pricing Engine
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Monetary Units: Egyptian Piasters (قروش) — Integer Minor Units (1 EGP = 100 Piasters)
 */

import crypto from 'node:crypto';
import { FareQuote, ServiceTypeId } from '../types/index.js';

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
  hmacSecret: process.env.PRICING_HMAC_SECRET || '',
};

export class PricingEngine {
  constructor(private config: PricingConfig = DEFAULT_PRICING_CONFIG) {}

  /**
   * Calculates an authoritative fare quote and returns a tamper-evident signed quote object.
   */
  public generateQuote(params: {
    serviceTypeId: ServiceTypeId;
    distanceKm: number;
    isRuralOrVillage?: boolean;
    pickupLandmark?: string;
    dropoffLandmark?: string;
  }): FareQuote {
    this.assertSigningSecretConfigured();
    const { serviceTypeId, distanceKm, isRuralOrVillage = false } = params;

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
    if (distanceKm < 0) {
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

    // Fare calculation in pure integer piasters (no floating point representation errors)
    const baseFarePiasters = this.config.baseFarePiasters;
    const chargeableKm = distanceKm > this.config.baseIncludedKm
      ? distanceKm - this.config.baseIncludedKm
      : 0;

    const distanceFarePiasters = Math.round(chargeableKm * this.config.ratePerKmPiasters);
    const ruralSurchargePiasters = isRuralOrVillage ? this.config.ruralSurchargePiasters : 0;
    const platformFeePiasters = this.config.platformFeePiasters;

    const totalFarePiasters =
      baseFarePiasters + distanceFarePiasters + ruralSurchargePiasters + platformFeePiasters;

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
        title: `الأجرة الأساسية (أول ${this.config.baseIncludedKm} كم)`,
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
        title: 'بدل طرق غير ممهدة / قرى مركز الباجور',
        amountPiasters: ruralSurchargePiasters,
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
      distanceKm,
      baseFarePiasters,
      distanceFarePiasters,
      ruralSurchargePiasters,
      platformFeePiasters,
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
  private assertSigningSecretConfigured(): void {
    if (typeof this.config.hmacSecret !== 'string' || this.config.hmacSecret.length < 32) {
      const err = new Error('خدمة التسعير غير مهيأة بأمان؛ يرجى ضبط PRICING_HMAC_SECRET.');
      (err as any).code = 'PRICING_SIGNING_NOT_CONFIGURED';
      (err as any).statusCode = 503;
      throw err;
    }
  }

  public verifyQuote(quote: {
    quoteId: string;
    serviceTypeId: ServiceTypeId;
    totalFarePiasters: number;
    expiresAt: string;
    signature: string;
  }): boolean {
    this.assertSigningSecretConfigured();
    const { quoteId, serviceTypeId, totalFarePiasters, expiresAt, signature } = quote;

    if (!quoteId || !serviceTypeId || !Number.isSafeInteger(totalFarePiasters) || totalFarePiasters < 0 || !expiresAt || !signature) {
      const err = new Error('بيانات التسعيرة غير مكتملة أو غير صالحة.');
      (err as any).code = 'INVALID_QUOTE';
      (err as any).statusCode = 400;
      throw err;
    }

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

    const supplied = Buffer.from(signature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      const err = new Error('عذراً، التسعيرة غير مطابقة أو تم التلاعب بها.');
      (err as any).code = 'QUOTE_SIGNATURE_TAMPERED';
      (err as any).statusCode = 400;
      throw err;
    }

    return true;
  }
}
