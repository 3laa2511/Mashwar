# Mashwar — Independent Patch Audit, Safe Integration & Defect Correction Report

**Repository Target:** `3laa2511/Mashwar`  
**Target Branch:** `security/fail-closed-order-authorization` (PR #11)  
**Audit Date:** 2026-10-23  
**Status:** AUDITED & DEFECTS CORRECTED (54/54 Passing Tests, Verified Clean Git Apply)

---

## 1. Environment and Repository Identity

- **Working Directory:** `/app/applet` (AI Studio sandbox environment).
- **Git Repository Status:** The sandbox environment was originally an exported workspace without a `.git` metadata directory. A local Git repository was initialized with dedicated branch `fix/mashwar-ci-security`.
- **Remote Connectivity:** `origin` is configured to `https://github.com/3laa2511/Mashwar.git`.
- **GitHub Authentication:** **NOT AVAILABLE / UNVERIFIED REMOTE.** The remote repository is private. Unauthenticated API calls return HTTP 404, and `git ls-remote` prompts for credentials (terminal prompts disabled). No GitHub personal access token or SSH private key is stored or available in the container.
- **Remote Push / PR Verification:** **BLOCKED / NOT PERFORMED.** No remote push, merge, deploy, or database migration was executed. All work is strictly prepared locally.

---

## 2. Artifact Inventory and Integrity

The following original artifacts were located and inspected in the workspace root:

| Artifact | Size | SHA-256 Checksum | Extraction Status | Integrity Assessment |
| :--- | :---: | :--- | :---: | :--- |
| `mashwar-security-hardening.zip` | 73,226 B | `2f4165d448c59368...` | Verified in `/tmp/audit_extracted_bundle` | Valid ZIP, 0 path traversals, 0 embedded secrets. |
| `mashwar-security-hardening.patch` | 139,956 B | `798aff2d18f1d109...` | Verified in `/tmp/audit_extracted_bundle` | **DEFECTIVE.** Lacked standard Git diff headers; failed `git apply --check`. |
| `MANIFEST.md` | 3,243 B | `46e2a134bd3cfc36...` | Preserved unchanged | Documented original 13 files. |

**Preservation Guarantee:** The original `mashwar-security-hardening.zip`, `mashwar-security-hardening.patch`, and `MANIFEST.md` files have been preserved completely unchanged.

---

## 3. Verified Repository Baseline

- **Repository Root:** `/app/applet`
- **Head Commit (Local):** `8f2715628dafaf30e820b63907b18c1fcb5e4a1f` (`feat(security): fail-closed auth, transactional cash collection, and CI workflow`)
- **Package Manager & Runtime:** **Bun** (v1.4.2 via `bun.lock`) with Node.js v22.
- **Tracked Security & Backend Files:** 13 core files in `backend/`, `docs/backend/`, `.github/workflows/`, and `package.json`.
- **Untracked UI Prototype Files:** Preserved completely without modification (`src/`, `index.html`, `flutter_mashwar/`, `metadata.json`, `vite.config.ts`).
- **PR #11 Historical Context:** Expected head SHA `5e293d9cb9c07fc11132556a419667d0591527df` could not be fetched due to lack of GitHub credentials.

---

## 4. Patch Compatibility & Audit Findings

### Patch Applicability
- **Original Patch (`mashwar-security-hardening.patch`):** **FAILED `git apply --check`**. The original patch was generated using string concatenation without `diff --git`, `new file mode 100644`, or `--- /dev/null` headers.
- **Corrected Patch (`audit_output/mashwar-corrected-patch.diff`):** **VERIFIED**. Tested via `git apply --check` in a clean Git workspace. Applies cleanly with zero errors.

### Change Inventory & Risk Assessment

| File Path | Type | Risk | Reason for Change |
| :--- | :---: | :---: | :--- |
| `backend/src/security/auth.ts` | NEW | Low | Zero-trust token verification, audience check, strict `app_metadata.role`, header stripping. |
| `backend/src/security/supabaseAuth.ts` | NEW | Low | Canonical alias module re-exporting `auth.ts` to prevent duplicate implementations. |
| `backend/src/services/cashCollectionService.ts` | NEW | Medium | Transactional cash collection with row locks (`FOR UPDATE`), idempotency payload check, order state checks. |
| `backend/src/api/routes.ts` | MODIFIED | Medium | Route integration with fail-closed authentication and server-derived customer/captain IDs. |
| `backend/src/database/schema.ts` | NEW | Low | Kysely database schema definition for PostgreSQL tables and integer piasters monetary types. |
| `backend/src/database/db.ts` | NEW | Low | Connection pool manager and Kysely client provider. |
| `backend/src/database/migrations/001_security_hardening.ts` | NEW | Medium | DDL migration with unique constraint on `idempotency_key` and composite indexes. |
| `backend/src/services/captainService.ts` | NEW | Low | Database-backed captain resolution from authenticated user `auth.uid()`. |
| `backend/src/types/index.ts` | MODIFIED | Low | Extended role union types for order state machine transitions. |
| `backend/tests/run_tests.ts` | MODIFIED | Low | 16 test suites covering 54 automated assertions. |
| `docs/backend/SUPABASE_AUTH_SETUP.md` | MODIFIED | Low | Architecture documentation, endpoint matrix, and staging verification guidelines. |
| `.github/workflows/quality.yml` | NEW | Low | GitHub Actions quality gate running lint, backend tests, and web build. |
| `package.json` | MODIFIED | Low | Added `pg`, `@types/pg`, and explicit `typecheck` script. |

---

## 5. Security Findings (Categorized by Severity)

### [CRITICAL] Defect 1: Synthetic Patch Format Incompatibility
- **Location:** `mashwar-security-hardening.patch`
- **Issue:** Patch was generated without standard Git diff metadata, causing `git apply --check` to fail immediately.
- **Resolution:** Generated standard Git unified diff format in `audit_output/mashwar-corrected-patch.diff` verified via `git apply`.

### [HIGH] Defect 2: Idempotency Key Payload Poisoning / Conflict
- **Location:** `backend/src/services/cashCollectionService.ts:95-132` and `:337-345`
- **Issue:** Replay requests with an existing idempotency key returned cached receipts without checking whether the `orderId`, `captainId`, or `amountPiasters` matched the original request.
- **Resolution:** Added strict validation comparing request payload against cached/stored collection records. Mismatched payloads are rejected with `409 IDEMPOTENCY_PAYLOAD_MISMATCH`.

### [HIGH] Defect 3: State Machine Bypass on Cash Collection
- **Location:** `backend/src/services/cashCollectionService.ts:165-200`
- **Issue:** Order status eligibility was not checked during cash collection, allowing cash collection on `cancelled` orders or un-dispatched (`created`) orders.
- **Resolution:** Enforced that orders must be in an active delivery state (`picked_up`, `in_transit`, `arrived_dropoff`, `delivered`). Cancelled orders are rejected with `400 ORDER_CANCELLED`; pre-dispatch orders with `400 ORDER_NOT_IN_DELIVERY`.

### [MEDIUM] Defect 4: Fallback to Top-Level `payload.role`
- **Location:** `backend/src/security/auth.ts:101`
- **Issue:** Role extraction used `(appMetadata.role || payload.role)`. Standard Supabase JWTs assign `role: 'authenticated'`. Custom roles must strictly be extracted from server-managed `app_metadata.role`.
- **Resolution:** Removed fallback; role is extracted exclusively from `appMetadata.role`. Added audience check (`aud: 'authenticated'`).

### [LOW] Defect 5: CI Step Naming and Script Parity
- **Location:** `package.json` and `.github/workflows/quality.yml`
- **Issue:** `tsc --noEmit` was executed under `"lint"` without an explicit `"typecheck"` script, and CI labeled it as lint without distinction.
- **Resolution:** Added explicit `"typecheck": "tsc --noEmit"` in `package.json` and updated workflow steps with accurate labels and directory existence guards for Flutter.

---

## 6. CI Workflow Findings

- **Workflow Path:** `.github/workflows/quality.yml`
- **Triggers:** `push` to `main`, `pull_request` targeting `main`.
- **Permissions:** Least-privilege `contents: read`.
- **Runtime:** `oven-sh/setup-bun@v2` with `bun install --frozen-lockfile`.
- **Scripts:** Runs `bun run typecheck`, `bun run test`, and `bun run build`.
- **Flutter Support:** Added conditional check `if: steps.check_flutter.outputs.has_flutter == 'true'` to prevent CI failures if the Flutter submodule or SDK is not initialized.

---

## 7. Tests Actually Executed

| Command | Directory | Exit Code | Result | Evidence |
| :--- | :---: | :---: | :---: | :--- |
| `bun run typecheck` (`tsc --noEmit`) | `/app/applet` | `0` | **VERIFIED PASS** | 0 TypeScript type errors. |
| `bun run test` (`tsx backend/tests/run_tests.ts`) | `/app/applet` | `0` | **VERIFIED PASS** | **`54/54 PASSED (0 FAILED)`** across 16 suites. |
| `bun run build` (`vite build`) | `/app/applet` | `0` | **VERIFIED PASS** | Built client bundle in 756ms. |
| `git apply --check audit_output/mashwar-corrected-patch.diff` | `/tmp/test_corrected_apply` | `0` | **VERIFIED PASS** | Applied cleanly without patch errors. |

---

## 8. PostgreSQL Tests: Executed vs Not Executed

- **Executed (In-Process Transactional Simulation):**
  - Atomic serialization under concurrency: 5 simultaneous requests with identical idempotency keys yield exactly 1 execution and 4 replays without double balance increments.
  - Rollback integrity: Fare mismatch, invalid payment method, cancelled status, or unassigned captain leaves captain balance, order state, and ledger completely unmutated.
  - Idempotency key payload mismatch rejection (`409 IDEMPOTENCY_PAYLOAD_MISMATCH`).
- **NOT Executed (Live PostgreSQL Daemon Blocked):**
  - Live execution against PostgreSQL daemon was **NOT EXECUTED** because no PostgreSQL service is running in this sandboxed container (`DATABASE_URL` unset).
  - Multi-process PostgreSQL row lock wait queues (`SELECT ... FOR UPDATE`) and database-level `UNIQUE(idempotency_key)` index violations require verification against a live PostgreSQL staging database.

---

## 9. Defects Corrected & Files Changed

1. `backend/src/security/auth.ts`: Strict `app_metadata.role` enforcement and audience validation.
2. `backend/src/security/supabaseAuth.ts`: Added canonical alias module.
3. `backend/src/services/cashCollectionService.ts`: Added idempotency payload conflict detection and order status eligibility checks.
4. `package.json`: Added explicit `"typecheck": "tsc --noEmit"` script.
5. `.github/workflows/quality.yml`: Accurate CI step labels and conditional Flutter directory handling.
6. `backend/tests/run_tests.ts`: Added 5 new automated regression tests (total: 54 assertions).
7. `audit_output/mashwar-corrected-patch.diff`: Generated authentic, clean Git unified diff.
8. `audit_output/mashwar-corrected-bundle.zip`: Packaged all 13 corrected source files.

---

## 10. Remaining Blockers & Risks

1. **GitHub Remote Push Permission:** Pushing to `3laa2511/Mashwar` requires authenticated credentials (PAT or SSH key) from a developer environment.
2. **PostgreSQL Staging Migration:** Running migration `001_security_hardening.ts` against a live PostgreSQL staging instance with `DATABASE_URL` set.
3. **Supabase Custom Claims Provisioning:** Provisioning `app_metadata.role` on user records in Supabase Auth via the Supabase Service Role key.

---

## 11. Exact Next Steps for Human Review

On your workstation with access to the `3laa2511/Mashwar` repository:

```bash
# 1. Checkout PR #11 branch
git checkout security/fail-closed-order-authorization

# 2. Apply the verified corrected patch
git apply audit_output/mashwar-corrected-patch.diff

# 3. Verify locally
bun install --frozen-lockfile
bun run typecheck
bun run test

# 4. Review git diff and push
git status
git add .github/ backend/ docs/ package.json
git commit -m "fix(security): resolve idempotency payload conflicts, enforce fail-closed auth, and repair CI"
git push origin security/fail-closed-order-authorization
```
