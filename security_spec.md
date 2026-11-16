# Mashwar Firestore Security Specification (Phase 0 TDD)

## 1. Core Data Invariants
1. **Fail-Closed Authentication**: All user-owned writes and private reads require `request.auth != null` and verified Google accounts (`request.auth.token.email_verified == true`).
2. **Role Immutability & Anti-Escalation**: Regular users creating `/users/{userId}` can ONLY initialize `role == 'customer'` and `cashbackBalancePiasters == 2500` (welcome bonus). Only verified Admin (`Alaa.moagaza2016@gmail.com` with `email_verified == true` or `/admins/{uid}`) can elevate roles (`captain`, `merchant`, `owner`) or mark a driver `isVerified: true`.
3. **PII Isolation**: User `email`, `phone`, and account details under `/users/{userId}` are readable only by `userId == request.auth.uid` or Admin. Public driver matching reads `/driverProfiles/{driverId}` which contains zero phone numbers or national IDs.
4. **Master Gate Chat Isolation**: `/threads/{threadId}/messages/{messageId}` checks parent `/orders/{threadId}` or `/rides/{threadId}` via `get()` so only the order/ride customer, assigned captain/driver, or Admin can read/post chat messages.
5. **Terminal State Locking**: Once an order reaches `delivered` or `cancelled`, or a ride reaches `completed` or `cancelled`, non-admin clients cannot reopen or mutate its status.
6. **Immutable Cashback Ledger**: `/users/{userId}/walletTransactions/{txId}` forbids updates/deletes (`allow update, delete: if false`) and validates positive bounded integer amounts tied to an existing `orderId` or `rideId`.

## 2. "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Order Write**: Creating `/orders/ord_1` with `request.auth == null`.
2. **Self-Role Escalation on Registration**: Creating `/users/uid_1` with `role: "owner"` by a non-admin email.
3. **Shadow Ghost Field Injection**: Updating `/orders/ord_1` with `{ status: "delivered", hackedFlag: true }`.
4. **Email Spoof Without Verification**: Accessing Admin privileges with `email: "Alaa.moagaza2016@gmail.com"` and `email_verified: false`.
5. **PII Blanket Read**: Reading `/users/other_uid` as a non-admin authenticated user.
6. **ID Poisoning**: Creating `/orders/` with a 300-character ID or invalid `/` characters.
7. **Terminal State Re-opening**: Customer/Captain updating an already `delivered` order back to `in_transit`.
8. **Unverified Driver Hijack**: Non-verified user assigning themselves (`assignedDriverId`) to someone else's `/rides/ride_1`.
9. **Other Merchant Menu Tampering**: Merchant A updating `/products/prod_store_B` owned by Merchant B.
10. **Fake Cashback Minting**: Creating a `cashback_earn` wallet transaction of `500000` piasters referencing a non-existent `orderId`.
11. **Timestamp Forgery**: Creating `/rides/ride_1` with client-backdated `createdAt` instead of `request.time`.
12. **Cross-Thread Chat Eavesdropping**: User C reading `/threads/ord_1/messages` when `ord_1` belongs to Customer A and Captain B.
