# Mashwar — First-Class Web & Mobile Client Strategy

**Status:** Architecture/product specification. Does not claim a production web client or live API integration already exists.

## 1. Product decision

Mashwar is a multi-client platform, not a mobile-only app with a marketing website. Flutter mobile and responsive customer web/PWA are first-class clients over the same trusted backend, identity provider, data model, order state machine, pricing and permissions. Do not fork business logic or maintain separate customer/order databases per client.

## 2. Client surfaces

- **Customer mobile:** Flutter Android first; iOS can follow the same architecture.
- **Customer web/PWA:** responsive browser experience for users who do not want to install an app; supports discovery, service-area selection, merchant catalog, quote/order creation, order history/status, support, and order chat with voice notes where browser support allows.
- **Captain mobile:** Flutter experience optimized for dispatch availability, delivery workflow, location permission, order details, and chat/voice notes.
- **Captain web:** do not assume full fleet/location functionality is equivalent on desktop. A responsive browser access path may support account/profile, subscription, assigned-order details and chat; live/background GPS dispatch remains mobile-first unless browser capabilities and user consent are adequate.
- **Merchant web:** browser-first workspace for profile/branch management, catalog, order acceptance/preparation and subscription management.
- **Owner/operations web:** separate authenticated admin application/surface, not the AI Studio developer preview at `src/App.tsx`. Requires role/permission checks and audited administrative actions.

## 3. Shared contract

All clients call the same versioned API and use the same verified identity/JWT model. The server is authoritative for price, quote expiry, order transitions, merchant approval, subscription entitlements, captain eligibility, dispatch, payment state and chat authorization. Share API schemas/types where practical, but keep UI components platform-specific where that improves accessibility.

## 4. Responsive web and accessibility

- Arabic-first RTL and English LTR via localization, not separate hard-coded business flows.
- Mobile-first responsive layout, usable on phones, tablets and desktops without horizontal overflow.
- PWA installability/offline shell may be added; offline UI must not pretend a request was persisted server-side.
- Keyboard navigation, visible focus, contrast, large touch targets, form labels, clear errors and loading/empty states.
- Accessible communication: voice note recording/playback and large icon buttons, plus text fallback.
- Browser microphone and geolocation require explicit permission and must degrade gracefully if denied or unavailable.
- Web notifications and background location are optional capabilities, never prerequisites for placing a basic order.

## 5. Suggested repository layout

Reconcile existing root files before moving anything:
- `flutter_mashwar/` — Flutter client.
- `web/customer/` — customer browser/PWA client.
- `web/merchant/` — merchant workspace (may share a frontend monorepo/package with customer web).
- `web/operations/` — protected owner/operations dashboard.
- `backend/` — trusted API and domain services.
- `packages/contracts/` — shared API schemas/types if supported by the chosen toolchain.
Do not silently repurpose root `src/App.tsx`; current root Vite/React surface is used as a developer preview/workbench and must be clearly separated from the production customer web app.

## 6. Capability parity matrix

| Capability | Flutter customer | Customer web | Captain mobile | Merchant web | Operations web |
|---|---|---|---|---|---|
| Account/session | Shared API/auth | Shared API/auth | Shared API/auth | Scoped merchant membership | Privileged roles + audit |
| Browse merchants/catalog | Yes | Yes | As needed for assigned orders | Manage own catalog | Review/manage |
| Create courier/merchant order | Yes | Yes | No | Accept/manage merchant orders | Support/authorized intervention |
| Status/history | Yes | Yes | Assigned jobs only | Own branch orders | Authorized operational view |
| Order text/voice chat | Yes | Yes, browser-permission dependent | Yes | Only relevant order scope | Support scope, audited |
| GPS dispatch | Mobile permissions | Manual pin/address fallback | Mobile-first location updates | Branch location management | Coverage/health visibility |
| Sensitive identity documents | Own submission/restricted flow | Only when justified, private | Own submission status | Never captain ID documents | Explicit verification permission |
| Admin/approval | No | No | No | No self-approval | Yes, audited |

## 7. Delivery strategy

1. Finalize API/auth/data contracts before parallel client implementation.
2. Build responsive customer web against the same API contracts as Flutter; avoid mock success responses.
3. Implement shared order conversation/message contract and private audio upload.
4. Add web/Flutter contract tests and end-to-end tests against isolated test infrastructure.
5. Release web and mobile behind the same server feature flags and service-area configuration.
6. Measure feature parity explicitly; document browser-specific limitations and unsupported features.

## 8. Acceptance criteria

- A customer can sign in on mobile and web with the same account and see the same persisted orders.
- An order created on one client appears on the other after authenticated refresh/realtime delivery.
- Pricing/order transitions are identical because both clients call the same server APIs.
- A user can place a basic order on web without installing Flutter.
- Chat and voice notes obey the same authorization/storage policies on both clients.
- No UI claims that GPS, push, payment, realtime, or voice upload is live until its real provider path is tested.
