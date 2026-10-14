import 'package:flutter_test/flutter_test.dart';
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
      expect(notifier.state.first.id, 'TEST-101');
      expect(notifier.state.first.status, OrderStatus.created);

      // 1. Advance to searchingCaptain
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.searchingCaptain);

      // 2. Advance to captainAssigned
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.captainAssigned);
      expect(notifier.state.first.captainName, isNotNull);

      // 3. Advance to atPickup
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.atPickup);

      // 4. Advance to inTransit
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.inTransit);

      // 5. Advance to delivered
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.delivered);

      // 6. Delivered is terminal: does not change on further advance
      notifier.advanceOrderStatus('TEST-101');
      expect(notifier.state.first.status, OrderStatus.delivered);
    });

    test('Cancels an order correctly', () {
      final notifier = OrdersNotifier();
      final orderId = notifier.state.first.id;
      notifier.cancelOrder(orderId);
      final cancelled = notifier.state.firstWhere((o) => o.id == orderId);
      expect(cancelled.status, OrderStatus.cancelled);
    });
  });
}
