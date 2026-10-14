# Mashwar — Payments, Cash Collection & Captain Subscription Model
**Phase:** Phase 2 Architecture Specification  
**Status:** Reviewable Specification  

---

## 1. Verified Code vs. Proposed Architecture

| Area | Verified Repository Code (`flutter_mashwar/`) | Proposed Architecture Design | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Captain Monetization** | Hardcoded daily earnings screen displaying static 240.00 EGP / 9 trips. | **Monthly Subscription Model** (fixed monthly fee, zero commission on standard deliveries). | **Proposed** (Confirmed Provisional Decision) |
| **Cash Collection** | Simulated label on active order card (`22.00 ج.م كاش`). | Dedicated `cash_collections` ledger tracking exact collected piasters, variance, and hub remittance. | **Proposed** |
| **Electronic Payments** | Not implemented in Flutter client. | `payment_intents` + `webhook_events` with HMAC signature verification and idempotency keys. | **Proposed** |
| **Subscription Expiration** | Not present in Flutter models. | Tiered eligibility policy: Active → 72-hour Grace Period (with warning) → Expired (offers blocked, renewal accessible). | **Proposed** |
| **Payment Gateways** | No gateway SDKs installed. | Gateway agnostic design supporting Egyptian aggregators (Paymob, Fawry, Vodafone Cash). | **Unresolved Decision** (Provider selection open) |

---

## 2. Captain Subscription Architecture (Confirmed Monetization Model)

Unlike traditional commission-based platforms that extract 15–25% per delivery, Mashwar's primary model in El Bagour is a **flat monthly subscription**:
- Captains retain **100% of the delivery fare** paid by customers or merchants.
- Captains pay a predictable monthly platform subscription fee (e.g., 250.00 EGP / month).
- Eliminates financial disputes, commission evasion, and off-app trip poaching.

### 2.1 Subscription State Machine & Lifecycle

```text
 ┌──────────────┐
 │    trial     │  (14-day free trial upon initial verification approval)
 └──────┬───────┘
        │ (Captain purchases subscription)
        ▼
 ┌──────────────┐
 │    active    │◀───────────────────────────────┐
 └──────┬───────┘                                │
        │ (Current period ends)                  │ (Captain pays renewal)
        ▼                                        │
 ┌───────────────────┐                           │
 │   grace_period    ├───────────────────────────┤
 │   (72 Hours)      │                           │
 └──────┬────────────┘                           │
        │ (Grace period expires without payment) │
        ▼                                        │
 ┌──────────────┐                                │
 │   expired    ├────────────────────────────────┘
 └──────────────┘
```

### 2.2 Proposed Captain Assignment Eligibility Policy
An expired subscription must **never** cause an abrupt, unsafe mid-trip shutdown. Mashwar implements a 4-tier eligibility policy:

| Subscription Status | Eligibility to Receive New Offers | In-App Captain Experience | Permitted Actions |
| :--- | :---: | :--- | :--- |
| **`trial`** | ✅ Eligible | Standard UI with trial days remaining badge (e.g. "تبقّى ٨ أيام على انتهاء الفترة التجريبية"). | Full delivery dispatch; view earnings; cash collection. |
| **`active`** | ✅ Eligible | Standard UI with renewal date indicator. | Full delivery dispatch; view earnings; cash collection. |
| **`grace_period`** | ✅ Eligible (Limited) | **Prominent Persistent Alert:** "انتهت فترة الاشتراك. تفعيل فترة سماح لمدة ٧٢ ساعة. يرجى التجديد لتجنب إيقاف الرادار". | Can complete ongoing orders and accept new offers for 72 hours. |
| **`expired`** | ❌ Blocked | **Modal Notification:** "تم إيقاف استقبال الطلبات لانتهاء الاشتراك. يمكنك التجديد الآن لإعادة تفعيل الرادار فوراً". | Cannot receive new delivery offers. Can view historical earnings, complete existing in-flight delivery, and access subscription renewal screen. |
| **`suspended`** | ❌ Blocked | **Administrative Lock:** "تم تعليق الحساب لمراجعة معايير السلامة والأمان. تواصل مع إدارة العمليات بالباجور". | All dispatch and financial collections locked by operations. |

---

## 3. Cash Collection & Remittance Architecture (COD)

Cash on Delivery represents the majority of local transactions in El Bagour. The architecture treats cash collection as a **distinct, audited financial event** separate from order quotation.

### 3.1 Cash Collection Lifecycle

```text
 1. Order Delivered ──▶ 2. Captain Inputs Cash ──▶ 3. Variance Checked ──▶ 4. Remittance to Hub
 (Quoted: 2500 piasters) (Captain: 2500 piasters)  (Zero discrepancy)    (Daily/Weekly office deposit)
```

1. **At-Doorstep Recording:** When the captain taps "تم التسليم وتحصيل المبلغ", the app prompts for the exact cash collected (in Egyptian Piasters).
2. **Discrepancy Enforcement:** If the entered cash differs from the quoted fare:
   - Difference within ±5.00 EGP (coinage change shortage / أزمة فكة): Recorded as customer tip or balance adjustment.
   - Significant under-collection: Flagged immediately for operations review.
3. **Cash Holding Ceiling:** Each captain has an approved maximum holding limit (default: 100,000 piasters / 1,000.00 EGP). When current holding reaches this limit, the system automatically marks the captain as **ineligible for cash orders** until funds are remitted to the El Bagour operations office or settled via mobile wallet.

---

## 4. Electronic Payments & Webhook Idempotency

### 4.1 Payment Intent Creation
1. Customer selects electronic payment (e.g. Card, Vodafone Cash, Fawry).
2. Server API creates an entry in `payment_intents` with status `requires_payment_method`.
3. Server interacts with Egyptian gateway provider using server-side API keys.
4. Client receives an ephemeral `client_secret` or Fawry reference code.

### 4.2 Webhook Processing Safeguards
Under no circumstances is an order marked `paid` based on a mobile client response. Payment is confirmed exclusively through **verified server-side webhooks**:

```typescript
async function handlePaymentWebhook(req: Request, res: Response) {
  const signature = req.headers['x-provider-signature'];
  const rawBody = req.rawBody;

  // 1. Verify cryptographic HMAC signature
  if (!verifyProviderHmac(rawBody, signature, process.env.GATEWAY_WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE' });
  }

  const event = req.body;
  const eventId = event.id;

  // 2. Idempotency Check: prevent duplicate event processing
  const existing = await db
    .select()
    .from(webhookEvents)
    .where(and(eq(webhookEvents.provider, 'paymob'), eq(webhookEvents.providerEventId, eventId)))
    .limit(1);

  if (existing.length > 0 && existing[0].isProcessed) {
    return res.status(200).json({ status: 'ALREADY_PROCESSED' });
  }

  // 3. Atomic Database Transaction: Update Payment and Order
  await db.transaction(async (tx) => {
    // Record webhook event
    await tx.insert(webhookEvents).values({
      provider: 'paymob',
      providerEventId: eventId,
      eventType: event.type,
      payload: event,
      isProcessed: true,
      processedAt: new Date(),
    });

    if (event.type === 'TRANSACTION_SUCCESS') {
      const orderId = event.data.order_id;
      await tx
        .update(orders)
        .set({ status: 'searching_captain' })
        .where(eq(orders.id, orderId));
    }
  });

  return res.status(200).json({ status: 'SUCCESS' });
}
```

---

## 5. Refunds & Dispute Handling

1. **Customer Pre-Cancellation:** If an electronic payment was captured and the customer cancels before captain assignment, the server initiates an automated refund through the gateway provider API.
2. **Merchant Order Cancellation:** If a restaurant or store is closed or out of stock, full refund is credited back to the customer's payment method within 24 hours.
3. **Audit Trail:** Every refund creates an immutable entry in `payment_transactions` with `is_refund = TRUE` and the authorizing operator ID.
