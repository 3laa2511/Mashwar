# Mashwar — مشوار
### Arabic-First Local Delivery & Mobility Platform (El Bagour, Menoufia, Egypt)

Mashwar is an Arabic-first Flutter mobile application built with sound null safety, Riverpod state management, GoRouter navigation, and a customized Material 3 design system for El Bagour local logistics.

---

## 1. Environment & Target Platform Notice
- **Target Platforms**: Android (minSdk 21, targetSdk 34) & iOS (iOS 14.0+)
- **Flutter SDK Requirement**: Flutter `>=3.19.0`
- **Dart SDK Requirement**: Dart `>=3.3.0 <4.0.0`
- **Host Environment Status**: The AI Studio preview container runs a Node.js/Vite environment without the native Flutter/Android/iOS toolchain installed. Therefore, `flutter test`, `flutter analyze`, and native Android/iOS compilation are **NOT RUN** in this container. The source files in `flutter_mashwar/` constitute a genuine, production-oriented Flutter codebase ready to run and test on any machine with Flutter installed.

---

## 2. Codebase Architecture (Feature-First)

```text
flutter_mashwar/
├── pubspec.yaml                 # Dependencies (Riverpod, GoRouter, Dio, Fonts)
├── android/
│   └── app/src/main/
│       └── AndroidManifest.xml  # Permissions (Location, Phone, Internet)
├── ios/
│   └── Runner/
│       └── Info.plist           # iOS Configuration & Privacy Descriptions
├── lib/
│   ├── main.dart               # Entry point with ProviderScope
│   ├── app/
│   │   ├── app.dart            # MaterialApp.router with RTL Cairo typography
│   │   ├── localization/       # Arabic/English localized strings
│   │   ├── router/
│   │   │   └── app_router.dart # GoRouter (Customer, Captain, Merchant, Ops)
│   │   └── theme/              # Custom Material 3 color & style tokens
│   ├── core/
│   │   └── utils/
│   │       ├── input_validator.dart # Egyptian phone, address, notes validation
│   │       └── price_calculator.dart # Itemized pricing breakdown
│   ├── shared/
│   │   ├── models/             # OrderModel, FareQuoteModel, AppRole
│   │   ├── providers/          # Riverpod ordersProvider & roleProvider
│   │   └── services/           # MockDataRepository with El Bagour landmarks
│   └── features/
│       ├── customer_home/      # Customer experience & active orders
│       ├── delivery_booking/   # Booking form & transparent price review
│       ├── order_tracking/     # Simulated lifecycle timeline stepper
│       ├── order_history/      # Orders archive & details viewer
│       ├── captain/            # Captain availability, radar, delivery steps
│       ├── merchant/           # Store workspace, orders, kitchen prep
│       └── operations/         # Dispatch metrics & regulatory passenger lock
└── test/
    ├── unit/
    │   ├── price_calculator_test.dart       # Pricing calculation unit tests
    │   ├── input_validation_test.dart       # Egyptian phone & location tests
    │   └── order_state_transitions_test.dart # Lifecycle progression tests
    └── widget/
        └── app_smoke_test.dart              # App mount & UI smoke test
```

---

## 3. How to Run Locally on Your Machine

### Prerequisites
1. Install [Flutter SDK](https://flutter.dev/docs/get-started/install).
2. Verify setup:
   ```bash
   flutter doctor
   ```

### Scaffolding Platform Wrappers (if needed)
To generate or update complete platform wrappers:
```bash
cd flutter_mashwar
flutter create . --org com.mashwar.app
```

### Running on Android / iOS / Web
```bash
cd flutter_mashwar
flutter pub get
flutter run
```

### Running Unit & Widget Tests
```bash
cd flutter_mashwar
flutter test
```

---

## 4. Completed vs. Mocked Functionality

### Completed & Functional:
1. **Application Shell & GoRouter Navigation**: All 4 role experiences (`/customer`, `/customer/book`, `/customer/order/:id`, `/customer/history`, `/captain`, `/merchant`, `/operations`) are reachable via real navigation and a top-bar Role Switcher.
2. **Riverpod State Management**: Shared `ordersProvider` manages order creation, live tracking, status advancement, and history.
3. **Customer Flow**: Complete journey from service selection to booking, validation, transparent fare quotation, and status advancement.
4. **Operations Regulatory Lock**: Passenger transportation is locked read-only in compliance with local Menoufia regulations.
5. **Localization & RTL**: Arabic-first Cairo typography with English fallback.

### Mocked / Simulated (Requires Future Backend):
1. **Authoritative Backend**: Fares, discounts, and dispatch rules must always be calculated server-side in production.
2. **Live GPS & Mapping**: Uses predefined El Bagour landmarks. Requires Google Maps Flutter SDK or Mapbox integration.
3. **SMS OTP Gateway**: Requires a commercial Egypt SMS provider (Vodafone SMS API or Firebase Phone Auth).
4. **Payment Gateway**: Requires integration with Egyptian payment gateways (e.g., Fawry, Paymob, Vodafone Cash).
