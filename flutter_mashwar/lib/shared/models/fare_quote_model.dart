class FareQuoteModel {
  final double baseFare;
  final double distanceKm;
  final double distanceFare;
  final double ruralOrUnpavedSurcharge;
  final double platformFee;
  final double totalFare;
  final String currency;
  final String estimatedDurationMinutes;

  const FareQuoteModel({
    required this.baseFare,
    required this.distanceKm,
    required this.distanceFare,
    required this.ruralOrUnpavedSurcharge,
    required this.platformFee,
    required this.totalFare,
    this.currency = 'ج.م',
    required this.estimatedDurationMinutes,
  });

  Map<String, dynamic> toJson() => {
        'baseFare': baseFare,
        'distanceKm': distanceKm,
        'distanceFare': distanceFare,
        'ruralOrUnpavedSurcharge': ruralOrUnpavedSurcharge,
        'platformFee': platformFee,
        'totalFare': totalFare,
        'currency': currency,
        'estimatedDurationMinutes': estimatedDurationMinutes,
      };
}
