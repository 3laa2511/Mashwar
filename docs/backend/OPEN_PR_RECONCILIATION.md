# Mashwar — Open PR Reconciliation & Merge Order

**Prepared:** 2026-10-28
**Purpose:** Avoid losing security fixes when several draft PRs change the same API routes.
**Rule:** This is a review plan, not authorization to merge. Do not merge drafts or deploy based only on this document.

## Verified remote facts

- The reported Phase 1 short SHA `6bbcaae` is not resolvable in the remote repository, and the reported branch `feat/phase-1-security-hardening` was not present in the fetched branch listing.
- `backend/src/api/routes.ts` is modified by PRs #2, #7, #10, and #11. These must be rebased/combined and tested as a single coherent route stack before merge.
- PR #11 adds server-verified Supabase principals and route ownership checks, but its own description explicitly says persistence remains in-memory, captain profile mapping is not database-backed, cash operations are not atomic, and tests/CI still need verification.
- PR #10 disables client-selected electronic-payment success and initializes new orders as unpaid. This must remain in effect until a real provider verifies payment.
- PR #7 disables unauthenticated cash collection until authenticated identity and exact fare matching are available.
- PR #2 disables unverified electronic-payment flows and overlaps the same routes/tests.
- PR #6 touches the quality workflow, backend routes/store, Flutter and root app. Its checks must be confirmed on the latest relevant commit before using its changes as a baseline.
- PR #8 is a UI-only light dashboard refresh and still uses demo data; do not treat it as live operations.
- PR #9 and PR #12 are documentation/release-gate PRs.
- The CI run for PR #12 was observed as `in_progress` at inspection time; this is not a pass.

## Recommended integration order

1. **Quality baseline:** inspect the latest PR #6 CI results; fix only concrete failures in a focused PR. Ensure the quality workflow exists on the base branch before interpreting other PRs' check status.
2. **API payment fail-closed behavior:** combine/rebase #2, #7, and #10 carefully because they edit the same `routes.ts` and test file. Preserve all fail-closed protections.
3. **Authentication and ownership:** rebase #11 onto the reconciled route baseline, then run positive and negative authorization tests. Do not allow caller-provided role, captain ID, actor headers, or payment status to establish identity/trust.
4. **Persistence slice:** only after #11's principal shape and route contracts are stable, implement PostgreSQL-backed repositories and transaction services on a new branch based on the reviewed integration head. Do not stack on an arbitrary draft branch.
5. **UI:** keep #8 separate until real authenticated endpoints are ready; replace demo state with server data in a later vertical-slice PR.
6. **Documentation:** retain #9 and #12 as release gates; reconcile duplicate wording after the runtime contracts settle.

## Non-negotiable merge gates

- Current branch/commit and CI checks are explicitly recorded for every PR.
- Backend typecheck, tests, and build pass on the exact proposed merge head.
- Flutter dependency resolution, analysis, and tests pass where relevant.
- Real PostgreSQL integration tests cover migration execution, restart persistence, transaction rollback, concurrent settlements, idempotency, and role boundaries.
- No production database changes, merge to `main`, or deployment without the user's explicit approval.

## Phase 2 implementation starting point

Do not write migration 003 just to add tables. The current schema already includes `financial_ledger`, `cash_collections`, `merchant_subscriptions`, `complaints`, `complaint_events`, and `idempotency_keys`. First compare schema DDL to actual route/service usage, then add only missing structures (likely audit/system settings or a dedicated refund request workflow if complaint events cannot express approvals safely). Ensure the migrator actually registers each migration before adding one.
