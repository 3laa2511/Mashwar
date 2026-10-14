# Mashwar — REST API Specification & Service Contracts
**Protocol:** HTTPS REST / JSON  
**Base URL:** `/api/v1`  
**Authentication:** HTTP Authorization Header: `Bearer <JWT_ACCESS_TOKEN>`  
**Phase:** Phase 2 Backend Specification  

---

## 1. Global API Conventions

### 1.1 Standard Response Envelope
All API responses follow a consistent envelope structure:

```json
// Success Response
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-10-13T19:42:00.000Z",
    "requestId": "req_01j9a8bc45"
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ASSIGNED",
    "message": "عذراً، تم إسناد هذا المشوار لكابتن آخر بالفعل.",
    "details": null
  },
  "meta": {
    "timestamp": "2026-10-13T19:42:00.000Z",
    "requestId": "req_01j9a8bc45"
  }
}
```

### 1.2 HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Malformed payload or failed Zod validation.
- `401 Unauthorized`: Missing, invalid, or expired JWT.
- `403 Forbidden`: Authenticated user lacks required role/permission.
- `404 Not Found`: Resource does not exist or does not belong to the user.
- `409 Conflict`: Concurrency conflict or race condition (e.g. another captain accepted the order first).
- `422 Unprocessable Entity`: Business invariant violated (e.g. attempting to order passenger transport).
- `429 Too Many Requests`: Rate limit exceeded.

### 1.3 Headers
- `Authorization: Bearer <token>`: Required for all authenticated routes.
- `Idempotency-Key: <UUID>`: Recommended for mutating requests (`POST /orders`, `POST /orders/:id/transitions`) to prevent duplicate execution during network retries.
- `Accept-Language: ar | en`: Controls localized error and status messages (defaults to `ar`).

---

## 2. Authentication & Identity Contracts

### 2.1 Request SMS OTP
`POST /api/v1/auth/request-otp`
- **Auth:** Public
- **Rate Limit:** 3 requests per 10 minutes per IP / phone.

**Request Body:**
```json
{
  "phoneNumber": "+201012345678"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "phoneNumber": "+201012345678",
    "retryAfterSeconds": 60,
    "isDemoMode": true,
    "demoCodeNotice": "In demo mode, use 1234 as the verification code."
  }
}
```

### 2.2 Verify SMS OTP
`POST /api/v1/auth/verify-otp`
- **Auth:** Public

**Request Body:**
```json
{
  "phoneNumber": "+201012345678",
  "otpCode": "1234"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "7b053d56-7594-4aa2-9bd4-ba97a6a82f92",
      "phoneNumber": "+201012345678",
      "roles": ["customer"]
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsIn...",
      "expiresInSeconds": 900,
      "refreshToken": "d8f498c1-..."
    }
  }
}
```

---

## 3. Customer Profile & Addresses

### 3.1 Get Customer Saved Addresses
`GET /api/v1/customer/addresses`
- **Auth:** `Bearer <JWT>` (Role: `customer`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "9a12c412-...",
      "label": "المنزل",
      "landmarkName": "ميدان المحطة - وسط الباجور",
      "detailedAddress": "شارع الجيش، عمارة الأمل، الدور الثالث",
      "isRuralOrVillage": false,
      "villageName": null,
      "isDefault": true
    }
  ]
}
```

---

## 4. Quoting & Pricing Contracts

### 4.1 Request Authoritative Fare Quote
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
    "baseFare": 15.00,
    "distanceFare": 9.20,
    "ruralSurcharge": 5.00,
    "platformFee": 2.00,
    "totalFare": 31.20,
    "currency": "EGP",
    "estimatedDurationMinutes": "15-20",
    "expiresAt": "2026-10-13T20:15:00.000Z",
    "lineItems": [
      { "title": "الأجرة الأساسية (تغطي أول 1.5 كم)", "amount": 15.00 },
      { "title": "تكلفة المسافة (2.3 كم إضافي)", "amount": 9.20 },
      { "title": "بدل طرق غير ممهدة / قرى", "amount": 5.00 },
      { "title": "رسوم الخدمة وتطوير المنصة", "amount": 2.00 }
    ]
  }
}
```

---

## 5. Order Management Contracts

### 5.1 Create Order
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

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "orderId": "91a82f12-...",
    "orderCode": "MSH-8105",
    "status": "searching_captain",
    "serviceType": "package",
    "quotedFare": 31.20,
    "createdAt": "2026-10-13T20:05:00.000Z"
  }
}
```

### 5.2 Get Order Details & Tracking
`GET /api/v1/orders/:id`
- **Auth:** `Bearer <JWT>` (Customer owner, assigned Captain, or Operations)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "orderId": "91a82f12-...",
    "orderCode": "MSH-8105",
    "status": "in_transit",
    "statusLabelAr": "في الطريق للتسليم",
    "serviceType": "package",
    "quotedFare": 31.20,
    "pickup": {
      "landmarkName": "ميدان المحطة - وسط الباجور",
      "detailedAddress": "برج الشروق، الدور الأرضي"
    },
    "dropoff": {
      "landmarkName": "مستشفى الباجور العام",
      "detailedAddress": "قسم العيادات الخارجية"
    },
    "assignedCaptain": {
      "name": "كابتن طارق الغريب",
      "vehicleDescription": "دراجة نارية هوجان سوداء (٤٣٢١ م ن)",
      "phone": "+201198765432"
    },
    "timeline": [
      { "status": "created", "timestamp": "2026-10-13T20:05:00.000Z" },
      { "status": "captain_assigned", "timestamp": "2026-10-13T20:07:30.000Z" },
      { "status": "at_pickup", "timestamp": "2026-10-13T20:12:00.000Z" },
      { "status": "in_transit", "timestamp": "2026-10-13T20:16:00.000Z" }
    ]
  }
}
```

### 5.3 Cancel Order
`POST /api/v1/orders/:id/cancel`
- **Auth:** `Bearer <JWT>` (Customer owner or Operations)

**Request Body:**
```json
{
  "reason": "تأخر الاستلام من المتجر"
}
```

---

## 6. Captain Fleet Contracts

### 6.1 Toggle Availability
`POST /api/v1/captain/availability`
- **Auth:** `Bearer <JWT>` (Role: `captain`)

**Request Body:**
```json
{
  "isOnline": true,
  "currentLandmark": "مجلس مدينة الباجور"
}
```

### 6.2 Accept Delivery Offer (Atomic Race Protection)
`POST /api/v1/captain/offers/:assignmentId/accept`
- **Auth:** `Bearer <JWT>` (Role: `captain`)

**Possible Responses:**
- `200 OK`:
  ```json
  {
    "success": true,
    "data": {
      "orderId": "91a82f12-...",
      "orderCode": "MSH-8105",
      "status": "captain_assigned"
    }
  }
  ```
- `409 Conflict`:
  ```json
  {
    "success": false,
    "error": {
      "code": "OFFER_ALREADY_CLAIMED",
      "message": "عذراً، قام كابتن آخر بقبول هذا المشوار قبلك."
    }
  }
  ```

### 6.3 Advance Order Delivery Status
`POST /api/v1/captain/orders/:id/transition`
- **Auth:** `Bearer <JWT>` (Assigned Captain)

**Request Body:**
```json
{
  "targetStatus": "at_pickup", // 'at_pickup' -> 'in_transit' -> 'delivered'
  "cashCollectedAmount": 31.20 // Mandatory when targetStatus = 'delivered'
}
```

---

## 7. Merchant Contracts

### 7.1 Update Order Preparation Status
`POST /api/v1/merchant/orders/:id/preparation`
- **Auth:** `Bearer <JWT>` (Role: `merchant_staff` or `merchant_admin`)

**Request Body:**
```json
{
  "preparationStatus": "ready_for_pickup", // 'preparing' | 'ready_for_pickup'
  "estimatedReadyMinutes": 0
}
```

---

## 8. Operations & Administrative Contracts

### 8.1 Search & Monitor Field Orders
`GET /api/v1/operations/orders?status=active&hub=el_bagour`
- **Auth:** `Bearer <JWT>` (Role: `operations_agent` or `super_admin`)

### 8.2 System Health & Readiness Check
`GET /api/health`
- **Auth:** Public

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-10-13T20:05:00.000Z",
  "database": "connected",
  "environment": "staging",
  "version": "1.0.0"
}
```
