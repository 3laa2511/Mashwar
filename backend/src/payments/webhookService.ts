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

  /**
   * Secrets are resolved at call time so runtime environment configuration is honored.
   * There are deliberately no built-in production or staging fallback secrets.
   */
  private static getSecret(provider: 'paymob' | 'fawry' | 'vodafone_cash'): string | undefined {
    const envName: Record<typeof provider, string> = {
      paymob: 'PAYMOB_HMAC_SECRET',
      fawry: 'FAWRY_SECURITY_SECRET',
      vodafone_cash: 'VODAFONE_CASH_SECRET',
    };
    const secret = process.env[envName[provider]];
    return secret && secret.length >= 32 ? secret : undefined;
  }

  /**
   * Generates a valid HMAC signature for testing or gateway simulation.
   */
  public static generateSignature(
    payload: string,
    provider: 'paymob' | 'fawry' | 'vodafone_cash'
  ): string {
    const secret = this.getSecret(provider);
    if (!secret) {
      throw new Error(`Webhook signing secret is not configured for provider: ${provider}`);
    }
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
    const secret = this.getSecret(provider);
    if (!secret || !signatureHeader || !/^[a-f0-9]{64}$/i.test(signatureHeader)) return false;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHeader, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
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
