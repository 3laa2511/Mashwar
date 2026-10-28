/**
 * Mashwar — Payment Webhook Verification & Idempotency Engine
 * Target Hub: El Bagour, Menoufia Governorate, Egypt
 * Supported Gateways: Paymob, Fawry, Vodafone Cash Direct
 */

import crypto from 'node:crypto';
import { WebhookEventPayload } from '../types/index.js';

export interface ProcessWebhookResult {
  received: boolean;
  status: 'PROCESSED' | 'ALREADY_PROCESSED' | 'SIGNATURE_FAILED' | 'REJECTED';
  messageAr: string;
  processedAt: string;
}

export class WebhookService {
  private static processedEvents = new Map<string, { processedAt: string; provider: string }>();

  public static readonly DEFAULT_WEBHOOK_SECRETS: Record<string, string> = {
    paymob: process.env.PAYMOB_HMAC_SECRET || 'paymob_staging_hmac_secret_el_bagour',
    fawry: process.env.FAWRY_SECURITY_SECRET || 'fawry_staging_secret_key_menoufia',
    vodafone_cash: process.env.VODAFONE_CASH_SECRET || 'vodafone_cash_api_key_delta',
  };

  private static resolveWebhookSecret(provider: 'paymob' | 'fawry' | 'vodafone_cash'): string | undefined {
    const providerEnvMap: Record<'paymob' | 'fawry' | 'vodafone_cash', string | undefined> = {
      paymob: process.env.PAYMOB_HMAC_SECRET || process.env.PAYMENT_WEBHOOK_SECRET,
      fawry: process.env.FAWRY_SECURITY_SECRET || process.env.PAYMENT_WEBHOOK_SECRET,
      vodafone_cash: process.env.VODAFONE_CASH_SECRET || process.env.PAYMENT_WEBHOOK_SECRET,
    };

    const configured = providerEnvMap[provider]?.trim();
    if (process.env.NODE_ENV === 'production') {
      if (!configured || configured.startsWith('CHANGE_ME_') || configured.length < 24) {
        const err = new Error(
          'خطأ إعدادات أمنية حرج: مفتاح التحقق من إشعارات الدفع مفقود أو غير صالح في بيئة الإنتاج (Fail-Closed).'
        );
        (err as any).code = 'WEBHOOK_CONFIG_MISSING';
        (err as any).statusCode = 500;
        throw err;
      }
      return configured;
    }

    return configured || this.DEFAULT_WEBHOOK_SECRETS[provider];
  }

  /**
   * Generates a valid HMAC signature for testing or gateway simulation.
   */
  public static generateSignature(
    payload: string,
    provider: 'paymob' | 'fawry' | 'vodafone_cash'
  ): string {
    const secret = this.resolveWebhookSecret(provider) || this.DEFAULT_WEBHOOK_SECRETS[provider];
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Verifies the cryptographic HMAC signature of incoming webhooks.
   */
  public static verifySignature(
    rawBody: string,
    signatureHeader: string,
    provider: 'paymob' | 'fawry' | 'vodafone_cash'
  ): boolean {
    const secret = this.resolveWebhookSecret(provider);
    if (!secret || !signatureHeader) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signatureHeader, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length !== expBuf.length) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Processes incoming payment webhook with strict idempotency and deduplication.
   */
  public static async processWebhook(
    rawBody: string,
    signatureHeader: string,
    payload: WebhookEventPayload,
    onSuccessPayment?: (payload: WebhookEventPayload) => Promise<void> | void
  ): Promise<ProcessWebhookResult> {
    const { provider, eventId, transactionReference } = payload;

    // 1. Verify HMAC signature
    const isValidSignature = this.verifySignature(rawBody, signatureHeader, provider);
    if (!isValidSignature) {
      return {
        received: false,
        status: 'SIGNATURE_FAILED',
        messageAr: 'فشل التحقق من التوقيع الرقمي للبوابة (HMAC Signature Mismatch).',
        processedAt: new Date().toISOString(),
      };
    }

    // 2. Check idempotency deduplication key (eventId or transactionReference)
    const idempotencyKey = `${provider}:${eventId || transactionReference}`;
    if (this.processedEvents.has(idempotencyKey)) {
      const existing = this.processedEvents.get(idempotencyKey)!;
      return {
        received: true,
        status: 'ALREADY_PROCESSED',
        messageAr: 'تم استلام الإشعار مسبقاً وتأكيد العملية (Idempotent replay detected).',
        processedAt: existing.processedAt,
      };
    }

    // 3. Process the event payload
    if (payload.eventType === 'TRANSACTION_SUCCESS' && onSuccessPayment) {
      await onSuccessPayment(payload);
    }

    // 4. Mark event as processed atomically in deduplication store
    const nowIso = new Date().toISOString();
    this.processedEvents.set(idempotencyKey, {
      processedAt: nowIso,
      provider,
    });

    return {
      received: true,
      status: 'PROCESSED',
      messageAr: 'تمت معالجة إشعار الدفع الإلكتروني بنجاح وتسجيل المعاملة.',
      processedAt: nowIso,
    };
  }

  /**
   * Resets the in-memory idempotency cache (used for testing).
   */
  public static clearCache(): void {
    this.processedEvents.clear();
  }
}
