# Mashwar — Formal Order Lifecycle & State Machine Specification
**Phase:** Phase 2 Specification  
**Component:** Domain State Engine  

---

## 1. Order Finite State Machine (FSM)

An order in Mashwar must progress strictly through predefined, auditable states. Arbitrary status jumps or backward steps are blocked by database constraints and service-layer validation.

```text
 ┌───────────────┐
 │    created    │
 └───────┬───────┘
         │ (Customer submits or Merchant confirms)
         ▼
 ┌───────────────────┐
 │ searching_captain │◀────────────────────────┐
 └───────┬───────────┘                         │
         │ (Captain accepts radar offer)       │ (Captain unassigns / timeout)
         ▼                                     │
 ┌───────────────────┐                         │
 │ captain_assigned  ├─────────────────────────┘
 └───────┬───────────┘
         │ (Captain confirms arrival at pickup landmark)
         ▼
 ┌───────────────────┐
 │     at_pickup     │
 └───────┬───────────┘
         │ (Captain confirms package receipt from sender/merchant)
         ▼
 ┌───────────────────┐
 │    in_transit     │
 └───────┬───────────┘
         │ (Captain delivers & collects cash / confirms payment)
         ▼
 ┌───────────────────┐
 │     delivered     │  [Terminal Success State]
 └───────────────────┘

 ─── Cancellation Paths ───
 Any state (except 'delivered') ──▶ [ cancelled ] [Terminal Abort State]
```

---

## 2. Transition Rules Matrix

| From State | To State | Authorized Actor | Preconditions & Validation Rules | Triggered Side Effects |
| :--- | :--- | :--- | :--- | :--- |
| `[None]` | `created` | Customer | Authoritative quote valid; pickup != drop-off; service type is enabled. | Calculates fare snapshot; creates `order_addresses`. |
| `created` | `searching_captain` | System / Customer | Valid payment method selected; no duplicate idempotency key. | Emits dispatch broadcast event to active captains within El Bagour radius. |
| `searching_captain` | `captain_assigned` | Captain (via Dispatch) | Atomic lock check: order must not be claimed; captain verification status must be `approved`. | Records `captain_assignments` (status: `accepted`); sends push notification to customer. |
| `captain_assigned` | `searching_captain` | System / Operations | Captain timeout (e.g. 15 min no movement) or emergency unassignment. | Archives assignment as `unassigned`; re-broadcasts to pool. |
| `captain_assigned` | `at_pickup` | Assigned Captain | Device GPS coordinates within 300m of pickup landmark, or manual confirmation in rural zones. | Updates customer tracking UI; notifies merchant if store order. |
| `at_pickup` | `in_transit` | Assigned Captain | Package inspection confirmed; item description verified. | Starts live delivery transit timer; updates status history. |
| `in_transit` | `delivered` | Assigned Captain | Cash collected amount verified against `quoted_fare_egp` (if COD). | Marks payment as `collected`; credits captain ledger; completes trip count. |
| `created` or `searching_captain` | `cancelled` | Customer | Reason provided. | Full refund if pre-paid; releases any active offers. |
| `captain_assigned` | `cancelled` | Customer / Ops | Cancellation fee applies if captain was already en route > 5 mins. | Charges cancellation fee; compensates assigned captain. |
| Any active state | `cancelled` | Operations Agent | Mandatory administrative override with audit note. | Logs audit entry with agent ID; releases all parties. |

---

## 3. Forbidden Transitions (Hard Invariants)

The state machine will reject the following transitions with HTTP `422 Unprocessable Entity`:
1. `delivered` → Any State (Delivered is strictly immutable and terminal).
2. `cancelled` → Any State (Cancelled is strictly immutable and terminal).
3. `created` → `in_transit` (Cannot skip captain assignment or pickup confirmation).
4. `searching_captain` → `at_pickup` (Cannot arrive at pickup without an assigned captain).
5. Any State → `passenger_transport` (Passenger transport is permanently rejected at state entry).

---

## 4. Concurrency & Double-Assignment Protection

When a delivery request is broadcast to multiple captains in El Bagour, multiple captains may tap "Accept" simultaneously.

### Atomic Claim Algorithm (PostgreSQL Transaction):
```typescript
async function acceptOrderOffer(orderId: string, captainId: string): Promise<Order> {
  return await db.transaction(async (tx) => {
    // 1. Acquire row-level exclusive lock on the order
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.status, 'searching_captain')))
      .for('update');

    if (!order) {
      throw new ConflictError('OFFER_ALREADY_CLAIMED', 'تم قبول هذا المشوار من كابتن آخر.');
    }

    // 2. Insert or update captain assignment to 'accepted'
    await tx.insert(captainAssignments).values({
      orderId,
      captainId,
      status: 'accepted',
      respondedAt: new Date(),
    });

    // 3. Update order status to 'captain_assigned'
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: 'captain_assigned',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();

    // 4. Log state transition
    await tx.insert(orderStatusHistory).values({
      orderId,
      fromStatus: 'searching_captain',
      toStatus: 'captain_assigned',
      actorRole: 'captain',
      notes: `تم قبول الطلب بواسطة كابتن: ${captainId}`,
    });

    return updatedOrder;
  });
}
```

The database unique partial index:
```sql
CREATE UNIQUE INDEX uq_order_active_captain_assignment 
ON captain_assignments (order_id) 
WHERE status = 'accepted';
```
guarantees that even if two transactions attempt to commit concurrently, the second transaction will fail with a unique constraint violation and receive HTTP `409 Conflict`.
