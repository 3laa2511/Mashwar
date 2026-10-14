# Mashwar — Merchant Marketplace Specification

**Status:** Product and technical specification; not evidence of live marketplace integration.  
**Default language:** Arabic (RTL), with English localization.  
**Commercial rule:** Merchant subscription is a separate product from captain subscription; prices and trial periods remain unapproved until explicitly decided.

## 1. Roles and lifecycle

A merchant owner can register with a verified phone, create a business profile, add one or more branches, submit required business information, and request review. Initial status is `draft` or `pending_review`; only an approved, active merchant/branch can appear publicly or accept customer orders. Operations can approve, reject with a reason, suspend, or request changes. Every privileged action is audited.

Suggested statuses: `draft`, `pending_review`, `changes_requested`, `approved`, `suspended`, `rejected`, `closed`. A merchant cannot approve itself or change its own verification status.

## 2. Merchant and branch profile

- Public profile: display name, category, description, logo/cover image, public address, service area, opening hours, estimated preparation time, delivery/pickup options, and customer-facing status.
- Private business information: owner/contact details and any verification documents; never expose private documents to customers.
- Each branch has its own coordinates, coverage, hours, catalog availability, and order-operating status.
- Uploads use validated image formats, size limits, private storage where appropriate, and signed short-lived access URLs for private material.
- No merchant may publish passenger transportation services.

## 3. Catalog

Support products and services with stable IDs, name/description in Arabic and optionally English, category, images, price in integer piasters, availability, optional stock/quantity, modifiers where needed, and archived state. Server validates all prices and item availability. Customer-submitted totals are never authoritative. Store immutable order-item snapshots so future catalog edits do not alter historical receipts.

Inventory behavior is optional per merchant/category; do not imply stock is enforced when a merchant has disabled inventory tracking. Availability and stock decrements must be atomic where inventory tracking is enabled.

## 4. Ordering journey

Customer selects a service area, discovers approved active merchants, views a branch/catalog, adds items, selects a delivery address or pickup option, sees a server-generated quote, confirms the order, and receives lifecycle updates. Merchant can accept/reject within a configured timeout, update preparation status, and mark ready for pickup. Delivery orders enter captain dispatch only when merchant acceptance/readiness rules allow it. The exact state transitions must be shared with `ORDER_LIFECYCLE.md`; no client-only status transitions.

Support direct courier requests (documents, parcels, errands) separately from merchant orders, with explicit service type, pickup/drop-off, package restrictions, and server-authoritative pricing.

## 5. Merchant subscription and entitlements

Keep merchant plans/subscriptions separate from captain plans/subscriptions. Suggested concepts: `merchant_subscription_plans`, `merchant_subscriptions`, `merchant_subscription_events`, and an entitlement/policy layer. Plan benefits may include number of active branches, catalog limits, analytics, promotional placement, or order-management features. Do not hard-code an unapproved price, grace period, payment gateway, or automatic renewal behavior. A subscription payment does not bypass merchant verification or allow a suspended merchant to publish.

## 6. Security and permissions

- Customers can read only public profiles/catalog entries for approved active branches in supported service areas.
- Merchant owner/staff can manage only their assigned merchant and branches, and only within granted permissions.
- Merchant staff access is explicitly scoped; do not grant access based only on a client-supplied merchant ID.
- Only authorized operations/admin roles can review/approve/suspend merchants, change plans, or access private verification records.
- Enforce ownership and status checks in the trusted server API and PostgreSQL RLS; use server-side validation and rate limits.
- Prevent mass assignment: clients cannot write approval status, subscription entitlement, platform fees, audit fields, or authoritative totals.
- Keep national IDs, private phone numbers, and private documents out of public APIs and logs.

## 7. Suggested data entities

`merchants`, `merchant_memberships`, `merchant_branches`, `merchant_categories`, `catalog_categories`, `catalog_items`, `catalog_item_images`, `catalog_modifiers`, `merchant_subscription_plans`, `merchant_subscriptions`, `merchant_subscription_events`, `merchant_order_acceptances`, and existing `orders` / `order_items` linked by foreign keys. Names are conceptual until reconciled with the existing schema draft; avoid duplicate tables.

## 8. Acceptance tests

- Pending/rejected/suspended merchant is never discoverable and cannot accept orders.
- Merchant A cannot read/update Merchant B's catalog, orders, branches, documents, or subscription.
- Client cannot change item price, total, approval state, branch location ownership, or subscription entitlement.
- Concurrent stock updates cannot oversell when stock tracking is enabled.
- Catalog edits do not mutate existing order snapshots.
- Merchant and captain subscription entitlements remain independent.
- Every admin review action creates an audit event.
