import 'package:flutter/material.dart';
import '../../../app/localization/app_strings.dart';
import '../../../app/theme/app_colors.dart';

class CaptainDashboardScreen extends StatefulWidget {
  const CaptainDashboardScreen({super.key});

  @override
  State<CaptainDashboardScreen> createState() => _CaptainDashboardScreenState();
}

class _CaptainDashboardScreenState extends State<CaptainDashboardScreen> {
  bool _isOnline = true;
  bool _hasActiveOrder = true;
  int _deliveryStep = 1; // 0: accepted, 1: at pickup, 2: in transit, 3: delivered

  final double _todayEarnings = 240.0;
  final int _completedTrips = 9;
  final double _cashCollected = 180.0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

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
            // Today Earnings summary
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('ملخص دخل اليوم', style: TextStyle(fontWeight: FontWeight.bold)),
                        Text('13 أكتوبر', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
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
            if (_hasActiveOrder) ...[
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
                            child: const Text('طلب #MSH-8102', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                          const Text('أجرة التوصيل: 22.00 ج.م', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondaryDark)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: const [
                          Icon(Icons.trip_origin_rounded, size: 18, color: AppColors.secondary),
                          SizedBox(width: 8),
                          Expanded(child: Text('الاستلام: ميدان المحطة - وسط الباجور', style: TextStyle(fontWeight: FontWeight.w600))),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: const [
                          Icon(Icons.location_on_rounded, size: 18, color: AppColors.error),
                          SizedBox(width: 8),
                          Expanded(child: Text('التسليم: مستشفى الباجور العام (الدور الثاني)', style: TextStyle(fontWeight: FontWeight.w600))),
                        ],
                      ),
                      const Divider(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.phone_rounded, size: 18),
                              label: const Text('اتصال بالعميل'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              onPressed: () {
                                setState(() {
                                  if (_deliveryStep < 3) {
                                    _deliveryStep++;
                                  } else {
                                    _hasActiveOrder = false;
                                  }
                                });
                              },
                              child: Text(
                                _deliveryStep == 0
                                    ? 'وصلت لمكان الاستلام'
                                    : _deliveryStep == 1
                                        ? 'تم استلام الشحنة'
                                        : _deliveryStep == 2
                                            ? 'تم التسليم وتحصيل 22 ج.م'
                                            : 'تم إنهاء المشوار',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Column(
                  children: const [
                    Icon(Icons.done_all_rounded, size: 48, color: AppColors.secondary),
                    SizedBox(height: 12),
                    Text('لا توجد مشاوير نشطة حالياً', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    SizedBox(height: 6),
                    Text('الرادار جاهز لتلقي طلبات جديدة في الباجور فور وصولها', style: TextStyle(fontSize: 12, color: AppColors.slate500)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
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
