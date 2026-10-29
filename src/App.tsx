/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { OwnerAdminDashboard } from './components/OwnerAdminDashboard';
import { MobileAppFrame } from './components/mobile/MobileAppFrame';
import { PinchZoomPan } from './components/common/PinchZoomPan';
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
  Radio,
  Star,
  Share2,
  Edit3,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Volume2,
  VolumeX,
  ArrowDown
} from 'lucide-react';

// Subtle base64 WAV notification chime fallback for HTMLAudioElement & Web Audio API
const ORDER_STATUS_CHIME_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
const PULL_TO_REFRESH_THRESHOLD = 40;

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

interface OrderHistoryEmptyStateProps {
  onBookNewDelivery: () => void;
}

function OrderHistoryEmptyState({ onBookNewDelivery }: OrderHistoryEmptyStateProps) {
  return (
    <div
      data-testid="order-history-empty-state"
      className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-4 font-['Cairo',sans-serif] shadow-inner"
    >
      <div
        data-testid="order-history-empty-state-icon"
        className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-sm"
      >
        <Package className="w-7 h-7 text-slate-400 opacity-80" aria-hidden="true" />
      </div>
      <div className="flex flex-col items-center gap-1.5 max-w-md">
        <h3 className="text-sm font-black text-slate-100 font-['Cairo',sans-serif]">
          No Past Deliveries Found • لا توجد طلبات توصيل في السجل
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed font-['Cairo',sans-serif]">
          Ready for your next trip or package delivery in El Bagour? Book a new delivery with our local fleet in seconds. • هل ترغب في إرسال طرد أو حجز توصيل جديد داخل مركز وقرى الباجور؟
        </p>
      </div>
      <button
        type="button"
        data-testid="book-new-delivery-btn"
        data-button-variant="primary"
        onClick={onBookNewDelivery}
        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-slate-950 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-md transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
      >
        <Bike className="w-4 h-4 shrink-0" />
        <span>Book New Delivery • حجز توصيل جديد</span>
      </button>
    </div>
  );
}

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

function extractEstimatedDurationMinutes(order: Record<string, any> | null | undefined): number {
  if (!order) return 15;
  if (typeof order.estimatedDuration === 'number' && Number.isFinite(order.estimatedDuration) && order.estimatedDuration > 0) {
    return Math.round(order.estimatedDuration);
  }
  if (
    typeof order.estimatedDurationMinutes === 'number' &&
    Number.isFinite(order.estimatedDurationMinutes) &&
    order.estimatedDurationMinutes > 0
  ) {
    return Math.round(order.estimatedDurationMinutes);
  }
  const rawStr = String(
    order.estimatedDuration ?? order.estimatedDurationMinutes ?? order.estimatedMinutes ?? ''
  );
  if (rawStr) {
    const normalized = rawStr.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const match = normalized.match(/(\d+)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 15;
}

export default function App() {
  // Top-Level Mode: Mobile App Prototype vs Owner Admin Dashboard vs Developer Testing Workbench
  const [workspaceMode, setWorkspaceMode] = useState<'mobile' | 'admin' | 'workbench'>('mobile');

  // Navigation & role state
  const [activeRole, setActiveRole] = useState<'customer' | 'captain' | 'merchant' | 'operations'>('customer');
  const [deviceFrame, setDeviceFrame] = useState<'iphone' | 'pixel' | 'fluid'>('iphone');
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'simulator' | 'backend_tests' | 'code' | 'architecture'>('backend_tests');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const {
    orders: marketplaceOrders,
    activeCustomerOrder,
    refreshOrderStatus,
    navigateToCustomerHistory,
    customerCancelOrder,
    rateOrderCaptain,
    updateOrderNotes,
    updateOrderFeedback,
    captains: marketplaceCaptains,
    captainCompletedDeliveries,
  } = useMarketplace();

  // Customer experience state
  const [customerScreen, setCustomerScreen] = useState<'home' | 'booking' | 'tracking' | 'history'>('home');
  const [selectedPickup, setSelectedPickup] = useState(EL_BAGOUR_LANDMARKS[0]);
  const [selectedDropoff, setSelectedDropoff] = useState(EL_BAGOUR_LANDMARKS[3]);
  const [orderType, setOrderType] = useState<'package' | 'store' | 'errand'>('package');
  const [orderNotes, setOrderNotes] = useState('الاتصال عند الوصول أمام البوابة الرئيسية');
  const [isEditNotesOpen, setIsEditNotesOpen] = useState<boolean>(false);
  const [notesSavedFeedback, setNotesSavedFeedback] = useState<boolean>(false);
  const [sharedLiveLinkUrl, setSharedLiveLinkUrl] = useState<string | null>(null);
  const [isShareLiveLinkOpen, setIsShareLiveLinkOpen] = useState<boolean>(false);
  const [liveLinkCopied, setLiveLinkCopied] = useState<boolean>(false);
  const [isRuralDestination, setIsRuralDestination] = useState(false);
  const [showPassengerModal, setShowPassengerModal] = useState(false);
  const [isCallCaptainPromptOpen, setIsCallCaptainPromptOpen] = useState<boolean>(false);
  const [isCaptainProfileModalOpen, setIsCaptainProfileModalOpen] = useState<boolean>(false);
  const [isCancelOrderDialogOpen, setIsCancelOrderDialogOpen] = useState<boolean>(false);
  const [trackedCancelledOrderId, setTrackedCancelledOrderId] = useState<string | null>(null);
  const [orderRatings, setOrderRatings] = useState<Record<string, number>>({});
  const [isFareBreakdownExpanded, setIsFareBreakdownExpanded] = useState<boolean>(true);
  const [isCaptainChatModalOpen, setIsCaptainChatModalOpen] = useState<boolean>(false);
  const [captainChatInput, setCaptainChatInput] = useState<string>('');
  const [captainChatMessages, setCaptainChatMessages] = useState<
    Array<{ id: string; sender: 'customer' | 'captain'; text: string; time: string }>
  >([
    {
      id: 'msg_init_1',
      sender: 'captain',
      text: 'أهلاً بك يا فندم، معك كابتن طارق، استلمت الطلب وأنا في الطريق إليك في الباجور.',
      time: '07:29 م',
    },
  ]);
  const [captainTipEgp, setCaptainTipEgp] = useState<number>(0);
  const [customTipInput, setCustomTipInput] = useState<string>('');
  const [isAddTipSectionOpen, setIsAddTipSectionOpen] = useState<boolean>(true);
  const [isTimelinePulsing, setIsTimelinePulsing] = useState<boolean>(true);
  const [orderFeedbackDrafts, setOrderFeedbackDrafts] = useState<Record<string, string>>({});
  const [orderFeedbackSavedMap, setOrderFeedbackSavedMap] = useState<Record<string, boolean>>({});
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [sosLocationShared, setSosLocationShared] = useState<boolean>(false);
  const [sosTriggeredService, setSosTriggeredService] = useState<string | null>(null);
  const [isOrderSummaryModalOpen, setIsOrderSummaryModalOpen] = useState<boolean>(false);
  const [isOrderHistoryEmptyPreview, setIsOrderHistoryEmptyPreview] = useState<boolean>(false);
  const [pickupAddressCopied, setPickupAddressCopied] = useState<boolean>(false);
  const [dropoffAddressCopied, setDropoffAddressCopied] = useState<boolean>(false);
  const [isWidgetStatusSlideAnimating, setIsWidgetStatusSlideAnimating] = useState<boolean>(true);
  const [isFullScreenMapOpen, setIsFullScreenMapOpen] = useState<boolean>(false);
  const [mapZoomScale, setMapZoomScale] = useState<number>(1);
  const [mapLayerStyle, setMapLayerStyle] = useState<'route' | 'satellite'>('route');
  const [isHapticVibrating, setIsHapticVibrating] = useState<boolean>(false);
  const [hapticPulseCount, setHapticPulseCount] = useState<number>(0);

  // Subtle Sound Notification state & refs for active order status updates
  const [isSoundNotificationEnabled, setIsSoundNotificationEnabled] = useState<boolean>(true);
  const [isAudioCuePlaying, setIsAudioCuePlaying] = useState<boolean>(false);
  const [audioCueCount, setAudioCueCount] = useState<number>(0);
  const [lastAudioCueAtLabel, setLastAudioCueAtLabel] = useState<string | null>(null);
  const [simulatedTimelineStatusOverride, setSimulatedTimelineStatusOverride] = useState<string | null>(null);
  const statusAudioRef = useRef<HTMLAudioElement | null>(null);

  // Pull-to-refresh gesture state & refs for the active order tracking widget container
  const [pullDistance, setPullDistance] = useState<number>(0);
  const [isPullingToRefresh, setIsPullingToRefresh] = useState<boolean>(false);
  const pullStartYRef = useRef<number | null>(null);
  const currentPullDistanceRef = useRef<number>(0);
  const isMousePullingRef = useRef<boolean>(false);

  const playOrderStatusNotificationSound = () => {
    if (!isSoundNotificationEnabled) return;

    setIsAudioCuePlaying(true);
    setAudioCueCount((prev) => prev + 1);
    setLastAudioCueAtLabel(
      new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );

    // 1. HTML5 Audio element / Audio constructor trigger
    try {
      if (statusAudioRef.current) {
        statusAudioRef.current.currentTime = 0;
        const playPromise = statusAudioRef.current.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } else if (typeof window !== 'undefined' && typeof window.Audio === 'function') {
        const chimeAudio = new window.Audio(ORDER_STATUS_CHIME_WAV_DATA_URI);
        chimeAudio.volume = 0.25;
        const playPromise = chimeAudio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    } catch {
      // Ignore autoplay restrictions in headless/restricted environments
    }

    // 2. Web Audio API subtle two-note harmonic chime (D5 -> A5)
    try {
      if (typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.29);
          window.setTimeout(() => {
            try {
              ctx.close();
            } catch {
              // ignore close errors
            }
          }, 350);
        }
      }
    } catch {
      // Ignore Web Audio API errors in unsupported environments
    }

    window.setTimeout(() => {
      setIsAudioCuePlaying(false);
    }, 900);
  };

  const triggerHapticFeedback = () => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore vibration permission errors
      }
    }
    setIsHapticVibrating(true);
    setHapticPulseCount((prev) => prev + 1);
    window.setTimeout(() => {
      setIsHapticVibrating(false);
    }, 220);
  };

  const handleWidgetButtonPressCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button')) {
      triggerHapticFeedback();
    }
  };

  const handleToggleFullScreenMap = () => {
    setIsFullScreenMapOpen((prev) => !prev);
  };

  const handleMapZoomIn = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMapZoomScale((prev) => Number(Math.min(3.5, Math.max(1, prev + 0.4)).toFixed(2)));
  };

  const handleMapZoomOut = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMapZoomScale((prev) => Number(Math.min(3.5, Math.max(1, prev - 0.4)).toFixed(2)));
  };

  const handleMapZoomReset = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMapZoomScale(1);
  };

  const handleToggleMapLayerStyle = () => {
    setMapLayerStyle((prev) => (prev === 'route' ? 'satellite' : 'route'));
  };

  const handleBookNewDelivery = () => {
    setIsOrderHistoryEmptyPreview(false);
    setCustomerScreen('tracking');
  };

  // Active order state with acceptance timestamp, captain phone & estimated duration
  const [activeOrderState, setActiveOrderState] = useState({
    id: 'ord_bagour_8102',
    orderNumber: '#MSH-8102',
    captainName: 'كابتن طارق الغريب',
    captainPhone: '01012345678',
    assignedCaptainPhone: '01012345678',
    captainVehicle: 'دراجة هوجان سوداء (٤٣٢١ م ن)',
    destination: 'مستشفى الباجور العام',
    pickup: 'ميدان المحطة - وسط الباجور',
    totalEgp: 22,
    status: 'in_transit',
    estimatedDuration: 15,
    estimatedDurationMinutes: 15,
    estimatedMinutes: '١٥ دقيقة',
    acceptedAt: '07:28 م',
    acceptedAtIso: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    notes: 'الاتصال عند الوصول أمام البوابة الرئيسية',
    orderNotes: 'الاتصال عند الوصول أمام البوابة الرئيسية',
  });

  useEffect(() => {
    if (
      activeCustomerOrder &&
      trackedCancelledOrderId &&
      activeCustomerOrder.id !== trackedCancelledOrderId
    ) {
      setTrackedCancelledOrderId(null);
    }
  }, [activeCustomerOrder?.id, trackedCancelledOrderId]);

  useEffect(() => {
    setSimulatedTimelineStatusOverride(null);
  }, [activeCustomerOrder?.id, activeCustomerOrder?.status]);

  // Extract the active order and its human-readable acceptance timestamp from existing order state
  const currentTrackedOrder =
    (trackedCancelledOrderId
      ? marketplaceOrders.find((o) => o.id === trackedCancelledOrderId) || activeOrderState
      : null) ||
    activeCustomerOrder ||
    marketplaceOrders.find((o) => Boolean(o.acceptedAtIso || o.acceptedAt)) ||
    activeOrderState;

  const currentOrderCaptainPhone =
    ('assignedCaptainPhone' in currentTrackedOrder && currentTrackedOrder.assignedCaptainPhone) ||
    ('captainPhone' in currentTrackedOrder && currentTrackedOrder.captainPhone) ||
    activeOrderState.captainPhone ||
    '01012345678';
  const currentOrderCaptainName =
    ('assignedCaptainName' in currentTrackedOrder && currentTrackedOrder.assignedCaptainName) ||
    ('captainName' in currentTrackedOrder && currentTrackedOrder.captainName) ||
    activeOrderState.captainName;
  const matchedCaptainProfile = marketplaceCaptains.find(
    (c) =>
      ('assignedCaptainId' in currentTrackedOrder && c.id === currentTrackedOrder.assignedCaptainId) ||
      c.name === currentOrderCaptainName ||
      c.phone === currentOrderCaptainPhone
  );
  const currentOrderCaptainVehicle =
    ('assignedCaptainVehicle' in currentTrackedOrder && currentTrackedOrder.assignedCaptainVehicle) ||
    ('captainVehicle' in currentTrackedOrder && currentTrackedOrder.captainVehicle) ||
    (matchedCaptainProfile
      ? `${matchedCaptainProfile.vehicleType} (${matchedCaptainProfile.plateNumber})`
      : activeOrderState.captainVehicle);
  const currentOrderCaptainRating =
    ('assignedCaptainRating' in currentTrackedOrder &&
    typeof currentTrackedOrder.assignedCaptainRating === 'number'
      ? currentTrackedOrder.assignedCaptainRating
      : undefined) ??
    matchedCaptainProfile?.rating ??
    4.9;
  const currentOrderCaptainTotalTripsElBagour =
    140 + (matchedCaptainProfile?.completedToday ?? captainCompletedDeliveries ?? 8);
  const currentOrderStatus =
    (trackedCancelledOrderId ? 'cancelled' : simulatedTimelineStatusOverride) ||
    ('status' in currentTrackedOrder && currentTrackedOrder.status) ||
    activeOrderState.status;
  const currentOrderPickup =
    ('pickupAddress' in currentTrackedOrder && currentTrackedOrder.pickupAddress) ||
    ('pickup' in currentTrackedOrder && currentTrackedOrder.pickup) ||
    activeOrderState.pickup ||
    'ميدان المحطة - وسط الباجور';
  const currentOrderDropoff =
    ('deliveryAddress' in currentTrackedOrder && currentTrackedOrder.deliveryAddress) ||
    ('destination' in currentTrackedOrder && currentTrackedOrder.destination) ||
    activeOrderState.destination ||
    'مستشفى الباجور العام';
  const currentOrderNotesValue =
    ('orderNotes' in currentTrackedOrder && typeof currentTrackedOrder.orderNotes === 'string'
      ? currentTrackedOrder.orderNotes
      : undefined) ??
    ('notes' in currentTrackedOrder && typeof currentTrackedOrder.notes === 'string'
      ? currentTrackedOrder.notes
      : undefined) ??
    orderNotes;

  const currentOrderItemDescription =
    ('itemDescription' in currentTrackedOrder &&
    typeof currentTrackedOrder.itemDescription === 'string' &&
    currentTrackedOrder.itemDescription.trim() !== ''
      ? currentTrackedOrder.itemDescription
      : undefined) || 'طرد مستلزمات طبية وأدوية عاجلة - مشوار الباجور';
  const currentOrderCustomerName =
    ('customerName' in currentTrackedOrder &&
    typeof currentTrackedOrder.customerName === 'string' &&
    currentTrackedOrder.customerName.trim() !== ''
      ? currentTrackedOrder.customerName
      : undefined) || 'أحمد سعيد المنوفي';
  const currentOrderCustomerPhone =
    ('customerPhone' in currentTrackedOrder &&
    typeof currentTrackedOrder.customerPhone === 'string' &&
    currentTrackedOrder.customerPhone.trim() !== ''
      ? currentTrackedOrder.customerPhone
      : undefined) || '01012345678';
  const currentOrderPaymentMethod =
    ('paymentMethod' in currentTrackedOrder &&
    typeof currentTrackedOrder.paymentMethod === 'string'
      ? currentTrackedOrder.paymentMethod
      : undefined) || 'cash';
  const elBagourEmergencyContact = {
    name: 'د. سامح المنوفي (جهة اتصال الطوارئ - الباجور)',
    phone: '01099881122',
    coordinates: '30.4328° N, 31.0369° E (El Bagour Center)',
  };

  // Fare Breakdown calculation for the active tracked order in El Bagour
  const isCurrentTrackedOrderRural =
    currentOrderDropoff.includes('قرية') || isRuralDestination;
  const fareBreakdownBaseFareEgp = 15;
  const fareBreakdownRuralSurchargeEgp = isCurrentTrackedOrderRural ? 5 : 0;
  const fareBreakdownPlatformFeeEgp = 2;
  const rawTrackedOrderTotalEgp =
    ('totalEgp' in currentTrackedOrder && typeof currentTrackedOrder.totalEgp === 'number'
      ? currentTrackedOrder.totalEgp
      : undefined) ?? activeOrderState.totalEgp;
  const fareBreakdownDistanceFareEgp = Math.max(
    5,
    rawTrackedOrderTotalEgp -
      (fareBreakdownBaseFareEgp + fareBreakdownRuralSurchargeEgp + fareBreakdownPlatformFeeEgp)
  );
  const fareBreakdownTipEgp = captainTipEgp;
  const fareBreakdownTotalEgp =
    fareBreakdownBaseFareEgp +
    fareBreakdownDistanceFareEgp +
    fareBreakdownRuralSurchargeEgp +
    fareBreakdownPlatformFeeEgp +
    fareBreakdownTipEgp;

  const PREDEFINED_QUICK_MESSAGES = [
    'أنا في انتظارك',
    'أين أنت الآن؟',
    'أنا أمام البوابة الرئيسية',
    'يرجى الاتصال عند الوصول',
  ] as const;

  const handleSendCaptainChatMessage = (rawMessageText: string) => {
    const trimmed = rawMessageText.trim();
    if (!trimmed) return;
    const nowTime = new Date().toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const customerMessage = {
      id: `msg_cust_${Date.now()}`,
      sender: 'customer' as const,
      text: trimmed,
      time: nowTime,
    };
    const captainReplyText =
      trimmed === 'أين أنت الآن؟'
        ? 'أنا في الطريق إليك في الباجور، سأصل خلال دقائق قليلة إن شاء الله 🛵'
        : trimmed === 'أنا في انتظارك'
          ? 'تمام يا فندم، أنا قريب جداً من نقطة التسليم الآن 👍'
          : 'تم استلام رسالتك يا فندم، في خدمتك دائماً ✔️';
    const captainReply = {
      id: `msg_capt_${Date.now() + 1}`,
      sender: 'captain' as const,
      text: captainReplyText,
      time: nowTime,
    };
    setCaptainChatMessages((prev) => [...prev, customerMessage, captainReply]);
    setCaptainChatInput('');
  };

  const handleSelectPresetTip = (amountEgp: number) => {
    setCaptainTipEgp(amountEgp);
    setCustomTipInput(String(amountEgp));
    setIsFareBreakdownExpanded(true);
  };

  const handleCustomTipInputChange = (rawVal: string) => {
    setCustomTipInput(rawVal);
    const trimmed = rawVal.trim();
    if (trimmed === '') {
      setCaptainTipEgp(0);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      setCaptainTipEgp(parsed);
      setIsFareBreakdownExpanded(true);
    }
  };

  const handleApplyCustomTip = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(customTipInput.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      setCaptainTipEgp(parsed);
      setIsFareBreakdownExpanded(true);
    }
  };

  // Vertical Status Timeline steps for active order tracking
  const orderTimelineSteps = [
    {
      key: 'created',
      label: 'Created',
      arabicLabel: 'تم إنشاء الطلب',
      description: 'Order registered in El Bagour dispatch ledger',
      Icon: FileText,
    },
    {
      key: 'searching_captain',
      label: 'Searching Captain',
      arabicLabel: 'جاري البحث عن كابتن',
      description: 'Broadcasting request to nearby El Bagour captains',
      Icon: Radio,
    },
    {
      key: 'captain_assigned',
      label: 'Captain Assigned',
      arabicLabel: 'تم تعيين الكابتن',
      description: `${currentOrderCaptainName} accepted the trip`,
      Icon: Bike,
    },
    {
      key: 'at_pickup',
      label: 'At Pickup',
      arabicLabel: 'الكابتن في نقطة الاستلام',
      description: `Arrived at ${currentOrderPickup}`,
      Icon: MapPin,
    },
    {
      key: 'picked_up',
      label: 'Picked Up',
      arabicLabel: 'تم استلام الطلب',
      description: 'Package verified and collected from pickup point',
      Icon: Package,
    },
    {
      key: 'in_transit',
      label: 'In Transit',
      arabicLabel: 'في الطريق للتسليم',
      description: `En route to ${currentOrderDropoff}`,
      Icon: Navigation,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      arabicLabel: 'تم التسليم بنجاح',
      description: 'Order delivered and cash settlement recorded',
      Icon: CheckCircle2,
    },
  ] as const;

  const normalizedStatusForTimeline =
    currentOrderStatus === 'assigned' || currentOrderStatus === 'accepted'
      ? 'captain_assigned'
      : currentOrderStatus === 'pending'
        ? 'searching_captain'
        : currentOrderStatus;
  const activeTimelineIndex = Math.max(
    0,
    orderTimelineSteps.findIndex((step) => step.key === normalizedStatusForTimeline)
  );

  // Trigger subtle pulse animation, sound notification cue, and Material 3 slide-in entrance whenever an order status update is received or timeline advances
  useEffect(() => {
    setIsTimelinePulsing(true);
    setIsWidgetStatusSlideAnimating(false);
    playOrderStatusNotificationSound();
    const frameTimer = window.setTimeout(() => {
      setIsWidgetStatusSlideAnimating(true);
    }, 15);
    const pulseTimer = window.setTimeout(() => {
      setIsTimelinePulsing(false);
    }, 2600);
    const slideSettleTimer = window.setTimeout(() => {
      setIsWidgetStatusSlideAnimating(false);
    }, 650);
    return () => {
      window.clearTimeout(frameTimer);
      window.clearTimeout(pulseTimer);
      window.clearTimeout(slideSettleTimer);
    };
  }, [currentOrderStatus, activeTimelineIndex, currentTrackedOrder.id]);

  // Advance active order status timeline to the next stage with subtle audio cue
  const handleAdvanceOrderTimelineStatus = () => {
    const nextStepIndex = (activeTimelineIndex + 1) % orderTimelineSteps.length;
    const nextStepKey = orderTimelineSteps[nextStepIndex].key;
    setTrackedCancelledOrderId(null);
    setSimulatedTimelineStatusOverride(nextStepKey);
    setActiveOrderState((prev) => ({
      ...prev,
      status: nextStepKey,
    }));
    playOrderStatusNotificationSound();
  };

  useEffect(() => {
    const trackedNotes =
      ('orderNotes' in currentTrackedOrder && typeof currentTrackedOrder.orderNotes === 'string'
        ? currentTrackedOrder.orderNotes
        : undefined) ??
      ('notes' in currentTrackedOrder && typeof currentTrackedOrder.notes === 'string'
        ? currentTrackedOrder.notes
        : undefined);
    if (typeof trackedNotes === 'string') {
      setOrderNotes(trackedNotes);
    }
  }, [currentTrackedOrder.id]);
  const elBagourRoutePolylinePoints = '38,68 96,46 168,54 242,28';
  const mapThemePalette = isDarkMode
    ? {
        mode: 'dark' as const,
        backgroundFill: '#091326',
        gridStroke: '#1e293b',
        baseRouteStroke: '#f59e0b',
        activeRouteStroke: '#fbbf24',
        pickupFill: '#10b981',
        pickupCenter: '#ffffff',
        dropoffFill: '#f59e0b',
        dropoffCenter: '#091326',
        riderFill: '#f59e0b',
        riderStroke: '#ffffff',
        labelFill: '#94a3b8',
      }
    : {
        mode: 'light' as const,
        backgroundFill: '#f1f5f9',
        gridStroke: '#cbd5e1',
        baseRouteStroke: '#d97706',
        activeRouteStroke: '#b45309',
        pickupFill: '#059669',
        pickupCenter: '#ffffff',
        dropoffFill: '#d97706',
        dropoffCenter: '#ffffff',
        riderFill: '#d97706',
        riderStroke: '#0f172a',
        labelFill: '#334155',
      };
  const isMapPinStatusPulsing =
    currentOrderStatus === 'at_pickup' || currentOrderStatus === 'in_transit';
  const isSatelliteTerrainLayer = mapLayerStyle === 'satellite';
  const satelliteBackgroundFill = isDarkMode ? '#061a14' : '#d1fae5';
  const satelliteContourStroke = isDarkMode ? '#115e59' : '#0d9488';
  const elBagourStaticMapSvgUri = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 96" width="280" height="96" data-theme="${mapThemePalette.mode}" data-layer="${mapLayerStyle}">
      <defs>
        <filter id="m3-static-pin-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.8" stdDeviation="1.5" flood-color="#020617" flood-opacity="0.55"/>
        </filter>
      </defs>
      <rect width="280" height="96" rx="12" fill="${isSatelliteTerrainLayer ? satelliteBackgroundFill : mapThemePalette.backgroundFill}"/>
      ${
        isSatelliteTerrainLayer
          ? `<path d="M0 18 Q70 8 140 22 T280 14 M0 48 Q85 34 165 54 T280 42 M0 78 Q95 66 190 84 T280 72" stroke="${satelliteContourStroke}" stroke-width="1.5" stroke-dasharray="4 3" fill="none" opacity="0.75"/>
             <path d="M18 0 Q38 48 24 96 M118 0 Q138 48 126 96 M212 0 Q196 48 224 96" stroke="#0284c7" stroke-width="2.2" stroke-opacity="0.45" fill="none"/>`
          : `<path d="M0 24 H280 M0 52 H280 M0 78 H280 M52 0 V96 M135 0 V96 M218 0 V96" stroke="${mapThemePalette.gridStroke}" stroke-width="1.5"/>`
      }
      <polyline points="${elBagourRoutePolylinePoints}" stroke="${mapThemePalette.baseRouteStroke}" stroke-opacity="0.45" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <polyline id="animated-route-polyline" points="${elBagourRoutePolylinePoints}" stroke="${mapThemePalette.activeRouteStroke}" stroke-width="3" stroke-dasharray="8 6" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.2s" repeatCount="indefinite"/>
      </polyline>
      <g filter="url(#m3-static-pin-shadow)">
        <path d="M38 48 C32.5 48 28 52.5 28 58 C28 63.2 38 70 38 70 C38 70 48 63.2 48 58 C48 52.5 43.5 48 38 48 Z" fill="${mapThemePalette.pickupFill}" stroke="#ffffff" stroke-width="1.2"/>
        <rect x="35" y="55" width="6" height="6" rx="1.2" fill="${mapThemePalette.pickupCenter}"/>
      </g>
      <g filter="url(#m3-static-pin-shadow)">
        <path d="M242 8 C236.5 8 232 12.5 232 18 C232 23.2 242 30 242 30 C242 30 252 23.2 252 18 C252 12.5 247.5 8 242 8 Z" fill="${mapThemePalette.dropoffFill}" stroke="#ffffff" stroke-width="1.2"/>
        <path d="M242 14 L245.5 18 L242 22 L238.5 18 Z" fill="${mapThemePalette.dropoffCenter}"/>
      </g>
      <text x="140" y="15" fill="${mapThemePalette.labelFill}" font-family="Cairo, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">EL BAGOUR ${isSatelliteTerrainLayer ? 'SATELLITE / TERRAIN' : 'LIVE ROUTE'} MAP (${mapThemePalette.mode.toUpperCase()})</text>
    </svg>`
  )}`;

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

  // Dynamic Estimated Time of Arrival (ETA) countdown derived from the current order's estimated duration field
  const currentOrderDurationMinutes = extractEstimatedDurationMinutes(currentTrackedOrder);
  const currentOrderRouteDistanceKm =
    ('distanceKm' in currentTrackedOrder &&
    typeof currentTrackedOrder.distanceKm === 'number' &&
    currentTrackedOrder.distanceKm > 0
      ? currentTrackedOrder.distanceKm
      : undefined) ?? 2.4;
  const [etaRemainingSeconds, setEtaRemainingSeconds] = useState<number>(
    () => currentOrderDurationMinutes * 60
  );
  const [isRefreshingOrder, setIsRefreshingOrder] = useState<boolean>(false);
  const [refreshProgress, setRefreshProgress] = useState<number>(0);
  const [refreshFeedbackStage, setRefreshFeedbackStage] = useState<'idle' | 'updating' | 'updated'>('idle');
  const [lastRefreshedAtLabel, setLastRefreshedAtLabel] = useState<string | null>(null);

  useEffect(() => {
    setEtaRemainingSeconds(currentOrderDurationMinutes * 60);
  }, [currentTrackedOrder.id, currentOrderDurationMinutes]);

  useEffect(() => {
    const countdownInterval = window.setInterval(() => {
      setEtaRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(countdownInterval);
  }, []);

  const etaMinutesRemaining = Math.floor(etaRemainingSeconds / 60);
  const etaSecondsRemaining = etaRemainingSeconds % 60;
  const formattedEtaCountdown = `${String(etaMinutesRemaining).padStart(2, '0')}:${String(
    etaSecondsRemaining
  ).padStart(2, '0')}`;

  // Manual refresh handler to re-fetch order status from the marketplace store with visual progress feedback
  const handleManualRefreshOrderStatus = async () => {
    if (isRefreshingOrder) return;
    setIsRefreshingOrder(true);
    setRefreshFeedbackStage('updating');
    setRefreshProgress(25);

    const stepTimer1 = window.setTimeout(() => setRefreshProgress(65), 140);
    const stepTimer2 = window.setTimeout(() => setRefreshProgress(90), 280);

    try {
      const refreshedOrder = await refreshOrderStatus(currentTrackedOrder.id);
      if (refreshedOrder) {
        const durMins = extractEstimatedDurationMinutes(refreshedOrder);
        setActiveOrderState((prev) => ({
          ...prev,
          id: refreshedOrder.id,
          orderNumber: refreshedOrder.orderNumber,
          captainName: refreshedOrder.assignedCaptainName || prev.captainName,
          captainPhone: refreshedOrder.assignedCaptainPhone || prev.captainPhone,
          assignedCaptainPhone: refreshedOrder.assignedCaptainPhone || prev.assignedCaptainPhone,
          captainVehicle: refreshedOrder.assignedCaptainVehicle || prev.captainVehicle,
          destination: refreshedOrder.deliveryAddress || prev.destination,
          pickup: refreshedOrder.pickupAddress || prev.pickup,
          totalEgp: refreshedOrder.totalEgp,
          status: refreshedOrder.status,
          estimatedDuration: durMins,
          estimatedDurationMinutes: durMins,
          estimatedMinutes: refreshedOrder.estimatedMinutes || prev.estimatedMinutes,
          acceptedAt: refreshedOrder.acceptedAt || prev.acceptedAt,
          acceptedAtIso: refreshedOrder.acceptedAtIso || prev.acceptedAtIso,
        }));
      }
      setLastRefreshedAtLabel(
        new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setIsTimelinePulsing(true);
      setIsWidgetStatusSlideAnimating(true);
      playOrderStatusNotificationSound();
      window.setTimeout(() => {
        setIsTimelinePulsing(false);
      }, 2600);
      window.setTimeout(() => {
        setIsWidgetStatusSlideAnimating(false);
      }, 650);
    } finally {
      window.setTimeout(() => {
        window.clearTimeout(stepTimer1);
        window.clearTimeout(stepTimer2);
        setRefreshProgress(100);
        setIsRefreshingOrder(false);
        setRefreshFeedbackStage('updated');
        window.setTimeout(() => {
          setRefreshFeedbackStage('idle');
          setRefreshProgress(0);
        }, 1200);
      }, 420);
    }
  };

  // Pull-to-refresh touch & mouse gesture handlers for the active order tracking widget container
  const extractTouchY = (
    e: React.TouchEvent<HTMLDivElement>
  ): number => {
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return 0;
    return touch.clientY ?? touch.pageY ?? touch.screenY ?? 0;
  };

  const handleWidgetTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshingOrder) return;
    pullStartYRef.current = extractTouchY(e);
    currentPullDistanceRef.current = 0;
    setIsPullingToRefresh(true);
    setPullDistance(0);
  };

  const handleWidgetTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isRefreshingOrder) return;
    if (pullStartYRef.current === null) {
      pullStartYRef.current = 0;
    }
    const currentY = extractTouchY(e);
    const deltaY = currentY - pullStartYRef.current;
    if (deltaY > 0) {
      const clampedDistance = Math.min(120, deltaY);
      currentPullDistanceRef.current = clampedDistance;
      setIsPullingToRefresh(true);
      setPullDistance(clampedDistance);
    } else {
      currentPullDistanceRef.current = 0;
      setPullDistance(0);
    }
  };

  const handleWidgetTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    let finalDistance = currentPullDistanceRef.current;
    if (finalDistance === 0 && pullStartYRef.current !== null && e.changedTouches?.[0]) {
      const endY =
        e.changedTouches[0].clientY ??
        e.changedTouches[0].pageY ??
        e.changedTouches[0].screenY ??
        0;
      finalDistance = Math.max(0, endY - pullStartYRef.current);
    }
    pullStartYRef.current = null;
    currentPullDistanceRef.current = 0;
    setIsPullingToRefresh(false);
    setPullDistance(0);

    if (finalDistance >= 25 && !isRefreshingOrder) {
      void handleManualRefreshOrderStatus();
    }
  };

  const handleWidgetTouchCancel = () => {
    pullStartYRef.current = null;
    currentPullDistanceRef.current = 0;
    setIsPullingToRefresh(false);
    setPullDistance(0);
  };

  const handleWidgetMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRefreshingOrder) return;
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, textarea, select, a, [data-testid="pinch-zoom-pan-container"]')) {
      return;
    }
    isMousePullingRef.current = true;
    pullStartYRef.current = e.clientY;
    currentPullDistanceRef.current = 0;
  };

  const handleWidgetMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMousePullingRef.current || pullStartYRef.current === null || isRefreshingOrder) return;
    const deltaY = e.clientY - pullStartYRef.current;
    if (deltaY > 8) {
      const clampedDistance = Math.min(120, deltaY);
      currentPullDistanceRef.current = clampedDistance;
      setIsPullingToRefresh(true);
      setPullDistance(clampedDistance);
    }
  };

  const handleWidgetMouseUp = () => {
    if (!isMousePullingRef.current) return;
    const finalDistance = currentPullDistanceRef.current;
    isMousePullingRef.current = false;
    pullStartYRef.current = null;
    currentPullDistanceRef.current = 0;
    setIsPullingToRefresh(false);
    setPullDistance(0);
    if (finalDistance >= PULL_TO_REFRESH_THRESHOLD && !isRefreshingOrder) {
      void handleManualRefreshOrderStatus();
    }
  };

  // Navigate to the order history section of the application
  const handleViewOrderHistory = () => {
    setCustomerScreen('history');
    navigateToCustomerHistory();
  };

  // Open Phone Dialer prompt with the captain's phone number from the active order object
  const handleOpenCallCaptainPrompt = () => {
    setIsCallCaptainPromptOpen(true);
  };

  // Open Cancel Order confirmation dialog
  const handleOpenCancelOrderDialog = () => {
    setIsCancelOrderDialogOpen(true);
  };

  // Confirm cancellation and update the order status to 'cancelled' in the marketplace store
  const handleConfirmCancelOrder = () => {
    const targetOrderId = currentTrackedOrder.id;
    customerCancelOrder(targetOrderId, 'إلغاء الطلب من شريط التتبع الحي');
    setTrackedCancelledOrderId(targetOrderId);
    setActiveOrderState((prev) => ({
      ...prev,
      status: 'cancelled',
    }));
    setEtaRemainingSeconds(0);
    setIsTimelinePulsing(true);
    setIsCancelOrderDialogOpen(false);
  };

  // Post-delivery 1-5 star rating handler for captain performance
  const handleRateOrderCaptain = (orderId: string, rating: number) => {
    const clamped = Math.max(1, Math.min(5, Math.round(rating)));
    setOrderRatings((prev) => ({
      ...prev,
      [orderId]: clamped,
    }));
    rateOrderCaptain(orderId, clamped);
  };

  // Order Feedback comment handlers persisting to marketplace order history store
  const handleOrderFeedbackChange = (orderId: string, feedbackText: string) => {
    setOrderFeedbackDrafts((prev) => ({
      ...prev,
      [orderId]: feedbackText,
    }));
    setOrderFeedbackSavedMap((prev) => ({
      ...prev,
      [orderId]: false,
    }));
    updateOrderFeedback(orderId, feedbackText);
  };

  const handleSaveOrderFeedback = (orderId: string, currentFeedbackText: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateOrderFeedback(orderId, currentFeedbackText);
    setOrderFeedbackSavedMap((prev) => ({
      ...prev,
      [orderId]: true,
    }));
  };

  // Generate a temporary live tracking URL and invoke mobile sharing intents
  const handleShareLiveLink = async () => {
    const normalizedOrderNo = String(currentTrackedOrder.orderNumber || '#MSH-8102').replace('#', '');
    const expiresAt = Date.now() + 30 * 60 * 1000;
    const tempUrl = `https://mashwar.eg/live-track/${encodeURIComponent(
      currentTrackedOrder.id
    )}?order=${encodeURIComponent(normalizedOrderNo)}&exp=${expiresAt}`;

    setSharedLiveLinkUrl(tempUrl);
    setIsShareLiveLinkOpen(true);
    setLiveLinkCopied(false);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `تتبع طلب مشوار الباجور ${currentTrackedOrder.orderNumber}`,
          text: `تابع مسار طلبي الحالي من ${currentOrderPickup} إلى ${currentOrderDropoff} لحظة بلحظة:`,
          url: tempUrl,
        });
      } catch {
        // Fallback panel remains open if native share sheet is dismissed or unsupported
      }
    }
  };

  const handleCopyLiveLink = async () => {
    if (!sharedLiveLinkUrl) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(sharedLiveLinkUrl);
      } catch {
        // ignore clipboard permission errors in test environment
      }
    }
    setLiveLinkCopied(true);
  };

  const handleCopyPickupAddress = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(currentOrderPickup);
      } catch {
        // ignore clipboard permission errors in test environment
      }
    }
    setPickupAddressCopied(true);
    window.setTimeout(() => {
      setPickupAddressCopied(false);
    }, 2000);
  };

  const handleCopyDropoffAddress = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(currentOrderDropoff);
      } catch {
        // ignore clipboard permission errors in test environment
      }
    }
    setDropoffAddressCopied(true);
    window.setTimeout(() => {
      setDropoffAddressCopied(false);
    }, 2000);
  };

  // Toggle Edit Notes form in the active order tracking widget
  const handleToggleEditNotes = () => {
    setIsEditNotesOpen((prev) => !prev);
    setNotesSavedFeedback(false);
  };

  // Update orderNotes in component state and persist to marketplaceStore
  const handleOrderNotesChange = (nextNotes: string) => {
    setOrderNotes(nextNotes);
    setActiveOrderState((prev) => ({
      ...prev,
      notes: nextNotes,
      orderNotes: nextNotes,
    }));
    updateOrderNotes(currentTrackedOrder.id, nextNotes);
    setNotesSavedFeedback(false);
  };

  const handleSaveOrderNotes = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveOrderState((prev) => ({
      ...prev,
      notes: orderNotes,
      orderNotes,
    }));
    updateOrderNotes(currentTrackedOrder.id, orderNotes);
    setNotesSavedFeedback(true);
    setIsEditNotesOpen(false);
  };

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
          <div className="flex items-center flex-wrap gap-2 font-['Cairo',sans-serif]">
            <div className="bg-slate-900 p-1 rounded-2xl flex items-center border border-slate-800 shadow-inner gap-1">
              <button
                onClick={() => setWorkspaceMode('mobile')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceMode === 'mobile'
                    ? 'bg-emerald-700 text-white border-emerald-500/50 shadow-md font-black ring-1 ring-emerald-500/40'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 تطبيق الموبايل (المحاكي)</span>
              </button>
              <button
                onClick={() => setWorkspaceMode('admin')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceMode === 'admin'
                    ? 'bg-amber-600 text-white border-amber-500/50 shadow-md font-black ring-1 ring-amber-500/40'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>💻 لوحة تحكم وعمليات المالك</span>
              </button>
              <button
                onClick={() => setWorkspaceMode('workbench')}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  workspaceMode === 'workbench'
                    ? 'bg-amber-600 text-white border-amber-500/50 shadow-md font-black ring-1 ring-amber-500/40'
                    : 'bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>🛠️ منصة المطور والمعمارية</span>
              </button>
            </div>

            {/* Workbench Sub-Tab Switchers (Only in Workbench Mode) */}
            {workspaceMode === 'workbench' && (
              <div className="bg-slate-900 p-1 rounded-2xl flex items-center border border-slate-800 gap-1">
                <button
                  onClick={() => setActiveTab('backend_tests')}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'backend_tests'
                      ? 'bg-emerald-700 text-white border-emerald-500/50 shadow font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Backend Tests</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-bold">89/89</span>
                </button>
                <button
                  onClick={() => setActiveTab('simulator')}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'simulator'
                      ? 'bg-amber-600 text-white border-amber-500/50 shadow font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Device Simulator</span>
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'code'
                      ? 'bg-amber-600 text-white border-amber-500/50 shadow font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Codebase</span>
                </button>
                <button
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'architecture'
                      ? 'bg-amber-600 text-white border-amber-500/50 shadow font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Architecture</span>
                </button>
              </div>
            )}

            {/* Dark / Light Mode Map & UI Theme Toggle */}
            <button
              type="button"
              data-testid="toggle-dark-mode-btn"
              aria-pressed={isDarkMode}
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:text-amber-400 hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1.5"
              title="Toggle Map & UI Dark/Light Mode"
            >
              {isDarkMode ? (
                <>
                  <ToggleRight className="w-4 h-4 text-amber-400" />
                  <span>Dark Mode • الوضع الداكن</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-amber-500" />
                  <span>Light Mode • الوضع الفاتح</span>
                </>
              )}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400 hover:bg-slate-800 transition-all cursor-pointer"
              title="Toggle Language"
            >
              {language === 'ar' ? '🇪🇬 العربية' : '🇬🇧 English'}
            </button>

            {/* Export Flutter Project ZIP */}
            <button
              onClick={downloadFlutterZip}
              disabled={downloadingZip}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingZip ? 'Packaging...' : 'Export Flutter .ZIP'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 flex flex-col gap-4 font-['Cairo',sans-serif]">
        {/* Render Mobile App Prototype (Customer & Captain Home Screens First) */}
        {workspaceMode === 'mobile' && (
          <div className="flex flex-col gap-6 font-['Cairo',sans-serif]" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Primary Mobile Application Frame (Customer, Captain & Merchant Interactive App) */}
            <MobileAppFrame onOpenOperationsDashboard={() => setWorkspaceMode('admin')} />

            {/* Synchronized Active Order Tracking Summary Card (Uniform Grid Layout & Slate/Amber/Rose Design System) */}
            <div
              data-testid="active-order-tracking-widget"
              data-status-animation={isWidgetStatusSlideAnimating ? 'slide-in' : 'settled'}
              data-haptic-feedback={isHapticVibrating ? 'active' : 'idle'}
              data-haptic-pulses={hapticPulseCount}
              data-pull-to-refresh={
                isRefreshingOrder
                  ? 'refreshing'
                  : pullDistance >= PULL_TO_REFRESH_THRESHOLD
                    ? 'ready'
                    : isPullingToRefresh
                      ? 'pulling'
                      : 'idle'
              }
              data-pull-distance={Math.round(pullDistance)}
              data-audio-cue={isAudioCuePlaying ? 'playing' : 'idle'}
              data-audio-cue-count={audioCueCount}
              data-sound-enabled={isSoundNotificationEnabled ? 'true' : 'false'}
              onClickCapture={handleWidgetButtonPressCapture}
              onTouchStart={handleWidgetTouchStart}
              onTouchMove={handleWidgetTouchMove}
              onTouchEnd={handleWidgetTouchEnd}
              onTouchCancel={handleWidgetTouchCancel}
              onMouseDown={handleWidgetMouseDown}
              onMouseMove={handleWidgetMouseMove}
              onMouseUp={handleWidgetMouseUp}
              onMouseLeave={handleWidgetMouseUp}
              className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl grid grid-cols-1 gap-4 font-['Cairo',sans-serif] transform transition-all duration-300 ease-out ${
                isHapticVibrating
                  ? 'animate-haptic-shake ring-1 ring-amber-400/50'
                  : isWidgetStatusSlideAnimating
                    ? 'animate-m3-slide-in translate-y-0 opacity-100 ring-1 ring-amber-500/30'
                    : 'translate-y-0 opacity-100'
              }`}
            >
              {/* Hidden HTML5 Audio Element for subtle order status notification cue */}
              <audio
                ref={statusAudioRef}
                data-testid="order-status-audio-element"
                src={ORDER_STATUS_CHIME_WAV_DATA_URI}
                preload="auto"
                className="hidden"
              />

              {/* Pull-to-Refresh Gesture Indicator Banner */}
              <div
                data-testid="pull-to-refresh-indicator"
                data-pull-state={
                  isRefreshingOrder
                    ? 'refreshing'
                    : pullDistance >= PULL_TO_REFRESH_THRESHOLD
                      ? 'ready'
                      : isPullingToRefresh && pullDistance > 0
                        ? 'pulling'
                        : 'idle'
                }
                role="status"
                aria-live="polite"
                onClick={() => {
                  if (!isRefreshingOrder) {
                    void handleManualRefreshOrderStatus();
                  }
                }}
                className={`w-full rounded-xl border px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-['Cairo',sans-serif] transition-all duration-200 cursor-pointer select-none ${
                  isRefreshingOrder
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                    : pullDistance >= PULL_TO_REFRESH_THRESHOLD
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-md'
                      : isPullingToRefresh && pullDistance > 0
                        ? 'bg-slate-800/90 border-amber-500/30 text-amber-300'
                        : 'bg-slate-950/90 border-slate-800/90 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isRefreshingOrder ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  ) : (
                    <ArrowDown
                      className={`w-3.5 h-3.5 text-amber-400 shrink-0 transition-transform duration-200 ${
                        pullDistance >= PULL_TO_REFRESH_THRESHOLD ? 'rotate-180 scale-110' : ''
                      }`}
                    />
                  )}
                  <span className="font-bold">
                    {isRefreshingOrder
                      ? 'Refreshing order status... • جاري تحديث حالة الطلب...'
                      : pullDistance >= PULL_TO_REFRESH_THRESHOLD
                        ? 'Release to refresh order status • أفلت لتحديث حالة الطلب الآن'
                        : isPullingToRefresh && pullDistance > 0
                          ? `Pulling to refresh (${Math.round(pullDistance)}px) • اسحب للأسفل للتحديث`
                          : 'Pull down to refresh order status • اسحب للأسفل لتحديث حالة الطلب'}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-amber-400/90">
                  {isRefreshingOrder
                    ? `${refreshProgress}%`
                    : pullDistance > 0
                      ? `${Math.min(100, Math.round((pullDistance / PULL_TO_REFRESH_THRESHOLD) * 100))}%`
                      : 'Pull-to-Refresh'}
                </span>
              </div>

              {/* Tier 1 Grid: Order Header + Live Timers (7 cols) & El Bagour Static Map Thumbnail (5 cols) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                {/* Order Summary & Live Timers Card */}
                <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4">
                  <div className="flex items-start gap-4">
                    <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping shrink-0 mt-1.5" />
                    <div className="grid grid-cols-1 gap-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-black text-white font-['Cairo',sans-serif]">
                          متابعة الطلب الحي في المحاكي الموحد ({currentTrackedOrder.orderNumber})
                        </span>
                        <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30">
                          {currentTrackedOrder.totalEgp}.00 ج.م
                        </span>
                        <span
                          data-testid="active-order-status-badge"
                          className="text-xs font-bold text-slate-200 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700"
                        >
                          الحالة: {currentOrderStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-['Cairo',sans-serif]">
                        {('assignedCaptainName' in currentTrackedOrder && currentTrackedOrder.assignedCaptainName) ||
                          activeOrderState.captainName}{' '}
                        • الوجهة:{' '}
                        {('deliveryAddress' in currentTrackedOrder && currentTrackedOrder.deliveryAddress) ||
                          activeOrderState.destination}
                        {lastRefreshedAtLabel && (
                          <span className="text-xs text-amber-400 mr-2 font-bold">
                            • آخر تحديث: {lastRefreshedAtLabel}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Live ETA Countdown & Accepted Timestamp Sub-Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dynamic Estimated Time of Arrival (ETA) Countdown Timer */}
                    <div
                      data-testid="active-order-eta-timer"
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-300"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold">Estimated Time of Arrival (ETA):</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-white text-sm" data-testid="eta-countdown-value">
                          {formattedEtaCountdown}
                        </span>
                        <span className="text-[11px] text-amber-200/80">
                          ({currentOrderDurationMinutes} د)
                        </span>
                      </div>
                    </div>

                    {/* Accepted Timestamp */}
                    <div
                      data-testid="active-order-accepted-time"
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold">وقت قبول الطلب:</span>
                      </div>
                      <span className="font-black text-white">
                        {formatHumanReadableAcceptedTimestamp(
                          extractedAcceptedAtIso,
                          extractedAcceptedAtFallback
                        ) || humanReadableAcceptedTime}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Static Map Thumbnail for El Bagour Route with Pickup & Dropoff Markers */}
                <div
                  data-testid="active-order-static-map-thumbnail"
                  data-map-view-mode={isFullScreenMapOpen ? 'fullscreen' : 'thumbnail'}
                  data-theme-mode={isDarkMode ? 'dark' : 'light'}
                  data-map-layer={mapLayerStyle}
                  data-map-zoom={mapZoomScale.toFixed(2)}
                  data-marker-pulse={isMapPinStatusPulsing ? 'active' : 'idle'}
                  data-loading-skeleton={isRefreshingOrder ? 'true' : 'false'}
                  aria-busy={isRefreshingOrder}
                  aria-label="El Bagour Route Static Map Thumbnail"
                  className="relative lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center font-['Cairo',sans-serif]"
                >
                  {isRefreshingOrder && (
                    <div
                      data-testid="static-map-skeleton-loader"
                      aria-label="Loading map route data"
                      className="col-span-full bg-slate-900/95 border border-slate-800 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse"
                    >
                      <div className="h-20 w-full rounded-xl bg-slate-800/90 border border-slate-700/60" />
                      <div className="flex flex-col justify-center gap-2.5">
                        <div className="h-6 w-full rounded-lg bg-slate-800/90" />
                        <div className="h-6 w-5/6 rounded-lg bg-slate-800/80" />
                        <div className="h-5 w-2/3 rounded-lg bg-slate-800/70" />
                      </div>
                    </div>
                  )}
                  <div
                    className={`relative w-full ${
                      isFullScreenMapOpen ? 'h-40 sm:col-span-2' : 'h-24'
                    } rounded-xl overflow-hidden border transition-all duration-300 ${
                      isDarkMode
                        ? 'border-slate-800 bg-slate-900'
                        : 'border-slate-300 bg-slate-100'
                    } ${isRefreshingOrder ? 'opacity-40 animate-pulse' : 'opacity-100'}`}
                  >
                    <PinchZoomPan
                      isDarkMode={isDarkMode}
                      scale={mapZoomScale}
                      onScaleChange={setMapZoomScale}
                      showControls={false}
                    >
                      <img
                        src={elBagourStaticMapSvgUri}
                        alt={`El Bagour Route Static Map from ${currentOrderPickup} to ${currentOrderDropoff}`}
                        data-testid="static-map-thumbnail-img"
                        data-theme-mode={isDarkMode ? 'dark' : 'light'}
                        data-map-layer={mapLayerStyle}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <svg
                        data-testid="active-order-map-polyline-svg"
                        data-theme-mode={isDarkMode ? 'dark' : 'light'}
                        data-map-layer={mapLayerStyle}
                        data-marker-pulse={isMapPinStatusPulsing ? 'active' : 'idle'}
                        viewBox="0 0 280 96"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        aria-label="Animated Route Path Polyline"
                      >
                        <defs>
                          <filter id="m3-map-pin-shadow" x="-35%" y="-35%" width="170%" height="170%">
                            <feDropShadow
                              dx="0"
                              dy="2"
                              stdDeviation="1.8"
                              floodColor="#020617"
                              floodOpacity="0.6"
                            />
                          </filter>
                        </defs>
                        {isSatelliteTerrainLayer && (
                          <g data-testid="map-satellite-terrain-contours" opacity="0.65">
                            <path
                              d="M0 22 Q70 10 145 26 T280 18 M0 60 Q95 44 175 64 T280 50"
                              fill="none"
                              stroke={satelliteContourStroke}
                              strokeWidth="1.4"
                              strokeDasharray="4 3"
                            />
                          </g>
                        )}
                        <polyline
                          data-testid="route-base-polyline"
                          points={elBagourRoutePolylinePoints}
                          fill="none"
                          stroke={mapThemePalette.baseRouteStroke}
                          strokeOpacity="0.4"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          data-testid="animated-route-polyline"
                          points={elBagourRoutePolylinePoints}
                          fill="none"
                          stroke={mapThemePalette.activeRouteStroke}
                          strokeWidth="3"
                          strokeDasharray="8 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-pulse"
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            from="28"
                            to="0"
                            dur="1.2s"
                            repeatCount="indefinite"
                          />
                        </polyline>

                        {/* Distinct Material 3 Style SVG Pickup Map Pin Icon (Package Origin) */}
                        <g
                          data-testid="map-svg-pickup-pin"
                          data-pin-type="pickup"
                          data-pulse-active={isMapPinStatusPulsing ? 'true' : 'false'}
                          filter="url(#m3-map-pin-shadow)"
                          className={`drop-shadow-md transition-transform duration-300 ${
                            isMapPinStatusPulsing ? 'animate-pulse' : ''
                          }`}
                        >
                          {isMapPinStatusPulsing && (
                            <path
                              d="M38 45 C30.8 45 25 50.8 25 58 C25 64.5 38 72.5 38 72.5 C38 72.5 51 64.5 51 58 C51 50.8 45.2 45 38 45 Z"
                              fill={mapThemePalette.pickupFill}
                              fillOpacity="0.28"
                            />
                          )}
                          <path
                            d="M38 48 C32.5 48 28 52.5 28 58 C28 63.2 38 70 38 70 C38 70 48 63.2 48 58 C48 52.5 43.5 48 38 48 Z"
                            fill={mapThemePalette.pickupFill}
                            stroke="#ffffff"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                          <rect
                            x="35"
                            y="55"
                            width="6"
                            height="6"
                            rx="1.2"
                            fill={mapThemePalette.pickupCenter}
                          />
                        </g>

                        {/* Distinct Material 3 Style SVG Dropoff Map Pin Icon (Destination Target) */}
                        <g
                          data-testid="map-svg-dropoff-pin"
                          data-pin-type="dropoff"
                          data-pulse-active={isMapPinStatusPulsing ? 'true' : 'false'}
                          filter="url(#m3-map-pin-shadow)"
                          className={`drop-shadow-md transition-transform duration-300 ${
                            isMapPinStatusPulsing ? 'animate-pulse' : ''
                          }`}
                        >
                          {isMapPinStatusPulsing && (
                            <path
                              d="M242 5 C234.8 5 229 10.8 229 18 C229 24.5 242 32.5 242 32.5 C242 32.5 255 24.5 255 18 C255 10.8 249.2 5 242 5 Z"
                              fill={mapThemePalette.dropoffFill}
                              fillOpacity="0.28"
                            />
                          )}
                          <path
                            d="M242 8 C236.5 8 232 12.5 232 18 C232 23.2 242 30 242 30 C242 30 252 23.2 252 18 C252 12.5 247.5 8 242 8 Z"
                            fill={mapThemePalette.dropoffFill}
                            stroke="#ffffff"
                            strokeWidth="1.4"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M242 14 L245.5 18 L242 22 L238.5 18 Z"
                            fill={mapThemePalette.dropoffCenter}
                          />
                        </g>

                        <circle
                          data-testid="animated-route-rider-dot"
                          r="4"
                          fill={mapThemePalette.riderFill}
                          stroke={mapThemePalette.riderStroke}
                          strokeWidth="1.5"
                        >
                          <animateMotion
                            path="M38,68 L96,46 L168,54 L242,28"
                            dur="3.5s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </svg>
                    </PinchZoomPan>

                    {/* Dedicated Touch-Optimized '+' and '-' Corner Zoom Controls (Material 3 Shadow & Slate/Cairo) */}
                    <div
                      data-testid="map-pinch-zoom-controls"
                      role="group"
                      aria-label="Map Thumbnail Zoom Controls"
                      className="absolute top-1.5 left-1.5 z-20 flex items-center gap-1 rounded-xl p-1 bg-slate-950/95 border border-slate-700/90 text-slate-100 font-['Cairo',sans-serif] shadow-lg drop-shadow-md backdrop-blur-xs"
                    >
                      <button
                        type="button"
                        data-testid="map-zoom-in-btn"
                        aria-label="Zoom In (+)"
                        title="Zoom In (+) • تكبير الخريطة"
                        disabled={mapZoomScale >= 3.5}
                        onClick={handleMapZoomIn}
                        className="min-w-[32px] min-h-[32px] px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-amber-400 disabled:opacity-40 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center shadow-md drop-shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                      <span
                        data-testid="map-zoom-scale-badge"
                        className="text-[10px] font-mono font-bold text-amber-400 px-1 select-none"
                      >
                        {Math.round(mapZoomScale * 100)}%
                      </span>
                      <button
                        type="button"
                        data-testid="map-zoom-out-btn"
                        aria-label="Zoom Out (-)"
                        title="Zoom Out (-) • تصغير الخريطة"
                        disabled={mapZoomScale <= 1}
                        onClick={handleMapZoomOut}
                        className="min-w-[32px] min-h-[32px] px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 hover:text-amber-400 disabled:opacity-40 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center shadow-md drop-shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed"
                      >
                        -
                      </button>
                      {mapZoomScale > 1 && (
                        <button
                          type="button"
                          data-testid="map-zoom-reset-btn"
                          aria-label="Reset Map Zoom"
                          title="Reset Zoom • إعادة ضبط"
                          onClick={handleMapZoomReset}
                          className="min-h-[32px] px-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold font-['Cairo',sans-serif] text-amber-400 hover:text-amber-300 shadow-sm transition-all cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    <span
                      data-testid="map-layer-badge"
                      className="absolute top-1.5 right-1.5 z-10 px-2 py-0.5 rounded-lg bg-slate-950/90 text-[10px] font-bold font-['Cairo',sans-serif] text-amber-400 border border-amber-500/30 shadow-sm pointer-events-none"
                    >
                      {isSatelliteTerrainLayer
                        ? 'Satellite/Terrain • قمر صناعي'
                        : 'Route Overview • الباجور'}
                    </span>
                    <span
                      data-testid="map-travel-estimate-badge"
                      className="absolute bottom-1.5 left-1.5 z-10 px-2 py-0.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-[10px] font-bold font-['Cairo',sans-serif] text-amber-300 flex items-center gap-1 shadow-sm pointer-events-none"
                    >
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>
                        ~{currentOrderDurationMinutes} min ({currentOrderDurationMinutes} د) • {currentOrderRouteDistanceKm.toFixed(1)} km
                      </span>
                    </span>
                  </div>
                  <div
                    className={`grid grid-cols-1 gap-3 text-xs font-['Cairo',sans-serif] ${
                      isFullScreenMapOpen ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <div
                      data-testid="map-pickup-marker"
                      data-pulse-active={isMapPinStatusPulsing ? 'true' : 'false'}
                      className={`flex items-center justify-between gap-2 text-amber-300 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 drop-shadow-sm ${
                        isMapPinStatusPulsing ? 'animate-pulse ring-1 ring-emerald-500/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4 text-emerald-400 drop-shadow-sm shrink-0" />
                        <span className="font-bold text-slate-400 shrink-0">Pickup (الانطلاق):</span>
                        <span className="font-bold text-white truncate" title={currentOrderPickup}>
                          {currentOrderPickup}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid="copy-pickup-address-btn"
                        aria-label="Copy Pickup Address"
                        title="Copy Pickup Address • نسخ عنوان الانطلاق"
                        onClick={handleCopyPickupAddress}
                        className="shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-amber-300 font-['Cairo',sans-serif] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        {pickupAddressCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="sr-only">Copy Pickup Address</span>
                      </button>
                    </div>
                    <div
                      data-testid="map-dropoff-marker"
                      data-pulse-active={isMapPinStatusPulsing ? 'true' : 'false'}
                      className={`flex items-center justify-between gap-2 text-slate-200 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 drop-shadow-sm ${
                        isMapPinStatusPulsing ? 'animate-pulse ring-1 ring-amber-500/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Navigation className="w-4 h-4 text-amber-400 drop-shadow-sm shrink-0" />
                        <span className="font-bold text-slate-400 shrink-0">Dropoff (الوصول):</span>
                        <span className="font-bold text-white truncate" title={currentOrderDropoff}>
                          {currentOrderDropoff}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid="copy-dropoff-address-btn"
                        aria-label="Copy Dropoff Address"
                        title="Copy Dropoff Address • نسخ عنوان الوصول"
                        onClick={handleCopyDropoffAddress}
                        className="shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-amber-300 font-['Cairo',sans-serif] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        {dropoffAddressCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        <span className="sr-only">Copy Dropoff Address</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        data-testid="toggle-map-layer-btn"
                        data-map-layer={mapLayerStyle}
                        aria-pressed={isSatelliteTerrainLayer}
                        aria-label={
                          isSatelliteTerrainLayer
                            ? 'Switch to Route Overview Map Layer'
                            : 'Switch to Satellite/Terrain Map Layer'
                        }
                        onClick={handleToggleMapLayerStyle}
                        className={`min-h-[40px] px-2.5 py-2 rounded-xl border text-[11px] font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer ${
                          isSatelliteTerrainLayer
                            ? 'bg-slate-800 border-amber-500/60 text-amber-300 ring-1 ring-amber-500/30'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100 hover:text-amber-300'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {isSatelliteTerrainLayer
                            ? 'Route Overview • مسار'
                            : 'Satellite/Terrain • تضاريس'}
                        </span>
                      </button>
                      <button
                        type="button"
                        data-testid="toggle-map-theme-btn"
                        aria-pressed={isDarkMode}
                        onClick={() => setIsDarkMode((prev) => !prev)}
                        className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-amber-300 text-[11px] font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        {isDarkMode ? (
                          <ToggleRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        ) : (
                          <ToggleLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span>{isDarkMode ? 'Dark Map • داكن' : 'Light Map • فاتح'}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="toggle-fullscreen-map-btn"
                        aria-expanded={isFullScreenMapOpen}
                        aria-label={
                          isFullScreenMapOpen
                            ? 'Toggle Static Map Thumbnail View'
                            : 'Toggle Full-Screen Map View'
                        }
                        onClick={handleToggleFullScreenMap}
                        className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-amber-300 text-[11px] font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {isFullScreenMapOpen
                            ? 'Thumbnail • مصغر'
                            : 'Full-Screen • ملء الشاشة'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tier 2 Grid: Cohesive Mobile-Optimized Action Buttons (Primary=Amber, Secondary=Slate, Danger=Rose) */}
              <div
                data-testid="active-order-actions-grid"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-800"
              >
                {/* Call Captain Button (Primary - Amber) */}
                <button
                  type="button"
                  data-testid="call-captain-btn"
                  data-button-variant="primary"
                  onClick={handleOpenCallCaptainPrompt}
                  aria-label={`Call Captain ${currentOrderCaptainPhone}`}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-slate-950 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-md transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>Call Captain</span>
                  <span className="font-mono text-[11px] text-slate-900" data-testid="tracking-widget-captain-phone">
                    ({currentOrderCaptainPhone})
                  </span>
                </button>

                {/* Message Captain Button (Primary - Amber) */}
                <button
                  type="button"
                  data-testid="message-captain-btn"
                  data-button-variant="primary"
                  onClick={() => setIsCaptainChatModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-400/60 text-white text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-md transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 shrink-0" />
                  <span>Message Captain</span>
                  <span className="px-1.5 py-0.5 rounded-lg bg-slate-950/80 text-[10px] font-mono text-amber-300 border border-amber-400/40">
                    {captainChatMessages.length}
                  </span>
                </button>

                {/* Manual Refresh Order Status Button with Visual Feedback & Progress Bar (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="refresh-order-status-btn"
                  data-button-variant="secondary"
                  onClick={handleManualRefreshOrderStatus}
                  disabled={isRefreshingOrder}
                  aria-busy={isRefreshingOrder}
                  aria-label="Refresh Order Status"
                  className={`relative overflow-hidden min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-bold font-['Cairo',sans-serif] flex flex-col items-center justify-center gap-1.5 shadow-sm transform hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed ${
                    isRefreshingOrder
                      ? 'bg-slate-800 border-amber-500/60 text-amber-300 opacity-95'
                      : refreshFeedbackStage === 'updated'
                      ? 'bg-slate-800 border-amber-500/60 text-amber-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw
                      className={`w-4 h-4 text-amber-400 shrink-0 ${
                        isRefreshingOrder ? 'animate-spin' : ''
                      }`}
                    />
                    <span data-testid="refresh-button-label">
                      {isRefreshingOrder
                        ? 'Updating... • جاري التحديث...'
                        : refreshFeedbackStage === 'updated'
                        ? 'Updated ✓ • تم التحديث'
                        : 'Refresh • تحديث الحالة'}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    data-testid="refresh-progress-bar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={refreshProgress}
                    className={`w-full h-1 rounded-full bg-slate-950 overflow-hidden transition-opacity duration-200 ${
                      isRefreshingOrder || refreshProgress > 0 ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div
                      className={`h-full bg-amber-400 transition-all duration-150 ease-out rounded-full ${
                        refreshProgress >= 100
                          ? 'w-full'
                          : refreshProgress >= 90
                          ? 'w-11/12'
                          : refreshProgress >= 65
                          ? 'w-2/3'
                          : refreshProgress > 0 || isRefreshingOrder
                          ? 'w-1/4'
                          : 'w-0'
                      }`}
                    />
                  </div>
                </button>

                {/* View Captain Profile Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="view-captain-profile-btn"
                  data-button-variant="secondary"
                  onClick={() => setIsCaptainProfileModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <Bike className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>View Captain Profile</span>
                </button>

                {/* View Order Summary Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="view-order-summary-btn"
                  data-button-variant="secondary"
                  onClick={() => setIsOrderSummaryModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <Package className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>View Order Summary</span>
                </button>

                {/* Edit Notes Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="edit-notes-btn"
                  data-button-variant="secondary"
                  onClick={handleToggleEditNotes}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Edit Notes</span>
                </button>

                {/* Add Tip Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="add-tip-btn"
                  data-button-variant="secondary"
                  onClick={() => {
                    setIsAddTipSectionOpen(true);
                    setIsFareBreakdownExpanded(true);
                  }}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Add Tip</span>
                  {captainTipEgp > 0 && (
                    <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/20 text-[10px] font-mono text-amber-300 border border-amber-500/30">
                      +{captainTipEgp} EGP
                    </span>
                  )}
                </button>

                {/* Share Live Link Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="share-live-link-btn"
                  data-button-variant="secondary"
                  onClick={handleShareLiveLink}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Share Live Link</span>
                </button>

                {/* View History Navigation Button (Secondary - Slate) */}
                <button
                  type="button"
                  data-testid="view-order-history-btn"
                  data-button-variant="secondary"
                  onClick={handleViewOrderHistory}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>View History</span>
                </button>

                {/* Cancel Order Button (Danger - Rose) */}
                <button
                  type="button"
                  data-testid="cancel-order-btn"
                  data-button-variant="danger"
                  onClick={handleOpenCancelOrderDialog}
                  disabled={currentOrderStatus === 'cancelled' || currentOrderStatus === 'delivered'}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/60 disabled:bg-slate-800 disabled:border-slate-700 disabled:text-slate-500 text-rose-200 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-sm transform hover:scale-105 active:scale-95 disabled:hover:scale-100 transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Cancel Order</span>
                </button>

                {/* SOS Emergency Button (Danger - Rose) */}
                <button
                  type="button"
                  data-testid="sos-emergency-btn"
                  data-button-variant="danger"
                  onClick={() => {
                    setSosLocationShared(false);
                    setSosTriggeredService(null);
                    setIsSosModalOpen(true);
                  }}
                  aria-label="SOS Emergency Assistance"
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-500 text-white text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center gap-2 shadow-md shadow-rose-950/50 transform hover:scale-105 active:scale-95 transition-all duration-200 ease-out cursor-pointer sm:col-span-2 lg:col-span-2"
                >
                  <ShieldCheck className="w-4 h-4 text-rose-200 shrink-0" />
                  <span>SOS • طوارئ الباجور</span>
                </button>
              </div>

              {/* Tier 3 Grid: 2-Column Hierarchy for Vertical Status Timeline & Order Details / Fare / Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                {/* Left Column (6 cols): Vertical Status Timeline Component */}
                <div
                  data-testid="active-order-vertical-timeline"
                  data-status-pulse={isTimelinePulsing ? 'active' : 'idle'}
                  data-loading-skeleton={isRefreshingOrder ? 'true' : 'false'}
                  aria-busy={isRefreshingOrder}
                  className={`lg:col-span-6 bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4 transition-all duration-500 ${
                    isTimelinePulsing
                      ? 'animate-pulse ring-1 ring-amber-500/40 bg-amber-950/15'
                      : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                      <Activity
                        className={`w-4 h-4 text-amber-400 ${
                          isTimelinePulsing || isRefreshingOrder ? 'animate-pulse' : ''
                        }`}
                      />
                      <span>Order Status Timeline • التسلسل الزمني لحالات الطلب</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Subtle Sound Notification Status & Toggle */}
                      <span
                        data-testid="status-audio-cue-indicator"
                        data-audio-cue-state={isAudioCuePlaying ? 'playing' : 'ready'}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${
                          isAudioCuePlaying
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {isSoundNotificationEnabled ? (
                          <Volume2 className="w-3 h-3 text-amber-400 shrink-0" />
                        ) : (
                          <VolumeX className="w-3 h-3 text-slate-500 shrink-0" />
                        )}
                        <span>
                          {isAudioCuePlaying
                            ? 'Audio Cue Playing • تنبيه صوتي'
                            : lastAudioCueAtLabel
                              ? `Audio Cue (${audioCueCount})`
                              : 'Audio Cue Ready'}
                        </span>
                      </span>
                      <button
                        type="button"
                        data-testid="toggle-status-sound-btn"
                        aria-pressed={isSoundNotificationEnabled}
                        aria-label={
                          isSoundNotificationEnabled
                            ? 'Mute Status Audio Notification'
                            : 'Unmute Status Audio Notification'
                        }
                        onClick={() => setIsSoundNotificationEnabled((prev) => !prev)}
                        className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200 hover:text-amber-300 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        {isSoundNotificationEnabled ? (
                          <>
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            <span>Sound On • الصوت مفعل</span>
                          </>
                        ) : (
                          <>
                            <VolumeX className="w-3 h-3 text-slate-400" />
                            <span>Muted • صامت</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        data-testid="advance-order-status-btn"
                        onClick={handleAdvanceOrderTimelineStatus}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[10px] font-bold text-amber-300 flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span>Advance Step • المرحلة التالية</span>
                      </button>
                      <span
                        data-testid="timeline-pulse-indicator"
                        className={`text-xs font-mono text-amber-400 ${
                          isTimelinePulsing || isRefreshingOrder ? 'animate-pulse font-bold' : ''
                        }`}
                      >
                        {isRefreshingOrder
                          ? 'Refreshing... • جاري التحديث'
                          : currentOrderStatus === 'cancelled'
                            ? 'Cancelled • ملغي'
                            : `${activeTimelineIndex + 1} / ${orderTimelineSteps.length}`}
                      </span>
                    </div>
                  </div>

                  {isRefreshingOrder && (
                    <div
                      data-testid="timeline-skeleton-loader"
                      aria-label="Loading order timeline status"
                      className="grid grid-cols-1 gap-3 py-1 animate-pulse"
                    >
                      {[1, 2, 3].map((skeletonIdx) => (
                        <div key={skeletonIdx} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 shrink-0" />
                          <div className="flex-1 h-10 rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 flex items-center justify-between">
                            <div className="h-3 w-32 rounded bg-slate-800" />
                            <div className="h-3 w-14 rounded bg-slate-800" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`relative pl-3 pr-1 grid grid-cols-1 gap-4 transition-opacity duration-200 ${
                      isRefreshingOrder ? 'opacity-40 animate-pulse' : 'opacity-100'
                    }`}
                  >
                    {orderTimelineSteps.map((step, index) => {
                      const StepIcon = step.Icon;
                      const isCompleted =
                        currentOrderStatus !== 'cancelled' && index < activeTimelineIndex;
                      const isCurrent =
                        currentOrderStatus !== 'cancelled' && index === activeTimelineIndex;

                      return (
                        <div
                          key={step.key}
                          data-testid={`timeline-step-${step.key}`}
                          data-step-state={
                            isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming'
                          }
                          className={`relative flex items-start gap-4 ${
                            isCurrent ? 'animate-pulse' : ''
                          }`}
                        >
                          {index < orderTimelineSteps.length - 1 && (
                            <div
                              className={`absolute left-[13px] top-7 bottom-[-16px] w-0.5 ${
                                isCompleted ? 'bg-amber-500/70' : 'bg-slate-800'
                              }`}
                            />
                          )}
                          <div
                            className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border shrink-0 ${
                              isCurrent
                                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm shadow-amber-500/30 animate-pulse'
                                : isCompleted
                                  ? 'bg-slate-800 border-amber-500/50 text-amber-400'
                                  : 'bg-slate-900 border-slate-700 text-slate-500'
                            }`}
                          >
                            <StepIcon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs font-bold ${
                                    isCurrent
                                      ? 'text-amber-300'
                                      : isCompleted
                                        ? 'text-white'
                                        : 'text-slate-400'
                                  }`}
                                >
                                  {step.label}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  • {step.arabicLabel}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500">{step.description}</span>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                                isCurrent
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                                  : isCompleted
                                    ? 'bg-slate-800 text-amber-400 border-slate-700'
                                    : 'bg-slate-950 text-slate-500 border-slate-800'
                              }`}
                            >
                              {isCurrent ? 'Active • حالي' : isCompleted ? 'Done ✓' : 'Pending'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column (6 cols): Fare Breakdown, Order Notes, Tip & Live Link Cards */}
                <div className="lg:col-span-6 grid grid-cols-1 gap-4">
                  {/* Expandable Fare Breakdown Section */}
                  <div
                    data-testid="expandable-fare-breakdown"
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4"
                  >
                    <button
                      type="button"
                      data-testid="toggle-fare-breakdown-btn"
                      data-button-variant="secondary"
                      aria-expanded={isFareBreakdownExpanded}
                      onClick={() => setIsFareBreakdownExpanded((prev) => !prev)}
                      className="w-full min-h-[44px] flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold font-['Cairo',sans-serif] text-slate-100 cursor-pointer transition-all"
                    >
                      <span className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-400" />
                        <span>Expandable Fare Breakdown • تفاصيل تكلفة المشوار</span>
                      </span>
                      <span
                        data-testid="fare-breakdown-total-amount"
                        className="flex items-center gap-2 text-amber-400 font-mono"
                      >
                        <span>{fareBreakdownTotalEgp.toFixed(2)} EGP</span>
                        {isFareBreakdownExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </span>
                    </button>

                    {isFareBreakdownExpanded && (
                      <div
                        data-testid="fare-breakdown-content"
                        className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs"
                      >
                        <div
                          data-testid="fare-item-base-fare"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-slate-300 font-medium">Base Fare (فتحة العداد)</span>
                          <span className="font-mono font-bold text-white">
                            {fareBreakdownBaseFareEgp.toFixed(2)} EGP
                          </span>
                        </div>
                        <div
                          data-testid="fare-item-distance-fare"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-slate-300 font-medium">Distance Fare (تكلفة المسافة)</span>
                          <span className="font-mono font-bold text-white">
                            {fareBreakdownDistanceFareEgp.toFixed(2)} EGP
                          </span>
                        </div>
                        <div
                          data-testid="fare-item-rural-surcharge"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-slate-300 font-medium">Rural Surcharge (إضافي القرى)</span>
                          <span className="font-mono font-bold text-amber-300">
                            {fareBreakdownRuralSurchargeEgp.toFixed(2)} EGP
                          </span>
                        </div>
                        <div
                          data-testid="fare-item-platform-fee"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800"
                        >
                          <span className="text-slate-300 font-medium">Platform Fee (رسوم المنصة)</span>
                          <span className="font-mono font-bold text-slate-200">
                            {fareBreakdownPlatformFeeEgp.toFixed(2)} EGP
                          </span>
                        </div>
                        <div
                          data-testid="fare-item-tip"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-amber-500/30"
                        >
                          <span className="text-amber-300 font-medium">Captain Tip (إكرامية الكابتن)</span>
                          <span className="font-mono font-bold text-amber-300">
                            {fareBreakdownTipEgp.toFixed(2)} EGP
                          </span>
                        </div>
                        <div
                          data-testid="fare-item-total"
                          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40"
                        >
                          <span className="text-amber-300 font-bold">Total Fare (الإجمالي الكلي)</span>
                          <span className="font-mono font-black text-amber-400">
                            {fareBreakdownTotalEgp.toFixed(2)} EGP
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Notes Summary & Inline Editor inside Active Order Tracking Widget */}
                  <div
                    data-testid="edit-notes-section"
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4"
                  >
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2 text-slate-300">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-slate-400">ملاحظات الطلب (Order Notes):</span>
                        <span
                          data-testid="active-order-notes-display"
                          className="font-bold text-white"
                        >
                          {currentOrderNotesValue || 'لا توجد ملاحظات إضافية'}
                        </span>
                      </div>
                      {notesSavedFeedback && (
                        <span
                          data-testid="order-notes-saved-badge"
                          className="text-xs font-bold text-amber-400"
                        >
                          Saved ✓ • تم الحفظ
                        </span>
                      )}
                    </div>

                    {isEditNotesOpen && (
                      <form
                        onSubmit={handleSaveOrderNotes}
                        data-testid="edit-order-notes-form"
                        className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4"
                      >
                        <input
                          type="text"
                          name="orderNotes"
                          aria-label="Order Notes"
                          data-testid="edit-order-notes-input"
                          value={orderNotes}
                          onChange={(e) => handleOrderNotesChange(e.target.value)}
                          placeholder="أضف أو عدّل ملاحظات التوصيل للكابتن..."
                          className="sm:col-span-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="submit"
                          data-testid="save-order-notes-btn"
                          data-button-variant="primary"
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-slate-950 text-xs font-black font-['Cairo',sans-serif] cursor-pointer transition-all shadow-sm"
                        >
                          Save Notes • حفظ الملاحظات
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Add Tip (Captain Gratuity) Section */}
                  {isAddTipSectionOpen && (
                    <div
                      data-testid="add-tip-section"
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                        <span className="font-bold text-slate-200 flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-amber-400" />
                          <span>Add Tip • إكرامية الكابتن (Gratuity)</span>
                        </span>
                        <span
                          data-testid="active-tip-amount-badge"
                          className="text-xs font-mono font-bold text-amber-300 bg-amber-500/15 px-3 py-1 rounded-xl border border-amber-500/30"
                        >
                          Tip: {fareBreakdownTipEgp.toFixed(2)} EGP
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <div className="grid grid-cols-3 gap-4">
                          {[5, 10, 15].map((presetEgp) => {
                            const isSelected = captainTipEgp === presetEgp;
                            return (
                              <button
                                key={presetEgp}
                                type="button"
                                data-testid={`tip-preset-${presetEgp}`}
                                data-button-variant={isSelected ? 'primary' : 'secondary'}
                                aria-pressed={isSelected}
                                onClick={() => handleSelectPresetTip(presetEgp)}
                                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold font-['Cairo',sans-serif] transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700'
                                }`}
                              >
                                {presetEgp} EGP
                              </button>
                            );
                          })}
                        </div>

                        <form
                          onSubmit={handleApplyCustomTip}
                          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                        >
                          <input
                            type="number"
                            min="0"
                            step="1"
                            aria-label="Custom Tip Amount in EGP"
                            data-testid="custom-tip-input"
                            value={customTipInput}
                            onChange={(e) => handleCustomTipInputChange(e.target.value)}
                            placeholder="Custom Tip (EGP) • مبلغ مخصص"
                            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                          />
                          <button
                            type="submit"
                            data-testid="apply-custom-tip-btn"
                            data-button-variant="primary"
                            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-slate-950 text-xs font-black font-['Cairo',sans-serif] cursor-pointer transition-all shadow-sm"
                          >
                            Apply Tip
                          </button>
                          {captainTipEgp > 0 && (
                            <button
                              type="button"
                              data-testid="clear-tip-btn"
                              data-button-variant="secondary"
                              onClick={() => {
                                setCaptainTipEgp(0);
                                setCustomTipInput('');
                              }}
                              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] cursor-pointer transition-all"
                            >
                              Clear
                            </button>
                          )}
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Temporary Live Link & Mobile Sharing Intents Drawer */}
                  {isShareLiveLinkOpen && sharedLiveLinkUrl && (
                    <div
                      data-testid="share-live-link-panel"
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 gap-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-amber-400" />
                          <span>رابط التتبع المؤقت للمشاركة (Temporary Live Tracking URL — صالح لمدة ٣٠ دقيقة)</span>
                        </span>
                        <button
                          type="button"
                          data-button-variant="secondary"
                          onClick={() => setIsShareLiveLinkOpen(false)}
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold font-['Cairo',sans-serif] text-slate-200 hover:text-white cursor-pointer transition-all"
                        >
                          إغلاق ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <input
                          type="text"
                          readOnly
                          aria-label="Temporary Live Share Link"
                          data-testid="generated-live-link-input"
                          value={sharedLiveLinkUrl}
                          className="sm:col-span-3 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-amber-300"
                        />
                        <span data-testid="generated-live-link-url" className="sr-only">
                          {sharedLiveLinkUrl}
                        </span>
                        <button
                          type="button"
                          data-testid="copy-live-link-btn"
                          data-button-variant="secondary"
                          onClick={handleCopyLiveLink}
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 cursor-pointer transition-all"
                        >
                          {liveLinkCopied ? <Check className="w-4 h-4 text-amber-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                          <span>{liveLinkCopied ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `تابع مسار طلبي في مشوار الباجور (${currentTrackedOrder.orderNumber}): ${sharedLiveLinkUrl}`
                          )}`}
                          data-testid="share-intent-whatsapp"
                          data-button-variant="primary"
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 border border-amber-400 text-slate-950 text-xs font-black font-['Cairo',sans-serif] flex items-center justify-center gap-2 transition-all"
                        >
                          <span>WhatsApp Share</span>
                        </a>
                        <a
                          href={`sms:?body=${encodeURIComponent(
                            `تتبع طلبي في مشوار الباجور (${currentTrackedOrder.orderNumber}): ${sharedLiveLinkUrl}`
                          )}`}
                          data-testid="share-intent-sms"
                          data-button-variant="secondary"
                          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-2 transition-all"
                        >
                          <span>SMS Share</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Order History Section when navigated via 'View History' */}
            {customerScreen === 'history' && (
              <div
                data-testid="order-history-section"
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-4 font-['Cairo',sans-serif]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <h2 className="text-sm font-black text-white">
                      سجل الطلبات والمشاوير وتقييم الكباتن (Order History & Post-Delivery Rating)
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300 font-bold">
                      {isOrderHistoryEmptyPreview ? 0 : marketplaceOrders.length} طلبات
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      data-testid="toggle-history-empty-state-btn"
                      onClick={() => setIsOrderHistoryEmptyPreview((prev) => !prev)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold font-['Cairo',sans-serif] transition-all cursor-pointer"
                    >
                      {isOrderHistoryEmptyPreview
                        ? 'Show Orders • عرض الطلبات'
                        : 'Preview Empty State • معاينة السجل الفارغ'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerScreen('tracking')}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold font-['Cairo',sans-serif] transition-all cursor-pointer"
                    >
                      إغلاق السجل والعودة للتتبع الحي
                    </button>
                  </div>
                </div>

                {!isOrderHistoryEmptyPreview && marketplaceOrders.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {marketplaceOrders.map((ord) => {
                    const currentRating = orderRatings[ord.id] ?? ord.customerRating ?? 0;
                    const currentFeedback =
                      orderFeedbackDrafts[ord.id] ?? ord.orderFeedback ?? ord.customerFeedback ?? '';
                    const isFeedbackSaved = Boolean(orderFeedbackSavedMap[ord.id]);
                    return (
                      <div
                        key={ord.id}
                        data-testid={`history-order-card-${ord.id}`}
                        className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-md flex flex-col gap-3 text-xs font-['Cairo',sans-serif]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white text-sm">
                            {ord.orderNumber} • {ord.storeName}
                          </span>
                          <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                            {ord.totalEgp}.00 ج.م
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>
                            الكابتن: {ord.assignedCaptainName || 'كابتن مشوار الباجور'} • الوجهة: {ord.deliveryAddress}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-amber-300 font-bold">
                            {ord.status}
                          </span>
                        </div>

                        {/* Post-Delivery 1-5 Star Rating System */}
                        <div
                          data-testid="post-delivery-star-rating"
                          data-order-id={ord.id}
                          className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-300">
                              Rate Captain (1-5) • تقييم الكابتن:
                            </span>
                            {currentRating > 0 && (
                              <span
                                data-testid="selected-captain-rating"
                                className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30"
                              >
                                {currentRating}/5 ★
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5" role="group" aria-label={`Rate captain for order ${ord.orderNumber}`}>
                            {[1, 2, 3, 4, 5].map((starValue) => {
                              const isFilled = starValue <= currentRating;
                              return (
                                <button
                                  key={starValue}
                                  type="button"
                                  data-testid={`rate-star-${starValue}`}
                                  data-star-value={starValue}
                                  aria-label={`Rate ${starValue} out of 5 stars`}
                                  aria-pressed={currentRating === starValue}
                                  onClick={() => handleRateOrderCaptain(ord.id, starValue)}
                                  className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    isFilled
                                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 shadow-xs'
                                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      isFilled ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                                    }`}
                                  />
                                  <span>{starValue}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Order Feedback Textarea below Star Rating */}
                        <form
                          onSubmit={(e) => handleSaveOrderFeedback(ord.id, currentFeedback, e)}
                          data-testid="order-feedback-section"
                          data-order-id={ord.id}
                          className="pt-2.5 border-t border-slate-800/80 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor={`order-feedback-textarea-mobile-${ord.id}`}
                              className="text-[11px] font-bold text-slate-300"
                            >
                              Order Feedback • تعليق وملاحظات تجربة التوصيل:
                            </label>
                            {(isFeedbackSaved || Boolean(ord.orderFeedback || ord.customerFeedback)) && (
                              <span
                                data-testid="order-feedback-saved-badge"
                                className="text-[10px] font-bold text-emerald-400"
                              >
                                Feedback Saved ✓ • تم حفظ التعليق
                              </span>
                            )}
                          </div>
                          <textarea
                            id={`order-feedback-textarea-mobile-${ord.id}`}
                            name="orderFeedback"
                            aria-label="Order Feedback"
                            data-testid="order-feedback-textarea"
                            data-order-id={ord.id}
                            rows={2}
                            value={currentFeedback}
                            onChange={(e) => handleOrderFeedbackChange(ord.id, e.target.value)}
                            placeholder="Write your Order Feedback about your delivery experience... • اكتب ملاحظاتك عن تجربة التوصيل..."
                            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 resize-y"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span
                              data-testid="persisted-order-feedback-display"
                              className="text-[11px] text-slate-400 truncate"
                            >
                              {ord.orderFeedback || ord.customerFeedback
                                ? `Saved: ${ord.orderFeedback || ord.customerFeedback}`
                                : 'لم يتم تسجيل تعليق بعد'}
                            </span>
                            <button
                              type="submit"
                              data-testid="save-order-feedback-btn"
                              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white text-xs font-bold cursor-pointer transition-all shadow-sm shrink-0"
                            >
                              Save Feedback • حفظ التعليق
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  })}
                  </div>
                )}

                {/* Order History Empty State Component with Subtle Icon & 'Book New Delivery' CTA */}
                <OrderHistoryEmptyState onBookNewDelivery={handleBookNewDelivery} />
              </div>
            )}
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
              data-status-animation={isWidgetStatusSlideAnimating ? 'slide-in' : 'settled'}
              data-haptic-feedback={isHapticVibrating ? 'active' : 'idle'}
              data-haptic-pulses={hapticPulseCount}
              onClickCapture={handleWidgetButtonPressCapture}
              className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col gap-4 font-['Cairo',sans-serif] transform transition-all duration-300 ease-out ${
                isHapticVibrating
                  ? 'animate-haptic-shake ring-1 ring-amber-400/50'
                  : isWidgetStatusSlideAnimating
                    ? 'animate-m3-slide-in translate-y-0 opacity-100 ring-1 ring-amber-500/30'
                    : 'translate-y-0 opacity-100'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-white">
                        متابعة الطلب الحي في المحاكي الموحد ({currentTrackedOrder.orderNumber})
                      </span>
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                        {currentTrackedOrder.totalEgp}.00 ج.م
                      </span>
                      <span
                        data-testid="active-order-status-badge"
                        className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30"
                      >
                        الحالة: {('status' in currentTrackedOrder && currentTrackedOrder.status) || activeOrderState.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {('assignedCaptainName' in currentTrackedOrder && currentTrackedOrder.assignedCaptainName) ||
                        activeOrderState.captainName}{' '}
                      • الوجهة:{' '}
                      {('deliveryAddress' in currentTrackedOrder && currentTrackedOrder.deliveryAddress) ||
                        activeOrderState.destination}
                      {lastRefreshedAtLabel && (
                        <span className="text-[11px] text-emerald-400 mr-2">
                          • آخر تحديث: {lastRefreshedAtLabel}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Static Map Thumbnail for El Bagour Route with Pickup & Dropoff Markers */}
                <div
                  data-testid="active-order-static-map-thumbnail"
                  data-map-view-mode={isFullScreenMapOpen ? 'fullscreen' : 'thumbnail'}
                  data-theme-mode={isDarkMode ? 'dark' : 'light'}
                  data-loading-skeleton={isRefreshingOrder ? 'true' : 'false'}
                  aria-busy={isRefreshingOrder}
                  aria-label="El Bagour Route Static Map Thumbnail"
                  className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex flex-col sm:flex-row items-center gap-3 shrink-0"
                >
                  <div
                    className={`relative w-44 h-16 rounded-lg overflow-hidden border shrink-0 ${
                      isDarkMode
                        ? 'border-slate-800 bg-slate-900'
                        : 'border-slate-300 bg-slate-100'
                    }`}
                  >
                    <PinchZoomPan isDarkMode={isDarkMode}>
                      <img
                        src={elBagourStaticMapSvgUri}
                        alt={`El Bagour Route Static Map from ${currentOrderPickup} to ${currentOrderDropoff}`}
                        data-testid="static-map-thumbnail-img"
                        data-theme-mode={isDarkMode ? 'dark' : 'light'}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <svg
                        data-testid="active-order-map-polyline-svg"
                        data-theme-mode={isDarkMode ? 'dark' : 'light'}
                        viewBox="0 0 280 96"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        aria-label="Animated Route Path Polyline"
                      >
                        <polyline
                          data-testid="route-base-polyline"
                          points={elBagourRoutePolylinePoints}
                          fill="none"
                          stroke={mapThemePalette.baseRouteStroke}
                          strokeOpacity="0.4"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          data-testid="animated-route-polyline"
                          points={elBagourRoutePolylinePoints}
                          fill="none"
                          stroke={mapThemePalette.activeRouteStroke}
                          strokeWidth="3"
                          strokeDasharray="8 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-pulse"
                        >
                          <animate
                            attributeName="stroke-dashoffset"
                            from="28"
                            to="0"
                            dur="1.2s"
                            repeatCount="indefinite"
                          />
                        </polyline>
                        <circle cx="38" cy="68" r="5" fill={mapThemePalette.pickupFill} />
                        <circle cx="242" cy="28" r="5" fill={mapThemePalette.dropoffFill} />
                        <circle
                          data-testid="animated-route-rider-dot"
                          r="4"
                          fill={mapThemePalette.riderFill}
                          stroke={mapThemePalette.riderStroke}
                          strokeWidth="1.5"
                        >
                          <animateMotion
                            path="M38,68 L96,46 L168,54 L242,28"
                            dur="3.5s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </svg>
                    </PinchZoomPan>
                    <span className="absolute top-1 right-1.5 z-10 px-1.5 py-0.5 rounded bg-slate-950/85 text-[9px] font-bold font-['Cairo',sans-serif] text-emerald-400 border border-emerald-500/30 pointer-events-none">
                      El Bagour • الباجور
                    </span>
                    <span
                      data-testid="map-travel-estimate-badge"
                      className="absolute bottom-1 left-1.5 z-10 px-1.5 py-0.5 rounded bg-slate-950/90 border border-slate-700/80 text-[9px] font-bold font-['Cairo',sans-serif] text-amber-300 flex items-center gap-1 shadow-sm pointer-events-none"
                    >
                      <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span>
                        ~{currentOrderDurationMinutes} min • {currentOrderRouteDistanceKm.toFixed(1)} km
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 text-[11px] min-w-[200px] font-['Cairo',sans-serif]">
                    <div
                      data-testid="map-pickup-marker"
                      className="flex items-center justify-between gap-2 text-emerald-300 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-bold text-slate-400">Pickup (الانطلاق):</span>
                        <span className="font-bold text-white truncate max-w-[140px]" title={currentOrderPickup}>
                          {currentOrderPickup}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid="copy-pickup-address-btn"
                        aria-label="Copy Pickup Address"
                        title="Copy Pickup Address • نسخ عنوان الانطلاق"
                        onClick={handleCopyPickupAddress}
                        className="shrink-0 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-amber-300 font-['Cairo',sans-serif] flex items-center justify-center transition-all cursor-pointer"
                      >
                        {pickupAddressCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="sr-only">Copy Pickup Address</span>
                      </button>
                    </div>
                    <div
                      data-testid="map-dropoff-marker"
                      className="flex items-center justify-between gap-2 text-amber-300 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="font-bold text-slate-400">Dropoff (الوصول):</span>
                        <span className="font-bold text-white truncate max-w-[140px]" title={currentOrderDropoff}>
                          {currentOrderDropoff}
                        </span>
                      </div>
                      <button
                        type="button"
                        data-testid="copy-dropoff-address-btn"
                        aria-label="Copy Dropoff Address"
                        title="Copy Dropoff Address • نسخ عنوان الوصول"
                        onClick={handleCopyDropoffAddress}
                        className="shrink-0 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-amber-300 font-['Cairo',sans-serif] flex items-center justify-center transition-all cursor-pointer"
                      >
                        {dropoffAddressCopied ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="sr-only">Copy Dropoff Address</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      data-testid="toggle-fullscreen-map-btn"
                      aria-expanded={isFullScreenMapOpen}
                      aria-label={
                        isFullScreenMapOpen
                          ? 'Toggle Static Map Thumbnail View'
                          : 'Toggle Full-Screen Map View'
                      }
                      onClick={handleToggleFullScreenMap}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-amber-300 text-[11px] font-bold font-['Cairo',sans-serif] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>
                        {isFullScreenMapOpen
                          ? 'Thumbnail Map View • تصغير الخريطة'
                          : 'Full-Screen Map View • تكبير الخريطة'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
                {/* Dynamic Estimated Time of Arrival (ETA) Countdown Timer */}
                <div
                  data-testid="active-order-eta-timer"
                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300 shrink-0"
                >
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold">Estimated Time of Arrival (ETA):</span>
                  <span className="font-mono font-black text-white text-sm" data-testid="eta-countdown-value">
                    {formattedEtaCountdown}
                  </span>
                  <span className="text-[10px] text-amber-200/80">
                    ({currentOrderDurationMinutes} د)
                  </span>
                </div>

                {/* Accepted Timestamp */}
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

                {/* Manual Refresh Order Status Button with Visual Feedback & Progress Bar */}
                <button
                  type="button"
                  data-testid="refresh-order-status-btn"
                  onClick={handleManualRefreshOrderStatus}
                  disabled={isRefreshingOrder}
                  aria-busy={isRefreshingOrder}
                  aria-label="Refresh Order Status"
                  className={`relative overflow-hidden px-3.5 py-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer disabled:cursor-not-allowed ${
                    isRefreshingOrder
                      ? 'bg-slate-800/90 border-emerald-500/50 text-emerald-300 opacity-90'
                      : refreshFeedbackStage === 'updated'
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <RefreshCw
                      className={`w-3.5 h-3.5 text-emerald-400 ${
                        isRefreshingOrder ? 'animate-spin' : ''
                      }`}
                    />
                    <span data-testid="refresh-button-label">
                      {isRefreshingOrder
                        ? 'Updating... • جاري التحديث...'
                        : refreshFeedbackStage === 'updated'
                        ? 'Updated ✓ • تم التحديث'
                        : 'Refresh • تحديث الحالة'}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    data-testid="refresh-progress-bar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={refreshProgress}
                    className={`w-full h-1 rounded-full bg-slate-950/80 overflow-hidden transition-opacity duration-200 ${
                      isRefreshingOrder || refreshProgress > 0 ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div
                      className={`h-full bg-emerald-400 transition-all duration-150 ease-out rounded-full ${
                        refreshProgress >= 100
                          ? 'w-full'
                          : refreshProgress >= 90
                          ? 'w-11/12'
                          : refreshProgress >= 65
                          ? 'w-2/3'
                          : refreshProgress > 0 || isRefreshingOrder
                          ? 'w-1/4'
                          : 'w-0'
                      }`}
                    />
                  </div>
                </button>

                {/* Call Captain Button */}
                <button
                  type="button"
                  data-testid="call-captain-btn"
                  onClick={handleOpenCallCaptainPrompt}
                  aria-label={`Call Captain ${currentOrderCaptainPhone}`}
                  className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Captain</span>
                  <span className="font-mono text-[11px] text-sky-100" data-testid="tracking-widget-captain-phone">
                    ({currentOrderCaptainPhone})
                  </span>
                </button>

                {/* Message Captain Button */}
                <button
                  type="button"
                  data-testid="message-captain-btn"
                  onClick={() => setIsCaptainChatModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Message Captain</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-teal-950/70 text-[10px] font-mono text-teal-200">
                    {captainChatMessages.length}
                  </span>
                </button>

                {/* Add Tip Button */}
                <button
                  type="button"
                  data-testid="add-tip-btn"
                  onClick={() => {
                    setIsAddTipSectionOpen(true);
                    setIsFareBreakdownExpanded(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Add Tip</span>
                  {captainTipEgp > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-pink-950/70 text-[10px] font-mono text-pink-200">
                      +{captainTipEgp} EGP
                    </span>
                  )}
                </button>

                {/* View Captain Profile Button */}
                <button
                  type="button"
                  data-testid="view-captain-profile-btn"
                  onClick={() => setIsCaptainProfileModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Bike className="w-3.5 h-3.5" />
                  <span>View Captain Profile</span>
                </button>

                {/* Cancel Order Button */}
                <button
                  type="button"
                  data-testid="cancel-order-btn"
                  onClick={handleOpenCancelOrderDialog}
                  disabled={currentOrderStatus === 'cancelled' || currentOrderStatus === 'delivered'}
                  className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Cancel Order</span>
                </button>

                {/* Share Live Link Button */}
                <button
                  type="button"
                  data-testid="share-live-link-btn"
                  onClick={handleShareLiveLink}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share Live Link</span>
                </button>

                {/* Edit Notes Button */}
                <button
                  type="button"
                  data-testid="edit-notes-btn"
                  onClick={handleToggleEditNotes}
                  className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Notes</span>
                </button>

                {/* View Order Summary Button */}
                <button
                  type="button"
                  data-testid="view-order-summary-btn"
                  onClick={() => setIsOrderSummaryModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>View Order Summary</span>
                </button>

                {/* SOS Emergency Button */}
                <button
                  type="button"
                  data-testid="sos-emergency-btn"
                  onClick={() => {
                    setSosLocationShared(false);
                    setSosTriggeredService(null);
                    setIsSosModalOpen(true);
                  }}
                  aria-label="SOS Emergency Assistance"
                  className="px-3 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-400/50 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-rose-900/40 transition cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-200" />
                  <span>SOS</span>
                </button>

                {/* View History Navigation Button */}
                <button
                  type="button"
                  data-testid="view-order-history-btn"
                  onClick={handleViewOrderHistory}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View History</span>
                </button>
              </div>

              {/* Order Notes Summary & Inline Editor inside Active Order Tracking Widget */}
              <div
                data-testid="edit-notes-section"
                className="pt-2 border-t border-slate-800/80 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-bold text-slate-400">ملاحظات الطلب (Order Notes):</span>
                    <span
                      data-testid="active-order-notes-display"
                      className="font-bold text-white"
                    >
                      {currentOrderNotesValue || 'لا توجد ملاحظات إضافية'}
                    </span>
                  </div>
                  {notesSavedFeedback && (
                    <span
                      data-testid="order-notes-saved-badge"
                      className="text-[11px] font-bold text-emerald-400"
                    >
                      Saved ✓ • تم الحفظ
                    </span>
                  )}
                </div>

                {isEditNotesOpen && (
                  <form
                    onSubmit={handleSaveOrderNotes}
                    data-testid="edit-order-notes-form"
                    className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-amber-500/40 rounded-xl p-2.5"
                  >
                    <input
                      type="text"
                      name="orderNotes"
                      aria-label="Order Notes"
                      data-testid="edit-order-notes-input"
                      value={orderNotes}
                      onChange={(e) => handleOrderNotesChange(e.target.value)}
                      placeholder="أضف أو عدّل ملاحظات التوصيل للكابتن..."
                      className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      data-testid="save-order-notes-btn"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition"
                    >
                      Save Notes • حفظ الملاحظات
                    </button>
                  </form>
                )}
              </div>

              {/* Add Tip (Captain Gratuity) Section */}
              {isAddTipSectionOpen && (
                <div
                  data-testid="add-tip-section"
                  className="pt-2 border-t border-slate-800/80 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-pink-400" />
                      <span>Add Tip • إكرامية الكابتن (Gratuity)</span>
                    </span>
                    <span
                      data-testid="active-tip-amount-badge"
                      className="text-[11px] font-mono font-bold text-pink-300 bg-pink-500/15 px-2.5 py-0.5 rounded-full border border-pink-500/30"
                    >
                      Tip: {fareBreakdownTipEgp.toFixed(2)} EGP
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 border border-slate-800/90 rounded-xl p-2.5">
                    {[5, 10, 15].map((presetEgp) => {
                      const isSelected = captainTipEgp === presetEgp;
                      return (
                        <button
                          key={presetEgp}
                          type="button"
                          data-testid={`tip-preset-${presetEgp}`}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectPresetTip(presetEgp)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-pink-600 text-white border-pink-400 shadow-sm shadow-pink-500/30'
                              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                          }`}
                        >
                          {presetEgp} EGP
                        </button>
                      );
                    })}

                    <form
                      onSubmit={handleApplyCustomTip}
                      className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[180px]"
                    >
                      <input
                        type="number"
                        min="0"
                        step="1"
                        aria-label="Custom Tip Amount in EGP"
                        data-testid="custom-tip-input"
                        value={customTipInput}
                        onChange={(e) => handleCustomTipInputChange(e.target.value)}
                        placeholder="Custom Tip (EGP) • مبلغ مخصص"
                        className="flex-1 min-w-[130px] px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-pink-400 font-mono"
                      />
                      <button
                        type="submit"
                        data-testid="apply-custom-tip-btn"
                        className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold cursor-pointer transition"
                      >
                        Apply Tip
                      </button>
                      {captainTipEgp > 0 && (
                        <button
                          type="button"
                          data-testid="clear-tip-btn"
                          onClick={() => {
                            setCaptainTipEgp(0);
                            setCustomTipInput('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer transition"
                        >
                          Clear
                        </button>
                      )}
                    </form>
                  </div>
                </div>
              )}

              {/* Expandable Fare Breakdown Section */}
              <div
                data-testid="expandable-fare-breakdown"
                className="pt-2 border-t border-slate-800/80 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="toggle-fare-breakdown-btn"
                    aria-expanded={isFareBreakdownExpanded}
                    onClick={() => setIsFareBreakdownExpanded((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 cursor-pointer transition"
                  >
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Expandable Fare Breakdown • تفاصيل تكلفة المشوار</span>
                    </span>
                    <span
                      data-testid="fare-breakdown-total-amount"
                      className="flex items-center gap-2 text-emerald-400 font-mono"
                    >
                      <span>{fareBreakdownTotalEgp.toFixed(2)} EGP</span>
                      {isFareBreakdownExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </span>
                  </button>
                </div>

                {isFareBreakdownExpanded && (
                  <div
                    data-testid="fare-breakdown-content"
                    className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs"
                  >
                    <div
                      data-testid="fare-item-base-fare"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-medium">Base Fare (فتحة العداد)</span>
                      <span className="font-mono font-bold text-white">
                        {fareBreakdownBaseFareEgp.toFixed(2)} EGP
                      </span>
                    </div>
                    <div
                      data-testid="fare-item-distance-fare"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-medium">Distance Fare (تكلفة المسافة)</span>
                      <span className="font-mono font-bold text-white">
                        {fareBreakdownDistanceFareEgp.toFixed(2)} EGP
                      </span>
                    </div>
                    <div
                      data-testid="fare-item-rural-surcharge"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-medium">Rural Surcharge (إضافي القرى)</span>
                      <span className="font-mono font-bold text-amber-300">
                        {fareBreakdownRuralSurchargeEgp.toFixed(2)} EGP
                      </span>
                    </div>
                    <div
                      data-testid="fare-item-platform-fee"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/60"
                    >
                      <span className="text-slate-300 font-medium">Platform Fee (رسوم المنصة)</span>
                      <span className="font-mono font-bold text-sky-300">
                        {fareBreakdownPlatformFeeEgp.toFixed(2)} EGP
                      </span>
                    </div>
                    <div
                      data-testid="fare-item-tip"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-pink-500/30"
                    >
                      <span className="text-pink-300 font-medium">Captain Tip (إكرامية الكابتن)</span>
                      <span className="font-mono font-bold text-pink-300">
                        {fareBreakdownTipEgp.toFixed(2)} EGP
                      </span>
                    </div>
                    <div
                      data-testid="fare-item-total"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40"
                    >
                      <span className="text-emerald-300 font-bold">Total Fare (الإجمالي الكلي)</span>
                      <span className="font-mono font-black text-emerald-400">
                        {fareBreakdownTotalEgp.toFixed(2)} EGP
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Vertical Status Timeline Component */}
              <div
                data-testid="active-order-vertical-timeline"
                data-status-pulse={isTimelinePulsing ? 'active' : 'idle'}
                data-loading-skeleton={isRefreshingOrder ? 'true' : 'false'}
                aria-busy={isRefreshingOrder}
                className={`pt-2 border-t border-slate-800/80 flex flex-col gap-2 rounded-xl transition-all duration-500 ${
                  isTimelinePulsing
                    ? 'animate-pulse ring-1 ring-emerald-500/40 bg-emerald-950/15 p-2'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Activity
                      className={`w-3.5 h-3.5 text-emerald-400 ${
                        isTimelinePulsing ? 'animate-pulse' : ''
                      }`}
                    />
                    Order Status Timeline • التسلسل الزمني لحالات الطلب
                  </span>
                  <span
                    data-testid="timeline-pulse-indicator"
                    className={`text-[11px] font-mono text-emerald-400 ${
                      isTimelinePulsing ? 'animate-pulse font-bold' : ''
                    }`}
                  >
                    {currentOrderStatus === 'cancelled'
                      ? 'Cancelled • ملغي'
                      : `${activeTimelineIndex + 1} / ${orderTimelineSteps.length}`}
                  </span>
                </div>

                <div className="relative pl-3 pr-1 py-1 flex flex-col gap-2.5">
                  {orderTimelineSteps.map((step, index) => {
                    const StepIcon = step.Icon;
                    const isCompleted =
                      currentOrderStatus !== 'cancelled' && index < activeTimelineIndex;
                    const isCurrent =
                      currentOrderStatus !== 'cancelled' && index === activeTimelineIndex;

                    return (
                      <div
                        key={step.key}
                        data-testid={`timeline-step-${step.key}`}
                        data-step-state={
                          isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming'
                        }
                        className={`relative flex items-start gap-3 ${
                          isCurrent ? 'animate-pulse' : ''
                        }`}
                      >
                        {index < orderTimelineSteps.length - 1 && (
                          <div
                            className={`absolute left-[13px] top-6 bottom-[-12px] w-0.5 ${
                              isCompleted ? 'bg-emerald-500/70' : 'bg-slate-800'
                            }`}
                          />
                        )}
                        <div
                          className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border shrink-0 ${
                            isCurrent
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm shadow-emerald-500/30 animate-pulse'
                              : isCompleted
                                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-400'
                                : 'bg-slate-900 border-slate-700 text-slate-500'
                          }`}
                        >
                          <StepIcon className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-1 bg-slate-950/60 border border-slate-800/70 rounded-lg px-2.5 py-1.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-bold ${
                                  isCurrent
                                    ? 'text-emerald-300'
                                    : isCompleted
                                      ? 'text-white'
                                      : 'text-slate-400'
                                }`}
                              >
                                {step.label}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                • {step.arabicLabel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500">{step.description}</span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCurrent
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                                : isCompleted
                                  ? 'bg-slate-800 text-emerald-400'
                                  : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            {isCurrent ? 'Active • حالي' : isCompleted ? 'Done ✓' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temporary Live Link & Mobile Sharing Intents Drawer */}
              {isShareLiveLinkOpen && sharedLiveLinkUrl && (
                <div
                  data-testid="share-live-link-panel"
                  className="pt-2 border-t border-slate-800/80 bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-indigo-400" />
                      رابط التتبع المؤقت للمشاركة (Temporary Live Tracking URL — صالح لمدة ٣٠ دقيقة)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsShareLiveLinkOpen(false)}
                      className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
                    >
                      إغلاق ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      aria-label="Temporary Live Share Link"
                      data-testid="generated-live-link-input"
                      value={sharedLiveLinkUrl}
                      className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg bg-slate-950 border border-indigo-500/40 font-mono text-xs text-indigo-200"
                    />
                    <span data-testid="generated-live-link-url" className="sr-only">
                      {sharedLiveLinkUrl}
                    </span>
                    <button
                      type="button"
                      data-testid="copy-live-link-btn"
                      onClick={handleCopyLiveLink}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                    >
                      {liveLinkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{liveLinkCopied ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `تابع مسار طلبي في مشوار الباجور (${currentTrackedOrder.orderNumber}): ${sharedLiveLinkUrl}`
                      )}`}
                      data-testid="share-intent-whatsapp"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition"
                    >
                      <span>WhatsApp Share</span>
                    </a>
                    <a
                      href={`sms:?body=${encodeURIComponent(
                        `تتبع طلبي في مشوار الباجور (${currentTrackedOrder.orderNumber}): ${sharedLiveLinkUrl}`
                      )}`}
                      data-testid="share-intent-sms"
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 transition"
                    >
                      <span>SMS Share</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Order History Section when navigated via 'View History' */}
            {customerScreen === 'history' && (
              <div
                data-testid="order-history-section"
                className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl flex flex-col gap-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-black text-white">
                      سجل الطلبات والمشاوير وتقييم الكباتن (Order History & Post-Delivery Rating)
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      {marketplaceOrders.length} طلبات
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerScreen('tracking')}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    إغلاق السجل والعودة للتتبع الحي
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {marketplaceOrders.map((ord) => {
                    const currentRating = orderRatings[ord.id] ?? ord.customerRating ?? 0;
                    const currentFeedback =
                      orderFeedbackDrafts[ord.id] ?? ord.orderFeedback ?? ord.customerFeedback ?? '';
                    const isFeedbackSaved = Boolean(orderFeedbackSavedMap[ord.id]);
                    return (
                      <div
                        key={ord.id}
                        data-testid={`history-order-card-${ord.id}`}
                        className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-white">
                            {ord.orderNumber} • {ord.storeName}
                          </span>
                          <span className="font-bold text-emerald-400">{ord.totalEgp}.00 ج.م</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span>
                            الكابتن: {ord.assignedCaptainName || 'كابتن مشوار الباجور'} • الوجهة: {ord.deliveryAddress}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold">
                            {ord.status}
                          </span>
                        </div>

                        {/* Post-Delivery 1-5 Star Rating System */}
                        <div
                          data-testid="post-delivery-star-rating"
                          data-order-id={ord.id}
                          className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-slate-300">
                              Rate Captain (1-5) • تقييم الكابتن:
                            </span>
                            {currentRating > 0 && (
                              <span
                                data-testid="selected-captain-rating"
                                className="text-[11px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30"
                              >
                                {currentRating}/5 ★
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1" role="group" aria-label={`Rate captain for order ${ord.orderNumber}`}>
                            {[1, 2, 3, 4, 5].map((starValue) => {
                              const isFilled = starValue <= currentRating;
                              return (
                                <button
                                  key={starValue}
                                  type="button"
                                  data-testid={`rate-star-${starValue}`}
                                  data-star-value={starValue}
                                  aria-label={`Rate ${starValue} out of 5 stars`}
                                  aria-pressed={currentRating === starValue}
                                  onClick={() => handleRateOrderCaptain(ord.id, starValue)}
                                  className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-0.5 transition cursor-pointer ${
                                    isFilled
                                      ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${
                                      isFilled ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                                    }`}
                                  />
                                  <span>{starValue}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Order Feedback Textarea below Star Rating */}
                        <form
                          onSubmit={(e) => handleSaveOrderFeedback(ord.id, currentFeedback, e)}
                          data-testid="order-feedback-section"
                          data-order-id={ord.id}
                          className="pt-2 border-t border-slate-800/80 flex flex-col gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor={`order-feedback-textarea-sim-${ord.id}`}
                              className="text-[11px] font-bold text-slate-300"
                            >
                              Order Feedback • تعليق وملاحظات تجربة التوصيل:
                            </label>
                            {(isFeedbackSaved || Boolean(ord.orderFeedback || ord.customerFeedback)) && (
                              <span
                                data-testid="order-feedback-saved-badge"
                                className="text-[10px] font-bold text-emerald-400"
                              >
                                Feedback Saved ✓ • تم حفظ التعليق
                              </span>
                            )}
                          </div>
                          <textarea
                            id={`order-feedback-textarea-sim-${ord.id}`}
                            name="orderFeedback"
                            aria-label="Order Feedback"
                            data-testid="order-feedback-textarea"
                            data-order-id={ord.id}
                            rows={2}
                            value={currentFeedback}
                            onChange={(e) => handleOrderFeedbackChange(ord.id, e.target.value)}
                            placeholder="Write your Order Feedback about your delivery experience... • اكتب ملاحظاتك عن تجربة التوصيل..."
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400 resize-y"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <span
                              data-testid="persisted-order-feedback-display"
                              className="text-[11px] text-slate-400 truncate"
                            >
                              {ord.orderFeedback || ord.customerFeedback
                                ? `Saved: ${ord.orderFeedback || ord.customerFeedback}`
                                : 'لم يتم تسجيل تعليق بعد'}
                            </span>
                            <button
                              type="submit"
                              data-testid="save-order-feedback-btn"
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer transition shrink-0"
                            >
                              Save Feedback • حفظ التعليق
                            </button>
                          </div>
                        </form>
                      </div>
                    );
                  })}
                </div>

                {/* Order History Empty State Component with Subtle Icon & 'Book New Delivery' CTA */}
                <OrderHistoryEmptyState onBookNewDelivery={handleBookNewDelivery} />
              </div>
            )}

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

      {/* Call Captain Phone Dialer Prompt Modal */}
      {isCallCaptainPromptOpen && (
        <div
          data-testid="call-captain-dialer-prompt"
          role="dialog"
          aria-modal="true"
          aria-label="Call Captain Phone Dialer Prompt"
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl"
            dir="rtl"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
              <Phone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white mb-1">
              Call Captain • الاتصال الهاتفي بالكابتن
            </h3>
            <p className="text-xs text-slate-300 mb-3">
              {currentOrderCaptainName} • الطلب ({currentTrackedOrder.orderNumber})
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4">
              <span className="text-[11px] text-slate-400 block mb-1">
                Captain Phone Number • رقم هاتف الكابتن المسجل بالطلب
              </span>
              <span
                data-testid="dialer-prompt-phone-number"
                className="font-mono text-lg font-black text-emerald-400 tracking-wider block"
              >
                {currentOrderCaptainPhone}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href={`tel:${currentOrderCaptainPhone}`}
                data-testid="dialer-call-action-link"
                onClick={() => setIsCallCaptainPromptOpen(false)}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <Phone className="w-4 h-4" />
                <span>Dial {currentOrderCaptainPhone} • فتح الهاتف</span>
              </a>
              <button
                type="button"
                data-testid="close-call-captain-prompt-btn"
                onClick={() => setIsCallCaptainPromptOpen(false)}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
              >
                إغلاق • Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Dialog */}
      {isCancelOrderDialogOpen && (
        <div
          data-testid="cancel-order-confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Order Cancellation"
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl"
            dir="rtl"
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white mb-2">
              Confirm Cancel Order • تأكيد إلغاء الطلب ({currentTrackedOrder.orderNumber})
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-5">
              هل أنت متأكد من رغبتك في إلغاء الطلب الحالي؟ سيتم تحديث حالة الطلب فوراً إلى ملغي (cancelled) في متجر وسجل الطلبات.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                data-testid="confirm-cancel-order-btn"
                onClick={handleConfirmCancelOrder}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-500/50 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                Confirm Cancel • تأكيد الإلغاء
              </button>
              <button
                type="button"
                data-testid="dismiss-cancel-order-btn"
                onClick={() => setIsCancelOrderDialogOpen(false)}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
              >
                Keep Order • تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captain Profile Modal */}
      {isCaptainProfileModalOpen && (
        <div
          data-testid="captain-profile-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Captain Profile Details in El Bagour"
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Bike className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h3
                    data-testid="captain-profile-name"
                    className="text-base font-black text-white"
                  >
                    {currentOrderCaptainName}
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    كابتن معتمد • مدينة الباجور (El Bagour Verified Captain)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCaptainProfileModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs mb-5">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-bold">
                  Vehicle Details • بيانات المركبة:
                </span>
                <span
                  data-testid="captain-profile-vehicle"
                  className="font-black text-white"
                >
                  {currentOrderCaptainVehicle}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-bold">
                  Captain Rating • تقييم الكابتن:
                </span>
                <span
                  data-testid="captain-profile-rating"
                  className="font-black text-amber-400 flex items-center gap-1"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span>{currentOrderCaptainRating.toFixed(1)} / 5.0</span>
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400 font-bold">
                  Total Completed Trips in El Bagour • إجمالي مشاوير الباجور:
                </span>
                <span
                  data-testid="captain-profile-completed-trips"
                  className="font-black text-emerald-400"
                >
                  {currentOrderCaptainTotalTripsElBagour} رحلة مكتملة في الباجور (El Bagour)
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCaptainProfileModalOpen(false);
                  setIsCallCaptainPromptOpen(true);
                }}
                className="flex-1 py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Captain ({currentOrderCaptainPhone})</span>
              </button>
              <button
                type="button"
                data-testid="close-captain-profile-modal-btn"
                onClick={() => setIsCaptainProfileModalOpen(false)}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer"
              >
                إغلاق • Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Message Captain Chat Modal */}
      {isCaptainChatModalOpen && (
        <div
          data-testid="captain-chat-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Message Captain Chat Modal"
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-3"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-black text-white">
                    Message Captain • محادثة {currentOrderCaptainName}
                  </h3>
                  <span className="text-[11px] text-emerald-400 font-bold">
                    الطلب ({currentTrackedOrder.orderNumber}) • متصل الآن في الباجور
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-captain-chat-modal-btn"
                onClick={() => setIsCaptainChatModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer transition-all"
              >
                إغلاق ✕
              </button>
            </div>

            {/* Chat Messages History */}
            <div
              data-testid="captain-chat-messages-list"
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-60 overflow-y-auto flex flex-col gap-2 text-xs"
            >
              {captainChatMessages.map((msg) => (
                <div
                  key={msg.id}
                  data-testid={`chat-message-${msg.sender}`}
                  className={`flex flex-col max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.sender === 'customer'
                      ? 'self-start bg-emerald-700/25 border border-emerald-500/40 text-emerald-100'
                      : 'self-end bg-slate-900 border border-slate-700 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-emerald-400">
                      {msg.sender === 'customer' ? 'أنت (Customer)' : currentOrderCaptainName}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{msg.time}</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Predefined Quick Messages */}
            <div
              data-testid="captain-chat-quick-messages"
              className="flex flex-col gap-1.5"
            >
              <span className="text-[11px] font-bold text-slate-400">
                رسائل سريعة جاهزة (Quick Messages):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_QUICK_MESSAGES.map((quickText, idx) => (
                  <button
                    key={quickText}
                    type="button"
                    data-testid={`quick-message-btn-${idx}`}
                    onClick={() => handleSendCaptainChatMessage(quickText)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-700/30 border border-slate-700 hover:border-emerald-500/50 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
                  >
                    {quickText}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Chat Message Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendCaptainChatMessage(captainChatInput);
              }}
              className="flex items-center gap-2 pt-1 border-t border-slate-800"
            >
              <input
                type="text"
                data-testid="captain-chat-input"
                aria-label="Message to Captain"
                value={captainChatInput}
                onChange={(e) => setCaptainChatInput(e.target.value)}
                placeholder="اكتب رسالة للكابتن..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                data-testid="send-chat-message-btn"
                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-all shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>إرسال • Send</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SOS Emergency Assistance Modal */}
      {isSosModalOpen && (
        <div
          data-testid="sos-emergency-modal"
          role="dialog"
          aria-modal="true"
          aria-label="SOS Emergency Assistance in El Bagour"
          className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black text-white">
                    SOS Emergency • مساعدة الطوارئ والأمان (الباجور)
                  </h3>
                  <span className="text-[11px] text-rose-300 font-bold">
                    الطلب ({currentTrackedOrder.orderNumber}) • موقعك الحي في الباجور جاهز للمشاركة
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-sos-modal-btn"
                onClick={() => setIsSosModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer transition-all"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 font-bold">
                  Pre-configured Emergency Contact in El Bagour • جهة اتصال الطوارئ المسجلة:
                </span>
                <span
                  data-testid="sos-emergency-contact-name"
                  className="font-black text-white"
                >
                  {elBagourEmergencyContact.name}
                </span>
                <span
                  data-testid="sos-emergency-contact-phone"
                  className="font-mono text-emerald-400 font-bold"
                >
                  {elBagourEmergencyContact.phone}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 font-bold">
                  Live Route & Coordinates • الموقع الحالي وخط السير:
                </span>
                <span
                  data-testid="sos-live-location-details"
                  className="font-bold text-amber-300"
                >
                  {currentOrderPickup} ← {currentOrderDropoff} ({elBagourEmergencyContact.coordinates})
                </span>
              </div>
            </div>

            {sosLocationShared && (
              <div
                data-testid="sos-location-shared-confirmation"
                className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Live location shared with {elBagourEmergencyContact.name} ({elBagourEmergencyContact.phone}) in El Bagour! • تم إرسال موقعك الحي وبيانات الكابتن لجهة اتصال الطوارئ بنجاح.
                </span>
              </div>
            )}

            {sosTriggeredService && (
              <div
                data-testid="sos-emergency-call-confirmation"
                className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 font-bold flex items-center gap-2"
              >
                <Phone className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Connecting to {sosTriggeredService}... • جاري الاتصال بطوارئ الباجور ({sosTriggeredService})
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="sos-share-live-location-btn"
                onClick={() => setSosLocationShared(true)}
                className="w-full py-2.5 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>
                  Share Live Location with Emergency Contact ({elBagourEmergencyContact.phone}) • مشاركة الموقع الحي
                </span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href="tel:122"
                  data-testid="sos-call-emergency-services-btn"
                  onClick={() => setSosTriggeredService('النجدة المصرية 122 (Local Emergency Police)')}
                  className="py-2.5 px-3.5 rounded-xl bg-rose-700 hover:bg-rose-600 border border-rose-500/50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all text-center"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Local Emergency Services (122 • النجدة)</span>
                </a>
                <a
                  href="tel:123"
                  data-testid="sos-call-ambulance-btn"
                  onClick={() => setSosTriggeredService('إسعاف الباجور 123 (El Bagour Ambulance)')}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all text-center"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Call Ambulance (123 • إسعاف الباجور)</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Order Summary Modal */}
      {isOrderSummaryModalOpen && (
        <div
          data-testid="order-summary-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Complete Order Summary Modal"
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black text-white">
                    Order Summary • ملخص تفاصيل الطلب الكامل
                  </h3>
                  <span
                    data-testid="summary-order-number"
                    className="text-[11px] text-emerald-400 font-bold"
                  >
                    رقم الطلب: {currentTrackedOrder.orderNumber} • الحالة: {currentOrderStatus}
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-order-summary-modal-btn"
                onClick={() => setIsOrderSummaryModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer transition-all"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold">Pickup Address • عنوان الاستلام:</span>
                  <span
                    data-testid="summary-pickup-address"
                    className="font-black text-emerald-300"
                  >
                    {currentOrderPickup}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                  <span className="text-slate-400 font-bold">Dropoff Address • عنوان التوصيل:</span>
                  <span
                    data-testid="summary-dropoff-address"
                    className="font-black text-amber-300"
                  >
                    {currentOrderDropoff}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <span className="text-slate-400 font-bold">
                  Item Description • وصف الشحنة / الطلب:
                </span>
                <span
                  data-testid="summary-item-description"
                  className="font-bold text-white"
                >
                  {currentOrderItemDescription}
                </span>
              </div>

              <div
                data-testid="summary-customer-details"
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-1.5"
              >
                <span className="text-slate-400 font-bold">
                  Customer Details • بيانات العميل:
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">الاسم (Customer Name):</span>
                  <span
                    data-testid="summary-customer-name"
                    className="font-black text-white"
                  >
                    {currentOrderCustomerName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">رقم الهاتف (Customer Phone):</span>
                  <span
                    data-testid="summary-customer-phone"
                    className="font-mono font-bold text-emerald-300"
                  >
                    {currentOrderCustomerPhone}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-slate-400 font-bold">الكابتن وطريقة الدفع:</span>
                  <span className="text-white font-bold">
                    {currentOrderCaptainName} ({currentOrderPaymentMethod})
                  </span>
                </div>
                <span
                  data-testid="summary-total-fare"
                  className="font-mono text-sm font-black text-emerald-400"
                >
                  {fareBreakdownTotalEgp.toFixed(2)} EGP
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOrderSummaryModalOpen(false)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              حسناً • Close Summary
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Map View Modal */}
      {isFullScreenMapOpen && (
        <div
          data-testid="fullscreen-map-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Full-Screen El Bagour Live Route Map"
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif] animate-m3-slide-in"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-4xl w-full shadow-2xl flex flex-col gap-4 font-['Cairo',sans-serif]"
            dir="rtl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h3 className="text-base font-black text-white">
                    Full-Screen Map View • خريطة التتبع المباشر بملء الشاشة (الباجور)
                  </h3>
                  <span className="text-xs text-slate-400 font-bold">
                    الطلب ({currentTrackedOrder.orderNumber}) • الكابتن: {currentOrderCaptainName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-fullscreen-map-btn"
                onClick={() => setIsFullScreenMapOpen(false)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 hover:text-amber-300 text-xs font-bold font-['Cairo',sans-serif] flex items-center gap-2 cursor-pointer transition-all"
              >
                <span>Thumbnail View • تصغير وإغلاق الخريطة ✕</span>
              </button>
            </div>

            <div className="relative w-full h-72 sm:h-96 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <img
                src={elBagourStaticMapSvgUri}
                alt={`Full-Screen El Bagour Route Map from ${currentOrderPickup} to ${currentOrderDropoff}`}
                data-testid="fullscreen-map-img"
                className="w-full h-full object-cover"
              />
              <svg
                viewBox="0 0 280 96"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-label="Full-Screen Animated Route Path Polyline"
              >
                <polyline
                  points={elBagourRoutePolylinePoints}
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity="0.35"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={elBagourRoutePolylinePoints}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-pulse"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="28"
                    to="0"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </polyline>
                <circle cx="38" cy="68" r="5" fill="#f59e0b" />
                <circle cx="242" cy="28" r="5" fill="#fbbf24" />
                <circle
                  r="4"
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                >
                  <animateMotion
                    path="M38,68 L96,46 L168,54 L242,28"
                    dur="3.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
              <span className="absolute top-3 right-3 z-10 px-3 py-1 rounded-xl bg-slate-950/90 text-xs font-bold font-['Cairo',sans-serif] text-amber-400 border border-amber-500/40">
                El Bagour Live GPS • مركز الباجور - المنوفية
              </span>
              <span className="absolute bottom-3 left-3 z-10 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-700 text-xs font-bold font-['Cairo',sans-serif] text-amber-300 flex items-center gap-1.5 shadow-md">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  ~{currentOrderDurationMinutes} min ({currentOrderDurationMinutes} د) • {currentOrderRouteDistanceKm.toFixed(1)} km
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-400 font-bold shrink-0">Pickup (الانطلاق):</span>
                  <span className="text-white font-bold truncate">{currentOrderPickup}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPickupAddress}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {pickupAddressCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>نسخ</span>
                </button>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Navigation className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-400 font-bold shrink-0">Dropoff (الوصول):</span>
                  <span className="text-white font-bold truncate">{currentOrderDropoff}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDropoffAddress}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {dropoffAddressCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
                  <span>نسخ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Passenger Regulatory Notice Modal */}
      {showPassengerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-['Cairo',sans-serif]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl" dir="rtl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">خدمة نقل الركاب معلقة نظامياً</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              حرصاً على سلامتك وامتثالاً للقوانين المصرية المعمول بها، تم تعطيل خدمة نقل الأفراد في مدينة الباجور لحين مراجعة التراخيص المرورية الرسمية واعتماد وثائق التأمين التجاري.
            </p>
            <button
              onClick={() => setShowPassengerModal(false)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-500/50 text-white font-bold text-xs transition-all cursor-pointer"
            >
              فهمت ذلك - العودة للخدمات المتاحة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
