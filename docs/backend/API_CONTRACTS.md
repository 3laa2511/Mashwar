# Mashwar — REST API Specification & Service Contracts
**Protocol:** HTTPS REST / JSON  
**Base URL:** `/api/v1`  
**Authentication:** HTTP Authorization Header: `Bearer <JWT_ACCESS_TOKEN>`  
**Monetary Format:** Integer Minor Units (Egyptian Piasters - قروش)  
**Status:** Reviewable Specification  

---

## 1. Verified Code vs. Proposed API Contracts

| Area | Verified Repository Code (`flutter_mashwar/`) | Proposed REST Contract | Implementation Status |
| :--- | :--- | :--- | :--- |
| **Quoting** | Synchronous client calculation in `PriceCalculator.calculateQuote()` | `POST /api/v1/quotes` returning signed, server-authoritative quote. | **Proposed** |
| **Order Creation** | Local `OrdersNotifier.addOrder()` adding to in-memory list. | `POST /api/v1/orders` with mandatory `Idempotency-Key` and `quoteId`. | **Proposed** |
| **Cash Collection** | Simulated button directly updating client state to delivered. | `POST /api/v1/captain/orders/:id/cash-collection` with piasters verification. | **Proposed** |
| **Electronic Payments** | Not implemented. | `POST /api/v1/payments/intents` and `POST /api/v1/webhooks/payments/:provider`. | **Proposed** |
| **Captain Subscriptions** | Not implemented. | `GET /api/v1/captain/subscription` and `POST /api/v1/captain/subscription/purchase`. | **Proposed** |
| **Order Status Transitions** | Unconditional client method `advanceOrderStatus(orderId)`. | `POST /api/v1/orders/:id/transitions` validating actor authorization & preconditions. | **Proposed** |

---

## 2. Global Standards & Error Conventions

### 2.1 Standard Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "CAPTAIN_INELIGIBLE_EXPIRED_SUBSCRIPTION",
    "message": "عذراً، انتهت صلاحية اشتراك الكابتن وفترة السماح. يرجى التجديد لتلقي الطلبات.",
    "details": {
      "gracePeriodExpiredAt": "2026-10-12T18:00:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-10-13T20:00:00.000Z",
    "requestId": "req_01j9a8bc45"
  }
}
```

---

## 3. Quoting & Pricing Endpoints

### 3.1 Create Authoritative Fare Quote
`POST /api/v1/quotes`
- **Auth:** `Bearer <JWT>` (Role: `customer`)

**Request Body:**
```json
{
  "serviceTypeId": "package",
  "pickupLandmark": "ميدان المحطة - وسط الباجور",
  "dropoffLandmark": "قرية كفر الباجور",
  "isRuralOrVillage": true,
  "estimatedDistanceKm": 3.8
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "quoteId": "quote_8923a1",
    "serviceTypeId": "package",
    "distanceKm": 3.8,
    "baseFarePiasters": 1500,
    "distanceFarePiasters": 920,
    "ruralSurchargePiasters": 500,
    "platformFeePiasters": 200,
    "totalFarePiasters": 3120,
    "formattedTotalEgp": "31.20 ج.م",
    "currency": "EGP",
    "estimatedDurationMinutes": "15-20",
    "expiresAt": "2026-10-13T20:15:00.000Z",
    "lineItems": [
      { "title": "الأجرة الأساسية (أول 1.5 كم)", "amountPiasters": 1500 },
      { "title": "تكلفة المسافة (2.3 كم إضافي)", "amountPiasters": 920 },
      { "title": "بدل طرق غير ممهدة / قرى", "amountPiasters": 500 },
      { "title": "رسوم الخدمة وتطوير المنصة", "amountPiasters": 200 }
    ]
  }
}
```

---

## 4. Order Management Endpoints

### 4.1 Create Order Using Valid Quote
`POST /api/v1/orders`
- **Auth:** `Bearer <JWT>` (Role: `customer`)
- **Header:** `Idempotency-Key: <UUID>`

**Request Body:**
```json
{
  "serviceTypeId": "package",
  "quoteId": "quote_8923a1",
  "itemDescription": "أوراق رسمية وتقارير طبية",
  "specialInstructions": "التسليم بالدور الثاني بمستشفى الباجور العام",
  "pickup": {
    "landmarkName": "ميدان المحطة - وسط الباجور",
    "detailedAddress": "برج الشروق، الدور الأرضي",
    "contactPhone": "+201012345678"
  },
  "dropoff": {
    "landmarkName": "مستشفى الباجور العام",
    "detailedAddress": "قسم العيادات الخارجية",
    "contactPhone": "+201198765432"
  },
  "paymentMethod": "cash_on_delivery"
}
```

### 4.2 Cancel Order
`POST /api/v1/orders/:id/cancel`
- **Auth:** `Bearer <JWT>` (Customer owner, or Operations)

**Request Body:**
```json
{
  "cancellationReason": "تأخر الاستلام من المتجر"
}
```

### 4.3 Update Order Status (Authoritative FSM Transition)
`POST /api/v1/orders/:id/transitions`
- **Auth:** `Bearer <JWT>` (Assigned Captain, Merchant, or Operations)

**Request Body:**
```json
{
  "targetStatus": "at_pickup", // 'at_pickup' | 'in_transit' | 'delivered'
  "actorRole": "captain",
  "notes": "الكابتن وصل أمام برج الشروق"
}
```

---

## 5. Captain Fleet & Subscription Endpoints

### 5.1 Check Captain Assignment Eligibility
`GET /api/v1/captain/eligibility`
- **Auth:** `Bearer <JWT>` (Role: `captain`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isEligibleForNewOffers": true,
    "subscriptionStatus": "grace_period",
    "gracePeriodEndsAt": "2026-10-15T18:00:00.000Z",
    "warningMessageAr": "تنبيه: أنت الآن في فترة السماح (متبقي 48 ساعة). يرجى تجديد الاشتراك الشهري لتجنب إيقاف الرادار.",
    "cashHoldingPiasters": 45000,
    "maxCashHoldingPiasters": 100000,
    "cashLimitReached": false
  }
}
```

### 5.2 View Captain Subscription Status
`GET /api/v1/captain/subscription`
- **Auth:** `Bearer <JWT>` (Role: `captain`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "subscriptionId": "sub_01a98e",
    "planCode": "EL_BAGOUR_MONTHLY_STANDARD",
    "planNameAr": "اشتراك الباجور الشهري الموحد",
    "status": "active",
    "pricePiasters": 25000,
    "formattedPrice": "250.00 ج.م",
    "currentPeriodEndsAt": "2026-11-13T20:00:00.000Z",
    "daysRemaining": 30,
    "autoRenew": false
  }
}
```

### 5.3 Purchase or Renew Subscription
`POST /api/v1/captain/subscription/renew`
- **Auth:** `Bearer <JWT>` (Role: `captain`)

**Request Body:**
```json
{
  "planCode": "EL_BAGOUR_MONTHLY_STANDARD",
  "paymentMethod": "cash_at_hub", // 'cash_at_hub' | 'vodafone_cash' | 'fawry' | 'electronic_card'
  "transactionReference": "TX-VODA-98214"
}
```

### 5.4 Record Cash Collection (Doorstep COD)
`POST /api/v1/captain/orders/:id/cash-collection`
- **Auth:** `Bearer <JWT>` (Assigned Captain)

**Request Body:**
```json
{
  "amountCollectedPiasters": 3120, // Must match or explain discrepancy
  "customerConfirmed": true,
  "notes": "تم تحصيل المبلغ نقداً بالكامل"
}
```

---

## 6. Electronic Payments & Webhook Endpoints

### 6.1 Create Electronic Payment Intent
`POST /api/v1/payments/intents`
- **Auth:** `Bearer <JWT>` (Customer owner)

**Request Body:**
```json
{
  "orderId": "91a82f12-...",
  "provider": "paymob"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "paymentIntentId": "pi_98231a",
    "amountPiasters": 3120,
    "currency": "EGP",
    "clientSecret": "tok_ephem_98210381023",
    "providerReference": "PAYMOB-1092830"
  }
}
```

### 6.2 Process Verified Payment Webhook (Idempotent)
`POST /api/v1/webhooks/payments/:provider`
- **Auth:** HMAC Signature Header (`x-provider-signature`)
- **Public URL called by Gateway Servers**

**Response (200 OK):**
```json
{
  "received": true,
  "status": "PROCESSED"
}
```

### 6.3 Initiate and Record Refund
`POST /api/v1/operations/payments/:paymentId/refund`
- **Auth:** `Bearer <JWT>` (Role: `operations_agent` or `super_admin`)

**Request Body:**
```json
{
  "amountPiasters": 3120,
  "reason": "إلغاء الطلب قبل إسناد الكابتن"
}
```

---

## 7. Operations Order Assignment & Override Endpoints

### 7.1 Manual Captain Assignment / Reassignment
`POST /api/v1/operations/orders/:id/assign`
- **Auth:** `Bearer <JWT>` (Role: `operations_agent` or `super_admin`)

**Request Body:**
```json
{
  "captainId": "cap_891230",
  "overrideReason": "إعادة توجيه يدوية بسبب تعطل دراجة الكابتن السابق"
}
```
