/// Centralized validation utilities for the Mashwar mobile app.
class InputValidator {
  /// Validates Egyptian mobile phone numbers (010, 011, 012, 015 followed by 8 digits)
  static String? validateEgyptianPhone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'يرجى إدخال رقم الموبايل';
    }
    final clean = value.replaceAll(RegExp(r'\s+'), '');
    final regex = RegExp(r'^(010|011|012|015)[0-9]{8}$');
    if (!regex.hasMatch(clean)) {
      return 'رقم موبايل غير صحيح (مثال: 01012345678)';
    }
    return null;
  }

  /// Validates pickup and drop-off landmark locations
  static String? validateLocations({
    required String? pickup,
    required String? dropoff,
  }) {
    if (pickup == null || pickup.trim().isEmpty) {
      return 'يرجى تحديد مكان الاستلام بالباجور';
    }
    if (dropoff == null || dropoff.trim().isEmpty) {
      return 'يرجى تحديد مكان التسليم بالباجور';
    }
    if (pickup.trim() == dropoff.trim()) {
      return 'مكان الاستلام والتسليم لا يمكن أن يكونا متطابقين';
    }
    return null;
  }

  /// Validates package/item description
  static String? validateDescription(String? value) {
    if (value == null || value.trim().length < 3) {
      return 'يرجى توضيح محتويات الشحنة أو الطلب (٣ أحرف على الأقل)';
    }
    if (value.trim().length > 250) {
      return 'الوصف طويل جداً (الحد الأقصى ٢٥٠ حرف)';
    }
    return null;
  }
}
