import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/localization/app_strings.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';
import '../../../../shared/providers/role_provider.dart';

class CustomerHomeScreen extends ConsumerStatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  ConsumerState<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends ConsumerState<CustomerHomeScreen> {
  int _selectedTabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final orders = ref.watch(ordersProvider);
    final activeOrders = orders.where((o) => o.status != OrderStatus.delivered && o.status != OrderStatus.cancelled).toList();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(20),
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
          // Role switch popup menu for demo environment
          PopupMenuButton<AppRole>(
            tooltip: 'تبديل الدور للتجربة (Demo Role Switcher)',
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.slate200,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.swap_horiz_rounded, size: 20, color: AppColors.slate800),
            ),
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
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: AppRole.customer,
                child: Row(
                  children: [
                    Icon(Icons.person, color: AppColors.primaryDark, size: 18),
                    SizedBox(width: 8),
                    Text('تطبيق العميل (Customer)', style: TextStyle(fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: AppRole.captain,
                child: Row(
                  children: [
                    Icon(Icons.two_wheeler, color: AppColors.secondary, size: 18),
                    SizedBox(width: 8),
                    Text('تطبيق الكابتن (Captain)', style: TextStyle(fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: AppRole.merchant,
                child: Row(
                  children: [
                    Icon(Icons.storefront, color: Colors.blueAccent, size: 18),
                    SizedBox(width: 8),
                    Text('متجر التاجر (Merchant)', style: TextStyle(fontSize: 13)),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: AppRole.operations,
                child: Row(
                  children: [
                    Icon(Icons.admin_panel_settings, color: Colors.purple, size: 18),
                    SizedBox(width: 8),
                    Text('غرفة العمليات (Operations)', style: TextStyle(fontSize: 13)),
                  ],
                ),
              ),
            ],
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
                    color: Colors.black.withValues(alpha: 0.15),
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
              onTap: () => context.push('/customer/book'),
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
              onTap: () => context.push('/customer/book'),
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
              onTap: () => context.push('/customer/book'),
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
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Row(
                      children: [
                        Icon(Icons.gavel_rounded, color: AppColors.error),
                        SizedBox(width: 8),
                        Text('امتثال تنظيمي وقانوني', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    content: Text(AppStrings.get('passengerDisabledNotice')),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('حسناً'),
                      ),
                    ],
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
                  'الطلبات النشطة (${activeOrders.length})',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                ),
                TextButton(
                  onPressed: () => context.push('/customer/history'),
                  child: const Text('عرض السجل بالكامل'),
                ),
              ],
            ),
            const SizedBox(height: 8),

            if (activeOrders.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: const Center(
                  child: Text('لا توجد طلبات جارية حالياً • ابدأ بحجز مشوارك الأول!'),
                ),
              )
            else
              ...activeOrders.map((order) {
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.push('/customer/order/${order.id}'),
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
                                      color: AppColors.secondary.withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(Icons.two_wheeler_rounded, color: AppColors.secondary, size: 20),
                                  ),
                                  const SizedBox(width: 10),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('طلب #${order.id}', style: const TextStyle(fontWeight: FontWeight.bold)),
                                      Text(
                                        order.itemDescription,
                                        style: const TextStyle(fontSize: 12, color: AppColors.slate500),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: AppColors.secondary.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text('${order.estimatedFareEGP} ج.م', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondaryDark)),
                              ),
                            ],
                          ),
                          const Divider(height: 20),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'من: ${order.pickupAddress} ➔ ${order.dropoffAddress}',
                                style: const TextStyle(fontSize: 11, color: AppColors.slate600),
                              ),
                              const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.slate400),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            const SizedBox(height: 32),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTabIndex,
        onDestinationSelected: (index) {
          setState(() => _selectedTabIndex = index);
          if (index == 0) {
            context.go('/customer');
          } else if (index == 1) {
            context.push('/customer/history');
          } else if (index == 2) {
            context.push('/customer/book');
          }
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_rounded), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.receipt_long_rounded), label: 'طلباتي'),
          NavigationDestination(icon: Icon(Icons.add_circle_outline_rounded), label: 'طلب مشوار'),
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
                color: isEnabled ? AppColors.primary.withValues(alpha: 0.15) : Colors.grey.shade200,
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
                          color: badgeColor.withValues(alpha: 0.12),
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
}
