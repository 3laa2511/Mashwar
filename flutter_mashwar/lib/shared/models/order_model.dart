import 'package:flutter/foundation.dart';

enum OrderServiceType {
  package,
  restaurantStore,
  errand,
  passengerRestricted,
}

enum OrderStatus {
  created,
  searchingCaptain,
  captainAssigned,
  atPickup,
  inTransit,
  delivered,
  cancelled,
}

class OrderModel {
  final String id;
  final String customerName;
  final String customerPhone;
  final OrderServiceType serviceType;
  final OrderStatus status;
  final String pickupAddress;
  final String dropoffAddress;
  final String itemDescription;
  final double estimatedFareEGP;
  final double distanceKm;
  final String? captainName;
  final String? captainPhone;
  final String? captainVehicle;
  final DateTime createdAt;
  final String? notes;

  const OrderModel({
    required this.id,
    required this.customerName,
    required this.customerPhone,
    required this.serviceType,
    required this.status,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.itemDescription,
    required this.estimatedFareEGP,
    required this.distanceKm,
    this.captainName,
    this.captainPhone,
    this.captainVehicle,
    required this.createdAt,
    this.notes,
  });

  OrderModel copyWith({
    String? id,
    String? customerName,
    String? customerPhone,
    OrderServiceType? serviceType,
    OrderStatus? status,
    String? pickupAddress,
    String? dropoffAddress,
    String? itemDescription,
    double? estimatedFareEGP,
    double? distanceKm,
    String? captainName,
    String? captainPhone,
    String? captainVehicle,
    DateTime? createdAt,
    String? notes,
  }) {
    return OrderModel(
      id: id ?? this.id,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      serviceType: serviceType ?? this.serviceType,
      status: status ?? this.status,
      pickupAddress: pickupAddress ?? this.pickupAddress,
      dropoffAddress: dropoffAddress ?? this.dropoffAddress,
      itemDescription: itemDescription ?? this.itemDescription,
      estimatedFareEGP: estimatedFareEGP ?? this.estimatedFareEGP,
      distanceKm: distanceKm ?? this.distanceKm,
      captainName: captainName ?? this.captainName,
      captainPhone: captainPhone ?? this.captainPhone,
      captainVehicle: captainVehicle ?? this.captainVehicle,
      createdAt: createdAt ?? this.createdAt,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'customerName': customerName,
      'customerPhone': customerPhone,
      'serviceType': serviceType.name,
      'status': status.name,
      'pickupAddress': pickupAddress,
      'dropoffAddress': dropoffAddress,
      'itemDescription': itemDescription,
      'estimatedFareEGP': estimatedFareEGP,
      'distanceKm': distanceKm,
      'captainName': captainName,
      'captainPhone': captainPhone,
      'captainVehicle': captainVehicle,
      'createdAt': createdAt.toIso8601String(),
      'notes': notes,
    };
  }
}
