import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../app/theme/app_colors.dart';
import '../../../shared/providers/role_provider.dart';

class OperationsDashboardScreen extends ConsumerWidget {
  const OperationsDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('غرفة عمليات مشوار - الباجور', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
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
            // Regulatory Compliance Banner — Read-only policy lock
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.amber.shade400, width: 1.5),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.lock_rounded, color: Colors.amber, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'نظام الامتثال القانوني والترخيص (محافظة المنوفية)',
                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'خدمة نقل الركاب مقفلة برمجياً بحكم السياسة التنظيمية لحين اعتماد التراخيص الرسمية من إدارة المرور ومجلس مدينة الباجور.',
                          style: TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                        const SizedBox(height: 10),
                        // Read-only indicator (Non-casually removable)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.shield_rounded, color: AppColors.error, size: 16),
                              SizedBox(width: 6),
                              Text(
                                'حالة قفل الركاب: مقفل نظامياً (Read-Only Policy Lock)',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate800),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),
            // Operations Live KPIs (Clearly identified as demo)
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('مؤشرات الأداء التجريبية (Sample Metrics)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: AppColors.slate200, borderRadius: BorderRadius.circular(6)),
                  child: const Text('بيانات توضيحية', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            const SizedBox(height: 8),

            Row(
              children: [
                Expanded(child: _buildMetricTile('الطلبات الجارية', '14', AppColors.primaryDark, Icons.local_shipping)),
                const SizedBox(width: 12),
                Expanded(child: _buildMetricTile('الكباتن النشطين', '28', AppColors.secondaryDark, Icons.two_wheeler)),
                const SizedBox(width: 12),
                Expanded(child: _buildMetricTile('المتاجر المفتوحة', '19', Colors.indigo, Icons.storefront)),
              ],
            ),

            const SizedBox(height: 20),
            const Text('سجل الحركة التجريبي المباشر (Audit Log)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 10),

            _buildLogItem('19:42', '[محاكاة] تم تسليم طرد #MSH-8099 بقرية كفر الباجور بنجاح'),
            _buildLogItem('19:38', '[محاكاة] كابتن طارق الغريب في طريقه لاستلام وجبة من مطعم فطاير الباجور'),
            _buildLogItem('19:31', '[محاكاة] طلب جديد #MSH-8104 بمجلس مدينة الباجور - جاري إسناد كابتن'),
            _buildLogItem('19:25', '[محاكاة] تسجيل كابتن جديد "أحمد إبراهيم" - في انتظار فحص رخصة القيادة'),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.slate500), textAlign: TextAlign.center),
        ],
      ),
    );
  }

  Widget _buildLogItem(String time, String message) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.slate100,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(time, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.slate700)),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: const TextStyle(fontSize: 12, color: AppColors.slate800))),
        ],
      ),
    );
  }
}
