# Mashwar — Final Production-Readiness Engineering Manifest

Target Repository: `https://github.com/3laa2511/Mashwar`
Generated At: 2026-10-24T00:31:35.612Z
Verification Status: `bun run typecheck` (0 errors), `bun run test` (71/71 assertions across 23 suites PASS), `npm run build` (PASS), `@action-validator/cli .github/workflows/quality.yml` (0 errors)

## Included Files & SHA-256 Checksums

| File Path | Size (Bytes) | SHA-256 Checksum |
| :--- | :---: | :--- |
| `.github/workflows/quality.yml` | 2212 | `8506dde8d0842b7939baf0bf3ccb64ad08d13ca1a0eafaaa7fa43c1b81c3fea8` |
| `.env.example` | 1445 | `1a4b259c10410f11f9d029f7d2911fb4c7ddfc0e86f91ea2e03d06325eabdde3` |
| `package.json` | 1160 | `8a61dec65ac577c980f8bfe1e0eb652dd7ff150e1888897569e332d7ac352a1d` |
| `server.ts` | 1728 | `6d2ea3319d9ff7b52f4252c1ec5dca7676fb443f66c0b2ef984e7e08800f90e0` |
| `backend/src/types/index.ts` | 8053 | `1283650b1ff24b873f46801bbb4f338b6c6e93eff96b376bdec705455d3104f0` |
| `backend/src/database/db.ts` | 1663 | `5b6a635472a01fac9e8b618e9ddf598e7019839ae9a785d0c4a01784cb7b371b` |
| `backend/src/database/schema.ts` | 8954 | `b5f89f132e4a60b283fd8c7230030cb67fc2a6dcd77fc483c2bb918c86f96bc8` |
| `backend/src/database/migrator.ts` | 2623 | `d316c94a2ad9813c140e62e30bb967142dd3793c645f13d8701b0f6b45fdcdc2` |
| `backend/src/database/migrations/001_security_hardening.ts` | 7399 | `68229a3211a9f887a8eac680e44b8a8e10e6da689dac36e31af3286663df5f59` |
| `backend/src/database/migrations/002_complete_platform_schema.ts` | 16463 | `fee5c753a145525ea9e6b7ef2a78d579fba7b2d937dd20ccc6bb5d85f99cf312` |
| `backend/src/pricing/pricingEngine.ts` | 9465 | `93ca6df046e238f5a6874db5a08715ef3af651c84b9c95f7ab7e9317fd022416` |
| `backend/src/orders/orderFsm.ts` | 8271 | `7269e0d3324107cd68efeb04f76684edb072ff40b8d1a9aea5a0f3765ca47568` |
| `backend/src/dispatch/assignmentService.ts` | 4266 | `dfa8831b0dbc5430394bec4a09e0ba26333477d5d3607390b447933d6001d868` |
| `backend/src/captain/captainEligibility.ts` | 4828 | `9fd308509903723498f35e63e223c9dcffbb264c6ab3720d4c909c3a2151b30d` |
| `backend/src/services/captainService.ts` | 6774 | `8b870669696e82f0b5aa26b959542d3d563ab7d5599bc9988ca5db8d3729a103` |
| `backend/src/services/cashCollectionService.ts` | 20935 | `bf9e53c55b5bf0559ce3fa2398e99e58ed535d72b0754c8e56666790b0e52f97` |
| `backend/src/services/merchantService.ts` | 9266 | `a7a07522a1773f8d8279767531609c17d654f1c2911d0f2e278bc4227bb16188` |
| `backend/src/services/complaintService.ts` | 9136 | `080310622f861ad86b218cc2779c52c34e15ec4d4bd2d715d452dbc2973ffe4d` |
| `backend/src/security/auth.ts` | 8691 | `03a70456d1f7a5bf846c21aa0901d43fffc33ddc471df51c28416a76eab97c23` |
| `backend/src/security/rbac.ts` | 3627 | `032e67f09a3e51f6d54e7e3b7fbed8d6b7e47b07cffa9da5998df106c85b497b` |
| `backend/src/security/rateLimiter.ts` | 1859 | `41afb6b88d8b1d61c33a39c3ecc4df245205e1b94f7a5e5715ef7f6262b74a4b` |
| `backend/src/security/auditLogger.ts` | 2536 | `d21c3da8d076b4f3df5c4c84e02a15d6ff8790e3bfec10692e5048e73de6af77` |
| `backend/src/store/persistentStore.ts` | 49786 | `a57a99187d44f3de8c9c79de8c41b279e2c1e2c9575239218064140ff0142b48` |
| `backend/src/api/routes.ts` | 51990 | `2ac2ec1e42f76bc6848bbd5894d6bbe02e31d329f462bbf13536eeec09bf7a60` |
| `backend/tests/run_tests.ts` | 73427 | `6aec02a42cc6e80ae7a29845033d02e37cc29fb544a00f0d93dd7d468cf3f268` |
| `src/components/OwnerAdminDashboard.tsx` | 74761 | `f870806e0bd339f0e536be95f629273c2017ab919cbd3874a59ff8a1ea7a5e12` |
| `src/store/marketplaceStore.tsx` | 27581 | `8d38324e44407098aaf11e4a2d8b9c48b05fdc47320e58452a58c0059fbec483` |
| `docs/backend/DATA_MODEL.md` | 23416 | `56b9a2e2f14c140988a601953b84a580b3e7ea01bc43b5c2089926205e7ddf2f` |
| `docs/backend/ARCHITECTURE.md` | 9484 | `12f01e88ac7f4f4e7e033bb6a9060c976c79e408ae82346a6297b1554beac3eb` |
