# Mashwar — Customer Ordering Journey

**Status:** Product journey specification; implementation status must be verified separately.

## 1. Entry and service-area selection

Customer opens Mashwar, grants location permission if desired, or selects a city/area manually. The app checks active service coverage and explains unsupported locations without implying that Mashwar operates everywhere. The initial enabled launch area is El Bagour; additional areas are enabled through admin configuration.

## 2. Main choices

Present clear, localized choices:
- **Order from a store:** browse approved merchants and branches, search/filter catalog, view item details, choose quantities/options, and review availability.
- **Send a parcel/document:** provide pickup, destination, package description and applicable restrictions.
- **Run an errand:** describe the task, set pickup/drop-off and any purchase budget; define prohibited items and proof-of-purchase/receipt handling.
- **Order status and support:** view confirmed order details, lifecycle timeline, contact support, cancel only when permitted, and report a problem.

Passenger rides remain unavailable and should not appear as an actionable service until separate legal and safety approval.

## 3. Quote and confirmation

The server returns a quote ID, itemized piaster amount, currency, expiry, service area, and relevant assumptions. The client displays this quote and submits only the quote ID plus required order details and idempotency key. The server revalidates current eligibility, item prices/availability, address coverage, and quote expiry. Never trust a client total or silently change a confirmed quote.

## 4. Delivery and captain trust

After the order is accepted/ready according to its type, dispatch searches eligible captains within the configured service area. Customer sees only necessary public captain profile fields and status updates. Precise tracking appears only when real, authorized location updates are available; otherwise show lifecycle milestones and honest status copy.

## 5. Completion, payment and rating

Record payment state only from trusted cash-confirmation flows or verified payment-provider events. Completion requires the server's state-transition rules and any required proof/cash reconciliation. Allow one rating per eligible completed order, with reporting/moderation rules and a documented policy for disputed deliveries.

## 6. UX quality bar

- Arabic-first RTL, professional and consistent design, accessible contrast and touch targets, useful loading/empty/error/offline states.
- English localization must not require separate hard-coded screens.
- Do not hard-code El Bagour landmarks as the production discovery source.
- No fake GPS, fabricated map routes, placeholder success notifications, or simulated payment confirmations presented as real.
- Every visible action should be wired to a real supported capability or clearly marked as unavailable during development.
