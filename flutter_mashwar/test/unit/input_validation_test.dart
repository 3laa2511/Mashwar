import 'package:flutter_test/flutter_test.dart';
import '../../lib/core/utils/input_validator.dart';

void main() {
  group('InputValidator Tests', () {
    test('Validates Egyptian phone numbers correctly', () {
      expect(InputValidator.validateEgyptianPhone('01012345678'), isNull);
      expect(InputValidator.validateEgyptianPhone('01198765432'), isNull);
      expect(InputValidator.validateEgyptianPhone('01234567890'), isNull);
      expect(InputValidator.validateEgyptianPhone('01511223344'), isNull);

      // Invalid formats
      expect(InputValidator.validateEgyptianPhone(''), isNotNull);
      expect(InputValidator.validateEgyptianPhone('123456'), isNotNull);
      expect(InputValidator.validateEgyptianPhone('01312345678'), isNotNull); // 013 is landline, not mobile
      expect(InputValidator.validateEgyptianPhone('010123456789'), isNotNull); // 12 digits
    });

    test('Validates pickup and drop-off landmark distinction', () {
      expect(
        InputValidator.validateLocations(
          pickup: 'ميدان المحطة - وسط الباجور',
          dropoff: 'مستشفى الباجور العام',
        ),
        isNull,
      );

      // Identical locations
      expect(
        InputValidator.validateLocations(
          pickup: 'ميدان المحطة - وسط الباجور',
          dropoff: 'ميدان المحطة - وسط الباجور',
        ),
        isNotNull,
      );

      // Empty locations
      expect(
        InputValidator.validateLocations(pickup: '', dropoff: 'مستشفى الباجور العام'),
        isNotNull,
      );
    });

    test('Validates item description length and content', () {
      expect(InputValidator.validateDescription('أوراق رسمية وملف تقارير طبية'), isNull);
      expect(InputValidator.validateDescription(''), isNotNull);
      expect(InputValidator.validateDescription('أو'), isNotNull); // < 3 characters
    });
  });
}
