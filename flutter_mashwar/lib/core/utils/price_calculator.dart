import '../../shared/models/fare_quote_model.dart';

/// PriceCalculator handles client-side estimated fare quotation.
/// IMPORTANT: As per architecture rules, this is an estimate for UI feedback only.
/// The authoritative fare must always be calculated and enforced by the production backend.
class PriceCalculator {
  static const double defaultBaseFare = 15.0; // EGP includes first 1.5km in central El Bagour
  static const double ratePerKm = 4.0; // EGP per subsequent kilometer
  static const double ruralSurchargeAmount = 5.0; // EGP for outer Menoufia rural villages
  static const double platformFeeAmount = 2.0; // EGP regulatory & dispatch maintenance

  /// Computes a transparent, itemized fare breakdown
  static FareQuoteModel calculateQuote({
    required double distanceKm,
    bool isRuralOrVillage = false,
  }) {
    if (distanceKm < 0) {
      throw ArgumentError('Distance cannot be negative');
    }

    final double chargeableKm = distanceKm > 1.5 ? (distanceKm - 1.5) : 0.0;
    final double distanceFare = (chargeableKm * ratePerKm).roundToDouble();
    final double ruralSurcharge = isRuralOrVillage ? ruralSurchargeAmount : 0.0;
    final double totalFare = defaultBaseFare + distanceFare + ruralSurcharge + platformFeeAmount;

    // Estimate duration: average speed 25 km/h in urban El Bagour plus 5 min buffer
    final int minutes = (distanceKm * 2.4 + 5).ceil();

    return FareQuoteModel(
      baseFare: defaultBaseFare,
      distanceKm: distanceKm,
      distanceFare: distanceFare,
      ruralOrUnpavedSurcharge: ruralSurcharge,
      platformFee: platformFeeAmount,
      totalFare: totalFare,
      estimatedDurationMinutes: '$minutes-${minutes + 5}',
    );
  }

  /// Calculates authoritative fare in Egyptian Piasters (1 EGP = 100 Piasters)
  /// Used for strict parity with the production backend pricing engine.
  static int calculateFarePiasters({
    required double distanceKm,
    bool isRuralOrVillage = false,
  }) {
    if (distanceKm < 0) {
      throw ArgumentError('Distance cannot be negative');
    }

    const int baseFarePiasters = 1500; // 15.00 EGP
    const int ratePerKmPiasters = 400; // 4.00 EGP
    const int ruralSurchargePiasters = 500; // 5.00 EGP
    const int platformFeePiasters = 200; // 2.00 EGP

    final double chargeableKm = distanceKm > 1.5 ? (distanceKm - 1.5) : 0.0;
    final int distanceFarePiasters = (chargeableKm * ratePerKmPiasters).round();
    final int ruralSurcharge = isRuralOrVillage ? ruralSurchargePiasters : 0;

    return baseFarePiasters + distanceFarePiasters + ruralSurcharge + platformFeePiasters;
  }
}
