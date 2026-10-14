# Mashwar — Location-Based Dispatch Specification

**Status:** Architecture specification; does not imply that GPS, maps, routing, or live tracking are integrated.

## 1. Order location model

Each order stores immutable pickup/drop-off coordinate snapshots, normalized address labels, the selected service area, and a location accuracy/source timestamp where applicable. Coordinates are collected only with user permission. Allow manual map pin/address selection when GPS is unavailable; do not block the entire journey solely because device location permission is denied. Validate latitude/longitude ranges and ensure points fall inside the active service area.

Do not expose precise customer addresses to unrelated captains. Share the pickup/drop-off details only with the assigned captain and authorized operational staff, at the minimum point in the order lifecycle necessary.

## 2. Candidate eligibility before proximity ranking

Filter candidates before ranking:
1. Account and identity verification approved.
2. Online, available, and location update sufficiently fresh.
3. Active subscription or explicitly configured grace policy.
4. Compatible vehicle/service type and permitted package constraints.
5. Captain is opted into the relevant active service area.
6. No conflicting active assignment and any operational/cash limits pass.
7. Coordinates and accuracy are acceptable.

A nearest but ineligible captain must never be selected.

## 3. Distance and offer strategy

Use a `RoutingProvider` abstraction that returns road distance, ETA, provider/version, and failure metadata. Straight-line distance may be a cheap candidate pre-filter, but must not be presented as road distance or precise ETA. Provider choice (OSRM, Google Maps, or other) is an open cost/privacy/accuracy decision.

Dispatch should:
- Query eligible candidates within a configurable search region.
- Rank by road ETA/distance and documented tie-breakers (for example availability age and fairness), not by an undocumented hidden score.
- Send time-bounded offers in controlled waves; do not reveal customer data before acceptance.
- Atomically claim the order using a database transaction/row lock and a unique constraint for active assignment.
- Use durable offer/idempotency records; an in-process mutex is insufficient across restarts or multiple backend instances.
- Expand search radius/area only according to configured rules and never silently cross a service-area boundary.
- Return a queued/no-captain state with clear customer messaging if no eligible captain is available.
- Reconcile late acceptance, expired offers, cancellation, and duplicate requests safely.

## 4. Location privacy and abuse controls

- Require OS permission and explain why location is needed; collect background location only when legally necessary and explicitly disclosed.
- Record only necessary location samples; apply retention limits and access controls.
- Rate-limit location updates; reject impossible jumps, invalid timestamps, and repeated spoof patterns for risk review.
- Do not claim continuous live tracking unless client collection, transport, authorization, and UI rendering are all operational.
- Never trust coordinates supplied by the customer as proof of a captain's live location.
- Log access to exact coordinates and redact them from routine logs.

## 5. Failure behavior

If GPS, geocoding, or routing is unavailable, degrade explicitly: allow manual address capture where safe, provide a broad estimate only if backed by an approved fallback, or queue for manual operations. Never fabricate route lines, distance, ETA, or captain movement. Keep provider API keys server-side and apply quotas/cost alerts.

## 6. Acceptance tests

- Customer outside all active service areas cannot place an unsupported delivery.
- Nearest captain is excluded when unverified, offline, stale, unsubscribed beyond policy, incompatible, or already assigned.
- Two simultaneous acceptances result in exactly one durable assignment.
- A server restart does not erase order, offer, or idempotency state.
- Routing-provider timeout produces an explicit fallback/error state rather than a fake ETA.
- A captain cannot fetch an unassigned customer's precise address.
- Synthetic second-city tests prove dispatch does not assume El Bagour.
