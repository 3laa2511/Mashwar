import '../models/order_model.dart';
import '../models/fare_quote_model.dart';

/// Abstract contract for order data operations.
/// Decouples the Flutter UI layer from concrete data sources (Mock vs HTTP backend).
abstract class IOrderRepository {
  /// Fetches all active and historic orders for the authenticated user.
  Future<List<OrderModel>> getOrders();

  /// Fetches a specific order by its unique identifier.
  Future<OrderModel?> getOrderById(String orderId);

  /// Submits and persists a new order.
  Future<OrderModel> createOrder(
    OrderModel newOrder, {
    String? quoteId,
    String? quoteSignature,
  });

  /// Authoritatively transitions an order status in accordance with backend FSM rules.
  Future<OrderModel> updateOrderStatus(
    String orderId,
    OrderStatus targetStatus, {
    String? actorRole,
    String? notes,
    int? cashCollectedPiasters,
  });

  /// Cancels an order with documented reason.
  Future<OrderModel> cancelOrder(
    String orderId, {
    String? cancellationReason,
  });

  /// Requests an authoritative fare quote from the pricing engine.
  Future<FareQuoteModel> getFareQuote({
    required double distanceKm,
    bool isRuralOrVillage = false,
  });
}
