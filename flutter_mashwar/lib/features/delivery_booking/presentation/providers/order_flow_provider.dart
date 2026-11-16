import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/utils/price_calculator.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';
import '../../../../shared/services/mock_data_repository.dart';

enum OrderFlowServiceCategory {
  delivery,
  ride,
}

enum RideVehicleType {
  tuktuk,
  car,
}

enum OrderFlowStep {
  selectService,
  configureDetails,
  reviewAndConfirm,
}

class LocalMerchantSummary {
  final String id;
  final String nameAr;
  final String landmark;
  final String categoryAr;
  final List<MerchantCatalogItem> items;

  const LocalMerchantSummary({
    required this.id,
    required this.nameAr,
    required this.landmark,
    required this.categoryAr,
    required this.items,
  });
}

class MerchantCatalogItem {
  final String id;
  final String nameAr;
  final double priceEgp;

  const MerchantCatalogItem({
    required this.id,
    required this.nameAr,
    required this.priceEgp,
  });
}

const List<LocalMerchantSummary> elBagourMerchants = [
  LocalMerchantSummary(
    id: 'store_el_basha_grill',
    nameAr: 'مشويات الباشا - الباجور',
    landmark: 'شارع الجيش - برج الشروق',
    categoryAr: 'مطاعم',
    items: [
      MerchantCatalogItem(id: 'prod_kofta', nameAr: 'وجبة كفتة مشوية على الفحم', priceEgp: 165),
      MerchantCatalogItem(id: 'prod_shish', nameAr: 'ساندوتش شيش طاووق سوري', priceEgp: 65),
    ],
  ),
  LocalMerchantSummary(
    id: 'store_shifa_pharmacy',
    nameAr: 'صيدلية الشفاء المركزية',
    landmark: 'مستشفى الباجور العام',
    categoryAr: 'صيدليات',
    items: [
      MerchantCatalogItem(id: 'prod_panadol', nameAr: 'بانادول إكسترا 24 قرص', priceEgp: 48),
      MerchantCatalogItem(id: 'prod_vitc', nameAr: 'فيتامين سي فوار 1000 مجم', priceEgp: 55),
    ],
  ),
  LocalMerchantSummary(
    id: 'store_baraka_market',
    nameAr: 'سوبر ماركت البركة والعائلة',
    landmark: 'ميدان المحطة - وسط الباجور',
    categoryAr: 'سوبر ماركت',
    items: [
      MerchantCatalogItem(id: 'prod_breakfast', nameAr: 'باقة فطار الباجور (لبن + جبنة + عيش)', priceEgp: 85),
      MerchantCatalogItem(id: 'prod_water', nameAr: 'كرتونة مياه معدنية 12 زجاجة', priceEgp: 72),
    ],
  ),
];

class OrderFlowState {
  final OrderFlowStep step;
  final OrderFlowServiceCategory serviceCategory;
  final String selectedMerchantId;
  final Map<String, int> itemQuantities;
  final RideVehicleType rideVehicleType;
  final String pickupLandmark;
  final String dropoffLandmark;
  final bool isRuralDestination;
  final String paymentMethod;
  final String notes;
  final bool isSubmitting;
  final String? errorMessage;

  const OrderFlowState({
    this.step = OrderFlowStep.selectService,
    this.serviceCategory = OrderFlowServiceCategory.delivery,
    this.selectedMerchantId = 'store_el_basha_grill',
    this.itemQuantities = const {},
    this.rideVehicleType = RideVehicleType.tuktuk,
    this.pickupLandmark = 'ميدان المحطة - وسط الباجور',
    this.dropoffLandmark = 'مستشفى الباجور العام',
    this.isRuralDestination = false,
    this.paymentMethod = 'cash',
    this.notes = '',
    this.isSubmitting = false,
    this.errorMessage,
  });

  LocalMerchantSummary get selectedMerchant => elBagourMerchants.firstWhere(
        (m) => m.id == selectedMerchantId,
        orElse: () => elBagourMerchants.first,
      );

  double get estimatedDistanceKm {
    if (pickupLandmark == dropoffLandmark) return 1.2;
    return isRuralDestination ? 4.8 : 2.4;
  }

  double get merchantSubtotalEgp {
    if (serviceCategory != OrderFlowServiceCategory.delivery) return 0;
    double sum = 0;
    for (final item in selectedMerchant.items) {
      final qty = itemQuantities[item.id] ?? 0;
      sum += item.priceEgp * qty;
    }
    return sum;
  }

  double get serviceFareEgp {
    if (serviceCategory == OrderFlowServiceCategory.delivery) {
      final quote = PriceCalculator.calculateQuote(
        distanceKm: estimatedDistanceKm,
        isRuralOrVillage: isRuralDestination,
      );
      return quote.totalFare;
    }
    // Ride fare: TukTuk vs Economy Car
    final double base = rideVehicleType == RideVehicleType.tuktuk ? 15.0 : 28.0;
    final double perKm = rideVehicleType == RideVehicleType.tuktuk ? 4.5 : 7.5;
    final double extraKm = (estimatedDistanceKm - 1.5).clamp(0.0, 50.0);
    return double.parse((base + extraKm * perKm).toStringAsFixed(0));
  }

  double get totalFareEgp => merchantSubtotalEgp + serviceFareEgp;

  OrderFlowState copyWith({
    OrderFlowStep? step,
    OrderFlowServiceCategory? serviceCategory,
    String? selectedMerchantId,
    Map<String, int>? itemQuantities,
    RideVehicleType? rideVehicleType,
    String? pickupLandmark,
    String? dropoffLandmark,
    bool? isRuralDestination,
    String? paymentMethod,
    String? notes,
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
  }) {
    return OrderFlowState(
      step: step ?? this.step,
      serviceCategory: serviceCategory ?? this.serviceCategory,
      selectedMerchantId: selectedMerchantId ?? this.selectedMerchantId,
      itemQuantities: itemQuantities ?? this.itemQuantities,
      rideVehicleType: rideVehicleType ?? this.rideVehicleType,
      pickupLandmark: pickupLandmark ?? this.pickupLandmark,
      dropoffLandmark: dropoffLandmark ?? this.dropoffLandmark,
      isRuralDestination: isRuralDestination ?? this.isRuralDestination,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      notes: notes ?? this.notes,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class OrderFlowNotifier extends StateNotifier<OrderFlowState> {
  final Ref _ref;

  OrderFlowNotifier(this._ref)
      : super(OrderFlowState(
          pickupLandmark: MockDataRepository.elBagourLandmarks.first,
          dropoffLandmark: MockDataRepository.elBagourLandmarks[3],
        ));

  void selectServiceCategory(OrderFlowServiceCategory category) {
    state = state.copyWith(
      serviceCategory: category,
      pickupLandmark: category == OrderFlowServiceCategory.delivery
          ? state.selectedMerchant.landmark
          : MockDataRepository.elBagourLandmarks.first,
      clearError: true,
    );
  }

  void selectMerchant(String merchantId) {
    final merchant = elBagourMerchants.firstWhere(
      (m) => m.id == merchantId,
      orElse: () => elBagourMerchants.first,
    );
    state = state.copyWith(
      selectedMerchantId: merchant.id,
      pickupLandmark: merchant.landmark,
      itemQuantities: {},
      clearError: true,
    );
  }

  void updateItemQty(String itemId, int delta) {
    final updated = Map<String, int>.from(state.itemQuantities);
    final next = (updated[itemId] ?? 0) + delta;
    if (next <= 0) {
      updated.remove(itemId);
    } else {
      updated[itemId] = next;
    }
    state = state.copyWith(itemQuantities: updated, clearError: true);
  }

  void selectRideVehicle(RideVehicleType vehicle) {
    state = state.copyWith(rideVehicleType: vehicle, clearError: true);
  }

  void setPickupLandmark(String landmark) {
    final rural = landmark.contains('قرية') || state.dropoffLandmark.contains('قرية');
    state = state.copyWith(
      pickupLandmark: landmark,
      isRuralDestination: rural,
      clearError: true,
    );
  }

  void setDropoffLandmark(String landmark) {
    final rural = landmark.contains('قرية') || state.pickupLandmark.contains('قرية');
    state = state.copyWith(
      dropoffLandmark: landmark,
      isRuralDestination: rural,
      clearError: true,
    );
  }

  void setPaymentMethod(String method) {
    state = state.copyWith(paymentMethod: method);
  }

  void setNotes(String notes) {
    state = state.copyWith(notes: notes);
  }

  void goToStep(OrderFlowStep step) {
    state = state.copyWith(step: step, clearError: true);
  }

  void nextStep() {
    if (state.step == OrderFlowStep.selectService) {
      state = state.copyWith(step: OrderFlowStep.configureDetails, clearError: true);
      return;
    }
    if (state.step == OrderFlowStep.configureDetails) {
      if (state.serviceCategory == OrderFlowServiceCategory.delivery &&
          state.itemQuantities.isEmpty) {
        state = state.copyWith(
          errorMessage: 'يرجى اختيار صنف واحد على الأقل من المتجر للمتابعة.',
        );
        return;
      }
      if (state.pickupLandmark == state.dropoffLandmark) {
        state = state.copyWith(
          errorMessage: 'نقطة الانطلاق والوصول متطابقتان، اختر وجهة مختلفة.',
        );
        return;
      }
      state = state.copyWith(step: OrderFlowStep.reviewAndConfirm, clearError: true);
    }
  }

  void previousStep() {
    if (state.step == OrderFlowStep.reviewAndConfirm) {
      state = state.copyWith(step: OrderFlowStep.configureDetails, clearError: true);
    } else if (state.step == OrderFlowStep.configureDetails) {
      state = state.copyWith(step: OrderFlowStep.selectService, clearError: true);
    }
  }

  Future<String?> submitOrder({String? customerPhone}) async {
    state = state.copyWith(isSubmitting: true, clearError: true);

    final orderNumber = 'MSH-${DateTime.now().millisecondsSinceEpoch % 10000}';
    final isDelivery = state.serviceCategory == OrderFlowServiceCategory.delivery;

    final String summary = isDelivery
        ? state.selectedMerchant.items
            .where((item) => (state.itemQuantities[item.id] ?? 0) > 0)
            .map((item) => '${item.nameAr} × ${state.itemQuantities[item.id]}')
            .join(' + ')
        : (state.rideVehicleType == RideVehicleType.tuktuk
            ? 'رحلة توكتوك معتمد بالباجور'
            : 'رحلة سيارة ملاكي مكيفة');

    final newOrder = OrderModel(
      id: orderNumber,
      customerName: 'عميل مشوار',
      customerPhone: customerPhone ?? '01012345678',
      serviceType: isDelivery
          ? OrderServiceType.restaurantStore
          : OrderServiceType.passengerRestricted,
      status: OrderStatus.searchingCaptain,
      pickupAddress: state.pickupLandmark,
      dropoffAddress: state.dropoffLandmark,
      itemDescription: summary.isNotEmpty ? summary : 'طلب توصيل مشوار',
      estimatedFareEGP: state.totalFareEgp,
      distanceKm: state.estimatedDistanceKm,
      createdAt: DateTime.now(),
      notes: state.notes.trim().isEmpty ? null : state.notes.trim(),
    );

    _ref.read(ordersProvider.notifier).addOrder(newOrder);

    // Sync to Cloud Firestore if authenticated
    try {
      final user = FirebaseAuth.instance.currentUser;
      if (user != null) {
        final db = FirebaseFirestore.instance;
        if (isDelivery) {
          final docId = 'ord_${DateTime.now().millisecondsSinceEpoch}';
          await db.collection('orders').doc(docId).set({
            'id': docId,
            'orderNumber': orderNumber,
            'customerId': user.uid,
            'customerName': user.displayName ?? 'عميل مشوار',
            'serviceType': 'restaurant_store',
            'cityId': 'city_el_bagour',
            'storeNames': [state.selectedMerchant.nameAr],
            'pickupLandmark': state.pickupLandmark,
            'dropoffLandmark': state.dropoffLandmark,
            'itemsSummary': newOrder.itemDescription,
            'isRural': state.isRuralDestination,
            'scheduledFor': 'now',
            'hasVoiceNote': false,
            'voiceNoteDurationSec': 0,
            'voiceNoteTranscript': '',
            'distanceKm': state.estimatedDistanceKm,
            'subtotalPiasters': (state.merchantSubtotalEgp * 100).round(),
            'deliveryFeePiasters': (state.serviceFareEgp * 100).round(),
            'cashbackAppliedPiasters': 0,
            'totalFarePiasters': (state.totalFareEgp * 100).round(),
            'paymentMethod': state.paymentMethod,
            'status': 'created',
            'createdAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        } else {
          final docId = 'ride_${DateTime.now().millisecondsSinceEpoch}';
          await db.collection('rides').doc(docId).set({
            'id': docId,
            'rideNumber': orderNumber,
            'passengerId': user.uid,
            'passengerName': user.displayName ?? 'راكب مشوار',
            'vehicleTier':
                state.rideVehicleType == RideVehicleType.tuktuk ? 'tuktuk' : 'car',
            'cityId': 'city_el_bagour',
            'pickupLandmark': state.pickupLandmark,
            'dropoffLandmark': state.dropoffLandmark,
            'distanceKm': state.estimatedDistanceKm,
            'estimatedFarePiasters': (state.totalFareEgp * 100).round(),
            'cashbackAppliedPiasters': 0,
            'paymentMethod': state.paymentMethod,
            'status': 'searching_driver',
            'safetySosTriggered': false,
            'createdAt': FieldValue.serverTimestamp(),
            'updatedAt': FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (_) {
      // Keeps local Riverpod order flowing even if offline
    }

    state = const OrderFlowState();
    return orderNumber;
  }
}

final orderFlowProvider =
    StateNotifierProvider<OrderFlowNotifier, OrderFlowState>((ref) {
  return OrderFlowNotifier(ref);
});
