# Mashwar — Captain Onboarding, Verification & Public Profile

**Status:** Specification only; no identity-verification provider or live document workflow is implied.

## 1. Onboarding lifecycle

A candidate verifies their phone through the configured identity provider, submits name and profile photo, chooses supported service areas, submits required identity/vehicle documents, and accepts applicable terms. Suggested states: `draft`, `pending_review`, `changes_requested`, `approved`, `suspended`, `rejected`, `expired`. Only an approved and currently eligible captain may go online or receive offers. Subscription status is a separate eligibility dimension; payment alone cannot approve identity.

Operations can review each document, record decision/reason and reviewer, request resubmission, suspend access, and audit every action. Avoid claims of automatic government-ID validation unless an approved provider is actually integrated.

## 2. Customer-visible captain profile

Show only necessary trust information:
- Display name and profile photo.
- Phone verification badge (not necessarily the raw phone number).
- Identity/driver verification status as a simple badge, not document contents.
- Average rating and rating count; completed deliveries count only when sourced from persisted completed orders.
- Vehicle category and masked/limited identifying details if operationally needed.
- Estimated arrival only when based on a real routing/location source.
- Customer support/contact relay rather than exposing the captain's private phone by default.

Do **not** expose national ID number, ID images, license images, home address, date of birth, private phone number, review notes, or internal risk flags to customers or merchants.

## 3. Sensitive-document handling

- Store identity documents in a private bucket with strict object-level authorization; never use public buckets.
- Use short-lived signed URLs issued only after backend authorization, and never log or persist signed URL query strings.
- Limit document access to explicitly authorized verification staff; log every view/download and review decision.
- Encrypt data in transit and at rest; minimize copied identity attributes and avoid storing the full national ID unless legally and operationally necessary.
- Define retention/deletion and incident-response policy with legal counsel before production collection. Do not invent legal retention periods.
- Redact documents, ID numbers, phone numbers, tokens, and exact coordinates from routine application logs and analytics.
- Do not commit real identity data or documents to source control or test fixtures.

## 4. Eligibility for dispatch

Eligibility is a server-side predicate combining: approved status, active account, valid required documents, current online/available state, current GPS freshness and service-area eligibility, compatible vehicle/service, active captain subscription or an explicitly approved grace policy, and any cash-holding/safety constraints. A customer cannot nominate an arbitrary captain to bypass these checks. The database transaction must enforce that one order cannot be assigned to multiple captains.

Subscription policy, trial, grace duration, and cash limits remain configurable/unapproved until management signs them off.

## 5. Suggested entities

Reconcile rather than duplicate existing `captains` and `captain_subscriptions`. Add conceptual `captain_verification_documents`, `captain_verification_reviews`, `captain_service_areas`, `captain_location_updates`, and `captain_ratings` only where not already represented. Keep private document metadata separate from public captain profile fields.

## 6. Acceptance tests

- Pending, rejected, suspended, expired-document, or inactive captain cannot go online/accept offers.
- A customer API response contains no national ID, document URL, private phone, or internal review notes.
- One customer cannot read another captain's private verification records.
- A signed document URL expires and is never returned by public profile endpoints.
- Spoofed/stale/out-of-area coordinates cannot make an ineligible captain eligible.
- Rating aggregates exclude cancelled, disputed, or non-completed deliveries according to an explicit policy and prevent duplicate ratings.
