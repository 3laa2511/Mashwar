import '../models/order_model.dart';

class MockDataRepository {
  static final List<String> elBagourLandmarks = [
    'ميدان المحطة - وسط الباجور',
    'مجلس مدينة الباجور',
    'شارع الجيش - برج الشروق',
    'مستشفى الباجور العام',
    'شارع الجمهورية - أمام بنك مصر',
    'منطقة المساكن الشعبية',
    'طريق بنها - الباجور الزراعي',
    'قرية كفر الباجور',
    'قرية شنتنا الحجر',
    'قرية جروان',
    'قرية ميت عفيف',
    'مجمع مواقف الباجور الجديد',
  ];

  static List<OrderModel> getInitialMockOrders() {
    return [
      OrderModel(
        id: 'MSH-8102',
        customerName: 'أحمد محمود',
        customerPhone: '01012345678',
        serviceType: OrderServiceType.package,
        status: OrderStatus.inTransit,
        pickupAddress: 'ميدان المحطة - وسط الباجور',
        dropoffAddress: 'مستشفى الباجور العام',
        itemDescription: 'أوراق رسمية وملف تقارير طبية مستعجل',
        estimatedFareEGP: 22.0,
        distanceKm: 2.8,
        captainName: 'كابتن طارق الغريب',
        captainPhone: '01198765432',
        captainVehicle: 'دراجة نارية هوجان سوداء (رقم: ٤٣٢١ م ن)',
        createdAt: DateTime.now().subtract(const Duration(minutes: 18)),
        notes: 'يرجى التسليم لمكتب الاستقبال الدور الثاني',
      ),
      OrderModel(
        id: 'MSH-8101',
        customerName: 'سارة إبراهيم',
        customerPhone: '01234567890',
        serviceType: OrderServiceType.restaurantStore,
        status: OrderStatus.atPickup,
        pickupAddress: 'شارع الجيش - مطعم فطاير الباجور',
        dropoffAddress: 'شارع الجمهورية - أمام بنك مصر',
        itemDescription: 'وجبة غداء فطير مشلتت وبيتزا شرقي',
        estimatedFareEGP: 19.0,
        distanceKm: 1.9,
        captainName: 'كابتن محمود السيد',
        captainPhone: '01055566677',
        captainVehicle: 'سكوتر بينيلي أحمر (رقم: ٨٧٦٥ م ن)',
        createdAt: DateTime.now().subtract(const Duration(minutes: 32)),
        notes: 'الطلب مدفوع ومجهز في المطعم',
      ),
      OrderModel(
        id: 'MSH-8099',
        customerName: 'د. خالد رضوان',
        customerPhone: '01511223344',
        serviceType: OrderServiceType.errand,
        status: OrderStatus.delivered,
        pickupAddress: 'صيدلية الشعب - شارع المحطة',
        dropoffAddress: 'قرية كفر الباجور',
        itemDescription: 'أدوية ومستلزمات صيدلية عاجلة',
        estimatedFareEGP: 31.0,
        distanceKm: 4.2,
        captainName: 'كابتن تامر فتحي',
        captainPhone: '01222334455',
        captainVehicle: 'دراجة نارية دايون فضية',
        createdAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 15)),
        notes: 'تم التسليم والتحصيل كاش بالكامل',
      ),
    ];
  }
}
