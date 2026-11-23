import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';

class OrderHistoryScreen extends ConsumerWidget {
  const OrderHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(ordersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('سجل طلبات مشوار', style: TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customer'),
        ),
      ),
      body: orders.isEmpty
          ? const Center(
              child: Text('لا توجد طلبات سابقة حتى الآن'),
            )
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final order = orders[index];
                final isDelivered = order.status == OrderStatus.delivered;

                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.go('/customer/order/${order.id}'),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: isDelivered
                                          ? AppColors.secondary.withValues(alpha: 0.12)
                                          : AppColors.primary.withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      isDelivered ? Icons.check_circle_outline : Icons.local_shipping_outlined,
                                      color: isDelivered ? AppColors.secondary : AppColors.primaryDark,
                                      size: 18,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Text(
                                    'طلب #${order.id}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: isDelivered
                                      ? AppColors.secondary.withValues(alpha: 0.15)
                                      : AppColors.primary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '${order.estimatedFareEGP} ج.م',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                    color: isDelivered ? AppColors.secondaryDark : AppColors.primaryDark,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Text(
                            order.itemDescription,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'من: ${order.pickupAddress} ➔ إلى: ${order.dropoffAddress}',
                            style: const TextStyle(fontSize: 11, color: AppColors.slate500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Divider(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _getStatusText(order.status),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: isDelivered ? AppColors.secondary : AppColors.primaryDark,
                                ),
                              ),
                              const Row(
                                children: [
                                  Text('عرض التتبع', style: TextStyle(fontSize: 11, color: AppColors.slate600)),
                                  SizedBox(width: 4),
                                  Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.slate400),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }

  String _getStatusText(OrderStatus status) {
    switch (status) {
      case OrderStatus.created:
        return 'قيد الإنشاء';
      case OrderStatus.searchingCaptain:
        return 'جاري البحث عن كابتن';
      case OrderStatus.captainAssigned:
        return 'تم إسناد الكابتن';
      case OrderStatus.atPickup:
        return 'وصل للاستلام';
      case OrderStatus.inTransit:
        return 'في الطريق للتسليم';
      case OrderStatus.delivered:
        return 'مكتمل ومسلّم ✓';
      case OrderStatus.cancelled:
        return 'ملغي';
    }
  }
}
