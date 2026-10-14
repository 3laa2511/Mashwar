import 'package:flutter/material.dart';
import '../../../app/theme/app_colors.dart';

class OperationsDashboardScreen extends StatefulWidget {
  const OperationsDashboardScreen({super.key});

  @override
  State<OperationsDashboardScreen> createState() => _OperationsDashboardScreenState();
}

class _OperationsDashboardScreenState extends State<OperationsDashboardScreen> {
  bool _passengerRideLock = true; // Strict regulatory lock

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('غرفة عمليات مشوار - الباجور', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Regulatory Compliance Banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.amber.shade400),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.gavel_rounded, color: Colors.amber, size: 24),
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
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            const Text('قفل نقل الركاب النشط:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            const SizedBox(width: 8),
                            Switch(
                              value: _passengerRideLock,
                              activeColor: AppColors.secondary,
                              onChanged: (val) {
                                // Prevent unlocking without admin authorization
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('تنبيه: يتطلب فتح خدمة الركاب موافقة الشؤون القانونية وسجل تجاري معتمد'),
                                    backgroundColor: AppColors.error,
                                  ),
                                );
                              },
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),
            // Operations Live KPIs
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
            const Text('سجل الحركة الميدانية المباشر', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),

            _buildLogItem('19:42', 'تم تسليم طرد #MSH-8099 بقرية كفر الباجور بنجاح (كابتن تامر فتحي)'),
            _buildLogItem('19:38', 'كابتن طارق الغريب في طريقه لاستلام وجبة من مطعم فطاير الباجور'),
            _buildLogItem('19:31', 'طلب جديد #MSH-8104 بمجلس مدينة الباجور - جاري إسناد كابتن'),
            _buildLogItem('19:25', 'تسجيل كابتن جديد "أحمد إبراهيم" - في انتظار فحص رخصة القيادة والفيش الجنائي'),
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
