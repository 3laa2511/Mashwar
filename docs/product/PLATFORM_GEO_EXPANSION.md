# Mashwar — Multi-Region Platform & Expansion Strategy

**Status:** Product/architecture specification; not a claim of implementation.  
**Initial launch market:** El Bagour, Menoufia, Egypt.  
**Platform intent:** A city-configurable delivery and local-commerce company that can expand across Menoufia and other governorates without rewriting application code.

## 1. Non-negotiable product principle

Mashwar starts in El Bagour; it must not be built *for El Bagour only*. No production business rule, API route, database constraint, Flutter screen, admin dashboard, seed dataset, or routing adapter may assume El Bagour is the only supported location. The first launch region is configuration/data, not an architectural boundary.

Use neutral terms such as region, service area, city, branch, merchant location, coverage zone, and operating hours. Keep Arabic labels localized, not embedded into business logic.

## 2. Geographic hierarchy

Model the hierarchy as data:
- Country (initially Egypt)
- Governorate (initially Menoufia)
- City / town
- District / neighborhood / village
- Service area / coverage zone (the actual operational boundary)
- Optional geofence polygon or supported delivery radius

Suggested entities: `countries`, `governorates`, `cities`, `localities`, `service_areas`, `service_area_boundaries`, `service_area_service_types`, and `service_area_operating_hours`. Use stable UUIDs and explicit parent foreign keys; use a geospatial-capable type/index (PostGIS geography/geometry) only when enabled and supported by the chosen Supabase plan. Do not rely on display names as identifiers.

## 3. Region-aware behavior

- Every order must reference its operational service area and preserve pickup/drop-off coordinate/address snapshots.
- Merchants may have one or more branches; each branch has a location, service-area eligibility, opening hours, and availability.
- Captains may opt into one or more service areas and can be dispatched only within supported, currently active coverage.
- Pricing rules, delivery limits, payment options, operating hours, and service availability can vary by service area through versioned configuration.
- Owner/admin tools must manage service areas and launch status without deploying a new app version.
- Search and discovery should be scoped to the user's selected/detected area, with a clear manual area selector and graceful empty-state behavior.
- The initial production configuration can enable only El Bagour. Future areas remain disabled until operations explicitly activates them.

## 4. Expansion safety and operations

Before enabling a new area, require a readiness checklist: verified captain supply, merchant coverage, routing quality, pricing review, customer support coverage, emergency contacts, delivery operating hours, payment/cash reconciliation, and local legal review. A city cannot be activated merely because it exists in the database.

Never infer legal permission for passenger transport. Passenger rides remain disabled until separate legal, licensing, insurance, and safety approval.

## 5. Avoiding accidental single-city coupling

- Remove fixed city lists and coordinates from production business logic; fixtures may use clearly labeled synthetic data.
- Keep routing behind a `RoutingProvider` interface so OSRM, Google Maps, or another provider can be changed without rewriting order/dispatch logic.
- Keep currency and locale distinct: EGP is the initial currency, Arabic is the default language, and neither should be used as a proxy for geography.
- Use indexed coordinates and bounding/coverage checks; do not use straight-line distance as a final road-distance or ETA promise.
- Include tests for two synthetic service areas to prove isolation, discovery, pricing, and dispatch do not leak across areas.

## 6. Acceptance criteria

1. A new service area can be created and activated from admin-controlled configuration without code changes.
2. An order outside all active service areas is rejected with a helpful localized message.
3. A merchant branch and captain can each be eligible for one area but not another.
4. Pricing and service availability are selected from the order's authoritative service area.
5. Tests include El Bagour as seed/configuration only and a second synthetic city as a portability check.
6. All current limitations and external provider dependencies remain explicit; no fake GPS, map routes, or real-time tracking claims.
