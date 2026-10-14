# Mashwar (مشوار) — Product Design System & Mobile UX Direction
**Product Domain:** Local Delivery, Courier & Mobility Platform  
**Target Launch Hub:** El Bagour (الباجور), Menoufia Governorate, Egypt  
**Target Clients:** Native Flutter Application (Android & iOS) in `flutter_mashwar/`  
**Phase:** Phase 3 Architecture Review & Design System Hardening  

---

## 1. Verified Design Assets & Reference Limitations

To ensure factual integrity:
1. **Existing Verified Implementation:** The Flutter codebase in `flutter_mashwar/lib/app/theme/` contains foundational tokens:
   - Font Family: **Cairo** (via `google_fonts: ^6.1.0`) with Arabic-first typography hierarchy and full RTL alignment.
   - Primary Brand Color: Egyptian Amber (`0xFFF59E0B` / `0xFFD97706`).
   - Secondary Brand Color: Delta Emerald Green (`0xFF059669` / `0xFF047857`).
   - Dark Foundation: Deep Slate (`0xFF020617` / `0xFF0F172A`).
2. **Design Reference Note:** External Figma files or visual mockups were not provided in the repository workspace. This document codifies the design system based on verified repository files and established mobile patterns from top-tier global mobility platforms (Careem, Uber, Talabat, Mrsool) adapted specifically for secondary Egyptian cities.

---

## 2. Core UI/UX Philosophy for El Bagour

1. **Arabic-First (RTL Priority):** The entire interface is structured from right to left (RTL) by default. Iconography respects cultural directionality (e.g. forward navigation arrows point left `←`, back arrows point right `→`, progress bars fill from right to left).
2. **One-Handed Operational Ergonomics:** In Egyptian towns, customers and captains frequently use their phones on moving motorcycles, in transit, or carrying packages. All primary actions (Booking CTA, Accept Offer, Status Transition) are placed within the natural lower thumb zone (bottom 35% of the screen).
3. **No Fake GPS / Honest Map Behavior:** Never fabricate live moving vehicle markers without real hardware GPS telemetry. In areas with intermittent satellite lock, Mashwar displays verified landmark nodes (e.g. "أمام مستشفى الباجور العام") with an explicit estimated arrival window (e.g. "الوصول المتوقع: ١٠-١٥ دقيقة").
4. **Legibility under Harsh Egyptian Sunlight:** High-contrast text tokens (minimum 4.5:1 contrast ratio) ensuring readability in high-ambient outdoor lighting for delivery captains.

---

## 3. Coherent Color & Typography Scale

### 3.1 Color System Tokens (`AppColors`)

```dart
class AppColors {
  // Brand Primary (Amber / Movement & Energy)
  static const Color primary = Color(0xFFF59E0B);
  static const Color primaryDark = Color(0xFFD97706);
  static const Color primaryLight = Color(0xFFFDE68A);

  // Brand Secondary (Emerald Delta / Success & Completed Deliveries)
  static const Color secondary = Color(0xFF059669);
  static const Color secondaryDark = Color(0xFF047857);
  static const Color secondaryLight = Color(0xFFA7F3D0);

  // Neutral Foundations (Slate)
  static const Color slate950 = Color(0xFF020617); // Dark background
  static const Color slate900 = Color(0xFF0F172A); // Card background in Dark Mode
  static const Color slate800 = Color(0xFF1E293B); // Border in Dark Mode
  static const Color slate600 = Color(0xFF475569); // Muted text
  static const Color slate200 = Color(0xFFE2E8F0); // Border in Light Mode
  static const Color slate100 = Color(0xFFF1F5F9); // Light background
  static const Color slate50 = Color(0xFFF8FAFC);  // Surface Light

  // System Status Feedback
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
  static const Color warning = Color(0xFFF59E0B);
  static const Color info = Color(0xFF3B82F6);
}
```

### 3.2 Typography Hierarchy (Cairo Font)

| Token Name | Weight | Size | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **`displayLarge`** | Bold (700) | 28px | 36px | Hero headlines & total fare summaries. |
| **`headlineMedium`** | Bold (700) | 20px | 28px | Screen titles, app bar titles, store names. |
| **`titleMedium`** | Semi-Bold (600) | 16px | 24px | Card headers, service titles, landmark labels. |
| **`bodyLarge`** | Regular (400) | 15px | 22px | Primary form input text, item descriptions. |
| **`bodyMedium`** | Regular (400) | 13px | 18px | Secondary descriptions, timestamps, subtitles. |
| **`labelSmall`** | Bold (700) | 11px | 14px | Status badges, rural surcharges, tag chips. |

---

## 4. Four Distinct Role Experiences

### 4.1 Customer Experience
- **Home Hub:** Quick service selection (Package Courier, Store/Restaurant Fulfillment, Errands & Pharmacy).
- **Passenger Mobility Notice:** Visually disabled card with distinct regulatory lock badge; tapping opens an informative modal explaining local regulatory compliance.
- **Booking Journey:**
  - One-tap landmark selector for El Bagour.
  - Transparent itemized price breakdown (Base fare, distance charge, rural village allowance, platform fee) before order confirmation.
  - Real-time tracking timeline showing realistic milestones: `طلب مسجل` ➔ `جاري البحث` ➔ `تم إسناد الكابتن` ➔ `وصل للاستلام` ➔ `في الطريق` ➔ `تم التسليم`.

### 4.2 Captain Experience
- **Availability Radar:** Prominent toggle (متصل / في استراحة) with pulsing radar indicator.
- **Subscription Standing Banner:**
  - Active: displays days remaining.
  - Grace Period: non-dismissible amber banner with 72-hour countdown.
  - Expired: modal preventing radar activation with a direct link to renew.
- **Dispatch Offer Card:** Displays landmark neighborhood, distance in km, and net payout in EGP with high-contrast Accept/Decline action buttons.
- **Delivery Flow:** Step-by-step slider preventing accidental touches (`وصلت للاستلام` ➔ `استلمت الشحنة` ➔ `تم التسليم والتحصيل`).

### 4.3 Merchant Workspace
- **Store Status:** Big open/closed switch with kitchen preparation capacity.
- **Order Queue:** Clear separation between incoming orders, orders in preparation (`جاري التجهيز`), and orders waiting for captain pickup (`جاهز للاستلام`).
- **One-Touch Readiness Alert:** Tapping "جاهز للتسليم" immediately notifies the assigned captain and updates operations.

### 4.4 Operations & Dispatch Room
- **Adaptive Control Center:** Responsive layout providing fleet metrics (active orders, online captains, open stores).
- **Immutable Passenger Lock:** Read-only security indicator enforcing transport suspension without casual toggle options.
- **Audit Stream:** Real-time event log for dispatch reassignments, cash reconciliation discrepancies, and verification approvals.

---

## 5. System States & Edge-Case UX Patterns

1. **Loading State:** Shimmer skeleton placeholders matching the exact card shapes rather than spinning circle indicators.
2. **Empty State:** Culturally resonant illustrations with clear primary action buttons (e.g. "لا توجد طلبات سابقة — اطلب مشوارك الأول الآن").
3. **Offline / Network Reconnect State:** A non-intrusive sticky top banner (`جارٍ إعادة الاتصال بشبكة الإنترنت...`) that auto-retries failed requests without clearing input forms.
4. **Permission Denied State:** If location permission is denied, the app gracefully falls back to the manual El Bagour landmark picker with a polite explanation of why GPS improves pickup accuracy.
5. **Touch Targets & Accessibility:** All interactive buttons and list items have a minimum touch target size of **48 × 48 dp** with 16dp minimum padding.
