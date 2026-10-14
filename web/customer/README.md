# Mashwar Customer Web

A responsive Arabic-first browser client scaffold for the Mashwar platform. It is deliberately separate from the root Vite/React developer preview in `src/App.tsx`.

## Run locally

From this directory:

```bash
bun install
cp .env.example .env.local
bun run dev
```

Configure `VITE_MASHWAR_API_BASE_URL` to the trusted API origin. Do not put signing keys, service-role credentials, storage secrets, or payment provider secrets in any `VITE_*` variable.

## Current scope

- Responsive Arabic RTL / English LTR landing and order form.
- Service-area selector populated from `GET /api/v1/service-areas`; no single city is hard-coded as the platform boundary.
- Server-quote then order-confirmation flow; the client does not calculate the authoritative price.
- Browser microphone permission and local voice-note recording/preview controls.
- Order-linked text conversation and private voice-note upload flow using the documented API contracts.
- Explicit unavailable/error states when API configuration or backend capabilities are missing.

## Important status

This is a client scaffold, not a production-ready web service. Authentication/session handling, service-area APIs, quote/order endpoints, persisted conversations, private audio upload/storage and authorization are not yet proven to be implemented end-to-end. Until those backend routes are connected and tested, the UI must not be deployed as a live ordering channel. The mobile Flutter app and web client must share the same trusted API and persisted data.

The browser cannot guarantee the same background-location behavior as native mobile. If microphone permission is denied or unsupported, text communication remains the fallback.
