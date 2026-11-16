import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AppRole,
  BLUEPRINT_LIMITS,
  BOOTSTRAPPED_OWNER_EMAIL,
  DriverVehicleType,
  PaymentMethod,
  StoreCategory,
  VehicleTier,
  clampStr,
  sanitizeDocId,
  calculateDeliveryFeePiasters,
  calculateRideFarePiasters,
  estimateLandmarkDistanceKm,
  EL_BAGOUR_LANDMARKS,
} from '../lib/firestoreSchemas';

export interface UserAccountDoc {
  uid: string;
  displayName: string;
  email: string;
  phone?: string;
  role: AppRole;
  defaultCityId: string;
  defaultLandmark: string;
  cashbackBalancePiasters: number;
}

export interface DriverProfileDoc {
  uid: string;
  fullName: string;
  cityId: string;
  vehicleType: DriverVehicleType;
  plateLabel: string;
  isVerified: boolean;
  isOnline: boolean;
  ratingAverage: number;
  completedTrips: number;
  currentLandmark: string;
}

export interface StoreFrontDoc {
  id: string;
  ownerUid: string;
  nameAr: string;
  category: StoreCategory;
  cityId: string;
  landmark: string;
  deliveryFeePiasters: number;
  minOrderPiasters: number;
  prepTimeText: string;
  rating: number;
  isOpen: boolean;
}

export interface CatalogProductDoc {
  id: string;
  storeId: string;
  ownerUid: string;
  nameAr: string;
  descriptionAr: string;
  categoryName: string;
  pricePiasters: number;
  unit: string;
  isAvailable: boolean;
}

export type OrderLifecycleStatus =
  | 'created'
  | 'accepted_by_store'
  | 'preparing'
  | 'ready_for_pickup'
  | 'searching_captain'
  | 'captain_assigned'
  | 'at_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface DeliveryOrderDoc {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  merchantOwnerUid?: string;
  serviceType: 'restaurant_store' | 'package' | 'errand';
  cityId: string;
  storeNames: string[];
  pickupLandmark: string;
  dropoffLandmark: string;
  itemsSummary: string;
  isRural: boolean;
  scheduledFor: string;
  hasVoiceNote: boolean;
  voiceNoteDurationSec: number;
  voiceNoteTranscript: string;
  distanceKm: number;
  subtotalPiasters: number;
  deliveryFeePiasters: number;
  cashbackAppliedPiasters: number;
  totalFarePiasters: number;
  paymentMethod: PaymentMethod;
  status: OrderLifecycleStatus;
  assignedCaptainId?: string;
  assignedCaptainName?: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type RideLifecycleStatus =
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arrived'
  | 'in_ride'
  | 'completed'
  | 'cancelled';

export interface PassengerRideDoc {
  id: string;
  rideNumber: string;
  passengerId: string;
  passengerName: string;
  vehicleTier: VehicleTier;
  cityId: string;
  pickupLandmark: string;
  dropoffLandmark: string;
  distanceKm: number;
  estimatedFarePiasters: number;
  cashbackAppliedPiasters: number;
  paymentMethod: PaymentMethod;
  status: RideLifecycleStatus;
  assignedDriverId?: string;
  assignedDriverName?: string;
  driverPlateLabel?: string;
  safetySosTriggered: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ChatMessageDoc {
  id: string;
  senderUid: string;
  senderRole: 'customer' | 'captain' | 'merchant';
  senderName: string;
  text: string;
  createdAt?: Timestamp | null;
}

export interface WalletTransactionDoc {
  id: string;
  userId: string;
  type: 'welcome_bonus' | 'cashback_earn' | 'cashback_redeem' | 'admin_adjustment';
  amountPiasters: number;
  refId: string;
  titleAr: string;
  createdAt?: Timestamp | null;
}

export interface MultiStopCartItem {
  product: CatalogProductDoc;
  store: StoreFrontDoc;
  quantity: number;
}

// Initial curated El Bagour marketplace preview / seed catalog
export const SEED_EL_BAGOUR_STORES: StoreFrontDoc[] = [
  {
    id: 'store_el_basha_grill',
    ownerUid: 'seed_merchant_basha',
    nameAr: 'مشويات الباشا - الباجور',
    category: 'restaurant',
    cityId: 'city_el_bagour',
    landmark: 'شارع الجيش - برج الشروق',
    deliveryFeePiasters: 1500,
    minOrderPiasters: 6000,
    prepTimeText: '20-30 دقيقة',
    rating: 4.8,
    isOpen: true,
  },
  {
    id: 'store_shifa_pharmacy',
    ownerUid: 'seed_merchant_shifa',
    nameAr: 'صيدلية الشفاء المركزية',
    category: 'pharmacy',
    cityId: 'city_el_bagour',
    landmark: 'مستشفى الباجور العام',
    deliveryFeePiasters: 1500,
    minOrderPiasters: 4000,
    prepTimeText: '10-15 دقيقة',
    rating: 4.9,
    isOpen: true,
  },
  {
    id: 'store_baraka_market',
    ownerUid: 'seed_merchant_baraka',
    nameAr: 'سوبر ماركت البركة والعائلة',
    category: 'supermarket',
    cityId: 'city_el_bagour',
    landmark: 'ميدان المحطة - وسط الباجور',
    deliveryFeePiasters: 1500,
    minOrderPiasters: 5000,
    prepTimeText: '15-25 دقيقة',
    rating: 4.7,
    isOpen: true,
  },
  {
    id: 'store_koshary_mahatta',
    ownerUid: 'seed_merchant_koshary',
    nameAr: 'كشري وطواجن المحطة',
    category: 'restaurant',
    cityId: 'city_el_bagour',
    landmark: 'ميدان المحطة - وسط الباجور',
    deliveryFeePiasters: 1200,
    minOrderPiasters: 3500,
    prepTimeText: '15-20 دقيقة',
    rating: 4.6,
    isOpen: true,
  },
];

export const SEED_EL_BAGOUR_PRODUCTS: CatalogProductDoc[] = [
  {
    id: 'prod_basha_kofta',
    storeId: 'store_el_basha_grill',
    ownerUid: 'seed_merchant_basha',
    nameAr: 'وجبة كفتة مشوية على الفحم',
    descriptionAr: 'نصف كيلو كفتة بلدي مع أرز بسمتي وسلطة وطحينة وعيش',
    categoryName: 'مشويات',
    pricePiasters: 16500,
    unit: 'وجبة',
    isAvailable: true,
  },
  {
    id: 'prod_basha_shish',
    storeId: 'store_el_basha_grill',
    ownerUid: 'seed_merchant_basha',
    nameAr: 'ساندوتش شيش طاووق سوري',
    descriptionAr: 'خبز صاج محمص مع ثومية ومخلل وبطاطس',
    categoryName: 'ساندوتشات',
    pricePiasters: 6500,
    unit: 'ساندوتش',
    isAvailable: true,
  },
  {
    id: 'prod_shifa_panadol',
    storeId: 'store_shifa_pharmacy',
    ownerUid: 'seed_merchant_shifa',
    nameAr: 'بانادول إكسترا 24 قرص',
    descriptionAr: 'مسكن سريع للصداع وخافض للحرارة',
    categoryName: 'أدوية شائعة',
    pricePiasters: 4800,
    unit: 'علبة',
    isAvailable: true,
  },
  {
    id: 'prod_shifa_vitc',
    storeId: 'store_shifa_pharmacy',
    ownerUid: 'seed_merchant_shifa',
    nameAr: 'فيتامين سي فوار 1000 مجم',
    descriptionAr: 'دعم المناعة بطعم البرتقال الطبيعي',
    categoryName: 'فيتامينات',
    pricePiasters: 5500,
    unit: 'أنبوب',
    isAvailable: true,
  },
  {
    id: 'prod_baraka_dairy',
    storeId: 'store_baraka_market',
    ownerUid: 'seed_merchant_baraka',
    nameAr: 'باقة فطار الباجور (لبن + جبنة + عيش)',
    descriptionAr: 'لتر حليب طازج + جبنة بيضاء + 5 أرغفة بلدي ساخنة',
    categoryName: 'بقالة يومية',
    pricePiasters: 8500,
    unit: 'باقة',
    isAvailable: true,
  },
  {
    id: 'prod_baraka_water',
    storeId: 'store_baraka_market',
    ownerUid: 'seed_merchant_baraka',
    nameAr: 'كرتونة مياه معدنية 12 زجاجة',
    descriptionAr: 'توصيل لباب المنزل أو المكتب في الباجور والقرى',
    categoryName: 'مشروبات',
    pricePiasters: 7200,
    unit: 'كرتونة',
    isAvailable: true,
  },
  {
    id: 'prod_koshary_royal',
    storeId: 'store_koshary_mahatta',
    ownerUid: 'seed_merchant_koshary',
    nameAr: 'علبة كشري ملوكي سوبر',
    descriptionAr: 'حمص وبصل مقرمش وصلصة دقة وشطة بالزيت',
    categoryName: 'كشري',
    pricePiasters: 5000,
    unit: 'علبة',
    isAvailable: true,
  },
];

export const SEED_VERIFIED_DRIVERS: DriverProfileDoc[] = [
  {
    uid: 'driver_tuktuk_bagour_01',
    fullName: 'كابتن كريم السعيد',
    cityId: 'city_el_bagour',
    vehicleType: 'tuktuk',
    plateLabel: 'منوفية ٣١٨ ت',
    isVerified: true,
    isOnline: true,
    ratingAverage: 4.9,
    completedTrips: 342,
    currentLandmark: 'ميدان المحطة - وسط الباجور',
  },
  {
    uid: 'driver_car_bagour_02',
    fullName: 'كابتن محمود الشهاوي',
    cityId: 'city_el_bagour',
    vehicleType: 'car',
    plateLabel: 'م ن ٨٤٢١',
    isVerified: true,
    isOnline: true,
    ratingAverage: 4.8,
    completedTrips: 215,
    currentLandmark: 'شارع الجيش - برج الشروق',
  },
  {
    uid: 'driver_scooter_bagour_03',
    fullName: 'كابتن طارق الغريب',
    cityId: 'city_el_bagour',
    vehicleType: 'scooter',
    plateLabel: 'م ن ٤٣٢١',
    isVerified: true,
    isOnline: true,
    ratingAverage: 4.9,
    completedTrips: 518,
    currentLandmark: 'مستشفى الباجور العام',
  },
];

interface MashwarFirebaseContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  userProfile: UserAccountDoc | null;
  isOwnerUser: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  selectedCityId: string;
  selectedLandmark: string;
  updateLandmarkPreference: (cityId: string, landmark: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  authBusy: boolean;
  authError: string | null;

  // Live catalog & verified fleet
  stores: StoreFrontDoc[];
  products: CatalogProductDoc[];
  verifiedDrivers: DriverProfileDoc[];
  allDriversForAdmin: DriverProfileDoc[];
  isCatalogSeeded: boolean;
  seedElBagourCatalog: () => Promise<void>;

  // Multi-stop cart
  cart: MultiStopCartItem[];
  addToCart: (product: CatalogProductDoc, store: StoreFrontDoc) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, delta: number) => void;
  clearCart: () => void;

  // Orders & Rides streams
  myOrders: DeliveryOrderDoc[];
  dispatchOrders: DeliveryOrderDoc[];
  captainAssignedOrders: DeliveryOrderDoc[];
  merchantOrders: DeliveryOrderDoc[];
  allOrdersAdmin: DeliveryOrderDoc[];
  myRides: PassengerRideDoc[];
  dispatchRides: PassengerRideDoc[];
  captainAssignedRides: PassengerRideDoc[];
  allRidesAdmin: PassengerRideDoc[];

  // Active thread chat
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  activeThreadMessages: ChatMessageDoc[];
  sendThreadMessage: (threadId: string, role: 'customer' | 'captain' | 'merchant', text: string) => Promise<void>;

  // Cashback wallet
  walletTransactions: WalletTransactionDoc[];
  availableCashbackPiasters: number;
  claimCompletedCashback: (refId: string, kind: 'order' | 'ride', amountPiasters: number) => Promise<void>;

  // Customer actions
  createSuperAppOrder: (params: {
    serviceType: 'restaurant_store' | 'package' | 'errand';
    pickupLandmark: string;
    dropoffLandmark: string;
    itemsSummary: string;
    storeNames: string[];
    merchantOwnerUid?: string;
    subtotalPiasters: number;
    scheduledFor: string;
    hasVoiceNote: boolean;
    voiceNoteDurationSec: number;
    voiceNoteTranscript: string;
    paymentMethod: PaymentMethod;
    redeemCashbackPiasters: number;
  }) => Promise<DeliveryOrderDoc>;
  bookVerifiedRide: (params: {
    vehicleTier: VehicleTier;
    pickupLandmark: string;
    dropoffLandmark: string;
    paymentMethod: PaymentMethod;
    redeemCashbackPiasters: number;
  }) => Promise<PassengerRideDoc>;
  cancelOrder: (orderId: string) => Promise<void>;
  cancelRide: (rideId: string) => Promise<void>;
  triggerRideSos: (rideId: string) => Promise<void>;

  // Captain / Driver actions
  myDriverProfile: DriverProfileDoc | null;
  registerDriverProfile: (params: {
    fullName: string;
    vehicleType: DriverVehicleType;
    plateLabel: string;
  }) => Promise<void>;
  toggleDriverOnline: (isOnline: boolean) => Promise<void>;
  claimDispatchOrder: (orderId: string) => Promise<void>;
  advanceOrderStatus: (orderId: string, nextStatus: OrderLifecycleStatus) => Promise<void>;
  claimDispatchRide: (rideId: string) => Promise<void>;
  advanceRideStatus: (rideId: string, nextStatus: RideLifecycleStatus) => Promise<void>;

  // Merchant actions
  merchantUpdateOrderStatus: (orderId: string, nextStatus: OrderLifecycleStatus) => Promise<void>;
  merchantToggleStoreOpen: (storeId: string, isOpen: boolean) => Promise<void>;

  // Admin / Owner actions
  adminVerifyDriver: (driverUid: string, isVerified: boolean) => Promise<void>;
  adminAssignUserRole: (targetUid: string, role: AppRole) => Promise<void>;
}

const MashwarFirebaseContext = createContext<MashwarFirebaseContextValue | null>(null);

export const MashwarFirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserAccountDoc | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next);
      }
      return next;
    });
  }, []);

  // Ensure <html> reflects dark mode cleanly on initial mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDarkMode);
    }
  }, [isDarkMode]);

  const [selectedCityId, setSelectedCityId] = useState<string>('city_el_bagour');
  const [selectedLandmark, setSelectedLandmark] = useState<string>(EL_BAGOUR_LANDMARKS[0].nameAr);

  const [liveStores, setLiveStores] = useState<StoreFrontDoc[]>([]);
  const [liveProducts, setLiveProducts] = useState<CatalogProductDoc[]>([]);
  const [verifiedDrivers, setVerifiedDrivers] = useState<DriverProfileDoc[]>([]);
  const [allDriversForAdmin, setAllDriversForAdmin] = useState<DriverProfileDoc[]>([]);

  const [cart, setCart] = useState<MultiStopCartItem[]>([]);

  const [myOrders, setMyOrders] = useState<DeliveryOrderDoc[]>([]);
  const [dispatchOrders, setDispatchOrders] = useState<DeliveryOrderDoc[]>([]);
  const [captainAssignedOrders, setCaptainAssignedOrders] = useState<DeliveryOrderDoc[]>([]);
  const [merchantOrders, setMerchantOrders] = useState<DeliveryOrderDoc[]>([]);
  const [allOrdersAdmin, setAllOrdersAdmin] = useState<DeliveryOrderDoc[]>([]);

  const [myRides, setMyRides] = useState<PassengerRideDoc[]>([]);
  const [dispatchRides, setDispatchRides] = useState<PassengerRideDoc[]>([]);
  const [captainAssignedRides, setCaptainAssignedRides] = useState<PassengerRideDoc[]>([]);
  const [allRidesAdmin, setAllRidesAdmin] = useState<PassengerRideDoc[]>([]);

  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionDoc[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<ChatMessageDoc[]>([]);

  const isOwnerUser = Boolean(
    firebaseUser?.emailVerified &&
      (firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL.toLowerCase() ||
        userProfile?.role === 'owner')
  );

  // 1. Auth state subscription & initial user/welcome wallet provisioning
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const isBootstrappedOwner =
            user.emailVerified &&
            user.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL.toLowerCase();

          const initialProfile = {
            uid: user.uid,
            displayName: clampStr(user.displayName || 'مستخدم مشوار', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
            email: clampStr(user.email || 'user@mashwar.app', BLUEPRINT_LIMITS.EMAIL_MAX),
            role: (isBootstrappedOwner ? 'owner' : 'customer') as AppRole,
            defaultCityId: 'city_el_bagour',
            defaultLandmark: EL_BAGOUR_LANDMARKS[0].nameAr,
            cashbackBalancePiasters: BLUEPRINT_LIMITS.WELCOME_BONUS_PIASTERS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          await setDoc(userRef, initialProfile);

          // Record immutable welcome bonus ledger entry
          const welcomeTxId = `welcome_${user.uid}`;
          await setDoc(doc(db, 'users', user.uid, 'walletTransactions', welcomeTxId), {
            id: welcomeTxId,
            userId: user.uid,
            type: 'welcome_bonus',
            amountPiasters: BLUEPRINT_LIMITS.WELCOME_BONUS_PIASTERS,
            refId: user.uid,
            titleAr: 'مكافأة الترحيب بالانضمام لمشوار الباجور',
            createdAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Error initializing user profile:', err);
      } finally {
        setAuthReady(true);
      }
      void userPath;
    });

    return () => unsubAuth();
  }, []);

  // 2. Listen to authenticated user's profile & wallet ledger
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const userDocPath = `users/${firebaseUser.uid}`;
    const unsubUser = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserAccountDoc;
          setUserProfile(data);
          setSelectedCityId(data.defaultCityId || 'city_el_bagour');
          setSelectedLandmark(data.defaultLandmark || EL_BAGOUR_LANDMARKS[0].nameAr);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, userDocPath)
    );

    const txPath = `users/${firebaseUser.uid}/walletTransactions`;
    const unsubWallet = onSnapshot(
      query(collection(db, 'users', firebaseUser.uid, 'walletTransactions'), orderBy('createdAt', 'desc')),
      (snap) => {
        setWalletTransactions(snap.docs.map((d) => d.data() as WalletTransactionDoc));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, txPath)
    );

    return () => {
      unsubUser();
      unsubWallet();
    };
  }, [authReady, firebaseUser]);

  // 3. Seed El Bagour Catalog automatically when Owner connects & catalog is empty
  const seedElBagourCatalog = useCallback(async () => {
    if (!firebaseUser) return;
    const batch = writeBatch(db);
    for (const store of SEED_EL_BAGOUR_STORES) {
      batch.set(doc(db, 'stores', store.id), {
        ...store,
        ownerUid: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
    }
    for (const prod of SEED_EL_BAGOUR_PRODUCTS) {
      batch.set(doc(db, 'products', prod.id), {
        ...prod,
        ownerUid: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
    }
    for (const drv of SEED_VERIFIED_DRIVERS) {
      batch.set(doc(db, 'driverProfiles', drv.uid), {
        ...drv,
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'stores/seed');
    }
  }, [firebaseUser]);

  // 4. Listen to public marketplace stores, available products & verified drivers when signed in
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setLiveStores([]);
      setLiveProducts([]);
      setVerifiedDrivers([]);
      return;
    }

    const unsubStores = onSnapshot(
      collection(db, 'stores'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as StoreFrontDoc);
        setLiveStores(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'stores')
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('isAvailable', '==', true)),
      (snap) => {
        setLiveProducts(snap.docs.map((d) => d.data() as CatalogProductDoc));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'products')
    );

    const unsubDrivers = onSnapshot(
      query(collection(db, 'driverProfiles'), where('isVerified', '==', true)),
      (snap) => {
        setVerifiedDrivers(snap.docs.map((d) => d.data() as DriverProfileDoc));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'driverProfiles')
    );

    return () => {
      unsubStores();
      unsubProducts();
      unsubDrivers();
    };
  }, [authReady, firebaseUser]);

  // Auto-seed catalog once if owner signs in and Firestore stores is empty
  useEffect(() => {
    if (authReady && firebaseUser && isOwnerUser && liveStores.length === 0) {
      const timer = window.setTimeout(() => {
        void seedElBagourCatalog();
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [authReady, firebaseUser, isOwnerUser, liveStores.length, seedElBagourCatalog]);

  // 5. Listen to user's Orders & Rides (+ Captain / Merchant / Owner live queues)
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setMyOrders([]);
      setDispatchOrders([]);
      setCaptainAssignedOrders([]);
      setMerchantOrders([]);
      setAllOrdersAdmin([]);
      setMyRides([]);
      setDispatchRides([]);
      setCaptainAssignedRides([]);
      setAllRidesAdmin([]);
      return;
    }

    const uid = firebaseUser.uid;
    const unsubs: Array<() => void> = [];

    // Customer own orders
    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), where('customerId', '==', uid)),
        (snap) => {
          const sorted = snap.docs
            .map((d) => d.data() as DeliveryOrderDoc)
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setMyOrders(sorted);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders?customer')
      )
    );

    // Passenger own rides
    unsubs.push(
      onSnapshot(
        query(collection(db, 'rides'), where('passengerId', '==', uid)),
        (snap) => {
          const sorted = snap.docs
            .map((d) => d.data() as PassengerRideDoc)
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setMyRides(sorted);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'rides?passenger')
      )
    );

    // Open dispatch orders & rides + captain's own assigned orders & rides
    if (userProfile?.role === 'captain' || isOwnerUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('status', 'in', ['ready_for_pickup', 'searching_captain'])),
          (snap) => setDispatchOrders(snap.docs.map((d) => d.data() as DeliveryOrderDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders?dispatch')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('assignedCaptainId', '==', uid)),
          (snap) => {
            const sorted = snap.docs
              .map((d) => d.data() as DeliveryOrderDoc)
              .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setCaptainAssignedOrders(sorted);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders?captain')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'rides'), where('status', '==', 'searching_driver')),
          (snap) => setDispatchRides(snap.docs.map((d) => d.data() as PassengerRideDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'rides?dispatch')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'rides'), where('assignedDriverId', '==', uid)),
          (snap) => {
            const sorted = snap.docs
              .map((d) => d.data() as PassengerRideDoc)
              .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setCaptainAssignedRides(sorted);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'rides?driver')
        )
      );
    }

    // Merchant orders
    if (userProfile?.role === 'merchant' || isOwnerUser) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'orders'), where('merchantOwnerUid', '==', uid)),
          (snap) => setMerchantOrders(snap.docs.map((d) => d.data() as DeliveryOrderDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders?merchant')
        )
      );
    }

    // Owner full oversight queues
    if (isOwnerUser && firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL.toLowerCase()) {
      unsubs.push(
        onSnapshot(
          collection(db, 'orders'),
          (snap) => {
            const sorted = snap.docs
              .map((d) => d.data() as DeliveryOrderDoc)
              .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setAllOrdersAdmin(sorted);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders?admin')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'rides'),
          (snap) => {
            const sorted = snap.docs
              .map((d) => d.data() as PassengerRideDoc)
              .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setAllRidesAdmin(sorted);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'rides?admin')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'driverProfiles'),
          (snap) => setAllDriversForAdmin(snap.docs.map((d) => d.data() as DriverProfileDoc)),
          (err) => handleFirestoreError(err, OperationType.LIST, 'driverProfiles?admin')
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, firebaseUser, userProfile?.role, isOwnerUser]);

  // 6. Active Thread Real-Time Chat Listener
  useEffect(() => {
    if (!authReady || !firebaseUser || !activeThreadId) {
      setActiveThreadMessages([]);
      return;
    }

    const threadPath = `threads/${activeThreadId}/messages`;
    const unsubChat = onSnapshot(
      query(collection(db, 'threads', activeThreadId, 'messages'), orderBy('createdAt', 'asc')),
      (snap) => setActiveThreadMessages(snap.docs.map((d) => d.data() as ChatMessageDoc)),
      (err) => handleFirestoreError(err, OperationType.LIST, threadPath)
    );

    return () => unsubChat();
  }, [authReady, firebaseUser, activeThreadId]);

  const stores = liveStores.length > 0 ? liveStores : SEED_EL_BAGOUR_STORES;
  const products = liveProducts.length > 0 ? liveProducts : SEED_EL_BAGOUR_PRODUCTS;
  const effectiveVerifiedDrivers =
    verifiedDrivers.length > 0 ? verifiedDrivers : SEED_VERIFIED_DRIVERS;

  const isCatalogSeeded = liveStores.length > 0;

  const availableCashbackPiasters = useMemo(() => {
    if (walletTransactions.length === 0) {
      return userProfile?.cashbackBalancePiasters ?? 0;
    }
    return Math.max(
      0,
      walletTransactions.reduce((acc, tx) => {
        if (tx.type === 'cashback_redeem') return acc - tx.amountPiasters;
        return acc + tx.amountPiasters;
      }, 0)
    );
  }, [walletTransactions, userProfile?.cashbackBalancePiasters]);

  const signInWithGoogle = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول عبر جوجل.');
    } finally {
      setAuthBusy(false);
    }
  };

  const signOutUser = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setCart([]);
      setActiveThreadId(null);
    } finally {
      setAuthBusy(false);
    }
  };

  const updateLandmarkPreference = async (cityId: string, landmark: string) => {
    setSelectedCityId(cityId);
    setSelectedLandmark(landmark);
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        defaultCityId: sanitizeDocId(cityId).slice(0, BLUEPRINT_LIMITS.CITY_ID_MAX),
        defaultLandmark: clampStr(landmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  // Multi-stop cart controls (max 4 stops per blueprint)
  const addToCart = (product: CatalogProductDoc, store: StoreFrontDoc) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const uniqueStoreIds = new Set(prev.map((i) => i.store.id));
      if (!uniqueStoreIds.has(store.id) && uniqueStoreIds.size >= BLUEPRINT_LIMITS.MAX_ORDER_STOPS) {
        return prev;
      }
      return [...prev, { product, store, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  // Create Super-App Order (Multi-Stop + Scheduled + Voice Note + Cashback Redemption)
  const createSuperAppOrder: MashwarFirebaseContextValue['createSuperAppOrder'] = async (params) => {
    if (!firebaseUser) {
      throw new Error('يرجى تسجيل الدخول أولاً لإتمام الطلب.');
    }
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const orderNumber = `MSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const distanceKm = estimateLandmarkDistanceKm(params.pickupLandmark, params.dropoffLandmark);
    const isRural =
      params.pickupLandmark.includes('قرية') || params.dropoffLandmark.includes('قرية');

    const safeStoreNames = (params.storeNames.length > 0 ? params.storeNames : ['توصيل مشوار'])
      .slice(0, BLUEPRINT_LIMITS.MAX_ORDER_STOPS)
      .map((s) => clampStr(s, BLUEPRINT_LIMITS.STORE_NAME_MAX));

    const deliveryFeePiasters = calculateDeliveryFeePiasters({
      distanceKm,
      stopsCount: safeStoreNames.length,
      isRural,
    });

    const cashbackAppliedPiasters = Math.min(
      Math.max(0, Math.round(params.redeemCashbackPiasters)),
      availableCashbackPiasters,
      deliveryFeePiasters + params.subtotalPiasters
    );

    const totalFarePiasters = Math.max(
      0,
      params.subtotalPiasters + deliveryFeePiasters - cashbackAppliedPiasters
    );

    const initialStatus: OrderLifecycleStatus =
      params.serviceType === 'restaurant_store' ? 'created' : 'searching_captain';

    const docPayload = {
      id: orderId,
      orderNumber,
      customerId: firebaseUser.uid,
      customerName: clampStr(
        userProfile?.displayName || firebaseUser.displayName || 'عميل مشوار',
        BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
      ),
      ...(params.merchantOwnerUid
        ? { merchantOwnerUid: clampStr(params.merchantOwnerUid, BLUEPRINT_LIMITS.ID_MAX) }
        : {}),
      serviceType: params.serviceType,
      cityId: sanitizeDocId(selectedCityId).slice(0, BLUEPRINT_LIMITS.CITY_ID_MAX),
      storeNames: safeStoreNames,
      pickupLandmark: clampStr(params.pickupLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      dropoffLandmark: clampStr(params.dropoffLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      itemsSummary: clampStr(params.itemsSummary || 'طلب توصيل', BLUEPRINT_LIMITS.ITEMS_SUMMARY_MAX),
      isRural,
      scheduledFor: clampStr(params.scheduledFor || 'now', BLUEPRINT_LIMITS.SCHEDULED_FOR_MAX),
      hasVoiceNote: Boolean(params.hasVoiceNote),
      voiceNoteDurationSec: Math.max(
        0,
        Math.min(BLUEPRINT_LIMITS.VOICE_DURATION_MAX_SEC, Math.round(params.voiceNoteDurationSec))
      ),
      voiceNoteTranscript: clampStr(
        params.voiceNoteTranscript || '',
        BLUEPRINT_LIMITS.VOICE_TRANSCRIPT_MAX
      ),
      distanceKm,
      subtotalPiasters: Math.max(0, Math.round(params.subtotalPiasters)),
      deliveryFeePiasters,
      cashbackAppliedPiasters,
      totalFarePiasters,
      paymentMethod: params.paymentMethod,
      status: initialStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'orders', orderId), docPayload);
      if (cashbackAppliedPiasters > 0) {
        const redeemTxId = `redeem_${orderId}`;
        await setDoc(doc(db, 'users', firebaseUser.uid, 'walletTransactions', redeemTxId), {
          id: redeemTxId,
          userId: firebaseUser.uid,
          type: 'cashback_redeem',
          amountPiasters: cashbackAppliedPiasters,
          refId: orderId,
          titleAr: `خصم محفظة كاش باك على طلب #${orderNumber}`,
          createdAt: serverTimestamp(),
        });
      }
      setActiveThreadId(orderId);
      return docPayload as unknown as DeliveryOrderDoc;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
    }
  };

  // Book Verified Local TukTuk, Scooter, or Car Ride
  const bookVerifiedRide: MashwarFirebaseContextValue['bookVerifiedRide'] = async (params) => {
    if (!firebaseUser) {
      throw new Error('يرجى تسجيل الدخول أولاً لحجز مشوار.');
    }
    const rideId = `ride_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const rideNumber = `RDE-${Math.floor(1000 + Math.random() * 9000)}`;
    const distanceKm = estimateLandmarkDistanceKm(params.pickupLandmark, params.dropoffLandmark);
    const baseFare = calculateRideFarePiasters(params.vehicleTier, distanceKm);
    const cashbackAppliedPiasters = Math.min(
      Math.max(0, Math.round(params.redeemCashbackPiasters)),
      availableCashbackPiasters,
      Math.max(0, baseFare - 1000)
    );
    const estimatedFarePiasters = Math.max(1000, baseFare - cashbackAppliedPiasters);

    const ridePayload = {
      id: rideId,
      rideNumber,
      passengerId: firebaseUser.uid,
      passengerName: clampStr(
        userProfile?.displayName || firebaseUser.displayName || 'راكب مشوار',
        BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
      ),
      vehicleTier: params.vehicleTier,
      cityId: sanitizeDocId(selectedCityId).slice(0, BLUEPRINT_LIMITS.CITY_ID_MAX),
      pickupLandmark: clampStr(params.pickupLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      dropoffLandmark: clampStr(params.dropoffLandmark, BLUEPRINT_LIMITS.LANDMARK_MAX),
      distanceKm,
      estimatedFarePiasters,
      cashbackAppliedPiasters,
      paymentMethod: params.paymentMethod,
      status: 'searching_driver' as RideLifecycleStatus,
      safetySosTriggered: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'rides', rideId), ridePayload);
      if (cashbackAppliedPiasters > 0) {
        const redeemTxId = `redeem_${rideId}`;
        await setDoc(doc(db, 'users', firebaseUser.uid, 'walletTransactions', redeemTxId), {
          id: redeemTxId,
          userId: firebaseUser.uid,
          type: 'cashback_redeem',
          amountPiasters: cashbackAppliedPiasters,
          refId: rideId,
          titleAr: `خصم كاش باك على رحلة #${rideNumber}`,
          createdAt: serverTimestamp(),
        });
      }
      setActiveThreadId(rideId);
      return ridePayload as unknown as PassengerRideDoc;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rides/${rideId}`);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const cancelRide = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${rideId}`);
    }
  };

  const triggerRideSos = async (rideId: string) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        safetySosTriggered: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${rideId}`);
    }
  };

  const sendThreadMessage = async (
    threadId: string,
    role: 'customer' | 'captain' | 'merchant',
    text: string
  ) => {
    if (!firebaseUser) return;
    const trimmed = clampStr(text, BLUEPRINT_LIMITS.CHAT_TEXT_MAX);
    if (!trimmed) return;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'threads', threadId, 'messages', msgId), {
        id: msgId,
        senderUid: firebaseUser.uid,
        senderRole: role,
        senderName: clampStr(
          userProfile?.displayName || firebaseUser.displayName || 'مستخدم مشوار',
          BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
        ),
        text: trimmed,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `threads/${threadId}/messages/${msgId}`);
    }
  };

  const claimCompletedCashback = async (
    refId: string,
    kind: 'order' | 'ride',
    amountPiasters: number
  ) => {
    if (!firebaseUser) return;
    const txId = `cb_${sanitizeDocId(refId)}`;
    const boundedAmount = Math.max(100, Math.min(2500, Math.round(amountPiasters)));
    try {
      await setDoc(doc(db, 'users', firebaseUser.uid, 'walletTransactions', txId), {
        id: txId,
        userId: firebaseUser.uid,
        type: 'cashback_earn',
        amountPiasters: boundedAmount,
        refId: sanitizeDocId(refId),
        titleAr: kind === 'ride' ? 'كاش باك إتمام رحلة مشوار' : 'كاش باك إتمام طلب توصيل',
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.CREATE,
        `users/${firebaseUser.uid}/walletTransactions/${txId}`
      );
    }
  };

  const myDriverProfile = useMemo(
    () =>
      firebaseUser
        ? (allDriversForAdmin.find((d) => d.uid === firebaseUser.uid) ??
            verifiedDrivers.find((d) => d.uid === firebaseUser.uid) ??
            null)
        : null,
    [firebaseUser, allDriversForAdmin, verifiedDrivers]
  );

  const registerDriverProfile = async (params: {
    fullName: string;
    vehicleType: DriverVehicleType;
    plateLabel: string;
  }) => {
    if (!firebaseUser) return;
    try {
      await setDoc(doc(db, 'driverProfiles', firebaseUser.uid), {
        uid: firebaseUser.uid,
        fullName: clampStr(params.fullName, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        cityId: selectedCityId,
        vehicleType: params.vehicleType,
        plateLabel: clampStr(params.plateLabel, BLUEPRINT_LIMITS.PLATE_LABEL_MAX),
        isVerified: isOwnerUser ? true : false,
        isOnline: false,
        ratingAverage: 5,
        completedTrips: 0,
        currentLandmark: selectedLandmark,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `driverProfiles/${firebaseUser.uid}`);
    }
  };

  const toggleDriverOnline = async (isOnline: boolean) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'driverProfiles', firebaseUser.uid), {
        isOnline,
        currentLandmark: selectedLandmark,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `driverProfiles/${firebaseUser.uid}`);
    }
  };

  const claimDispatchOrder = async (orderId: string) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        assignedCaptainId: firebaseUser.uid,
        assignedCaptainName: clampStr(
          myDriverProfile?.fullName || userProfile?.displayName || 'كابتن مشوار',
          BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
        ),
        status: 'captain_assigned',
        updatedAt: serverTimestamp(),
      });
      setActiveThreadId(orderId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const advanceOrderStatus = async (orderId: string, nextStatus: OrderLifecycleStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const claimDispatchRide = async (rideId: string) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        assignedDriverId: firebaseUser.uid,
        assignedDriverName: clampStr(
          myDriverProfile?.fullName || userProfile?.displayName || 'كابتن مشوار',
          BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
        ),
        driverPlateLabel: clampStr(
          myDriverProfile?.plateLabel || 'م ن ٤٣٢١',
          BLUEPRINT_LIMITS.PLATE_LABEL_MAX
        ),
        status: 'driver_assigned',
        updatedAt: serverTimestamp(),
      });
      setActiveThreadId(rideId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${rideId}`);
    }
  };

  const advanceRideStatus = async (rideId: string, nextStatus: RideLifecycleStatus) => {
    try {
      await updateDoc(doc(db, 'rides', rideId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rides/${rideId}`);
    }
  };

  const merchantUpdateOrderStatus = async (orderId: string, nextStatus: OrderLifecycleStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const merchantToggleStoreOpen = async (storeId: string, isOpen: boolean) => {
    try {
      await updateDoc(doc(db, 'stores', storeId), {
        isOpen,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `stores/${storeId}`);
    }
  };

  const adminVerifyDriver = async (driverUid: string, isVerified: boolean) => {
    try {
      await updateDoc(doc(db, 'driverProfiles', driverUid), {
        isVerified,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `driverProfiles/${driverUid}`);
    }
  };

  const adminAssignUserRole = async (targetUid: string, role: AppRole) => {
    try {
      await updateDoc(doc(db, 'users', targetUid), {
        role,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  return (
    <MashwarFirebaseContext.Provider
      value={{
        authReady,
        firebaseUser,
        userProfile,
        isOwnerUser,
        isDarkMode,
        toggleDarkMode,
        selectedCityId,
        selectedLandmark,
        updateLandmarkPreference,
        signInWithGoogle,
        signOutUser,
        authBusy,
        authError,
        stores,
        products,
        verifiedDrivers,
        allDriversForAdmin,
        isCatalogSeeded,
        seedElBagourCatalog,
        cart,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        myOrders,
        dispatchOrders,
        captainAssignedOrders,
        merchantOrders,
        allOrdersAdmin,
        myRides,
        dispatchRides,
        captainAssignedRides,
        allRidesAdmin,
        activeThreadId,
        setActiveThreadId,
        activeThreadMessages,
        sendThreadMessage,
        walletTransactions,
        availableCashbackPiasters,
        claimCompletedCashback,
        createSuperAppOrder,
        bookVerifiedRide,
        cancelOrder,
        cancelRide,
        triggerRideSos,
        myDriverProfile,
        registerDriverProfile,
        toggleDriverOnline,
        claimDispatchOrder,
        advanceOrderStatus,
        claimDispatchRide,
        advanceRideStatus,
        merchantUpdateOrderStatus,
        merchantToggleStoreOpen,
        adminVerifyDriver,
        adminAssignUserRole,
      }}
    >
      {children}
    </MashwarFirebaseContext.Provider>
  );
};

export function useMashwarFirebase(): MashwarFirebaseContextValue {
  const ctx = useContext(MashwarFirebaseContext);
  if (!ctx) {
    throw new Error('useMashwarFirebase must be used inside MashwarFirebaseProvider');
  }
  return ctx;
}
