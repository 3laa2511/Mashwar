# Mashwar — مشوار
### Arabic-First Local Delivery & Mobility Platform (El Bagour, Menoufia, Egypt)

Mashwar is a native Flutter application built with sound null safety, Riverpod state management, GoRouter navigation, and a customized Material 3 design system tailored for Egyptian local delivery logistics.

---

## 1. Environment & Target Platform Notice
- **Target Platforms**: Android (minSdk 21, targetSdk 34) & iOS (iOS 14.0+)
- **Flutter SDK Requirement**: Flutter `>=3.19.0`
- **Dart SDK Requirement**: Dart `>=3.3.0 <4.0.0`
- **Environment Status Note**: The AI Studio preview container runs a Node.js/Vite environment without Flutter/Android/iOS native toolchains pre-installed. The source files in `flutter_mashwar/` are genuine, implementation-ready Flutter/Dart code that can be exported or cloned to run directly on any machine equipped with Flutter.

---

## 2. Codebase Architecture (Feature-First)

```text
flutter_mashwar/
├── pubspec.yaml                 # Dependencies (Riverpod, GoRouter, Dio, Fonts)
├── android/                     # Android Native Configuration & Manifest
├── ios/                         # iOS Native Configuration & Info.plist
├── lib/
│   ├── main.dart               # Entry point with ProviderScope
│   ├── app/
│   │   ├── app.dart            # MaterialApp with RTL Cairo typography
│   │   ├── localization/       # Arabic/English localized strings
│   │   ├── router/             # GoRouter configuration & guards
│   │   └── theme/              # Custom Material 3 color & style tokens
│   ├── core/
│   │   ├── networking/         # Dio HTTP client contract & interceptors
│   │   ├── storage/            # FlutterSecureStorage token handling
│   │   └── utils/              # PriceCalculator & validation logic
│   ├── shared/
│   │   ├── models/             # OrderModel, FareQuoteModel, UserRole
│   │   └── services/           # MockDataRepository with El Bagour landmarks
│   └── features/
│       ├── customer_home/      # Customer experience & service selection
│       ├── captain/            # Captain availability, radar, delivery steps
│       ├── merchant/           # Store workspace, orders, kitchen prep
│       └── operations/         # Dispatch metrics & regulatory passenger lock
└── test/
    └── unit/                   # Pricing & state transition unit tests
```

---

## 3. How to Run Locally

### Prerequisites
1. Install [Flutter SDK](https://flutter.dev/docs/get-started/install).
2. Verify setup:
   ```bash
   flutter doctor
   ```

### Running on Android / iOS / Web
```bash
cd flutter_mashwar
flutter pub get
flutter run
```

### Running Unit Tests
```bash
flutter test
```

---

## 4. Pending Integrations & Production Checklist
1. **SMS OTP Gateway**: Requires commercial Egypt SMS provider (e.g., Vodafone SMS API or Firebase Phone Auth with Egyptian carrier approval).
2. **Authoritative Backend**: Connect the typed `ApiService` layer to an authoritative REST/GraphQL backend. Fares, discounts, and dispatch rules must always be calculated server-side.
3. **Map & Routing SDK**: Replace the mock landmark picker with Google Maps Flutter SDK or Mapbox GL.
4. **Payment Processing**: Integrate Egyptian payment gateways (e.g., Fawry, Paymob, Vodafone Cash).
5. **Passenger Mobility Legal Review**: Passenger transport is currently locked by system policy pending local Menoufia traffic authority licenses and commercial passenger insurance.
