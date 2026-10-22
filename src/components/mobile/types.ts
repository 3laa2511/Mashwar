export type MobilePersona = 'customer' | 'captain' | 'merchant';

export type CustomerScreen = 'home' | 'booking' | 'searching' | 'active_trip' | 'history' | 'profile';
export type CaptainScreen = 'radar' | 'incoming' | 'active_trip' | 'earnings' | 'subscription' | 'profile';
export type MerchantScreen = 'overview' | 'orders' | 'products' | 'store_status';

export interface Landmark {
  id: string;
  nameAr: string;
  area: string;
  distanceKm: number;
  popular?: boolean;
}

export interface ServiceOption {
  id: 'scooter' | 'car' | 'store' | 'urgent';
  titleAr: string;
  subtitleAr: string;
  basePriceEgp: number;
  estimatedMinutes: string;
  iconName: string;
  tagAr?: string;
  capacityAr: string;
}

export interface SimulatedOrder {
  id: string;
  serviceType: 'scooter' | 'car' | 'store';
  pickupName: string;
  dropoffName: string;
  customerName: string;
  customerPhone: string;
  captainName?: string;
  captainPhone?: string;
  captainRating?: number;
  vehiclePlate?: string;
  vehicleModel?: string;
  totalFareEgp: number;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash';
  status: 'created' | 'searching' | 'assigned' | 'at_pickup' | 'in_transit' | 'delivered' | 'cancelled';
  createdAt: string;
  distanceKm: number;
  notes?: string;
}
