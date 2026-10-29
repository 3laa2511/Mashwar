class FareQuoteModel {
  final double baseFare;
  final double distanceKm;
  final double distanceFare;
  final double ruralOrUnpavedSurcharge;
  final double platformFee;
  final double totalFare;
  /// Exact server-calculated amount in integer Egyptian piasters.
  final int? totalFarePiasters;
  final String currency;
  final String estimatedDurationMinutes;

  /// Authoritative server-issued quote identity and validation data.
  /// These are nullable only to preserve local/demo quote construction.
  final String? quoteId;
  final String? signature;
  final String? expiresAt;
  final String? serviceTypeId;
  final String? cityId;
  final String? zoneId;

  const FareQuoteModel({
    required this.baseFare,
    required this.distanceKm,
    required this.distanceFare,
    required this.ruralOrUnpavedSurcharge,
    required this.platformFee,
    required this.totalFare,
    this.totalFarePiasters,
    this.currency = 'ج.م',
    required this.estimatedDurationMinutes,
    this.quoteId,
    this.signature,
    this.expiresAt,
    this.serviceTypeId,
    this.cityId,
    this.zoneId,
  });

  bool get isServerIssued =>
      quoteId != null &&
      quoteId!.isNotEmpty &&
      signature != null &&
      signature!.isNotEmpty &&
      expiresAt != null &&
      expiresAt!.isNotEmpty;

  bool get isExpired {
    if (expiresAt == null) return true;
    final expiry = DateTime.tryParse(expiresAt!);
    return expiry == null || !expiry.isAfter(DateTime.now().toUtc());
  }

  Map<String, dynamic> toJson() => {
        'baseFare': baseFare,
        'distanceKm': distanceKm,
        'distanceFare': distanceFare,
        'ruralOrUnpavedSurcharge': ruralOrUnpavedSurcharge,
        'platformFee': platformFee,
        'totalFare': totalFare,
        'totalFarePiasters': totalFarePiasters,
        'currency': currency,
        'estimatedDurationMinutes': estimatedDurationMinutes,
        'quoteId': quoteId,
        'signature': signature,
        'expiresAt': expiresAt,
        'serviceTypeId': serviceTypeId,
        'cityId': cityId,
        'zoneId': zoneId,
      };
}
