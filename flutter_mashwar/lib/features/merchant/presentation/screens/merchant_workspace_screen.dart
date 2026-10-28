import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/providers/role_provider.dart';

class MerchantWorkspaceScreen extends ConsumerStatefulWidget {
  const MerchantWorkspaceScreen({super.key});

  @override
  ConsumerState<MerchantWorkspaceScreen> createState() => _MerchantWorkspaceScreenState();
}

class _MerchantWorkspaceScreenState extends ConsumerState<MerchantWorkspaceScreen> {
  bool _isStoreOpen = true;

  final List<Map<String, dynamic>> _merchantOrders = [
    {
      'id': 'ORD-9341',
      'customer': 'أحمد سعيد',
      'items': '٢ فطير بالسجق والجبن الكيري + ١ لتر بيبسي',
      'total': '145.00 ج.م',
      'status': 'preparing', // preparing, ready
      'time': 'منذ 8 دقائق',
      'captain': 'كابتن محمود السيد (في الطريق للمتجر)',
    },
    {
      'id': 'ORD-9340',
      'customer': 'مروة عبد الرحمن',
      'items': '١ حواوشي مخصوص + ٢ بطاطس محمرة',
      'total': '85.00 ج.م',
      'status': 'ready',
      'time': 'منذ 22 دقيقة',
      'captain': 'كابتن طارق الغريب (وصل للمتجر)',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('متجر فطاير ومشاوي الباجور', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          Switch(
            value: _isStoreOpen,
            activeThumbColor: AppColors.secondary,
            onChanged: (val) {
              setState(() => _isStoreOpen = val);
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
            // Store Status Banner
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _isStoreOpen ? AppColors.secondary.withValues(alpha: 0.1) : Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _isStoreOpen ? AppColors.secondary : Colors.red.shade300,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    _isStoreOpen ? Icons.storefront_rounded : Icons.store_mall_directory_outlined,
                    color: _isStoreOpen ? AppColors.secondaryDark : Colors.red.shade700,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _isStoreOpen ? 'المتجر مفتوح ويستقبل طلبات العملاء' : 'المتجر مغلق حالياً',
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: _isStoreOpen ? AppColors.secondaryDark : Colors.red.shade900,
                          ),
                        ),
                        Text(
                          _isStoreOpen ? 'متوسط سرعة التجهيز الحالية: 15 دقيقة (بيانات تجريبية)' : 'لن يتم استقبال طلبات جديدة على مشوار',
                          style: const TextStyle(fontSize: 12, color: AppColors.slate500),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('الطلبات الجارية بالمطبخ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text('${_merchantOrders.length} طلبات تجريبية', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 12),

            ..._merchantOrders.map((order) {
              final isReady = order['status'] == 'ready';
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('طلب #${order['id']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text(order['total'], style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondaryDark)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text('العميل: ${order['customer']} (${order['time']})', style: const TextStyle(fontSize: 12, color: AppColors.slate500)),
                      const Divider(height: 16),
                      Text(order['items'], style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          const Icon(Icons.two_wheeler_rounded, size: 16, color: AppColors.primaryDark),
                          const SizedBox(width: 6),
                          Expanded(child: Text(order['captain'], style: const TextStyle(fontSize: 12, color: AppColors.slate600))),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isReady ? AppColors.secondary : AppColors.primary,
                                foregroundColor: isReady ? Colors.white : AppColors.slate950,
                              ),
                              onPressed: () {
                                setState(() {
                                  order['status'] = isReady ? 'preparing' : 'ready';
                                });
                              },
                              child: Text(isReady ? 'جاهز وتم إشعار الكابتن للاستلام ✓' : 'تأكيد اكتمال التجهيز وإشعار الكابتن'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }
}
