import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/utils/input_validator.dart';
import '../../../../core/utils/price_calculator.dart';
import '../../../../shared/models/fare_quote_model.dart';
import '../../../../shared/models/order_model.dart';
import '../../../../shared/providers/orders_provider.dart';
import '../../../../shared/services/mock_data_repository.dart';

class BookingScreen extends ConsumerStatefulWidget {
  final OrderServiceType initialServiceType;

  const BookingScreen({
    super.key,
    this.initialServiceType = OrderServiceType.package,
  });

  @override
  ConsumerState<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends ConsumerState<BookingScreen> {
  final _formKey = GlobalKey<FormState>();
  late OrderServiceType _serviceType;

  late String _pickup;
  late String _dropoff;
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _customerPhoneController =
      TextEditingController(text: '01012345678');
  bool _isRuralDestination = false;

  late FareQuoteModel _fareQuote;

  @override
  void initState() {
    super.initState();
    _serviceType = widget.initialServiceType;
    _pickup = MockDataRepository.elBagourLandmarks.first;
    _dropoff = MockDataRepository.elBagourLandmarks[3];
    _recalculateFare();
  }

  @override
  void dispose() {
    _notesController.dispose();
    _customerPhoneController.dispose();
    super.dispose();
  }

  void _recalculateFare() {
    final double dist = _isRuralDestination ? 4.8 : 2.4;
    setState(() {
      _fareQuote = PriceCalculator.calculateQuote(
        distanceKm: dist,
        isRuralOrVillage: _isRuralDestination,
      );
    });
  }

  void _handleConfirmOrder() {
    if (!_formKey.currentState!.validate()) return;

    final locError = InputValidator.validateLocations(
      pickup: _pickup,
      dropoff: _dropoff,
    );
    if (locError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(locError), backgroundColor: AppColors.error),
      );
      return;
    }

    final newOrderId = 'MSH-${DateTime.now().millisecondsSinceEpoch % 10000}';
    final newOrder = OrderModel(
      id: newOrderId,
      customerName: 'أحمد محمود',
      customerPhone: _customerPhoneController.text.trim(),
      serviceType: _serviceType,
      status: OrderStatus.searchingCaptain,
      pickupAddress: _pickup,
      dropoffAddress: _dropoff,
      itemDescription: _notesController.text.trim(),
      estimatedFareEGP: _fareQuote.totalFare,
      distanceKm: _fareQuote.distanceKm,
      createdAt: DateTime.now(),
      notes: _notesController.text.trim(),
    );

    ref.read(ordersProvider.notifier).addOrder(newOrder);

    // Navigate to tracking
    context.go('/customer/order/$newOrderId');
  }

  @override
  Widget build(BuildContext context) {

    return Scaffold(
      appBar: AppBar(
        title: Text(
          _serviceType == OrderServiceType.package
              ? 'طلب توصيل طرد'
              : _serviceType == OrderServiceType.restaurantStore
                  ? 'طلب من متجر / مطعم'
                  : 'مشوار خاص وصيدلية',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Landmark selection
              DropdownButtonFormField<String>(
                initialValue: _pickup,
                decoration: const InputDecoration(
                  labelText: 'نقطة الاستلام في الباجور',
                  prefixIcon: Icon(Icons.trip_origin_rounded, color: AppColors.secondary),
                ),
                items: MockDataRepository.elBagourLandmarks
                    .map((item) => DropdownMenuItem(value: item, child: Text(item, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _pickup = val);
                    _recalculateFare();
                  }
                },
              ),
              const SizedBox(height: 14),

              DropdownButtonFormField<String>(
                initialValue: _dropoff,
                decoration: const InputDecoration(
                  labelText: 'نقطة التسليم في الباجور',
                  prefixIcon: Icon(Icons.location_on_rounded, color: AppColors.error),
                ),
                items: MockDataRepository.elBagourLandmarks
                    .map((item) => DropdownMenuItem(value: item, child: Text(item, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) {
                    setState(() => _dropoff = val);
                    _recalculateFare();
                  }
                },
              ),
              const SizedBox(height: 14),

              // Rural village checkbox
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderLight),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('وجهة قروية / خارج المدينة (+5 ج.م)', style: TextStyle(fontSize: 13)),
                    Switch(
                      value: _isRuralDestination,
                      activeThumbColor: AppColors.secondary,
                      onChanged: (val) {
                        setState(() => _isRuralDestination = val);
                        _recalculateFare();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // Item description
              TextFormField(
                controller: _notesController,
                decoration: const InputDecoration(
                  labelText: 'تفاصيل ومحتويات الشحنة',
                  hintText: 'مثال: ملف أوراق مهم من برج الشروق إلى المستشفى',
                  prefixIcon: Icon(Icons.description_outlined),
                ),
                validator: InputValidator.validateDescription,
              ),
              const SizedBox(height: 14),

              // Phone number
              TextFormField(
                controller: _customerPhoneController,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'رقم موبايل المستلم أو العميل',
                  prefixIcon: Icon(Icons.phone_android_rounded),
                ),
                validator: InputValidator.validateEgyptianPhone,
              ),
              const SizedBox(height: 20),

              // Transparent Price Breakdown
              Card(
                color: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.borderLight),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('تفاصيل التسعيرة التقديرية', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text('تقدير تجريبي', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _buildPriceRow('الأجرة الأساسية (أول 1.5 كم)', '${_fareQuote.baseFare} ج.م'),
                      _buildPriceRow('تكلفة المسافة (${_fareQuote.distanceKm} كم)', '${_fareQuote.distanceFare} ج.م'),
                      if (_isRuralDestination)
                        _buildPriceRow('بدل طرق ريفية / قرى', '+${_fareQuote.ruralOrUnpavedSurcharge} ج.م'),
                      _buildPriceRow('رسوم الخدمة والتطوير', '${_fareQuote.platformFee} ج.م'),
                      const Divider(height: 20),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('الإجمالي التقديري:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          Text(
                            '${_fareQuote.totalFare} ج.م',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primaryDark),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: _handleConfirmOrder,
                child: Text('تأكيد طلب المشوار (${_fareQuote.totalFare} ج.م)'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPriceRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.slate600)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
