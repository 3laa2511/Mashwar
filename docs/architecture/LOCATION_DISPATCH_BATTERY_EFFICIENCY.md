# Mashwar Location, Dispatch & Battery Efficiency Architecture

Status: implementation specification; this does not claim the capabilities are already live.
Applies to customer app, captain app, merchant workflows, dispatch backend, and operations dashboard.
Initial rollout: El Bagour, with service areas and routing providers configured server-side.

## Product goal

Provide dependable ETA and dispatch using the least location collection and battery power that can satisfy the active task. "Always on" must not mean high-frequency GPS and network uploads all day. Location collection is purpose-bound, visible, permission-based, adaptive, and stopped when no longer needed.

## Core principles

1. **Track only when needed.** Customer location is used to select or confirm an address; ordinary browsing does not continuously track. Captain tracking runs only while explicitly online/available or completing an active delivery, according to the disclosed policy and platform permissions. Stop or downgrade tracking after going offline, finishing/cancelling a job, or losing permission.
2. **Adaptive sampling.** Choose the lowest-power profile that meets current dispatch/ETA needs. Consider app state, speed/activity, distance moved, accuracy, network, battery state, active order phase, and freshness of last fix. Avoid fixed high-frequency GPS in every state.
3. **Server is authoritative.** Validate actor, session, active shift, assigned order, service area, timestamp, accuracy, and sequence before accepting location or state transitions. Client coordinates never grant access or prove delivery by themselves.
4. **Transparent permissions.** Explain background location before requesting it. Ask for foreground permission first, then background only when a feature genuinely needs it. If denied or revoked, degrade gracefully and disclose that tracking is unavailable.
5. **Privacy by design.** Collect minimum necessary coordinates; restrict visibility to authorized participants and operations staff with a business need. Never expose a captain's live location to unrelated customers or merchants. Use retention limits, access audit, TLS, private storage, and a policy reviewed for local law.
6. **No false precision.** Show last-updated time and an uncertainty/stale state when location is old, inaccurate, mocked, unavailable, or delayed. ETA is an estimate, not a guarantee.
7. **No silent failure.** If tracking stalls, dispatch applies freshness penalties to the last known fix, requests a new fix when appropriate, and escalates to manual dispatch when confidence is insufficient.

## Location lifecycle and modes

- **Customer browsing:** no continuous tracking. Take one foreground fix only when the customer requests nearby options or confirms a map pin; allow manual address and map-pin fallback.
- **Captain offline:** no app-initiated continuous polling. Optional OS geofencing/significant-change behavior only if later justified and disclosed.
- **Captain online but idle:** low-power, meaningful-change updates for nearby dispatch. Do not promise second-by-second tracking while idle.
- **Offer/assignment pending:** temporarily increase freshness around the offer decision, without broadcasting high precision to every client. Use a short-lived snapshot with timestamp and accuracy.
- **Active pickup/delivery:** use platform-compliant foreground/background location only as permitted and clearly disclosed. Adapt update cadence to movement and route; use higher precision when approaching pickup/drop-off or navigating, and reduce frequency when stationary.
- **Delivered/cancelled/shift ended/offline:** stop active tracking and clear active-order sharing grants. Persist only the minimum event history needed for operations, disputes, and legal retention.
- **Permission disabled, battery saver, OS throttling, app force-closed, or network unavailable:** surface tracking health and last-seen time; never claim a live location. Resume with backoff when possible.

Exact intervals and distance thresholds must be selected through device testing and field trials, then remotely configurable. Do not hard-code a single interval as universally optimal.

## Battery and network strategy

- Use platform-native location APIs and Flutter integrations that correctly support lifecycle-aware background updates on Android and iOS.
- Request the lowest accuracy/priority and largest practical distance filter for the current mode; pause updates when stationary when platform APIs permit.
- Batch/coalesce updates; send only meaningful movement or accuracy changes, not duplicate coordinates.
- Use bounded queues with timestamps and sequence numbers for temporary offline buffering. Avoid storing unnecessary trails. Upload with backoff and jitter; discard superseded low-value samples.
- Compress payloads, avoid needless polling when push/realtime events can notify state changes, and use exponential backoff offline.
- Do not keep a wake lock or foreground service running outside the explicit tracking lifecycle. Respect OS restrictions and battery saver.
- Do not promise zero battery impact: background location necessarily consumes power. Optimize and measure across real devices, OS versions, low-end Android phones, and iPhones.

## Dispatch algorithm: eligibility first, ranking second

### Stage 1 — hard eligibility filters
Exclude a captain who is not verified/active, is offline, lacks a usable fresh location for the required service, is suspended, lacks the required vehicle/capacity, exceeds capacity, is outside service/shift rules, has an incompatible assignment, or fails safety/business constraints. Missing/stale location is not treated as an exact point.

### Stage 2 — candidate retrieval
Use a geospatial index such as PostgreSQL/PostGIS to retrieve a bounded candidate set within a configurable radius. Expand the radius in stages when no viable candidates exist. Do not calculate every captain against every order at scale.

### Stage 3 — road-aware ETA
Use straight-line distance only as a cheap prefilter. Rank finalists using road travel time/distance from a routing provider, including traffic and road constraints where available. Cache results briefly and invalidate when locations or conditions materially change. Keep provider calls server-side; define quotas, cost alerts, retries, timeouts, and deterministic fallback.

### Stage 4 — documented ranking score
Use a versioned configurable score that considers:
- expected time to pickup (primary);
- probability of accepting and completing within SLA;
- current workload, capacity and delivery compatibility;
- detour cost and impact on existing orders;
- fairness in recent workload/opportunity distribution;
- location freshness and accuracy penalty;
- service quality/reliability signals, with safeguards against unfair feedback loops.

Normalize features, cap outliers, log score components for audits, and evaluate bias and operational outcomes. Never rank solely by straight-line distance or raw star rating.

### Stage 5 — offer and assignment concurrency
Use durable database state, transactions, idempotency keys, and a short-lived assignment lease/atomic conditional update so workers cannot assign the same order/captain inconsistently. Offer sequentially or in a small controlled batch with expiry. A timeout/rejection advances the candidate list; no eligible candidate triggers radius expansion and then explicit operations fallback. In-memory Maps or a local Mutex are not production coordination.

### Stage 6 — multi-stop batching
Combine deliveries only when merchant readiness, promised windows, food safety, capacity, service type, and detour limits are compatible. Optimize stop order with a routing provider or measured algorithm; reject a batch that breaches SLA or harms existing customers. Start with simple constraints and add complexity only after collecting evidence.

### Stage 7 — continuous re-evaluation
Recompute ETA and assignment risk on meaningful events (location change, pickup ready, delay, cancellation, supported traffic change), not every UI render. Reassign only under explicit thresholds to prevent oscillation. Explain relevant changes to dispatch operators.

## ETA model

ETA = travel to pickup + estimated preparation/readiness + pickup handling + road travel to drop-off + handoff time + calibrated uncertainty buffer. Use historical outcomes only after enough reliable data exists; start with transparent rules, then evaluate predictive models. Track median and p90 ETA error by service area, time of day, vehicle type, and order category. Never show a precise-looking ETA if inputs are stale or low-confidence.

## API and event contract requirements

- Store fixes with actor/device, coordinates, observedAt, receivedAt, horizontal accuracy, speed/heading when available, sequence number, source/mode, and optional integrity indicators. Validate ranges/timestamps; reject implausible jumps or mark for review.
- Use an authenticated, short-lived, actor-scoped location write endpoint; rate-limit and cap payload size. Client-provided actor ID or tenant/branch scope is never trusted authority.
- Realtime subscribers receive only the minimum location/ETA fields allowed by their order relationship and current state.
- Use durable events/outbox for assignment, accept/reject, pickup, delivery, stale-location, and tracking-stopped events. Consumers must be idempotent.
- Keep operational telemetry (stale rate, update latency, network bytes, routing latency/cost, no-candidate rate, ETA error, reassignment rate) separate from personally identifying location history.

## Safety, abuse and reliability controls

- Prevent replay with timestamps/sequence numbers and authenticated requests. Apply plausibility checks to speed/jumps without claiming spoofing can be perfectly detected.
- Delivery completion needs the defined business proof, such as customer confirmation or an approved OTP/evidence flow; coordinates alone are not proof.
- Restrict identity evidence to authorized review roles; never include it in customer APIs or logs.
- Protect APIs with authorization on every resource, rate limits, schema validation, audit events, service-area isolation, and private object storage.
- Route-provider failure must not block order creation. Degrade to a clearly marked estimate or manual dispatch, never fake a successful assignment.
- Passenger transport remains disabled pending separate legal, licensing, insurance, and safety approval.

## Observability and acceptance gates

Measure on representative low-end Android and iOS devices:
- battery drain for idle-online, active-delivery, stationary, and poor-network scenarios;
- location freshness/latency and permission-denial behavior;
- network bytes per delivery and reconnect/buffer correctness;
- dispatch p50/p95 latency, no-candidate rate, assignment conflicts, and duplicate events;
- ETA median/p90 error, on-time delivery, captain utilization, and customer impact from batching;
- privacy access checks and retention/deletion behavior.

Release gates:
1. Unit tests for mode transitions, sampling policy, stale fixes, eligibility, ranking, batching, and fallback.
2. Integration tests for concurrent assignment, retries, duplicate/out-of-order events, offline buffering, permission revocation, app backgrounding, and OS throttling.
3. Load tests with realistic order/captain distributions and routing quotas/cost.
4. Controlled field pilot with informed captains and documented battery/ETA thresholds.
5. Feature-flag rollout per service area; monitor and roll back on defined reliability, cost, or battery regressions.

## Implementation sequence

1. Stabilize Flutter CI and establish a device/test baseline.
2. Define typed location/dispatch API contracts and service-area configuration.
3. Implement authenticated location lifecycle, durable PostgreSQL/PostGIS storage/indexes, retention, and RLS/access tests.
4. Implement eligibility filters, geospatial candidate retrieval, atomic assignment leases, and deterministic fallback.
5. Add routing-provider abstraction, route matrix/ETA caching, cost controls, and provider-independent tests.
6. Implement native lifecycle-aware adaptive sampling and battery measurement on Android/iOS.
7. Add authorized realtime order tracking, stale indicators, dispatch workspace, and audit events.
8. Add batching/route optimization only after single-order dispatch meets acceptance gates.
9. Run a controlled local pilot; tune from measured results before expanding coverage.

## Research references

- Apple, Getting the current location efficiently: https://developer.apple.com/documentation/corelocation/getting-the-current-location-of-a-device
- Apple, Accessing location efficiently: https://developer.apple.com/documentation/xcode/accessing-the-device-s-location-efficiently
- Android, Background location and battery: https://developer.android.com/develop/sensors-and-location/location/battery
- Android, Background location limits: https://developer.android.com/about/versions/oreo/background-location-limits
- Google Maps Routes API, Compute Route Matrix: https://developers.google.com/maps/documentation/routes/compute_route_matrix
- Google Maps Route Optimization API: https://developers.google.com/maps/documentation/route-optimization

These references inform the design. Provider choice, prices, platform permission behavior, legal policy, and production performance must be verified before implementation/deployment.
