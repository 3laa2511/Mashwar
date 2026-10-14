import 'package:flutter_test/flutter_test.dart';
import '../../lib/core/utils/price_calculator.dart';

void main() {
  group('PriceCalculator Tests for El Bagour Delivery Model', () {
    test('Calculates base fare within 1.5km urban radius', () {
      final quote = PriceCalculator.calculateQuote(distanceKm: 1.2, isRuralOrVillage: false);

      // Base fare 15 + 0 distance fare + 0 rural + 2 platform fee = 17 EGP
      expect(quote.baseFare, 15.0);
      expect(quote.distanceFare, 0.0);
      expect(quote.ruralOrUnpavedSurcharge, 0.0);
      expect(quote.platformFee, 2.0);
      expect(quote.totalFare, 17.0);
    });

    test('Calculates distance fare for trips exceeding 1.5km', () {
      // 3.5 km => 2.0 chargeable km * 4 EGP/km = 8 EGP distance fare
      // Total = 15 + 8 + 0 + 2 = 25 EGP
      final quote = PriceCalculator.calculateQuote(distanceKm: 3.5, isRuralOrVillage: false);

      expect(quote.distanceFare, 8.0);
      expect(quote.totalFare, 25.0);
    });

    test('Applies rural / village surcharge for outer Menoufia routes', () {
      // 3.5 km to village with surcharge = 15 + 8 + 5 (rural) + 2 = 30 EGP
      final quote = PriceCalculator.calculateQuote(distanceKm: 3.5, isRuralOrVillage: true);

      expect(quote.ruralOrUnpavedSurcharge, 5.0);
      expect(quote.totalFare, 30.0);
    });

    test('Throws ArgumentError on negative distance', () {
      expect(
        () => PriceCalculator.calculateQuote(distanceKm: -1.0),
        throwsA(isA<ArgumentError>()),
      );
    });
  });
}
