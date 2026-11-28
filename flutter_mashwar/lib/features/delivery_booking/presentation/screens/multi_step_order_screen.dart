import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../shared/services/mock_data_repository.dart';
import '../../../auth/presentation/providers/phone_auth_provider.dart';
import '../providers/order_flow_provider.dart';

class MultiStepOrderScreen extends ConsumerWidget {
  const MultiStepOrderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final flowState = ref.watch(orderFlowProvider);
    final flowNotifier = ref.read(orderFlowProvider.notifier);
    final authState = ref.watch(phoneAuthProvider);

    final int currentStepIndex = flowState.step.index;

    return Scaffold(
      appBar: AppBar(
        title: const Text('حجز طلب أو مشوار خطوة بخطوة'),
      ),
      body: Column(
        children: [
          // Stepper progress indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                _StepPill(
                  index: 1,
                  label: 'الخدمة',
                  isActive: currentStepIndex == 0,
                  isDone: currentStepIndex > 0,
                ),
                const Expanded(child: Divider()),
                _StepPill(
                  index: 2,
                  label: 'التفاصيل',
                  isActive: currentStepIndex == 1,
                  isDone: currentStepIndex > 1,
                ),
                const Expanded(child: Divider()),
                _StepPill(
                  index: 3,
                  label: 'التأكيد',
                  isActive: currentStepIndex == 2,
                  isDone: false,
                ),
              ],
            ),
          ),

          if (flowState.errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
                ),
                child: Text(
                  flowState.errorMessage!,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.error,
                  ),
                ),
              ),
            ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: switch (flowState.step) {
                OrderFlowStep.selectService => _ServiceChoiceStep(
                    selected: flowState.serviceCategory,
                    onSelect: flowNotifier.selectServiceCategory,
                  ),
                OrderFlowStep.configureDetails => _ConfigureDetailsStep(
                    state: flowState,
                    notifier: flowNotifier,
                  ),
                OrderFlowStep.reviewAndConfirm => _ReviewAndConfirmStep(
                    state: flowState,
                    notifier: flowNotifier,
                  ),
              },
            ),
          ),

          // Bottom action controls
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (flowState.step != OrderFlowStep.selectService) ...[
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        onPressed: flowState.isSubmitting
                            ? null
                            : flowNotifier.previousStep,
                        child: const Text('السابق'),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: flowState.isSubmitting
                          ? null
                          : () async {
                              if (flowState.step !=
                                  OrderFlowStep.reviewAndConfirm) {
                                flowNotifier.nextStep();
                              } else {
                                final orderId = await flowNotifier.submitOrder(
                                  customerPhone:
                                      authState.firebaseUser?.phoneNumber ??
                                          authState.rawPhoneInput,
                                );
                                if (orderId != null && context.mounted) {
                                  context.go('/customer/order/$orderId');
                                }
                              }
                            },
                      child: Text(
                        flowState.step == OrderFlowStep.reviewAndConfirm
                            ? (flowState.isSubmitting
                                ? 'جاري الإرسال...'
                                : 'تأكيد وإرسال (${flowState.totalFareEgp.toStringAsFixed(0)} ج.م)')
                            : 'التالي',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepPill extends StatelessWidget {
  final int index;
  final String label;
  final bool isActive;
  final bool isDone;

  const _StepPill({
    required this.index,
    required this.label,
    required this.isActive,
    required this.isDone,
  });

  @override
  Widget build(BuildContext context) {
    final Color bg = isDone
        ? AppColors.secondary
        : isActive
            ? AppColors.primary
            : AppColors.slate200;
    final Color fg = (isDone || isActive) ? Colors.white : AppColors.slate700;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 13,
          backgroundColor: bg,
          child: Text(
            isDone ? '✓' : '$index',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: fg),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _ServiceChoiceStep extends StatelessWidget {
  final OrderFlowServiceCategory selected;
  final ValueChanged<OrderFlowServiceCategory> onSelect;

  const _ServiceChoiceStep({
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'اختر نوع الخدمة المطلوبة',
          style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        const Text(
          'يمكنك طلب توصيل من مطاعم ومتاجر الباجور. خدمة نقل الركاب معلقة مؤقتاً لحين استيفاء التراخيص.',
          style: TextStyle(fontSize: 13, color: AppColors.slate500),
        ),
        const SizedBox(height: 16),
        _ServiceOptionCard(
          title: 'توصيل من المتاجر والمطاعم (Delivery)',
          subtitle: 'مطاعم مشويات، صيدليات، وسوبر ماركت في الباجور والقرى',
          icon: Icons.storefront_rounded,
          isSelected: selected == OrderFlowServiceCategory.delivery,
          onTap: () => onSelect(OrderFlowServiceCategory.delivery),
        ),
        const SizedBox(height: 12),
        _ServiceOptionCard(
          title: 'نقل الركاب معلق مؤقتاً',
          subtitle: 'تم تعطيل حجز التوكتوك والسيارات لحين اعتماد التراخيص الرسمية واشتراطات السلامة.',
          icon: Icons.directions_car_rounded,
          isSelected: false,
          isSuspended: true,
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('حرصاً على سلامتك، تم تعطيل نقل الركاب لحين استيفاء التراخيص الرسمية.'),
                backgroundColor: AppColors.slate700,
              ),
            );
          },
        ),
      ],
    );
  }
}

class _ServiceOptionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final bool isSelected;
  final bool isSuspended;
  final VoidCallback onTap;

  const _ServiceOptionCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.isSelected,
    this.isSuspended = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSuspended
              ? AppColors.slate100
              : isSelected
                  ? AppColors.secondary.withValues(alpha: 0.08)
                  : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected && !isSuspended ? AppColors.secondary : AppColors.borderLight,
            width: isSelected && !isSuspended ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 24,
              backgroundColor:
                  isSelected && !isSuspended ? AppColors.secondary : AppColors.slate200,
              child: Icon(
                icon,
                color: isSelected && !isSuspended ? Colors.white : AppColors.slate500,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.slate500,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: AppColors.secondary),
          ],
        ),
      ),
    );
  }
}

class _ConfigureDetailsStep extends StatelessWidget {
  final OrderFlowState state;
  final OrderFlowNotifier notifier;

  const _ConfigureDetailsStep({
    required this.state,
    required this.notifier,
  });

  @override
  Widget build(BuildContext context) {
    if (state.serviceCategory == OrderFlowServiceCategory.delivery) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'اختر المتجر المحلي',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            key: ValueKey('merchant_${state.selectedMerchantId}'),
            initialValue: state.selectedMerchantId,
            isExpanded: true,
            items: elBagourMerchants
                .map(
                  (m) => DropdownMenuItem(
                    value: m.id,
                    child: Text('${m.nameAr} (${m.categoryAr})'),
                  ),
                )
                .toList(),
            onChanged: (val) {
              if (val != null) notifier.selectMerchant(val);
            },
          ),
          const SizedBox(height: 16),
          const Text(
            'أضف الأصناف المطلوبة',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          ...state.selectedMerchant.items.map((item) {
            final qty = state.itemQuantities[item.id] ?? 0;
            return Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                title: Text(item.nameAr, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${item.priceEgp.toStringAsFixed(0)} ج.م'),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      onPressed: qty > 0 ? () => notifier.updateItemQty(item.id, -1) : null,
                      icon: const Icon(Icons.remove_circle_outline),
                    ),
                    Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                    IconButton(
                      onPressed: () => notifier.updateItemQty(item.id, 1),
                      icon: const Icon(Icons.add_circle_outline, color: AppColors.secondary),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 16),
          const Text(
            'عنوان التسليم (معلم أو قرية)',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            key: ValueKey('delivery_dropoff_${state.dropoffLandmark}'),
            initialValue: state.dropoffLandmark,
            isExpanded: true,
            items: MockDataRepository.elBagourLandmarks
                .map((lm) => DropdownMenuItem(value: lm, child: Text(lm)))
                .toList(),
            onChanged: (val) {
              if (val != null) notifier.setDropoffLandmark(val);
            },
          ),
        ],
      );
    }

    // Ride Configuration (TukTuk / Car)
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'اختر وسيلة المواصلات',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _VehicleChoiceChip(
                label: 'توكتوك معتمد',
                priceHint: 'يبدأ من 15 ج.م',
                icon: Icons.electric_rickshaw_rounded,
                selected: state.rideVehicleType == RideVehicleType.tuktuk,
                onTap: () => notifier.selectRideVehicle(RideVehicleType.tuktuk),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _VehicleChoiceChip(
                label: 'سيارة ملاكي',
                priceHint: 'يبدأ من 28 ج.م',
                icon: Icons.directions_car_rounded,
                selected: state.rideVehicleType == RideVehicleType.car,
                onTap: () => notifier.selectRideVehicle(RideVehicleType.car),
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'نقطة الانطلاق',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          key: ValueKey('ride_pickup_${state.pickupLandmark}'),
          initialValue: state.pickupLandmark,
          isExpanded: true,
          items: MockDataRepository.elBagourLandmarks
              .map((lm) => DropdownMenuItem(value: lm, child: Text(lm)))
              .toList(),
          onChanged: (val) {
            if (val != null) notifier.setPickupLandmark(val);
          },
        ),
        const SizedBox(height: 16),
        const Text(
          'نقطة الوصول (الوجهة)',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          key: ValueKey('ride_dropoff_${state.dropoffLandmark}'),
          initialValue: state.dropoffLandmark,
          isExpanded: true,
          items: MockDataRepository.elBagourLandmarks
              .map((lm) => DropdownMenuItem(value: lm, child: Text(lm)))
              .toList(),
          onChanged: (val) {
            if (val != null) notifier.setDropoffLandmark(val);
          },
        ),
      ],
    );
  }
}

class _VehicleChoiceChip extends StatelessWidget {
  final String label;
  final String priceHint;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _VehicleChoiceChip({
    required this.label,
    required this.priceHint,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary.withValues(alpha: 0.15) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.primaryDark : AppColors.borderLight,
            width: selected ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Icon(icon, size: 28, color: selected ? AppColors.primaryDark : AppColors.slate700),
            const SizedBox(height: 6),
            Text(label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            Text(priceHint, style: const TextStyle(fontSize: 11, color: AppColors.slate500)),
          ],
        ),
      ),
    );
  }
}

class _ReviewAndConfirmStep extends StatelessWidget {
  final OrderFlowState state;
  final OrderFlowNotifier notifier;

  const _ReviewAndConfirmStep({
    required this.state,
    required this.notifier,
  });

  @override
  Widget build(BuildContext context) {
    final isDelivery = state.serviceCategory == OrderFlowServiceCategory.delivery;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isDelivery
                      ? 'طلب توصيل: ${state.selectedMerchant.nameAr}'
                      : 'مشوار: ${state.rideVehicleType == RideVehicleType.tuktuk ? "توكتوك معتمد" : "سيارة ملاكي"}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
                const Divider(height: 20),
                Text('من: ${state.pickupLandmark}'),
                const SizedBox(height: 4),
                Text('إلى: ${state.dropoffLandmark}'),
                const SizedBox(height: 4),
                Text('المسافة التقديرية: ${state.estimatedDistanceKm} كم'),
                const Divider(height: 20),
                if (isDelivery) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('قيمة الأصناف'),
                      Text('${state.merchantSubtotalEgp.toStringAsFixed(0)} ج.م'),
                    ],
                  ),
                  const SizedBox(height: 4),
                ],
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(isDelivery ? 'رسوم التوصيل' : 'أجرة المشوار'),
                    Text('${state.serviceFareEgp.toStringAsFixed(0)} ج.م'),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'الإجمالي النهائي',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    Text(
                      '${state.totalFareEgp.toStringAsFixed(0)} ج.م',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: AppColors.secondaryDark,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'طريقة الدفع',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          key: ValueKey('payment_${state.paymentMethod}'),
          initialValue: state.paymentMethod,
          isExpanded: true,
          items: const [
            DropdownMenuItem(value: 'cash', child: Text('كاش عند الاستلام')),
            DropdownMenuItem(value: 'vodafone_cash', child: Text('فودافون كاش')),
            DropdownMenuItem(value: 'instapay', child: Text('إنستاباي')),
          ],
          onChanged: (val) {
            if (val != null) notifier.setPaymentMethod(val);
          },
        ),
        const SizedBox(height: 16),
        TextField(
          onChanged: notifier.setNotes,
          maxLines: 2,
          decoration: const InputDecoration(
            labelText: 'ملاحظات إضافية للكابتن',
            hintText: 'مثال: أمام الصيدلية أو بجوار المسجد الكبير...',
          ),
        ),
      ],
    );
  }
}
