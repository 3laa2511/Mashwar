import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';

class OrderTrackingScreen extends ConsumerWidget {
  final String orderId;

  const OrderTrackingScreen({super.key, required this.orderId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(singleOrderProvider(orderId));

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('تتبع المشوار')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.search_off_rounded, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text('لم يتم العثور على الطلب رقم $orderId'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.go('/customer'),
                child: const Text('العودة للرئيسية'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('تتبع المشوار #${order.id}', style: const TextStyle(fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/customer'),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Notice Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.primaryDark, size: 20),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'بيانات المحاكاة التجريبية: لا يتم إسناد كابتن فعلي أو تتبع GPS حي حتى يتم ربط الخادم ومزود الخرائط المعتمد.',
                      style: TextStyle(fontSize: 11, color: AppColors.slate700),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Simulated Map/Route Card
            Container(
              height: 140,
              decoration: BoxDecoration(
                color: AppColors.slate900,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Positioned.fill(
                    child: Opacity(
                      opacity: 0.15,
                      child: GridView.builder(
                        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 8),
                        itemBuilder: (ctx, i) => Container(
                          decoration: BoxDecoration(border: Border.all(color: Colors.white, width: 0.5)),
                        ),
                      ),
                    ),
                  ),
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.two_wheeler, color: AppColors.slate950, size: 28),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _getStatusLabel(order.status),
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'خط السير: ${order.pickupAddress} ➔ ${order.dropoffAddress}',
                        style: const TextStyle(color: AppColors.slate400, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Stepper timeline
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('مراحل التوصيل (Simulated Lifecycle)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const SizedBox(height: 16),
                    _buildTimelineStep('تم إنشاء الطلب', true, 'تم تسجيل الطلب وحساب الأجرة'),
                    _buildTimelineStep(
                      'جاري البحث عن كابتن بالباجور',
                      order.status != OrderStatus.created,
                      'البحث في نطاق ٥ كم في مدينة الباجور',
                    ),
                    _buildTimelineStep(
                      'تم إسناد الكابتن وقبول المشوار',
                      order.status == OrderStatus.captainAssigned ||
                          order.status == OrderStatus.atPickup ||
                          order.status == OrderStatus.inTransit ||
                          order.status == OrderStatus.delivered,
                      order.captainName != null ? '${order.captainName} (${order.captainVehicle})' : 'في انتظار القبول',
                    ),
                    _buildTimelineStep(
                      'الكابتن وصل للاستلام',
                      order.status == OrderStatus.atPickup ||
                          order.status == OrderStatus.inTransit ||
                          order.status == OrderStatus.delivered,
                      order.pickupAddress,
                    ),
                    _buildTimelineStep(
                      'في الطريق للتسليم',
                      order.status == OrderStatus.inTransit || order.status == OrderStatus.delivered,
                      order.dropoffAddress,
                    ),
                    _buildTimelineStep(
                      'تم التسليم بنجاح',
                      order.status == OrderStatus.delivered,
                      'تم تحصيل الأجرة: ${order.estimatedFareEGP} ج.م كاش',
                      isLast: true,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Order details summary
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('تفاصيل الشحنة', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    const Divider(height: 16),
                    _buildInfoRow('محتوى الطلب:', order.itemDescription),
                    _buildInfoRow('قيمة التوصيل:', '${order.estimatedFareEGP} ج.م'),
                    _buildInfoRow('المسافة التقديرية:', '${order.distanceKm} كم'),
                    _buildInfoRow('رقم هاتف العميل:', order.customerPhone),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Demo step advance button
            ElevatedButton.icon(
              onPressed: order.status == OrderStatus.delivered
                  ? null
                  : () {
                      ref.read(ordersProvider.notifier).advanceOrderStatus(order.id);
                    },
              icon: const Icon(Icons.fast_forward_rounded),
              label: Text(
                order.status == OrderStatus.delivered
                    ? 'اكتمل المشوار بالكامل ✓'
                    : 'محاكاة: تقديم حالة المشوار للمرحلة التالية',
              ),
            ),
            const SizedBox(height: 10),

            OutlinedButton(
              onPressed: () => context.go('/customer/history'),
              child: const Text('عرض سجل جميع الطلبات'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineStep(String title, bool isDone, String sub, {bool isLast = false}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: isDone ? AppColors.secondary : Colors.grey.shade300,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isDone ? Icons.check : Icons.circle,
                size: 14,
                color: Colors.white,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 32,
                color: isDone ? AppColors.secondary : Colors.grey.shade300,
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: TextStyle(fontWeight: isDone ? FontWeight.bold : FontWeight.normal, fontSize: 13)),
              Text(sub, style: TextStyle(fontSize: 11, color: isDone ? AppColors.slate600 : Colors.grey.shade400)),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  String _getStatusLabel(OrderStatus status) {
    switch (status) {
      case OrderStatus.created:
        return 'قيد الإنشاء';
      case OrderStatus.searchingCaptain:
        return 'جاري البحث عن كابتن بالباجور...';
      case OrderStatus.captainAssigned:
        return 'تم قبول المشوار من الكابتن';
      case OrderStatus.atPickup:
        return 'الكابتن وصل لنقطة الاستلام';
      case OrderStatus.inTransit:
        return 'الكابتن في الطريق للتسليم';
      case OrderStatus.delivered:
        return 'تم التوصيل بنجاح وتسليم الشحنة';
      case OrderStatus.cancelled:
        return 'تم إلغاء الطلب';
    }
  }
}
