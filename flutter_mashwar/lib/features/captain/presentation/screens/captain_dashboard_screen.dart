import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';
import '../../../../shared/providers/role_provider.dart';

class CaptainDashboardScreen extends ConsumerStatefulWidget {
  const CaptainDashboardScreen({super.key});

  @override
  ConsumerState<CaptainDashboardScreen> createState() => _CaptainDashboardScreenState();
}

class _CaptainDashboardScreenState extends ConsumerState<CaptainDashboardScreen> {
  bool _isOnline = true;
  bool _showRadarAlert = true;

  final double _todayEarnings = 240.0;
  final int _completedTrips = 9;
  final double _cashCollected = 180.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final orders = ref.watch(ordersProvider);
    // Find an active order assigned or in progress
    final activeOrder = orders.firstWhere(
      (o) => o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled,
      orElse: () => orders.first,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('كابتن مشوار - الباجور', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Switch(
            value: _isOnline,
            activeColor: AppColors.secondary,
            onChanged: (val) {
              setState(() => _isOnline = val);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(val ? 'أنت الآن متصل وتستقبل طلبات جديدة' : 'أنت الآن في وضع الاستراحة (غير متصل)'),
                  backgroundColor: val ? AppColors.secondary : AppColors.slate700,
                  duration: const Duration(seconds: 2),
                ),
              );
            },
          ),
          PopupMenuButton<AppRole>(
            tooltip: 'تبديل الدور للتجربة',
            icon: const Icon(Icons.swap_horiz_rounded),
            onSelected: (role) {
              ref.read(roleProvider.notifier).switchRole(role);
              switch (role) {
                case AppRole.customer:
                  context.go('/customer');
                  break;
                case AppRole.captain:
                  context.go('/captain');
                  break;
                case AppRole.merchant:
                  context.go('/merchant');
                  break;
                case AppRole.operations:
                  context.go('/operations');
                  break;
              }
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: AppRole.customer, child: Text('تطبيق العميل')),
              PopupMenuItem(value: AppRole.captain, child: Text('تطبيق الكابتن')),
              PopupMenuItem(value: AppRole.merchant, child: Text('متجر التاجر')),
              PopupMenuItem(value: AppRole.operations, child: Text('غرفة العمليات')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status banner
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: _isOnline ? AppColors.secondary.withOpacity(0.12) : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isOnline ? AppColors.secondary : Colors.grey.shade400,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isOnline ? Icons.radar_rounded : Icons.pause_circle_outline_rounded,
                    color: _isOnline ? AppColors.secondaryDark : Colors.grey.shade700,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isOnline ? 'حالة الكابتن: نشط ومتاح للطلبات' : 'حالة الكابتن: غير متصل',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _isOnline ? AppColors.secondaryDark : Colors.grey.shade800,
                          ),
                        ),
                        Text(
                          _isOnline ? 'الرادار يبحث عن طلبات في نطاق الباجور والقرى' : 'قم بتفعيل المفتاح لبدء استقبال المشاوير',
                          style: const TextStyle(fontSize: 12, color: AppColors.slate500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),
            // Today Earnings summary (clearly marked as demo)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ملخص دخل اليوم (أرقام استرشادية)', style: TextStyle(fontWeight: FontWeight.bold)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(6)),
                          child: const Text('تجريبي', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildMetricCol('أرباح اليوم', '$_todayEarnings ج.م', AppColors.primaryDark),
                        _buildMetricCol('المشاوير', '$_completedTrips رحلات', AppColors.secondaryDark),
                        _buildMetricCol('كاش محصل', '$_cashCollected ج.م', AppColors.slate800),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Incoming radar request simulation
            if (_isOnline && _showRadarAlert) ...[
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary, width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.sensors, color: AppColors.primaryDark),
                            SizedBox(width: 6),
                            Text('طلب رادار جديد قريب منك!', style: TextStyle(fontWeight: FontWeight.bold)),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.secondary,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text('28.00 ج.م', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text('الاستلام: مجلس مدينة الباجور ➔ التسليم: قرية كفر الباجور (3.2 كم)', style: TextStyle(fontSize: 12)),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.white),
                            onPressed: () {
                              setState(() => _showRadarAlert = false);
                              ref.read(ordersProvider.notifier).advanceOrderStatus(activeOrder.id);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('تم قبول المشوار بنجاح!'), backgroundColor: AppColors.secondary),
                              );
                            },
                            child: const Text('قبول المشوار'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => setState(() => _showRadarAlert = false),
                          child: const Text('تجاهل'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            Text(
              'المشوار الجاري حالياً',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Card(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: AppColors.primary, width: 1.5),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text('طلب #${activeOrder.id}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        ),
                        Text(
                          'أجرة التوصيل: ${activeOrder.estimatedFareEGP} ج.م',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondaryDark),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.trip_origin_rounded, size: 18, color: AppColors.secondary),
                        const SizedBox(width: 8),
                        Expanded(child: Text('الاستلام: ${activeOrder.pickupAddress}', style: const TextStyle(fontWeight: FontWeight.w600))),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.location_on_rounded, size: 18, color: AppColors.error),
                        const SizedBox(width: 8),
                        Expanded(child: Text('التسليم: ${activeOrder.dropoffAddress}', style: const TextStyle(fontWeight: FontWeight.w600))),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('محاكاة اتصال بالعميل: ${activeOrder.customerPhone}')),
                              );
                            },
                            icon: const Icon(Icons.phone_rounded, size: 18),
                            label: const Text('اتصال بالعميل'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: activeOrder.status == OrderStatus.delivered
                                ? null
                                : () {
                                    ref.read(ordersProvider.notifier).advanceOrderStatus(activeOrder.id);
                                  },
                            child: Text(
                              _getCaptainActionLabel(activeOrder.status),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _getCaptainActionLabel(OrderStatus status) {
    switch (status) {
      case OrderStatus.created:
      case OrderStatus.searchingCaptain:
        return 'قبول المشوار';
      case OrderStatus.captainAssigned:
        return 'وصلت لمكان الاستلام';
      case OrderStatus.atPickup:
        return 'تم استلام الشحنة';
      case OrderStatus.inTransit:
        return 'تم التسليم وتحصيل المبلغ';
      case OrderStatus.delivered:
        return 'المشوار مكتمل ✓';
      case OrderStatus.cancelled:
        return 'ملغي';
    }
  }

  Widget _buildMetricCol(String label, String value, Color color) {
    return Column(
      children: [
        Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
      ],
    );
  }
}
