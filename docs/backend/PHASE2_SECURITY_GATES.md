# Phase 2 API Security Gates — Mashwar

Status: implementation gate / review checklist. This document does not claim authentication is implemented.

## Verified risks observed in backend/src/api/routes.ts

- POST /orders reads customerId, customer name, and phone from the request body. The server must derive the customer identity and contact details from a verified principal; body fields must not establish identity.
- GET /orders/:id returns an order after checking only that it exists. A random or leaked order ID must not grant access to customer addresses, phone numbers, or order details.
- POST /orders/:id/transitions trusts caller-supplied actorId and actorRole.
- POST /orders/:id/cancel trusts caller-supplied actorId and actorRole when evaluating cancellation policy.
- POST /captain/orders/:id/accept trusts caller-supplied captainId.
- Cash collection must remain disabled until the verified captain is assigned to the order and the amount equals the server-authoritative amount due.
- Electronic payment routes must remain disabled until a real provider integration and verified webhook path are configured. A client request must never mark an order paid.

## Required design before enabling these routes

1. **Verified principal:** authentication middleware validates a signed, expiring session/token and sets a server-owned principal (userId, role, and account status). Never build the principal from request-body, query-string, or client-controlled role fields.
2. **Role and resource authorization:** each mutation checks the verified role plus resource ownership/assignment in the database. A customer can access only their own orders; a captain can mutate only an order assigned to that captain; merchants can access only their own store and related orders; operations actions require explicit permissions.
3. **Server-owned financial state:** calculate totals from trusted quote/order data; reject non-finite, negative, fractional-piaster, and out-of-range amounts. Do not let a request body set isPaid, collected amounts, captain cash balances, or final fares.
4. **Atomic state changes:** persist assignment, transition, cash ledger entries, and idempotency records transactionally. Enforce a unique active captain assignment and idempotency keys at the database level.
5. **Safe reads:** apply authorization before returning order details; use generic errors where revealing existence would leak resources.
6. **Operational safeguards:** request-size limits, schema validation, rate limits for authentication and sensitive mutations, restrictive CORS, security headers, HTTPS in deployment, secret management, and structured logs without tokens or sensitive customer data.

## Minimum integration-test matrix

- No credentials: order creation, transition, cancellation, captain acceptance, and cash collection are rejected without database mutation.
- Customer A cannot read, cancel, or mutate Customer B's order, even when A knows B's order ID.
- A customer cannot promote themselves by sending actorRole: owner or another user's ID.
- Captain A cannot accept or mutate an order assigned to Captain B.
- A merchant cannot access another merchant's products, store, or orders.
- Cash collection fails for an unassigned captain, wrong amount, duplicate request, or non-COD order; balances and order state remain unchanged.
- Client-originated payment success never marks an order paid; only a verified, idempotent provider webhook can do so.
- Concurrent captain acceptance results in exactly one assignment.
- Rejected requests leave order state, payment state, and ledger balances unchanged.

## Release rule

Do not enable production traffic or represent the API as production-secure until the authentication provider/session design is implemented, the integration tests above pass against the actual API, database authorization is reviewed, and CI evidence is green. The existing demo role switcher is not authentication. This checklist does not replace implementation or test evidence.
