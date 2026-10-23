# Mashwar Security Hardening & Backend Patch Manifest

**Repository:** `3laa2511/Mashwar`  
**Branch Target:** `security/fail-closed-order-authorization`  
**Date:** 2026-10-23T03:39:40.095Z  
**Status:** Verified (49/49 Passing Tests, Clean TypeScript Compilation)  

## Exported Files Manifest

| File Path | Type | Size (Bytes) | SHA-256 Checksum | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| `backend/src/security/auth.ts` | **NEW** | 8328 | `f58f4d167f330269...` | Zero-trust Supabase token verifier, app_metadata.role extractor, X-Actor header stripper, and tenant isolation guards. |
| `backend/src/security/supabaseAuth.ts` | **NEW** | 291 | `791654d955fbc9d2...` | Supabase authentication alias module re-exporting authoritative auth middleware. |
| `backend/src/api/routes.ts` | **MODIFIED** | 31680 | `b4fe8c35e72caa75...` | Express routes updated with fail-closed authenticate middleware, server-derived user/captain IDs, and cash collection endpoint. |
| `backend/src/database/schema.ts` | **NEW** | 3308 | `dec6e5f0ac3720ce...` | Kysely typed database schema for users, captains, orders, cash_collections, financial_ledger, and idempotency_keys. |
| `backend/src/database/db.ts` | **NEW** | 1520 | `430dc1de44e46973...` | Database connection provider, Kysely PostgresDialect pool manager, and migration runner. |
| `backend/src/database/migrations/001_security_hardening.ts` | **NEW** | 7399 | `68229a3211a9f887...` | PostgreSQL migration creating tables, foreign keys, unique constraint on idempotency_key, and composite indexes. |
| `backend/src/services/captainService.ts` | **NEW** | 3745 | `919c8536f79dc670...` | Database-backed captain profile resolver from auth.uid(), suspension status check, and cash threshold guard. |
| `backend/src/services/cashCollectionService.ts` | **NEW** | 18101 | `09b7d8354a498bda...` | PostgreSQL transactional cash collection with row-level locks (SELECT ... FOR UPDATE), idempotency, and audit ledger. |
| `backend/src/types/index.ts` | **MODIFIED** | 3022 | `8dd71588df718703...` | Added full role enum support to OrderTransitionRequest and updated monetary representations. |
| `backend/tests/run_tests.ts` | **MODIFIED** | 46299 | `f53d67d23f529675...` | 16 test suites with 49 automated passing unit, security, RBAC, and transactional concurrency assertions. |
| `docs/backend/SUPABASE_AUTH_SETUP.md` | **MODIFIED** | 8186 | `f76d2aecb77d05de...` | Architecture documentation, Supabase claims setup, endpoint authorization matrix, and PostgreSQL transaction guide. |
| `.github/workflows/quality.yml` | **NEW** | 1381 | `11f754fcb7b316d3...` | GitHub Actions workflow running lint, backend tests, and web build on push/PR to main with contents:read. |
| `package.json` | **MODIFIED** | 1115 | `16a741c832f9ad97...` | Added pg, @types/pg, test scripts, and dependencies for backend compilation and test execution. |

## Package Verification & Verification Commands

1. **Run Full Test Suite:**
   ```bash
   npm run test
   ```
   Expected: `49/49 PASSED (0 FAILED)` across 16 test suites.

2. **Verify TypeScript Compilation:**
   ```bash
   npm run lint
   ```
   Expected: 0 errors.

3. **Apply Unified Patch:**
   ```bash
   git apply mashwar-security-hardening.patch
   ```
