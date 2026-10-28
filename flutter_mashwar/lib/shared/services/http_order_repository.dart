import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/order_model.dart';
import '../models/fare_quote_model.dart';
import 'order_repository_interface.dart';

/// Production HTTP Implementation of IOrderRepository.
/// Communicates with the authoritative Mashwar backend service.
class HttpOrderRepository implements IOrderRepository {
  final String baseUrl;
  final http.Client client;
  final String? Function()? authTokenProvider;

  HttpOrderRepository({
    this.baseUrl = 'https://api.mashwar.app/api/v1',
    http.Client? client,
    this.authTokenProvider,
  }) : client = client ?? http.Client();

  Map<String, String> _buildHeaders({Map<String, String>? extra}) {
    final headers = <String, String>{
      'Accept': 'application/json',
      if (extra != null) ...extra,
    };
    final token = authTokenProvider?.call();
    if (token != null && token.trim().isNotEmpty) {
      headers['Authorization'] = 'Bearer ${token.trim()}';
    }
    return headers;
  }

  @override
  Future<List<OrderModel>> getOrders() async {
    final response = await client.get(
      Uri.parse('$baseUrl/orders'),
      headers: _buildHeaders(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final dataNode = decoded['data'];
      final List data = dataNode is Map ? (dataNode['orders'] ?? []) : (dataNode ?? []);
      return data.map((json) => _orderFromJson(json)).toList();
    } else {
      throw Exception('فشل جلب قائمة الطلبات من الخادم (${response.statusCode})');
    }
  }

  @override
  Future<OrderModel?> getOrderById(String orderId) async {
    final response = await client.get(
      Uri.parse('$baseUrl/orders/$orderId'),
      headers: _buildHeaders(),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      return _orderFromJson(decoded['data']);
    } else if (response.statusCode == 404) {
      return null;
    } else {
      throw Exception('فشل جلب بيانات الطلب من الخادم (${response.statusCode})');
    }
  }

  @override
  Future<OrderModel> createOrder(
    OrderModel newOrder, {
    String? quoteId,
    String? quoteSignature,
  }) async {
    final idempotencyKey = 'idemp_${DateTime.now().millisecondsSinceEpoch}_${newOrder.id}';
    final payload = {
      'serviceTypeId': _serviceTypeToBackend(newOrder.serviceType),
      'quoteId': quoteId ?? 'quote_default',
      'quoteSignature': quoteSignature,
      'itemDescription': newOrder.itemDescription,
      'specialInstructions': newOrder.notes,
      'totalFarePiasters': (newOrder.estimatedFareEGP * 100).round(),
      'pickup': {
        'landmarkName': newOrder.pickupAddress,
        'detailedAddress': newOrder.pickupAddress,
        'contactPhone': newOrder.customerPhone,
      },
      'dropoff': {
        'landmarkName': newOrder.dropoffAddress,
        'detailedAddress': newOrder.dropoffAddress,
        'contactPhone': newOrder.customerPhone,
      },
      'customerName': newOrder.customerName,
      'customerPhone': newOrder.customerPhone,
      'paymentMethod': 'cash_on_delivery',
    };

    final response = await client.post(
      Uri.parse('$baseUrl/orders'),
      headers: _buildHeaders(extra: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      }),
      body: jsonEncode(payload),
    );

    if (response.statusCode == 201 || response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      return _orderFromJson(decoded['data']);
    } else {
      final decoded = jsonDecode(response.body);
      final errMsg = decoded['error']?['message'] ?? 'فشل إنشاء الطلب';
      throw Exception(errMsg);
    }
  }

  @override
  Future<OrderModel> updateOrderStatus(
    String orderId,
    OrderStatus targetStatus, {
    String? actorRole,
    String? notes,
    int? cashCollectedPiasters,
  }) async {
    final payload = {
      'targetStatus': _statusToBackend(targetStatus),
      if (notes != null) 'notes': notes,
      if (cashCollectedPiasters != null) 'cashCollectedPiasters': cashCollectedPiasters,
    };

    final response = await client.post(
      Uri.parse('$baseUrl/orders/$orderId/transitions'),
      headers: _buildHeaders(extra: {
        'Content-Type': 'application/json',
      }),
      body: jsonEncode(payload),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      return _orderFromJson(decoded['data']['order']);
    } else {
      final decoded = jsonDecode(response.body);
      final errMsg = decoded['error']?['message'] ?? 'فشل تحديث حالة الطلب';
      throw Exception(errMsg);
    }
  }

  @override
  Future<OrderModel> cancelOrder(String orderId, {String? cancellationReason}) async {
    final response = await client.post(
      Uri.parse('$baseUrl/orders/$orderId/cancel'),
      headers: _buildHeaders(extra: {
        'Content-Type': 'application/json',
      }),
      body: jsonEncode({
        'reason': cancellationReason ?? 'إلغاء من قبل المستخدم',
      }),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      return _orderFromJson(decoded['data']['order']);
    } else {
      throw Exception('فشل إلغاء الطلب');
    }
  }

  @override
  Future<FareQuoteModel> getFareQuote({
    required double distanceKm,
    bool isRuralOrVillage = false,
  }) async {
    final response = await client.post(
      Uri.parse('$baseUrl/quotes'),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: jsonEncode({
        'serviceTypeId': 'package',
        'distanceKm': distanceKm,
        'isRuralOrVillage': isRuralOrVillage,
      }),
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final data = decoded['data'];
      return FareQuoteModel(
        baseFare: (data['baseFarePiasters'] as num) / 100.0,
        distanceKm: (data['distanceKm'] as num).toDouble(),
        distanceFare: (data['distanceFarePiasters'] as num) / 100.0,
        ruralOrUnpavedSurcharge: (data['ruralSurchargePiasters'] as num) / 100.0,
        platformFee: (data['platformFeePiasters'] as num) / 100.0,
        totalFare: (data['totalFarePiasters'] as num) / 100.0,
        estimatedDurationMinutes: data['estimatedDurationMinutes'] ?? '15-20',
        currency: 'ج.م',
      );
    } else {
      throw Exception('فشل حساب التسعيرة من الخادم');
    }
  }

  OrderModel _orderFromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id'] ?? json['orderNumber'] ?? 'MSH-0000',
      customerName: json['customerName'] ?? 'عميل مشوار',
      customerPhone: json['customerPhone'] ?? '',
      serviceType: _serviceTypeFromBackend(json['serviceTypeId']),
      status: _statusFromBackend(json['status']),
      pickupAddress: json['pickup']?['landmarkName'] ?? json['pickupAddress'] ?? '',
      dropoffAddress: json['dropoff']?['landmarkName'] ?? json['dropoffAddress'] ?? '',
      itemDescription: json['itemDescription'] ?? '',
      estimatedFareEGP: ((json['totalFarePiasters'] as num?) ?? 2500) / 100.0,
      distanceKm: (json['distanceKm'] as num?)?.toDouble() ?? 2.5,
      captainName: json['captainName'],
      captainPhone: json['captainPhone'],
      captainVehicle: json['captainVehicle'],
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt']) ?? DateTime.now()
          : DateTime.now(),
      acceptedAt: json['acceptedAt'] != null
          ? DateTime.tryParse(json['acceptedAt'])
          : null,
      notes: json['specialInstructions'] ?? json['notes'],
    );
  }

  String _serviceTypeToBackend(OrderServiceType type) {
    switch (type) {
      case OrderServiceType.restaurantStore:
        return 'restaurant_store';
      case OrderServiceType.errand:
        return 'errand';
      case OrderServiceType.passengerRestricted:
        return 'passenger';
      case OrderServiceType.package:
        return 'package';
    }
  }

  OrderServiceType _serviceTypeFromBackend(String? type) {
    switch (type) {
      case 'restaurant_store':
        return OrderServiceType.restaurantStore;
      case 'errand':
        return OrderServiceType.errand;
      case 'passenger':
        return OrderServiceType.passengerRestricted;
      case 'package':
        return OrderServiceType.package;
      default:
        return OrderServiceType.package;
    }
  }

  String _statusToBackend(OrderStatus status) {
    switch (status) {
      case OrderStatus.searchingCaptain:
        return 'searching_captain';
      case OrderStatus.captainAssigned:
        return 'captain_assigned';
      case OrderStatus.atPickup:
        return 'at_pickup';
      case OrderStatus.inTransit:
        return 'in_transit';
      case OrderStatus.delivered:
        return 'delivered';
      case OrderStatus.cancelled:
        return 'cancelled';
      case OrderStatus.created:
      default:
        return 'created';
    }
  }

  OrderStatus _statusFromBackend(String? status) {
    switch (status) {
      case 'searching_captain':
        return OrderStatus.searchingCaptain;
      case 'captain_assigned':
        return OrderStatus.captainAssigned;
      case 'at_pickup':
        return OrderStatus.atPickup;
      case 'in_transit':
        return OrderStatus.inTransit;
      case 'delivered':
        return OrderStatus.delivered;
      case 'cancelled':
        return OrderStatus.cancelled;
      case 'created':
      default:
        return OrderStatus.created;
    }
  }
}
