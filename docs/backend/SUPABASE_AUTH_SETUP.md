# Supabase Auth verification — Phase 2

## Runtime configuration

The API requires these server-side environment variables to verify bearer tokens:

- `SUPABASE_URL`: project URL, without a trailing slash.
- `SUPABASE_ANON_KEY`: the project's public anon key, used only as the `apikey` header when calling Supabase Auth. Never expose a service-role key to clients.

The middleware calls `GET /auth/v1/user` with the presented bearer token. A successful response identifies the user; invalid/expired tokens are rejected. If the provider is unavailable or configuration is missing, the API fails closed for requests that need authentication.

## Role provisioning

The API reads the role only from Supabase `app_metadata.role`. It deliberately does not read `user_metadata`, request bodies, query parameters, or `X-Actor-Role` as the source of authority.

Only a trusted server-side administrative process may assign `app_metadata.role`. Do not allow clients to update this field. Supported role values:

- `owner`
- `operations_dispatcher`
- `support_agent`
- `captain`
- `customer`
- `merchant`

Accounts without a recognized role are denied. Before production, define and review a controlled role-provisioning workflow, including audit logging and removal/revocation behavior.

## Current security boundary and remaining work

This change verifies identity and attaches a trusted principal. It is not the completion of authorization:

- Order reads are restricted to the owning customer, assigned captain, or listed operations roles; cancellation and state transitions now perform ownership/role checks. These checks still need positive and negative regression tests.
- Captain identity is resolved from the verified user against the current in-memory captain profiles. This mapping is temporary and must move to durable database-backed identity records before production.
- Cash collection checks assignment, cash payment method, exact total in piasters, delivered state, and duplicate submission. It is not yet atomic or concurrency-safe and must be moved into a durable transaction with an idempotent ledger entry before production.
- Every admin operation must enforce its permission, and sensitive non-admin routes such as captain eligibility/subscription must not leak another user's information.
- The existing in-memory store is not production persistence.
- Add automated tests for valid, invalid, expired, unprovisioned-role, provider-timeout, and role/ownership abuse cases.

Do not deploy this change until CI passes, these remaining gates are closed, and production configuration is reviewed. No production secrets or database changes belong in this PR.
