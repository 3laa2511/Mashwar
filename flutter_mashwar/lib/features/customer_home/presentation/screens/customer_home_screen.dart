import 'package:flutter/material.dart';
import '../../../app/localization/app_strings.dart';
import '../../../app/theme/app_colors.dart';
import '../../../shared/services/mock_data_repository.dart';
import '../../../shared/models/order_model.dart';

class CustomerHomeScreen extends StatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  int _selectedTabIndex = 0;
  String _selectedPickup = 'ميدان المحطة - وسط الباجور';
  String _selectedDropoff = 'مستشفى الباجور العام';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.pad(EdgeInsets.zero),
              ),
              child: Row(
                children: [
                  const Icon(Icons.location_on, size: 16, color: AppColors.primaryDark),
                  const SizedBox(width: 4),
                  Text(
                    'الباجور، المنوفية',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: isDark ? AppColors.primaryLight : AppColors.primaryDark,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () {},
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Welcome Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.slate900, Color(0xFF1E3A8A)],
                  begin: Alignment.topRight,
                  end: Alignment.bottomLeft,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.15),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  )
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'مشوارك في الباجور أسهل وأسرع',
                        style: theme.textTheme.headlineSmall?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.local_shipping_outlined, color: AppColors.slate950),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'توصيل طرود، طلبات مطاعم، ومستلزمات صيدلية في جميع أنحاء الباجور والقرى المجاورة.',
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.slate300,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),
            Text(
              'الخدمات المتاحة حالياً',
              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            // Service 1: Packages
            _buildServiceCard(
              title: AppStrings.get('packageDelivery'),
              description: AppStrings.get('packageDeliveryDesc'),
              icon: Icons.inventory_2_rounded,
              badgeText: 'أسرع كابتن',
              badgeColor: AppColors.secondary,
              isEnabled: true,
              onTap: () => _openBookingDialog(context, OrderServiceType.package),
            ),

            const SizedBox(height: 12),
            // Service 2: Restaurants & Stores
            _buildServiceCard(
              title: AppStrings.get('restaurantStore'),
              description: AppStrings.get('restaurantStoreDesc'),
              icon: Icons.storefront_rounded,
              badgeText: 'متاجر الباجور',
              badgeColor: AppColors.primaryDark,
              isEnabled: true,
              onTap: () => _openBookingDialog(context, OrderServiceType.restaurantStore),
            ),

            const SizedBox(height: 12),
            // Service 3: Errands & Pharmacy
            _buildServiceCard(
              title: AppStrings.get('errands'),
              description: AppStrings.get('errandsDesc'),
              icon: Icons.electric_moped_rounded,
              badgeText: 'تخليص فوري',
              badgeColor: Colors.blueAccent,
              isEnabled: true,
              onTap: () => _openBookingDialog(context, OrderServiceType.errand),
            ),

            const SizedBox(height: 12),
            // Service 4: Passenger Transportation - STRICTLY DISABLED
            _buildServiceCard(
              title: AppStrings.get('passengerDisabled'),
              description: AppStrings.get('passengerDisabledNotice'),
              icon: Icons.directions_car_rounded,
              badgeText: 'معلق نظامياً',
              badgeColor: AppColors.error,
              isEnabled: false,
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(AppStrings.get('passengerDisabledNotice')),
                    backgroundColor: AppColors.error,
                  ),
                );
              },
            ),

            const SizedBox(height: 24),
            // Active Deliveries Preview
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'آخر الطلبات النشطة',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: () {},
                  child: const Text('عرض الكل'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Example active order card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.secondary.withOpacity(0.12),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.two_wheeler_rounded, color: AppColors.secondary, size: 20),
                            ),
                            const SizedBox(width: 10),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: const [
                                Text('طلب #MSH-8102', style: TextStyle(fontWeight: FontWeight.bold)),
                                Text('طرد مستعجل • في الطريق إليك', style: TextStyle(fontSize: 12, color: AppColors.slate500)),
                              ],
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.secondary.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('22.00 ج.م', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondaryDark)),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      children: const [
                        Icon(Icons.person_pin_circle_outlined, size: 16, color: AppColors.slate400),
                        SizedBox(width: 6),
                        Expanded(child: Text('كابتن طارق الغريب • دراجة هوجان سوداء', style: TextStyle(fontSize: 13))),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTabIndex,
        onDestinationSelected: (index) => setState(() => _selectedTabIndex = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_rounded), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.receipt_long_rounded), label: 'طلباتي'),
          NavigationDestination(icon: Icon(Icons.person_outline_rounded), label: 'حسابي'),
        ],
      ),
    );
  }

  Widget _buildServiceCard({
    required String title,
    required String description,
    required IconData icon,
    required String badgeText,
    required Color badgeColor,
    required bool isEnabled,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isEnabled ? Colors.white : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isEnabled ? AppColors.borderLight : Colors.grey.shade300,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isEnabled ? AppColors.primary.withOpacity(0.15) : Colors.grey.shade200,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(
                icon,
                color: isEnabled ? AppColors.primaryDark : Colors.grey.shade500,
                size: 26,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: isEnabled ? AppColors.slate900 : Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: badgeColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          badgeText,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: badgeColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 12,
                      color: isEnabled ? AppColors.slate500 : Colors.grey.shade500,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 16,
              color: isEnabled ? AppColors.slate400 : Colors.grey.shade300,
            ),
          ],
        ),
      ),
    );
  }

  void _openBookingDialog(BuildContext context, OrderServiceType serviceType) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            top: 20,
            left: 20,
            right: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'طلب مشوار جديد',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _selectedPickup,
                decoration: const InputDecoration(labelText: 'نقطة الاستلام في الباجور'),
                items: MockDataRepository.elBagourLandmarks
                    .map((item) => DropdownMenuItem(value: item, child: Text(item, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedPickup = val);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _selectedDropoff,
                decoration: const InputDecoration(labelText: 'نقطة التسليم في الباجور'),
                items: MockDataRepository.elBagourLandmarks
                    .map((item) => DropdownMenuItem(value: item, child: Text(item, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDropoff = val);
                },
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('تم إرسال الطلب بنجاح وجاري إشعار الكباتن بالباجور!'),
                      backgroundColor: AppColors.secondary,
                    ),
                  );
                },
                child: const Text('حساب التسعيرة والبحث عن كابتن'),
              ),
            ],
          ),
        );
      },
    );
  }
}
