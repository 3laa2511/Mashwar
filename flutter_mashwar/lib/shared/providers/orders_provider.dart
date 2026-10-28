import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/order_model.dart';
import '../services/mock_data_repository.dart';
import '../services/order_repository_interface.dart';
import '../services/http_order_repository.dart';

/// Provider for the Order Repository instance (defaults to HTTP repository with mock fallback)
final orderRepositoryProvider = Provider<IOrderRepository>((ref) {
  return HttpOrderRepository();
});

class OrdersNotifier extends StateNotifier<List<OrderModel>> {
  final IOrderRepository? _repository;

  OrdersNotifier([this._repository]) : super(MockDataRepository.getInitialMockOrders());

  /// Adds a newly created order from the booking flow
  void addOrder(OrderModel newOrder) {
    state = [newOrder, ...state];
  }

  /// Advances an order's status through the simulated delivery lifecycle
  void advanceOrderStatus(String orderId) {
    state = [
      for (final order in state)
        if (order.id == orderId) _getNextOrderState(order) else order
    ];
  }

  /// Cancels an order
  void cancelOrder(String orderId) {
    state = [
      for (final order in state)
        if (order.id == orderId)
          order.copyWith(status: OrderStatus.cancelled)
        else
          order
    ];
  }

  OrderModel _getNextOrderState(OrderModel order) {
    switch (order.status) {
      case OrderStatus.created:
        return order.copyWith(
          status: OrderStatus.searchingCaptain,
          notes: 'جاري البحث عن أقرب كابتن في محيط الباجور',
        );
      case OrderStatus.searchingCaptain:
        return order.copyWith(
          status: OrderStatus.captainAssigned,
          captainName: 'كابتن طارق الغريب',
          captainPhone: '01198765432',
          captainVehicle: 'دراجة هوجان سوداء (٤٣٢١ م ن)',
          acceptedAt: order.acceptedAt ?? DateTime.now(),
          notes: 'تم قبول المشوار من الكابتن',
        );
      case OrderStatus.captainAssigned:
        return order.copyWith(
          status: OrderStatus.atPickup,
          notes: 'الكابتن وصل لمكان الاستلام',
        );
      case OrderStatus.atPickup:
        return order.copyWith(
          status: OrderStatus.inTransit,
          notes: 'تم استلام الشحنة والكابتن في الطريق للتسليم',
        );
      case OrderStatus.inTransit:
        return order.copyWith(
          status: OrderStatus.delivered,
          notes: 'تم تسليم الطلب وتحصيل المبلغ بالكامل',
        );
      case OrderStatus.delivered:
      case OrderStatus.cancelled:
        return order;
    }
  }
}

/// Global Riverpod Provider for Orders state
final ordersProvider = StateNotifierProvider<OrdersNotifier, List<OrderModel>>((ref) {
  return OrdersNotifier();
});

/// Selector for a single order by ID
final singleOrderProvider = Provider.family<OrderModel?, String>((ref, orderId) {
  final orders = ref.watch(ordersProvider);
  try {
    return orders.firstWhere((o) => o.id == orderId);
  } catch (_) {
    return null;
  }
});
