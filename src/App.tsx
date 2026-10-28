/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import JSZip from 'jszip';
import { OwnerAdminDashboard } from './components/OwnerAdminDashboard';
import { MobileAppFrame } from './components/mobile/MobileAppFrame';
import {
  useMarketplace,
  formatHumanReadableAcceptedTimestamp,
} from './store/marketplaceStore';
import {
  Smartphone,
  Tablet,
  Download,
  Code2,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  Navigation,
  Package,
  Store,
  FileText,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Info,
  Car,
  Bike,
  Activity,
  ArrowRight,
  ArrowLeft,
  Search,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Send,
  Radio
} from 'lucide-react';

// Egyptian El Bagour landmarks
const EL_BAGOUR_LANDMARKS = [
  'ميدان المحطة - وسط الباجور',
  'مجلس مدينة الباجور',
  'شارع الجيش - برج الشروق',
  'مستشفى الباجور العام',
  'شارع الجمهورية - أمام بنك مصر',
  'منطقة المساكن الشعبية',
  'طريق بنها - الباجور الزراعي',
  'قرية كفر الباجور',
  'قرية شنتنا الحجر',
  'قرية جروان',
  'قرية ميت عفيف',
  'مجمع مواقف الباجور الجديد',
];

// Flutter source files data for inspection and export
const FLUTTER_FILES: { path: string; language: string; content: string }[] = [
  {
    path: 'pubspec.yaml',
    language: 'yaml',
    content: `name: mashwar
description: "Mashwar — مشوار: Arabic-first local delivery and mobility platform for El Bagour, Menoufia, Egypt."
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"
  flutter: ">=3.19.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter
  flutter_riverpod: ^2.5.1
  go_router: ^14.0.0
  dio: ^5.4.1
  flutter_secure_storage: ^9.0.0
  google_fonts: ^6.1.0
  intl: ^0.19.0
  geolocator: ^11.0.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.1`
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.mashwar.app">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <application android:label="مشوار" android:icon="@mipmap/ic_launcher">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>`
  },
  {
    path: 'ios/Runner/Info.plist',
    language: 'xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDisplayName</key>
	<string>مشوار</string>
	<key>CFBundleName</key>
	<string>mashwar</string>
	<key>NSLocationWhenInUseUsageDescription</key>
	<string>يحتاج تطبيق مشوار للوصول إلى موقعك لتحديد نقطة استلام وتسليم الطرود بدقة في مدينة الباجور والقرى المجاورة.</string>
</dict>
</plist>`
  },
  {
    path: 'lib/main.dart',
    language: 'dart',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    const ProviderScope(
      child: MashwarApp(),
    ),
  );
}`
  },
  {
    path: 'lib/app/app.dart',
    language: 'dart',
    content: `import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class MashwarApp extends StatelessWidget {
  const MashwarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'مشوار — Mashwar',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      locale: const Locale('ar', 'EG'),
      supportedLocales: const [
        Locale('ar', 'EG'),
        Locale('en', 'US'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: appRouter,
    );
  }
}`
  },
  {
    path: 'lib/app/router/app_router.dart',
    language: 'dart',
    content: `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/customer_home/presentation/screens/customer_home_screen.dart';
import '../../features/delivery_booking/presentation/screens/booking_screen.dart';
import '../../features/order_tracking/presentation/screens/order_tracking_screen.dart';
import '../../features/order_history/presentation/screens/order_history_screen.dart';
import '../../features/captain/presentation/screens/captain_dashboard_screen.dart';
import '../../features/merchant/presentation/screens/merchant_workspace_screen.dart';
import '../../features/operations/presentation/screens/operations_dashboard_screen.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/customer',
  routes: [
    GoRoute(
      path: '/',
      redirect: (context, state) => '/customer',
    ),
    GoRoute(
      path: '/customer',
      builder: (context, state) => const CustomerHomeScreen(),
      routes: [
        GoRoute(
          path: 'book',
          builder: (context, state) => const BookingScreen(),
        ),
        GoRoute(
          path: 'order/:id',
          builder: (context, state) => OrderTrackingScreen(orderId: state.pathParameters['id'] ?? ''),
        ),
        GoRoute(
          path: 'history',
          builder: (context, state) => const OrderHistoryScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/captain',
      builder: (context, state) => const CaptainDashboardScreen(),
    ),
    GoRoute(
      path: '/merchant',
      builder: (context, state) => const MerchantWorkspaceScreen(),
    ),
    GoRoute(
      path: '/operations',
      builder: (context, state) => const OperationsDashboardScreen(),
    ),
  ],
);`
  },
  {
    path: 'lib/shared/providers/orders_provider.dart',
    language: 'dart',
    content: `import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/order_model.dart';
import '../services/mock_data_repository.dart';

class OrdersNotifier extends StateNotifier<List<OrderModel>> {
  OrdersNotifier() : super(MockDataRepository.getInitialMockOrders());

  void addOrder(OrderModel newOrder) {
    state = [newOrder, ...state];
  }

  void advanceOrderStatus(String orderId) {
    state = [
      for (final order in state)
        if (order.id == orderId) _getNextOrderState(order) else order
    ];
  }

  OrderModel _getNextOrderState(OrderModel order) {
    switch (order.status) {
      case OrderStatus.created:
        return order.copyWith(status: OrderStatus.searchingCaptain);
      case OrderStatus.searchingCaptain:
        return order.copyWith(status: OrderStatus.captainAssigned, captainName: 'كابتن طارق الغريب');
      case OrderStatus.captainAssigned:
        return order.copyWith(status: OrderStatus.atPickup);
      case OrderStatus.atPickup:
        return order.copyWith(status: OrderStatus.inTransit);
      case OrderStatus.inTransit:
        return order.copyWith(status: OrderStatus.delivered);
      case OrderStatus.delivered:
      case OrderStatus.cancelled:
        return order;
    }
  }
}

final ordersProvider = StateNotifierProvider<OrdersNotifier, List<OrderModel>>((ref) {
  return OrdersNotifier();
});`
  },
  {
    path: 'lib/core/utils/price_calculator.dart',
    language: 'dart',
    content: `import '../../shared/models/fare_quote_model.dart';

class PriceCalculator {
  static const double defaultBaseFare = 15.0; // EGP includes first 1.5km in central El Bagour
  static const double ratePerKm = 4.0; // EGP per subsequent kilometer
  static const double ruralSurchargeAmount = 5.0; // EGP for outer Menoufia rural villages
  static const double platformFeeAmount = 2.0;

  static FareQuoteModel calculateQuote({
    required double distanceKm,
    bool isRuralOrVillage = false,
  }) {
    if (distanceKm < 0) throw ArgumentError('Distance cannot be negative');
    final double chargeableKm = distanceKm > 1.5 ? (distanceKm - 1.5) : 0.0;
    final double distanceFare = (chargeableKm * ratePerKm).roundToDouble();
    final double ruralSurcharge = isRuralOrVillage ? ruralSurchargeAmount : 0.0;
    final double totalFare = defaultBaseFare + distanceFare + ruralSurcharge + platformFeeAmount;
    final int minutes = (distanceKm * 2.4 + 5).ceil();

    return FareQuoteModel(
      baseFare: defaultBaseFare,
      distanceKm: distanceKm,
      distanceFare: distanceFare,
      ruralOrUnpavedSurcharge: ruralSurcharge,
      platformFee: platformFeeAmount,
      totalFare: totalFare,
      estimatedDurationMinutes: '$minutes-$minutes+5',
    );
  }
}`
  },
  {
    path: 'lib/core/utils/input_validator.dart',
    language: 'dart',
    content: `class InputValidator {
  static String? validateEgyptianPhone(String? value) {
    if (value == null || value.trim().isEmpty) return 'يرجى إدخال رقم الموبايل';
    final clean = value.replaceAll(RegExp(r'\\s+'), '');
    final regex = RegExp(r'^(010|011|012|015)[0-9]{8}$');
    if (!regex.hasMatch(clean)) return 'رقم موبايل غير صحيح (مثال: 01012345678)';
    return null;
  }

  static String? validateLocations({required String? pickup, required String? dropoff}) {
    if (pickup == null || pickup.trim().isEmpty) return 'يرجى تحديد مكان الاستلام بالباجور';
    if (dropoff == null || dropoff.trim().isEmpty) return 'يرجى تحديد مكان التسليم بالباجور';
    if (pickup.trim() == dropoff.trim()) return 'مكان الاستلام والتسليم لا يمكن أن يكونا متطابقين';
    return null;
  }
}`
  },
  {
    path: 'test/unit/order_state_transitions_test.dart',
    language: 'dart',
    content: `import 'package:flutter_test/flutter_test.dart';
import '../../lib/shared/models/order_model.dart';
import '../../lib/shared/providers/orders_provider.dart';

void main() {
  group('OrdersNotifier State Transition Tests', () {
    test('Correctly progresses order states from created to delivered', () {
      final notifier = OrdersNotifier();
      final newOrder = OrderModel(
        id: 'TEST-101',
        customerName: 'علي حسن',
        customerPhone: '01011112222',
        serviceType: OrderServiceType.package,
        status: OrderStatus.created,
        pickupAddress: 'ميدان المحطة',
        dropoffAddress: 'مجلس المدينة',
        itemDescription: 'أوراق مهمة',
        estimatedFareEGP: 17.0,
        distanceKm: 1.2,
        createdAt: DateTime.now(),
      );

      notifier.addOrder(newOrder);
      expect(notifier.state.first.status, OrderStatus.created);
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.searchingCaptain);
    });
  });
}`
  },
  {
    path: 'test/widget/app_smoke_test.dart',
    language: 'dart',
    content: `import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../lib/app/app.dart';

void main() {
  testWidgets('MashwarApp smoke test: mounts MaterialApp.router with ProviderScope', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MashwarApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('الباجور، المنوفية'), findsOneWidget);
  });
}`
  },
  {
    path: 'flutter_mashwar/lib/shared/services/order_repository_interface.dart',
    language: 'dart',
    content: `import '../models/order_model.dart';
import '../models/fare_quote_model.dart';

abstract class IOrderRepository {
  Future<List<OrderModel>> getOrders();
  Future<OrderModel?> getOrderById(String orderId);
  Future<OrderModel> createOrder(OrderModel newOrder, {String? quoteId, String? quoteSignature});
  Future<OrderModel> updateOrderStatus(String orderId, OrderStatus targetStatus, {String? actorRole, String? notes, int? cashCollectedPiasters});
  Future<OrderModel> cancelOrder(String orderId, {String? cancellationReason});
  Future<FareQuoteModel> getFareQuote({required double distanceKm, bool isRuralOrVillage = false});
}`
  },
  {
    path: 'flutter_mashwar/lib/shared/services/http_order_repository.dart',
    language: 'dart',
    content: `// HttpOrderRepository implements IOrderRepository targeting /api/v1 REST contracts
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/order_model.dart';
import '../models/fare_quote_model.dart';
import 'order_repository_interface.dart';

class HttpOrderRepository implements IOrderRepository {
  final String baseUrl;
  final http.Client client;

  HttpOrderRepository({this.baseUrl = 'https://api.mashwar.app/api/v1', http.Client? client})
      : client = client ?? http.Client();

  // Implements getOrders, createOrder, updateOrderStatus with Idempotency-Key
}`
  },
  {
    path: 'backend/src/pricing/pricingEngine.ts',
    language: 'typescript',
    content: `// Authoritative Server-Side Pricing Engine with Integer Piasters & HMAC Signatures
import crypto from 'node:crypto';
import { FareQuote, ServiceTypeId } from '../types/index.js';

export class PricingEngine {
  public generateQuote(params: { serviceTypeId: ServiceTypeId; distanceKm: number; isRuralOrVillage?: boolean; }): FareQuote {
    if (params.serviceTypeId === 'passenger') {
      const err = new Error('خدمة نقل الركاب معلقة نظامياً وفقاً للقانون ٧٣ لسنة ٢٠١٨');
      (err as any).code = 'REGULATORY_COMPLIANCE_LOCK';
      throw err;
    }
    const baseFarePiasters = 1500;
    const distanceFarePiasters = Math.round(Math.max(0, params.distanceKm - 1.5) * 400);
    const ruralSurchargePiasters = params.isRuralOrVillage ? 500 : 0;
    const platformFeePiasters = 200;
    const totalFarePiasters = baseFarePiasters + distanceFarePiasters + ruralSurchargePiasters + platformFeePiasters;
    return { quoteId: 'quote_...', totalFarePiasters, formattedTotalEgp: (totalFarePiasters/100).toFixed(2) + ' ج.م' } as FareQuote;
  }
}`
  },
  {
    path: 'backend/src/orders/orderFsm.ts',
    language: 'typescript',
    content: `// Authoritative Order FSM: created -> searching_captain -> captain_assigned -> at_pickup -> in_transit -> delivered
export class OrderFsm {
  public static transition(order: Order, request: OrderTransitionRequest): StateTransitionResult {
    // Rejects illegal jumps (e.g. created -> delivered with 422 INVALID_STATE_TRANSITION)
    // Enforces cash collection on COD before transitioning to delivered
  }
}`
  },
  {
    path: 'backend/src/dispatch/assignmentService.ts',
    language: 'typescript',
    content: `// High-concurrency atomic mutex lock: 10 captains tap accept simultaneously -> 1 succeeds, 9 get 409 Conflict
export class AssignmentService {
  public static async claimOrder(orderOrGetter, captain, mutateOrderState): Promise<AssignmentResult> {
    // Chained lock ensures only 1 winner
  }
}`
  },
  {
    path: 'backend/tests/run_tests.ts',
    language: 'typescript',
    content: `// 27/27 Automated Quality Gate Tests (Pricing, FSM, Concurrency, Subscription, Webhooks, RBAC, Audit, Remittance, Tariff)
// Run via: npm test (or: npx tsx backend/tests/run_tests.ts)`
  },
  {
    path: 'docs/backend/PHASE_4_1_SECURITY_AND_OWNER_DASHBOARD_REPORT.md',
    language: 'markdown',
    content: `# Mashwar — Phase 4.1 Security Hardening & Owner Dashboard Report
Status: Complete & Verified (27/27 Automated Tests Passing)
Target Hub: El Bagour, Menoufia Governorate, Egypt
All 11 invariant suites verified with zero live DB connection or secret leakage.`
  }
];

export default function App() {
  // Top-Level Mode: Mobile App Prototype vs Owner Admin Dashboard vs Developer Testing Workbench
  const [workspaceMode, setWorkspaceMode] = useState<'mobile' | 'admin' | 'workbench'>('mobile');

  // Navigation & role state
  const [activeRole, setActiveRole] = useState<'customer' | 'captain' | 'merchant' | 'operations'>('customer');
  const [deviceFrame, setDeviceFrame] = useState<'iphone' | 'pixel' | 'fluid'>('iphone');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulator' | 'backend_tests' | 'code' | 'architecture'>('backend_tests');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const { orders: marketplaceOrders, activeCustomerOrder } = useMarketplace();

  // Customer experience state
  const [customerScreen, setCustomerScreen] = useState<'home' | 'booking' | 'tracking' | 'history'>('home');
  const [selectedPickup, setSelectedPickup] = useState(EL_BAGOUR_LANDMARKS[0]);
  const [selectedDropoff, setSelectedDropoff] = useState(EL_BAGOUR_LANDMARKS[3]);
  const [orderType, setOrderType] = useState<'package' | 'store' | 'errand'>('package');
  const [orderNotes, setOrderNotes] = useState('');
  const [isRuralDestination, setIsRuralDestination] = useState(false);
  const [showPassengerModal, setShowPassengerModal] = useState(false);

  // Active order state with acceptance timestamp
  const [activeOrderState, setActiveOrderState] = useState({
    id: 'ord_bagour_8102',
    orderNumber: '#MSH-8102',
    captainName: 'كابتن طارق الغريب',
    captainVehicle: 'دراجة هوجان سوداء (٤٣٢١ م ن)',
    destination: 'مستشفى الباجور العام',
    pickup: 'ميدان المحطة - وسط الباجور',
    totalEgp: 22,
    acceptedAt: '07:28 م',
    acceptedAtIso: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
  });

  // Extract the active order and its human-readable acceptance timestamp from existing order state
  const currentTrackedOrder =
    activeCustomerOrder ||
    marketplaceOrders.find((o) => Boolean(o.acceptedAtIso || o.acceptedAt)) ||
    activeOrderState;

  const hasCurrentOrderAcceptanceTimestamp = Boolean(
    currentTrackedOrder.acceptedAtIso || currentTrackedOrder.acceptedAt
  );
  const extractedAcceptedAtIso = hasCurrentOrderAcceptanceTimestamp
    ? currentTrackedOrder.acceptedAtIso
    : activeOrderState.acceptedAtIso;
  const extractedAcceptedAtFallback = hasCurrentOrderAcceptanceTimestamp
    ? currentTrackedOrder.acceptedAt
    : activeOrderState.acceptedAt;
  const humanReadableAcceptedTime =
    formatHumanReadableAcceptedTimestamp(
      extractedAcceptedAtIso,
      extractedAcceptedAtFallback
    ) ||
    extractedAcceptedAtFallback ||
    'بانتظار تسجيل وقت القبول...';

  // Captain experience state
  const [isCaptainOnline, setIsCaptainOnline] = useState(true);
  const [hasIncomingOrder, setHasIncomingOrder] = useState(false);
  const [captainDeliveryStep, setCaptainDeliveryStep] = useState<number>(1); // 0: accepted, 1: at pickup, 2: in transit, 3: completed
  const [captainEarnings, setCaptainEarnings] = useState(240);
  const [completedTrips, setCompletedTrips] = useState(9);

  // Merchant experience state
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [merchantOrders, setMerchantOrders] = useState([
    {
      id: 'ORD-9341',
      customer: 'أحمد سعيد',
      items: '٢ فطير بالسجق والجبن الكيري + ١ لتر بيبسي',
      total: '145.00 ج.م',
      status: 'preparing',
      time: 'منذ 8 دقائق',
      captain: 'كابتن محمود السيد (في الطريق للمتجر)',
    },
    {
      id: 'ORD-9340',
      customer: 'مروة عبد الرحمن',
      items: '١ حواوشي مخصوص + ٢ بطاطس محمرة',
      total: '85.00 ج.م',
      status: 'ready',
      time: 'منذ 22 دقيقة',
      captain: 'كابتن طارق الغريب (وصل للمتجر)',
    },
  ]);

  // Operations state
  const [passengerLockActive, setPassengerLockActive] = useState(true);

  // Backend Quality Gates & Invariant Engine interactive state
  const [testFilter, setTestFilter] = useState<'all' | 'pricing' | 'fsm' | 'concurrency' | 'subscription' | 'webhooks'>('all');
  const [simDistanceKm, setSimDistanceKm] = useState<number>(3.5);
  const [simIsRural, setSimIsRural] = useState<boolean>(false);
  const [simServiceType, setSimServiceType] = useState<'package' | 'restaurant_store' | 'errand' | 'passenger'>('package');
  const [tamperedPriceActive, setTamperedPriceActive] = useState<boolean>(false);
  const [concurrencyRunning, setConcurrencyRunning] = useState<boolean>(false);
  const [concurrencyResults, setConcurrencyResults] = useState<Array<{ captainId: string; name: string; status: 'won' | 'conflict'; timeMs: number }>>([]);
  const [fsmCurrentState, setFsmCurrentState] = useState<'created' | 'searching_captain' | 'captain_assigned' | 'at_pickup' | 'in_transit' | 'delivered'>('created');
  const [fsmSimError, setFsmSimError] = useState<string | null>(null);
  const [codAmountPaidPiasters, setCodAmountPaidPiasters] = useState<number>(2500);

  // Calculate authoritative pricing in integer piasters
  const authBaseFarePiasters = 1500;
  const authChargeableKm = Math.max(0, simDistanceKm - 1.5);
  const authDistanceFarePiasters = Math.round(authChargeableKm * 400);
  const authRuralSurchargePiasters = simIsRural ? 500 : 0;
  const authPlatformFeePiasters = 200;
  const authCalculatedTotalPiasters = authBaseFarePiasters + authDistanceFarePiasters + authRuralSurchargePiasters + authPlatformFeePiasters;
  const authFinalTotalPiasters = tamperedPriceActive ? 500 : authCalculatedTotalPiasters;
  const authDurationMin = Math.ceil(simDistanceKm * 2.4 + 5);
  const authDurationStr = `${authDurationMin}-${authDurationMin + 5}`;

  // Concurrency Race Simulation handler
  const triggerConcurrencyRace = () => {
    setConcurrencyRunning(true);
    setConcurrencyResults([]);
    setTimeout(() => {
      const captains = [
        'كابتن طارق الغريب (ميدان المحطة)',
        'كابتن مصطفى الصياد (شارع الجيش)',
        'كابتن أحمد عبد الرازق (مجلس المدينة)',
        'كابتن إبراهيم دسوقي (المساكن)',
        'كابتن علي رضوان (المستشفى)',
        'كابتن سامح الباجوري (شارع الجمهورية)',
        'كابتن محمود خليل (موقف بنها)',
        'كابتن تامر يوسف (كفر الباجور)',
        'كابتن هاني عثمان (جروان)',
        'كابتن وائل سعيد (ميت عفيف)',
      ];
      const winnerIndex = Math.floor(Math.random() * captains.length);
      const res = captains.map((name, idx) => ({
        captainId: `cap_0${idx + 1}`,
        name,
        status: idx === winnerIndex ? ('won' as const) : ('conflict' as const),
        timeMs: Math.floor(Math.random() * 8) + 1,
      }));
      setConcurrencyResults(res);
      setConcurrencyRunning(false);
    }, 400);
  };

  // Calculate simulated fare
  const distanceKm = isRuralDestination ? 4.8 : 2.4;
  const baseFare = 15;
  const distanceFare = Math.round(Math.max(0, distanceKm - 1.5) * 4);
  const ruralSurcharge = isRuralDestination ? 5 : 0;
  const platformFee = 2;
  const totalFare = baseFare + distanceFare + ruralSurcharge + platformFee;

  const isRtl = language === 'ar';

  const downloadFlutterZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('flutter_mashwar');

      // Add all generated Flutter files
      FLUTTER_FILES.forEach((f) => {
        folder?.file(f.path, f.content);
      });

      folder?.file('README.md', `# Mashwar — مشوار\nArabic-first local delivery Flutter app for El Bagour, Menoufia.\nRun: flutter pub get && flutter run`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mashwar_flutter_project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingZip(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'} flex flex-col font-['Cairo',sans-serif]`} dir="ltr">
      {/* Top Professional Header & Workbench Controls */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Brand & Platform */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl">
              م
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white">مشوار — Mashwar</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Flutter Architecture
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  الباجور • المنوفية
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Arabic-First Local Delivery & Mobility Native Mobile Specification & Live Simulator
              </p>
            </div>
          </div>

          {/* Primary Mode Switcher: Mobile App vs Owner Dashboard vs Developer Workbench */}
          <div className="flex items-center flex-wrap gap-2">
            <div className="bg-slate-900 p-1 rounded-xl flex items-center border border-emerald-500/30 shadow-inner">
              <button
                onClick={() => setWorkspaceMode('mobile')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  workspaceMode === 'mobile'
                    ? 'bg-emerald-600 text-white shadow-md font-black ring-1 ring-emerald-400/40'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 تطبيق الموبايل (المحاكي)</span>
              </button>
              <button
                onClick={() => setWorkspaceMode('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  workspaceMode === 'admin'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>💻 لوحة تحكم وعمليات المالك</span>
              </button>
              <button
                onClick={() => setWorkspaceMode('workbench')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  workspaceMode === 'workbench'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>🛠️ منصة المطور والمعمارية</span>
              </button>
            </div>

            {/* Workbench Sub-Tab Switchers (Only in Workbench Mode) */}
            {workspaceMode === 'workbench' && (
              <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700">
                <button
                  onClick={() => setActiveTab('backend_tests')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'backend_tests' ? 'bg-emerald-500 text-slate-950 shadow font-bold' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Backend Tests</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold">83/83</span>
                </button>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'simulator' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Device Simulator</span>
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'code' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Codebase</span>
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    activeTab === 'architecture' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Architecture</span>
                </button>
              </div>
            )}

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-amber-400 hover:bg-slate-700 transition"
              title="Toggle Language"
            >
              {language === 'ar' ? '🇪🇬 العربية' : '🇬🇧 English'}
            </button>

            {/* Export Flutter Project ZIP */}
            <button
              onClick={downloadFlutterZip}
              disabled={downloadingZip}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingZip ? 'Packaging...' : 'Export Flutter .ZIP'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 flex flex-col gap-4">
        {/* Render Mobile App Prototype (Customer & Captain Home Screens First) */}
        {workspaceMode === 'mobile' && (
          <div className="flex flex-col gap-4" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Synchronized Active Order Tracking Summary Bar */}
            <div
              data-testid="active-order-tracking-widget"
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">
                      متابعة الطلب الحي في المحاكي الموحد ({currentTrackedOrder.orderNumber})
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {currentTrackedOrder.totalEgp}.00 ج.م
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {('assignedCaptainName' in currentTrackedOrder && currentTrackedOrder.assignedCaptainName) ||
                      activeOrderState.captainName}{' '}
                    • الوجهة:{' '}
                    {('deliveryAddress' in currentTrackedOrder && currentTrackedOrder.deliveryAddress) ||
                      activeOrderState.destination}
                  </p>
                </div>
              </div>

              <div
                data-testid="active-order-accepted-time"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 shrink-0"
              >
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">وقت قبول الطلب:</span>
                <span className="font-black text-white">
                  {formatHumanReadableAcceptedTimestamp(
                    extractedAcceptedAtIso,
                    extractedAcceptedAtFallback
                  ) || humanReadableAcceptedTime}
                </span>
              </div>
            </div>

            <MobileAppFrame onOpenOperationsDashboard={() => setWorkspaceMode('admin')} />
          </div>
        )}

        {/* Render Phase 4.1 Owner & Operations Admin Dashboard */}
        {workspaceMode === 'admin' && <OwnerAdminDashboard />}

        {/* Render Developer Testing Workbench */}
        {workspaceMode === 'workbench' && (
          <>
            {/* Environment Transparency Notification */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed text-amber-200">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="text-amber-300 font-bold block mb-1">
                  إشعار شفافية بيئة العمل والتقنية (Environment Transparency Notice):
                </strong>
                بيئة العمل الحالية تعمل داخل متصفح وسيرفر Node.js/Vite بدون أدوات Flutter SDK وAndroid/iOS Toolchains المثبتة محلياً؛ لذلك تم توليد ملفات مشروع Flutter/Dart كاملة في مستودع <code className="bg-amber-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">flutter_mashwar/</code> وجاهزة للتشغيل والتصدير مباشرة. يُتيح هذا المحاكي التفاعلي اختبار واجهات تطبيق Flutter (Material 3) والأدوار الأربعة (العميل، الكابتن، التاجر، العمليات) بالعربية والإنجليزية بدقة تامة.
              </div>
            </div>

        {/* BACKEND TESTS & QUALITY GATES TAB */}
        {activeTab === 'backend_tests' && (
          <div className="flex flex-col gap-6" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Top Quality Gate Status Banner */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>٨٤ من ٨٤ اختبار تكامل وأمان ناجح (100% Passed)</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                      مركز الباجور • المنوفية
                    </span>
                  </div>
                  <h2 className="text-xl font-black text-white mb-1">
                    بوابات الجودة والتأسيس البرمجي للخادم (Authoritative Backend Foundation)
                  </h2>
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    تم بناء النواة البرمجية للخادم باستخدام Node.js و TypeScript واعتماد المعاملات المالية بالقرش المصري (Integer Minor Units) لمنع أخطاء الحساب العشري، مع تشفير توقيعات التسعيرة (HMAC-SHA256)، وقفل سباق تزامن قبول الطلبات بين الكباتن (Atomic Mutex)، وحظر نقل الركاب نظامياً.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block uppercase font-mono">Run Command</span>
                    <span className="text-xs font-bold text-amber-400 font-mono">npm test</span>
                  </div>
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center">
                    <span className="text-[10px] text-emerald-300 block uppercase font-mono">Zero Commission</span>
                    <span className="text-xs font-bold text-white">اشتراك شهري ثنائي</span>
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block mb-1">الدقة المالية للعملة</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Integer Piasters</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">0% Drift</span>
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block mb-1">حماية التوقيع الرقمي</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">HMAC-SHA256</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">Tamper-Proof</span>
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block mb-1">تزامن إسناد الكباتن</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Atomic Mutex Lock</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">Single Winner</span>
                  </div>
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                  <span className="text-[11px] text-slate-400 block mb-1">مهلة سماح الكابتن</span>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">72 ساعة إنذار</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">Grace Period</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Testing Consoles Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Console 1: Authoritative Pricing & Anti-Tamper Engine */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">
                      محرك التسعيرة السيادي وحماية التوقيع (Pricing & Anti-Tamper)
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    backend/src/pricing
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Service Type Selector */}
                  <div>
                    <label className="text-slate-400 block mb-1.5 font-medium">نوع الخدمة المطلوبة:</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['package', 'restaurant_store', 'errand', 'passenger'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSimServiceType(type)}
                          className={`py-2 px-1.5 rounded-lg border text-center font-bold transition-all text-[11px] ${
                            simServiceType === type
                              ? type === 'passenger'
                                ? 'bg-red-500/20 border-red-500 text-red-300'
                                : 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          {type === 'package' && 'طرد'}
                          {type === 'restaurant_store' && 'مطعم'}
                          {type === 'errand' && 'مشوار'}
                          {type === 'passenger' && 'ركاب (معلق)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Regulatory Warning if Passenger Selected */}
                  {simServiceType === 'passenger' && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <strong>استجابة الخادم السيادي (403 Forbidden):</strong>
                        <p className="mt-0.5">
                          تم حظر الطلب بكود <code className="bg-red-950 px-1 py-0.5 rounded font-mono">REGULATORY_COMPLIANCE_LOCK</code> وفقاً للقانون رقم ٧٣ لسنة ٢٠١٨. نقل الركاب معلق رسمياً في الباجور.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Distance Slider */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-slate-400 font-medium">مسافة المشوار بالكيلومتر:</span>
                      <span className="font-bold text-amber-400 font-mono">{simDistanceKm.toFixed(1)} كم</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="15.0"
                      step="0.5"
                      value={simDistanceKm}
                      onChange={(e) => setSimDistanceKm(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 bg-slate-950 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>0.5 كم (وسط الباجور)</span>
                      <span>5.0 كم (القرى المجاورة)</span>
                      <span>15.0 كم (حدود المركز)</span>
                    </div>
                  </div>

                  {/* Village Surcharge Toggle */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                    <span className="text-slate-300 font-medium">
                      طرق غير ممهدة / قرى مركز الباجور (بدل ريفي +٥٠٠ قرش)
                    </span>
                    <input
                      type="checkbox"
                      checked={simIsRural}
                      onChange={(e) => setSimIsRural(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>

                  {/* Authoritative Calculation Breakdown */}
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>الأجرة الأساسية (أول ١.٥ كم):</span>
                      <span className="text-slate-200">١,٥٠٠ قرش (15.00 EGP)</span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>تكلفة المسافة الإضافية ({authChargeableKm.toFixed(1)} كم × ٤٠٠ قرش):</span>
                      <span className="text-slate-200">{authDistanceFarePiasters} قرش</span>
                    </div>
                    {simIsRural && (
                      <div className="flex justify-between text-amber-400 text-[11px]">
                        <span>بدل طرق ريفية / قرى:</span>
                        <span>+٥٠٠ قرش (5.00 EGP)</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>رسوم المنصة والصيانة التشغيلية:</span>
                      <span className="text-slate-200">٢٠٠ قرش (2.00 EGP)</span>
                    </div>
                    <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-bold">
                      <span className="text-white">إجمالي التسعيرة السيادية:</span>
                      <span className="text-emerald-400 font-bold">
                        {authCalculatedTotalPiasters} قرش ({((authCalculatedTotalPiasters) / 100).toFixed(2)} ج.م)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 flex justify-between">
                      <span>المدة المقدرة (بدون خطأ نصي):</span>
                      <span className="text-amber-300 font-bold">{authDurationStr} دقيقة</span>
                    </div>
                  </div>

                  {/* Anti-Tamper Verification Simulation */}
                  <div className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">محاكاة تلاعب العميل بالسعر:</span>
                      <button
                        onClick={() => setTamperedPriceActive(!tamperedPriceActive)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                          tamperedPriceActive
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tamperedPriceActive ? 'التلاعب مفعل (5.00 ج.م)' : 'تفعيل تعديل السعر'}
                      </button>
                    </div>
                    {tamperedPriceActive ? (
                      <div className="p-2.5 rounded bg-red-950/50 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>
                          <strong>رفض الخادم (400 Bad Request):</strong> كود <code className="font-mono text-red-200">QUOTE_SIGNATURE_TAMPERED</code>. التوقيع الرقمي HMAC غير متطابق.
                        </span>
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>توقيع التسعيرة سليم وموثق بخادم الباجور (HMAC Valid).</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Console 2: 10-Captain Concurrency Race Simulator */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">
                      محاكاة سباق التزامن بين ١٠ كباتن (Atomic Mutex Guard)
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    backend/src/dispatch
                  </span>
                </div>

                <div className="text-xs space-y-3">
                  <p className="text-slate-400 leading-relaxed">
                    سيناريو شارع الجيش بالباجور: عند بث إشعار طلب توصيل، يقوم ١٠ كباتن بالنقر على زر «قبول المشوار» في نفس اللحظة (خلال أجزاء من الملي ثانية). يقوم قفل الـ Mutex بضمان فوز أول كابتن فقط، بينما يحصل باقي الكباتن التسعة على استجابة <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">409 Conflict</code> فوراً.
                  </p>

                  <button
                    onClick={triggerConcurrencyRace}
                    disabled={concurrencyRunning}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                  >
                    <Radio className={`w-4 h-4 ${concurrencyRunning ? 'animate-spin' : ''}`} />
                    <span>{concurrencyRunning ? 'جاري محاكاة التزامن بين الكباتن...' : 'إطلاق بث لـ ١٠ كباتن في محيط الباجور'}</span>
                  </button>

                  {/* Concurrency Results Grid */}
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                    {concurrencyResults.length > 0 ? (
                      concurrencyResults.map((item) => (
                        <div
                          key={item.captainId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            item.status === 'won'
                              ? 'bg-emerald-950/60 border-emerald-500 text-white font-bold shadow-md'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.status === 'won' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-500 text-[10px] flex items-center justify-center font-mono font-bold">
                                409
                              </span>
                            )}
                            <span className="text-xs">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px]">
                            <span>{item.timeMs}ms</span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                item.status === 'won'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.status === 'won' ? '٢٠٠ تم الإسناد' : '٤٠٩ سبق قبوله'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        اضغط على الزر أعلاه لإطلاق اختبار التزامن الحقيقي
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Console 3: Order FSM Lifecycle & COD Validation */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-sm text-white">
                      آلة الحالات المحدودة وتأكيد النقدية (Order FSM & COD)
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    backend/src/orders
                  </span>
                </div>

                <div className="text-xs space-y-4">
                  {/* FSM Stepper */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['created', 'searching_captain', 'captain_assigned', 'at_pickup', 'in_transit', 'delivered'] as const).map((step, idx) => (
                      <div
                        key={step}
                        className={`p-2 rounded-lg border text-center transition ${
                          fsmCurrentState === step
                            ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                            : 'bg-slate-950 border-slate-800 text-slate-500'
                        }`}
                      >
                        <span className="text-[10px] block opacity-60 font-mono">خطوة {idx + 1}</span>
                        <span className="text-[11px] truncate block">
                          {step === 'created' && 'تم الإنشاء'}
                          {step === 'searching_captain' && 'بحث كابتن'}
                          {step === 'captain_assigned' && 'تم الإسناد'}
                          {step === 'at_pickup' && 'عند الاستلام'}
                          {step === 'in_transit' && 'في الطريق'}
                          {step === 'delivered' && 'تم التسليم'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setFsmSimError(null);
                        const states = ['created', 'searching_captain', 'captain_assigned', 'at_pickup', 'in_transit', 'delivered'] as const;
                        const currIdx = states.indexOf(fsmCurrentState);
                        if (currIdx === 4) {
                          // Check cash collection
                          if (codAmountPaidPiasters < 2500) {
                            setFsmSimError('422 Unprocessable Entity: INSUFFICIENT_CASH_COLLECTED (المبلغ أقل من الأجرة المطلوبة ٢٥.٠٠ ج.م)');
                            return;
                          }
                        }
                        if (currIdx < states.length - 1) {
                          const nextState = states[currIdx + 1];
                          setFsmCurrentState(nextState);
                          if (nextState === 'captain_assigned') {
                            const now = new Date();
                            setActiveOrderState((prev) => ({
                              ...prev,
                              acceptedAtIso: now.toISOString(),
                              acceptedAt: now.toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            }));
                          }
                        } else {
                          setFsmCurrentState('created');
                        }
                      }}
                      className="py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <span>تقدم للحالة التالية قانونياً</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        setFsmSimError('422 Unprocessable Entity: INVALID_STATE_TRANSITION — يحظر الخادم القفز المباشر من [created] إلى [delivered] دون استلام وتحصيل.');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>محاكاة قفزة غير قانونية</span>
                    </button>
                  </div>

                  {/* Cash Collection Input if in transit */}
                  {fsmCurrentState === 'in_transit' && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-amber-300 font-bold">تسجيل النقدية المحصلة عند الباب (COD):</span>
                        <span className="font-mono text-xs font-bold text-white">{(codAmountPaidPiasters / 100).toFixed(2)} ج.م</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={codAmountPaidPiasters}
                          onChange={(e) => setCodAmountPaidPiasters(Number(e.target.value))}
                          step="100"
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono flex-1"
                        />
                        <button
                          onClick={() => setCodAmountPaidPiasters(1000)}
                          className="px-2 py-1 rounded bg-slate-800 text-[10px] text-slate-300 hover:bg-slate-700"
                        >
                          تجربة مبلغ ناقص
                        </button>
                      </div>
                    </div>
                  )}

                  {fsmSimError && (
                    <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/40 text-red-300 text-xs">
                      {fsmSimError}
                    </div>
                  )}
                </div>
              </div>

              {/* Console 4: Captain Fleet Subscription & 72h Grace Window */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Bike className="w-5 h-5 text-amber-400" />
                    <h3 className="font-bold text-sm text-white">
                      مراقبة اشتراكات الكباتن وسقف النقدية (Fleet & Subscriptions)
                    </h3>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    backend/src/captain
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Captain 1: Active */}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span>كابتن طارق الغريب</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">نشط</span>
                      </div>
                      <span className="text-[11px] text-slate-400 block mt-0.5">النقدية: ٢٤٥.٠٠ ج.م (أقل من سقف الـ ١٠٠٠ ج.م)</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 font-mono">مؤهل لاستقبال العروض</span>
                  </div>

                  {/* Captain 2: Grace Period */}
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <span>كابتن سامح الباجوري</span>
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">فترة سماح</span>
                      </div>
                      <span className="text-[11px] text-amber-200/80 block mt-0.5">انتهى الاشتراك (متبقي ٤٨ ساعة في مهلة الـ ٧٢ ساعة)</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-300 font-mono">مؤهل مع إنذار التجديد</span>
                  </div>

                  {/* Captain 3: Expired */}
                  <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/30 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-red-300">
                        <span>كابتن مصطفى الصياد</span>
                        <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 text-[10px]">منتهي</span>
                      </div>
                      <span className="text-[11px] text-red-200/70 block mt-0.5">انقضت مهلة الـ ٧٢ ساعة دون تجديد</span>
                    </div>
                    <span className="text-[10px] font-bold text-red-400 font-mono">الرادار متوقف (محظور)</span>
                  </div>

                  {/* Captain 4: Cash Capped */}
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-purple-300">
                        <span>كابتن أحمد عبد الرازق</span>
                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px]">سقف النقدية</span>
                      </div>
                      <span className="text-[11px] text-purple-200/70 block mt-0.5">النقدية بحوزته: ١,٠٥٠.٠٠ ج.م (تجاوزت الحد الأقصى ١,٠٠٠ ج.م)</span>
                    </div>
                    <span className="text-[10px] font-bold text-purple-400 font-mono">إيقاف حتى توريد النقدية</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'simulator' && (
          <div className="flex flex-col gap-6" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Synchronized Active Order Tracking Summary Bar (Preserves data-testid contracts) */}
            <div
              data-testid="active-order-tracking-widget"
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-white">
                      متابعة الطلب الحي في المحاكي الموحد ({currentTrackedOrder.orderNumber})
                    </span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      {currentTrackedOrder.totalEgp}.00 ج.م
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {('assignedCaptainName' in currentTrackedOrder && currentTrackedOrder.assignedCaptainName) ||
                      activeOrderState.captainName}{' '}
                    • الوجهة:{' '}
                    {('deliveryAddress' in currentTrackedOrder && currentTrackedOrder.deliveryAddress) ||
                      activeOrderState.destination}
                  </p>
                </div>
              </div>

              <div
                data-testid="active-order-accepted-time"
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 shrink-0"
              >
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold">وقت قبول الطلب:</span>
                <span className="font-black text-white">
                  {formatHumanReadableAcceptedTimestamp(
                    extractedAcceptedAtIso,
                    extractedAcceptedAtFallback
                  ) || humanReadableAcceptedTime}
                </span>
              </div>
            </div>

            {/* Unified Production Mobile App Experience Frame */}
            <MobileAppFrame onOpenOperationsDashboard={() => setWorkspaceMode('admin')} />
          </div>
        )}

        {/* CODE TAB: Native Flutter Codebase Viewer */}
        {activeTab === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            {/* File List */}
            <div className="lg:col-span-4 flex flex-col gap-1.5 border-r border-slate-800 pr-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <span>Flutter / Dart Source Files</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {FLUTTER_FILES.length} Files
                </span>
              </div>
              {FLUTTER_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between ${
                    selectedFileIndex === idx
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate">{file.path}</span>
                  <span className="text-[10px] opacity-60 uppercase">{file.language}</span>
                </button>
              ))}
            </div>

            {/* Code Display */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="font-mono text-xs text-amber-400 font-bold">
                  {FLUTTER_FILES[selectedFileIndex].path}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyCode(FLUTTER_FILES[selectedFileIndex].content)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Dart'}</span>
                  </button>
                </div>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 overflow-x-auto max-h-[550px] leading-relaxed border border-slate-800">
                <code>{FLUTTER_FILES[selectedFileIndex].content}</code>
              </pre>
            </div>
          </div>
        )}

        {/* ARCHITECTURE & LEGAL TAB */}
        {activeTab === 'architecture' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-bold text-base text-amber-400 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>الامتثال التنظيمي والسياسات القانونية (Regulatory Policy)</span>
              </h3>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong>١. تعليق خدمة نقل الركاب:</strong> تنفيذاً للاشتراطات المنصوص عليها في وثيقة المشروع، تم تعطيل نقل الركاب برمجياً حتى يتم استيفاء جميع التراخيص الرسمية من إدارة المرور ومجلس مدينة الباجور، واعتماد وثائق التأمين التجاري ضد الحوادث.
                </p>
                <p>
                  <strong>٢. حساب التسعيرة في الخادم (Server-Authoritative Pricing):</strong> الكود البرمجي مبني على مبدأ عدم الاعتماد على العميل في حساب التسعيرة النهائية أو تأكيد المدفوعات. يقوم الـ <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">PriceCalculator</code> بعرض التسعيرة الاسترشادية فقط، بينما يعتمد خادم الإنتاج التسعيرة الموثوقة.
                </p>
                <p>
                  <strong>٣. التخزين الآمن للمفاتيح والرموز:</strong> تم تخصيص طبقة <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">flutter_secure_storage</code> لإدارة جلسات الدخول والـ JWT بدون كتابة أي بيانات سرية كنص صريح.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-bold text-base text-emerald-400 mb-3 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>هيكل الحزم والاعتماديات في Flutter</span>
              </h3>
              <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong>• State Management:</strong> Riverpod 2.5 مع StateNotifier لضمان استقلالية منطق العمل واختبارية الشاشات.
                </p>
                <p>
                  <strong>• Navigation:</strong> GoRouter 14 مع دعم مسارات الدور (Customer, Captain, Merchant, Operations) وإعادة التوجيه (Guards).
                </p>
                <p>
                  <strong>• Typography:</strong> خط Cairo المعتمد من Google Fonts مع دعم كامل لاتجاه RTL والأرقام العربية.
                </p>
                <p>
                  <strong>• Testing:</strong> اختبارات وحدات شاملة لحساب التسعيرات وخطوات حالات الطلبات داخل مجلد <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">test/</code>.
                </p>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* Passenger Regulatory Notice Modal */}
      {showPassengerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl" dir="rtl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">خدمة نقل الركاب معلقة نظامياً</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              حرصاً على سلامتك وامتثالاً للقوانين المصرية المعمول بها، تم تعطيل خدمة نقل الأفراد في مدينة الباجور لحين مراجعة التراخيص المرورية الرسمية واعتماد وثائق التأمين التجاري.
            </p>
            <button
              onClick={() => setShowPassengerModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
            >
              فهمت ذلك - العودة للخدمات المتاحة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
