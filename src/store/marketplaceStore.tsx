import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Real generated assets
export const RESTAURANT_IMG = '/src/assets/images/mashwar_restaurant_grill_1792637801314.jpg';
export const PHARMACY_IMG = '/src/assets/images/mashwar_pharmacy_wellness_1792637802286.jpg';
export const SUPERMARKET_IMG = '/src/assets/images/mashwar_grocery_supermarket_1792637803087.jpg';

export type UserRole = 'customer' | 'captain' | 'merchant' | 'operations';

export interface DemoUser {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar: string;
  roleBadgeAr: string;
  merchantId?: string; // If role === 'merchant'
  vehicleInfo?: string; // If role === 'captain'
}

export interface StoreItem {
  id: string;
  nameAr: string;
  category: 'restaurant' | 'supermarket' | 'pharmacy' | 'other';
  categoryAr: string;
  ownerName: string;
  phone: string;
  address: string;
  distanceKm: number;
  rating: number;
  reviewsCount: number;
  deliveryTimeEst: string;
  minOrderEgp: number;
  isOpen: boolean;
  image: string;
  descriptionAr: string;
  subscriptionPlan: 'gold' | 'silver';
  commissionRate: number; // 0% flat invariant
}

export interface ProductItem {
  id: string;
  storeId: string;
  nameAr: string;
  descriptionAr: string;
  priceEgp: number;
  categoryName: string;
  isAvailable: boolean;
  unit: string;
}

export interface CartItem {
  product: ProductItem;
  quantity: number;
}

export type OrderStatus =
  | 'created' // Placed by customer, pending merchant acceptance
  | 'merchant_accepted' // Merchant is preparing the order
  | 'ready_for_pickup' // Merchant finished, waiting for captain dispatch
  | 'captain_assigned' // Captain accepted delivery
  | 'at_pickup' // Captain arrived at the merchant store
  | 'in_transit' // Captain picked up and is heading to customer
  | 'delivered' // Completed and cash collected
  | 'cancelled';

export interface MarketplaceOrder {
  id: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeAddress: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: Array<{
    productId: string;
    productName: string;
    unitPriceEgp: number;
    quantity: number;
  }>;
  subtotalEgp: number;
  deliveryFeeEgp: number;
  platformFeeEgp: number;
  totalEgp: number;
  paymentMethod: 'cash' | 'instapay' | 'vodafone_cash';
  status: OrderStatus;
  createdAt: string;
  createdAtDate: Date;
  notes?: string;
  assignedCaptainId?: string;
  assignedCaptainName?: string;
  assignedCaptainPhone?: string;
  cashCollected?: boolean;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  senderRole: 'customer' | 'captain';
  senderName: string;
  text: string;
  time: string;
}

// Pre-configured Demo Accounts
export const DEMO_PERSONAS: DemoUser[] = [
  {
    id: 'user_cust_01',
    name: 'أحمد مصطفى',
    phone: '01012345678',
    role: 'customer',
    avatar: '👨‍💼',
    roleBadgeAr: 'عميل (الباجور)',
  },
  {
    id: 'user_capt_01',
    name: 'محمود الصياد',
    phone: '01198765432',
    role: 'captain',
    avatar: '🛵',
    roleBadgeAr: 'كابتن معتمد (سكوتر)',
    vehicleInfo: 'سكوتر بينيلي أسود (٥٨٢٤ م ن و)',
  },
  {
    id: 'user_merch_basha',
    name: 'الحاج رأفت الباشا',
    phone: '01233445566',
    role: 'merchant',
    merchantId: 'merchant_basha',
    avatar: '👨‍🍳',
    roleBadgeAr: 'تاجر (مطعم ومشاوي الباشا)',
  },
  {
    id: 'user_merch_amana',
    name: 'د. سحر عبد الحميد',
    phone: '01044556677',
    role: 'merchant',
    merchantId: 'merchant_amana',
    avatar: '💊',
    roleBadgeAr: 'تاجر (صيدلية الأمانة)',
  },
  {
    id: 'user_merch_khairat',
    name: 'كمال النجار',
    phone: '01155667788',
    role: 'merchant',
    merchantId: 'merchant_khairat',
    avatar: '🛒',
    roleBadgeAr: 'تاجر (سوبرماركت الخيرات)',
  },
  {
    id: 'user_admin_01',
    name: 'أحمد المنوفي',
    phone: '01500000001',
    role: 'operations',
    avatar: '🛡️',
    roleBadgeAr: 'مدير عمليات الباجور',
  },
];

// Initial Stores Data
const INITIAL_STORES: StoreItem[] = [
  {
    id: 'merchant_basha',
    nameAr: 'مطعم ومشاوي الباشا',
    category: 'restaurant',
    categoryAr: 'مطاعم ومشويات',
    ownerName: 'الحاج رأفت الباشا',
    phone: '01233445566',
    address: 'شارع الجمهورية - أمام بنك مصر، الباجور',
    distanceKm: 1.2,
    rating: 4.85,
    reviewsCount: 312,
    deliveryTimeEst: '20-30 دقيقة',
    minOrderEgp: 40,
    isOpen: true,
    image: RESTAURANT_IMG,
    descriptionAr: 'مشويات طازجة على الفحم، كباب وكفتة بلدي، طواجن وحواوشي مخصوص على الطريقة المصرية الأصيلة.',
    subscriptionPlan: 'gold',
    commissionRate: 0,
  },
  {
    id: 'merchant_amana',
    nameAr: 'صيدلية الأمانة المركزية',
    category: 'pharmacy',
    categoryAr: 'صيدليات ومستلزمات',
    ownerName: 'د. سحر عبد الحميد',
    phone: '01044556677',
    address: 'ميدان المحطة - بجوار المستشفى العام، الباجور',
    distanceKm: 0.8,
    rating: 4.92,
    reviewsCount: 198,
    deliveryTimeEst: '10-20 دقيقة',
    minOrderEgp: 20,
    isOpen: true,
    image: PHARMACY_IMG,
    descriptionAr: 'خدمة دوائية على مدار الساعة، مستلزمات طبية، أجهزة قياس، مكملات غذائية وفيتامينات أصلية مصرحة.',
    subscriptionPlan: 'gold',
    commissionRate: 0,
  },
  {
    id: 'merchant_khairat',
    nameAr: 'سوبرماركت الخيرات والبركة',
    category: 'supermarket',
    categoryAr: 'سوبرماركت وبقالة',
    ownerName: 'كمال النجار',
    phone: '01155667788',
    address: 'شارع الجيش - برج الشروق، الباجور',
    distanceKm: 1.5,
    rating: 4.74,
    reviewsCount: 145,
    deliveryTimeEst: '15-25 دقيقة',
    minOrderEgp: 30,
    isOpen: true,
    image: SUPERMARKET_IMG,
    descriptionAr: 'كافة متطلبات المنزل، ألبان وأجبان طازجة يومياً، معلبات، زيوت، حبوب ومنظفات بأسعار الجملة.',
    subscriptionPlan: 'silver',
    commissionRate: 0,
  },
];

// Initial Products Catalog
const INITIAL_PRODUCTS: ProductItem[] = [
  // Merchant Basha (Grills)
  {
    id: 'prod_basha_01',
    storeId: 'merchant_basha',
    nameAr: 'طبق كباب وكفتة مشكل على الفحم (نصف كيلو)',
    descriptionAr: 'كفتة لحم بلدي متبلة مع كباب بتلو مشوي على الفحم، يقدم مع طحينة وعيش بلدي وسلطة بلدي خضراء.',
    priceEgp: 195,
    categoryName: 'مشويات الفحم',
    isAvailable: true,
    unit: 'طبق',
  },
  {
    id: 'prod_basha_02',
    storeId: 'merchant_basha',
    nameAr: 'وجبة ربع فرقة مشوية مع أرز وسلطات',
    descriptionAr: 'ربع دجاجة متبلة مشوية مع أرز بسمتي مصري، بطاطس محمرة، سلطة طحينة وخبز طازج.',
    priceEgp: 85,
    categoryName: 'وجبات فردية',
    isAvailable: true,
    unit: 'وجبة',
  },
  {
    id: 'prod_basha_03',
    storeId: 'merchant_basha',
    nameAr: 'حواوشي بلدي مخصوص بالجبنة الموزاريلا',
    descriptionAr: 'رغيف بلدي محشو باللحم المفروم المتبل مع خلطة الباشا والجبنة الموزاريلا السايحة.',
    priceEgp: 45,
    categoryName: 'ساندوتشات ومقبلات',
    isAvailable: true,
    unit: 'ساندوتش',
  },
  {
    id: 'prod_basha_04',
    storeId: 'merchant_basha',
    nameAr: 'طاجن لحمة بلدي بالبصل القاورما',
    descriptionAr: 'طاجن فخار بالفرن بقطع لحم الكندوز مع البصل المكرمل وصوص بهارات الشرق.',
    priceEgp: 140,
    categoryName: 'طواجن الفرن',
    isAvailable: true,
    unit: 'طاجن',
  },
  {
    id: 'prod_basha_05',
    storeId: 'merchant_basha',
    nameAr: 'لتر بيبسي عائلي مشبر',
    descriptionAr: 'مشروب غازي بارد منعش في عبوة بلاستيكية 1 لتر.',
    priceEgp: 25,
    categoryName: 'مشروبات باردة',
    isAvailable: true,
    unit: 'زجاجة',
  },

  // Merchant Amana (Pharmacy)
  {
    id: 'prod_amana_01',
    storeId: 'merchant_amana',
    nameAr: 'بنادول إكسترا أحمر (علبة ٢ شريط)',
    descriptionAr: 'مسكن للصداع والآلام وخافض للحرارة مع الكافيين لزيادة الفعالية.',
    priceEgp: 42,
    categoryName: 'أدوية ومسكنات',
    isAvailable: true,
    unit: 'علبة',
  },
  {
    id: 'prod_amana_02',
    storeId: 'merchant_amana',
    nameAr: 'فيتامين سي ١٠٠٠ ملغ فوار (أنابيب)',
    descriptionAr: 'أقراص فوارة بنكهة البرتقال الطبيعي لتعزيز المناعة ومقاومة نزلات البرد.',
    priceEgp: 65,
    categoryName: 'فيتامينات ومقويات',
    isAvailable: true,
    unit: 'أنبوبة',
  },
  {
    id: 'prod_amana_03',
    storeId: 'merchant_amana',
    nameAr: 'كمامات طبية ٣ طبقات دعامة أنف (علبة ٥٠ قطعة)',
    descriptionAr: 'كمامات طبية ثلاثية الطبقات معقمة بحلقات مطاطية مريحة ودعامة أنفية مرنة.',
    priceEgp: 50,
    categoryName: 'مستلزمات وقاية',
    isAvailable: true,
    unit: 'علبة',
  },
  {
    id: 'prod_amana_04',
    storeId: 'merchant_amana',
    nameAr: 'مقياس حرارة رقمي ديجيتال سريع',
    descriptionAr: 'ترمومتر رقمي دقيق لقياس درجة الحرارة مع شاشة LCD وتنبيه صوتي.',
    priceEgp: 95,
    categoryName: 'أجهزة طبية',
    isAvailable: true,
    unit: 'جهاز',
  },
  {
    id: 'prod_amana_05',
    storeId: 'merchant_amana',
    nameAr: 'كريم مرطب وملطف طبي بانثينول',
    descriptionAr: 'كريم مرطب طبي غني بفيتامين B5 لتجديد وترطيب البشرة وتلطيف الحروق البسيطة.',
    priceEgp: 35,
    categoryName: 'عناية وصحة',
    isAvailable: true,
    unit: 'أنبوبة',
  },

  // Merchant Khairat (Supermarket)
  {
    id: 'prod_khairat_01',
    storeId: 'merchant_khairat',
    nameAr: 'كرتونة بيض مزارع طازج (٣٠ بيضة)',
    descriptionAr: 'بيض مزارع أبيض طازج مفحوص ومغلف بعناية لضمان أعلى جودة.',
    priceEgp: 165,
    categoryName: 'ألبان وبيض',
    isAvailable: true,
    unit: 'كرتونة',
  },
  {
    id: 'prod_khairat_02',
    storeId: 'merchant_khairat',
    nameAr: 'جبن رومي مصري بطارخ قديم (ربع كيلو)',
    descriptionAr: 'جبن رومي بلدي معتق ذو نكهة قوية وجودة فاخرة، مقطع شرائح.',
    priceEgp: 90,
    categoryName: 'أجبان وبقالة',
    isAvailable: true,
    unit: '٢٥٠ جم',
  },
  {
    id: 'prod_khairat_03',
    storeId: 'merchant_khairat',
    nameAr: 'أرز مصري أبيض رفيع ممتاز (كيس ١ كجم)',
    descriptionAr: 'أرز مصري منقى ومغسول ومعبأ آلياً خالي من الشوائب والكسر.',
    priceEgp: 32,
    categoryName: 'حبوب وتموين',
    isAvailable: true,
    unit: 'كيس',
  },
  {
    id: 'prod_khairat_04',
    storeId: 'merchant_khairat',
    nameAr: 'زيت دوار الشمس عافية نقي (عبوة ٨٠٠ مل)',
    descriptionAr: 'زيت دوار شمس صافي مكرر خفيف على المعدة ومثالي للطهي والقلي الخفيف.',
    priceEgp: 78,
    categoryName: 'زيوت ومواد طهي',
    isAvailable: true,
    unit: 'زجاجة',
  },
  {
    id: 'prod_khairat_05',
    storeId: 'merchant_khairat',
    nameAr: 'حليب كامل الدسم مبستر طبيعي (١ لتر)',
    descriptionAr: 'لبن حليب طبيعي معقم طويل الأجل، غني بالكالسيوم والفيتامينات.',
    priceEgp: 44,
    categoryName: 'ألبان وبيض',
    isAvailable: true,
    unit: 'عبوة',
  },
];

// Initial Seed Orders
const INITIAL_ORDERS: MarketplaceOrder[] = [
  {
    id: 'ord_init_01',
    orderNumber: 'MSH-9401',
    storeId: 'merchant_basha',
    storeName: 'مطعم ومشاوي الباشا',
    storeAddress: 'شارع الجمهورية - أمام بنك مصر، الباجور',
    customerId: 'user_cust_01',
    customerName: 'أحمد مصطفى',
    customerPhone: '01012345678',
    deliveryAddress: 'شارع الجيش - برج الشروق، الباجور',
    items: [
      {
        productId: 'prod_basha_02',
        productName: 'وجبة ربع فرقة مشوية مع أرز وسلطات',
        unitPriceEgp: 85,
        quantity: 1,
      },
      {
        productId: 'prod_basha_03',
        productName: 'حواوشي بلدي مخصوص بالجبنة الموزاريلا',
        unitPriceEgp: 45,
        quantity: 2,
      },
    ],
    subtotalEgp: 175,
    deliveryFeeEgp: 15,
    platformFeeEgp: 2,
    totalEgp: 192,
    paymentMethod: 'cash',
    status: 'created',
    createdAt: 'منذ 5 دقائق',
    createdAtDate: new Date(Date.now() - 5 * 60 * 1000),
    notes: 'يرجى زيادة سلطة الطحينة والخبز سخن',
  },
];

interface MarketplaceContextType {
  // Authentication & Persona state
  currentUser: DemoUser;
  switchDemoUser: (user: DemoUser) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;

  // Stores & Catalog
  stores: StoreItem[];
  toggleStoreStatus: (storeId: string) => void;
  products: ProductItem[];
  toggleProductAvailability: (productId: string) => void;
  updateProductPrice: (productId: string, newPriceEgp: number) => void;

  // Single-Store Cart
  cartItems: CartItem[];
  cartStoreId: string | null;
  addToCart: (product: ProductItem, store: StoreItem) => { success: boolean; conflictStore?: string };
  removeFromCart: (productId: string) => void;
  updateCartItemQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  forceAddToCartNewStore: (product: ProductItem, store: StoreItem) => void;
  cartSubtotalEgp: number;
  cartDeliveryFeeEgp: number;
  cartPlatformFeeEgp: number;
  cartTotalEgp: number;

  // Orders Management & Synchronized Flow
  orders: MarketplaceOrder[];
  submitNewOrder: (params: {
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash';
    notes?: string;
  }) => MarketplaceOrder | null;
  merchantAcceptOrder: (orderId: string) => void;
  merchantMarkReady: (orderId: string) => void;
  merchantRejectOrder: (orderId: string, reason?: string) => void;
  captainAcceptDelivery: (orderId: string) => void;
  captainUpdateStep: (orderId: string, step: 'at_pickup' | 'in_transit' | 'delivered') => void;
  captainConfirmCashCollection: (orderId: string) => void;

  // Captain Specific State
  isCaptainOnline: boolean;
  setIsCaptainOnline: (online: boolean) => void;
  captainEarningsEgp: number;
  captainCompletedDeliveries: number;
  captainCashHoldingEgp: number;

  // Chat Simulation
  chatMessages: ChatMessage[];
  sendChatMessage: (orderId: string, text: string) => void;

  // View Helpers
  activeCustomerOrder: MarketplaceOrder | null;
  activeCaptainOrder: MarketplaceOrder | null;
  selectedStoreForBrowsing: StoreItem | null;
  setSelectedStoreForBrowsing: (store: StoreItem | null) => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Current logged in demo persona
  const [currentUser, setCurrentUser] = useState<DemoUser>(DEMO_PERSONAS[0]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Stores
  const [stores, setStores] = useState<StoreItem[]>(INITIAL_STORES);
  const [selectedStoreForBrowsing, setSelectedStoreForBrowsing] = useState<StoreItem | null>(null);

  // Products
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);

  // Cart (Strict Single-Store Enforcement)
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartStoreId, setCartStoreId] = useState<string | null>(null);

  // Orders
  const [orders, setOrders] = useState<MarketplaceOrder[]>(INITIAL_ORDERS);

  // Captain stats
  const [isCaptainOnline, setIsCaptainOnline] = useState<boolean>(true);
  const [captainEarningsEgp, setCaptainEarningsEgp] = useState<number>(340);
  const [captainCompletedDeliveries, setCaptainCompletedDeliveries] = useState<number>(7);
  const [captainCashHoldingEgp, setCaptainCashHoldingEgp] = useState<number>(510);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_01',
      orderId: 'ord_init_01',
      senderRole: 'captain',
      senderName: 'محمود الصياد',
      text: 'مساء الخير، أنا في طريقي لاستلام الطلب من المطعم.',
      time: '10:40 ص',
    },
    {
      id: 'msg_02',
      orderId: 'ord_init_01',
      senderRole: 'customer',
      senderName: 'أحمد مصطفى',
      text: 'أهلاً يا كابتن، في انتظارك عند مدخل برج الشروق.',
      time: '10:41 ص',
    },
  ]);

  // Switch persona
  const switchDemoUser = (user: DemoUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
  };

  // Toggle store open/closed
  const toggleStoreStatus = (storeId: string) => {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, isOpen: !s.isOpen } : s))
    );
  };

  // Product availability
  const toggleProductAvailability = (productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isAvailable: !p.isAvailable } : p))
    );
  };

  // Product price update
  const updateProductPrice = (productId: string, newPriceEgp: number) => {
    if (newPriceEgp <= 0) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, priceEgp: newPriceEgp } : p))
    );
  };

  // Cart operations
  const addToCart = (product: ProductItem, store: StoreItem) => {
    if (cartStoreId && cartStoreId !== store.id && cartItems.length > 0) {
      const currentStore = stores.find((s) => s.id === cartStoreId);
      return { success: false, conflictStore: currentStore?.nameAr || 'متجر آخر' };
    }

    setCartStoreId(store.id);
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });

    return { success: true };
  };

  const forceAddToCartNewStore = (product: ProductItem, store: StoreItem) => {
    setCartStoreId(store.id);
    setCartItems([{ product, quantity: 1 }]);
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => {
      const next = prev.filter((item) => item.product.id !== productId);
      if (next.length === 0) setCartStoreId(null);
      return next;
    });
  };

  const updateCartItemQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: qty } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setCartStoreId(null);
  };

  const cartSubtotalEgp = cartItems.reduce(
    (sum, item) => sum + item.product.priceEgp * item.quantity,
    0
  );
  const cartDeliveryFeeEgp = cartItems.length > 0 ? 15 : 0;
  const cartPlatformFeeEgp = cartItems.length > 0 ? 2 : 0;
  const cartTotalEgp = cartSubtotalEgp + cartDeliveryFeeEgp + cartPlatformFeeEgp;

  // Submit Order from Customer (Requests authoritative quote from /api/v1/quotes in background)
  const submitNewOrder = (params: {
    deliveryAddress: string;
    paymentMethod: 'cash' | 'instapay' | 'vodafone_cash';
    notes?: string;
  }): MarketplaceOrder | null => {
    if (cartItems.length === 0 || !cartStoreId) return null;
    const store = stores.find((s) => s.id === cartStoreId);
    if (!store) return null;

    const orderNum = `MSH-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder: MarketplaceOrder = {
      id: `ord_${Date.now()}`,
      orderNumber: orderNum,
      storeId: store.id,
      storeName: store.nameAr,
      storeAddress: store.address,
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      deliveryAddress: params.deliveryAddress || 'شارع الجيش - برج الشروق، الباجور',
      items: cartItems.map((ci) => ({
        productId: ci.product.id,
        productName: ci.product.nameAr,
        unitPriceEgp: ci.product.priceEgp,
        quantity: ci.quantity,
      })),
      subtotalEgp: cartSubtotalEgp,
      deliveryFeeEgp: cartDeliveryFeeEgp,
      platformFeeEgp: cartPlatformFeeEgp,
      totalEgp: cartTotalEgp,
      paymentMethod: params.paymentMethod,
      status: 'created',
      createdAt: 'الآن',
      createdAtDate: new Date(),
      notes: params.notes || '',
    };

    // Trigger real backend quote verification against /api/v1/quotes
    fetch('/api/v1/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceTypeId: 'restaurant_store',
        distanceKm: store.distanceKm || 1.5,
        zoneId: 'zone_bagour_center',
        itemsSubtotalPiasters: Math.round(cartSubtotalEgp * 100),
        pickupLandmark: store.address,
        dropoffLandmark: params.deliveryAddress,
      }),
    }).catch(() => {
      // Non-blocking fallback if offline
    });

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();
    return newOrder;
  };

  // Merchant actions
  const merchantAcceptOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'merchant_accepted' } : o))
    );
  };

  const merchantMarkReady = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'ready_for_pickup' } : o))
    );
  };

  const merchantRejectOrder = (orderId: string, reason?: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'cancelled', notes: reason ? `[مرفوض من المتجر: ${reason}]` : '[مرفوض من المتجر]' }
          : o
      )
    );
  };

  // Captain actions
  const captainAcceptDelivery = (orderId: string) => {
    const captainUser = DEMO_PERSONAS.find((p) => p.role === 'captain');
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'captain_assigned',
              assignedCaptainId: captainUser?.id || 'user_capt_01',
              assignedCaptainName: captainUser?.name || 'محمود الصياد',
              assignedCaptainPhone: captainUser?.phone || '01198765432',
            }
          : o
      )
    );
  };

  const captainUpdateStep = (orderId: string, step: 'at_pickup' | 'in_transit' | 'delivered') => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          if (step === 'delivered') {
            setCaptainEarningsEgp((e) => e + o.deliveryFeeEgp);
            setCaptainCompletedDeliveries((c) => c + 1);
            if (o.paymentMethod === 'cash') {
              setCaptainCashHoldingEgp((h) => h + o.totalEgp);
            }
            return { ...o, status: 'delivered', cashCollected: true };
          }
          return { ...o, status: step };
        }
        return o;
      })
    );
  };

  const captainConfirmCashCollection = (orderId: string) => {
    captainUpdateStep(orderId, 'delivered');
  };

  // Chat
  const sendChatMessage = (orderId: string, text: string) => {
    if (!text.trim()) return;
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      orderId,
      senderRole: currentUser.role === 'captain' ? 'captain' : 'customer',
      senderName: currentUser.name,
      text: text.trim(),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, newMsg]);

    // Simulated reply from the opposite party after 1.5 seconds if sent by customer
    if (currentUser.role === 'customer') {
      setTimeout(() => {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `msg_reply_${Date.now()}`,
            orderId,
            senderRole: 'captain',
            senderName: 'محمود الصياد',
            text: 'تمام يا فندم، الطلب معايا وفي الطريق إليك حالياً.',
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }, 1500);
    }
  };

  // Find active orders
  const activeCustomerOrder =
    orders.find(
      (o) =>
        o.customerId === currentUser.id &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    ) || null;

  const activeCaptainOrder =
    orders.find(
      (o) =>
        (o.assignedCaptainId === currentUser.id ||
          (currentUser.role === 'captain' && o.status === 'ready_for_pickup')) &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled'
    ) || null;

  return (
    <MarketplaceContext.Provider
      value={{
        currentUser,
        switchDemoUser,
        isAuthModalOpen,
        setIsAuthModalOpen,
        stores,
        toggleStoreStatus,
        products,
        toggleProductAvailability,
        updateProductPrice,
        cartItems,
        cartStoreId,
        addToCart,
        removeFromCart,
        updateCartItemQty,
        clearCart,
        forceAddToCartNewStore,
        cartSubtotalEgp,
        cartDeliveryFeeEgp,
        cartPlatformFeeEgp,
        cartTotalEgp,
        orders,
        submitNewOrder,
        merchantAcceptOrder,
        merchantMarkReady,
        merchantRejectOrder,
        captainAcceptDelivery,
        captainUpdateStep,
        captainConfirmCashCollection,
        isCaptainOnline,
        setIsCaptainOnline,
        captainEarningsEgp,
        captainCompletedDeliveries,
        captainCashHoldingEgp,
        chatMessages,
        sendChatMessage,
        activeCustomerOrder,
        activeCaptainOrder,
        selectedStoreForBrowsing,
        setSelectedStoreForBrowsing,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = (): MarketplaceContextType => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};
