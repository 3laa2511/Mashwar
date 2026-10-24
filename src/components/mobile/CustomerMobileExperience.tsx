import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Bike,
  Car,
  Package,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  ChevronLeft,
  Navigation,
  Phone,
  MessageSquare,
  Star,
  CheckCircle2,
  Wallet,
  Banknote,
  Send,
  X,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Store,
  Layers,
  Info
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import {
  useMarketplace,
  StoreItem,
  ProductItem,
  MarketplaceOrder
} from '../../store/marketplaceStore';

interface CustomerMobileExperienceProps {
  onSwitchToCaptain?: () => void;
  onOpenAuthModal?: () => void;
}

export const CustomerMobileExperience: React.FC<CustomerMobileExperienceProps> = ({
  onSwitchToCaptain,
  onOpenAuthModal,
}) => {
  const {
    currentUser,
    stores,
    products,
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
    activeCustomerOrder,
    chatMessages,
    sendChatMessage,
    customerWalletBalancePiasters,
    customerWalletBalanceEgp,
    customerWalletTransactions,
    topUpCustomerWallet,
    setIsAuthModalOpen,
  } = useMarketplace();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'home' | 'stores' | 'history' | 'profile'>('home');

  // Browsing & Store Views
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<'all' | 'restaurant' | 'pharmacy' | 'supermarket'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart / Checkout Drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('شارع الجيش - برج الشروق، الباجور');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'vodafone_cash'>('cash');
  const [orderNotes, setOrderNotes] = useState('');

  // Conflict modal state when trying to add from another store
  const [conflictModal, setConflictModal] = useState<{
    show: boolean;
    pendingProduct?: ProductItem;
    pendingStore?: StoreItem;
    currentStoreName?: string;
  }>({ show: false });

  // Chat modal state
  const [showChatModal, setShowChatModal] = useState(false);
  const [inputChatText, setInputChatText] = useState('');

  // Wallet filter & top-up feedback state in Profile
  const [walletFilter, setWalletFilter] = useState<'all' | 'credit' | 'debit'>('all');
  const [topUpSuccessText, setTopUpSuccessText] = useState<string | null>(null);

  const handleQuickTopUp = (amountEgp: number, channelAr: string) => {
    topUpCustomerWallet(amountEgp, channelAr);
    setTopUpSuccessText(`تم شحن +${amountEgp}.00 ج.م في محفظتك بنجاح`);
    setTimeout(() => setTopUpSuccessText(null), 3000);
  };

  // Filtered stores
  const filteredStores = stores.filter((s) => {
    const matchCategory =
      storeCategoryFilter === 'all' || s.category === storeCategoryFilter;
    const matchSearch =
      s.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.categoryAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Current store in cart
  const currentCartStore = stores.find((s) => s.id === cartStoreId);

  // Handle Add to cart with single-store rule
  const handleAddProduct = (prod: ProductItem, store: StoreItem) => {
    const res = addToCart(prod, store);
    if (!res.success) {
      setConflictModal({
        show: true,
        pendingProduct: prod,
        pendingStore: store,
        currentStoreName: res.conflictStore,
      });
    }
  };

  const handleConfirmSwitchStore = () => {
    if (conflictModal.pendingProduct && conflictModal.pendingStore) {
      forceAddToCartNewStore(conflictModal.pendingProduct, conflictModal.pendingStore);
    }
    setConflictModal({ show: false });
  };

  // Handle Checkout submission
  const handlePlaceOrder = () => {
    const newOrd = submitNewOrder({
      deliveryAddress,
      paymentMethod,
      notes: orderNotes,
    });
    if (newOrd) {
      setIsCartOpen(false);
      setSelectedStore(null);
      setActiveTab('home');
    }
  };

  // Handle send message in chat
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChatText.trim() || !activeCustomerOrder) return;
    sendChatMessage(activeCustomerOrder.id, inputChatText);
    setInputChatText('');
  };

  // Products belonging to the selected store
  const storeProducts = selectedStore
    ? products.filter((p) => p.storeId === selectedStore.id)
    : [];

  // Customer's orders
  const customerOrders = orders.filter((o) => o.customerId === currentUser.id);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile App Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shadow-xs shadow-emerald-700/20">
            م
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">مشوار</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                العميل: {currentUser.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span className="truncate max-w-[140px]">الباجور • برج الشروق</span>
            </div>
          </div>
        </div>

        {/* Action Controls: Cart Trigger & Account Switcher */}
        <div className="flex items-center gap-2">
          {/* Cart Icon Button with Quantity Badge */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center justify-center transition-colors"
            title="سلة المشتريات"
          >
            <ShoppingBag className="w-4 h-4" />
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center ring-2 ring-white">
                {cartItems.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            )}
          </button>

          {/* Demo Auth Switcher Trigger */}
          <button
            onClick={() => {
              if (onOpenAuthModal) onOpenAuthModal();
              else setIsAuthModalOpen(true);
            }}
            className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow-2xs"
            title="تبديل الحساب التجريبي"
          >
            <span className="text-xs">🔄</span>
            <span>تبديل</span>
          </button>
        </div>
      </div>

      {/* Main Dynamic Viewport */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* ========================================================
            TAB 1: HOME (Map + Active Order / Nearby Highlights)
           ======================================================== */}
        {activeTab === 'home' && !selectedStore && (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* Map Canvas Background */}
            <div className="absolute inset-0 z-0">
              <EgyptianMapCanvas
                mode="customer"
                pickupText={activeCustomerOrder ? activeCustomerOrder.storeAddress : 'ميدان المحطة - وسط الباجور'}
                dropoffText={activeCustomerOrder ? activeCustomerOrder.deliveryAddress : 'شارع الجيش - برج الشروق'}
                showRoute={Boolean(activeCustomerOrder)}
              />
            </div>

            {/* If there is an active order in progress: show Live Tracking Sheet */}
            {activeCustomerOrder ? (
              <div className="relative z-10 mt-auto bg-white rounded-t-3xl p-4 shadow-2xl border-t border-slate-100 flex flex-col gap-3 max-h-[88%] overflow-y-auto">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

                {/* Status Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                    <span className="font-extrabold text-sm text-slate-900">
                      {activeCustomerOrder.status === 'created' && 'تم إرسال الطلب للمتجر • بانتظار الموافقة'}
                      {activeCustomerOrder.status === 'merchant_accepted' && 'المتجر يجهز طلبك الآن 🍳'}
                      {activeCustomerOrder.status === 'ready_for_pickup' && 'الطلب جاهز • بانتظار وصول الكابتن'}
                      {activeCustomerOrder.status === 'captain_assigned' && 'تم تعيين الكابتن • في الطريق للمتجر'}
                      {activeCustomerOrder.status === 'at_pickup' && 'الكابتن وصل للمتجر لاستلام الطلب'}
                      {activeCustomerOrder.status === 'in_transit' && 'الكابتن في الطريق إليك 🛵'}
                      {activeCustomerOrder.status === 'delivered' && 'تم توصيل الطلب بنجاح!'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {activeCustomerOrder.orderNumber}
                  </span>
                </div>

                {/* Progress Stepper */}
                <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                  <div
                    className={`p-1.5 rounded-lg ${
                      ['created', 'merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    تم الإرسال
                  </div>
                  <div
                    className={`p-1.5 rounded-lg ${
                      ['merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    تجهيز المتجر
                  </div>
                  <div
                    className={`p-1.5 rounded-lg ${
                      ['ready_for_pickup', 'captain_assigned', 'at_pickup', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    استلام الكابتن
                  </div>
                  <div
                    className={`p-1.5 rounded-lg ${
                      activeCustomerOrder.status === 'delivered'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    تم التسليم
                  </div>
                </div>

                {/* Store and Items Card */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{activeCustomerOrder.storeName}</span>
                    </span>
                    <span className="font-black text-slate-900">{activeCustomerOrder.totalEgp}.00 ج.م</span>
                  </div>

                  <div className="space-y-1 text-slate-600">
                    {activeCustomerOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span>{item.quantity}× {item.productName}</span>
                        <span className="font-bold">{item.unitPriceEgp * item.quantity} ج.م</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>التوصيل إلى: {activeCustomerOrder.deliveryAddress}</span>
                    <span className="font-bold text-amber-800">
                      الدفع: {activeCustomerOrder.paymentMethod === 'cash' ? 'كاش عند الاستلام' : 'إلكتروني'}
                    </span>
                  </div>
                </div>

                {/* Captain Card if Assigned */}
                {activeCustomerOrder.assignedCaptainName && (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-base shadow-xs">
                        🛵
                      </div>
                      <div>
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                          <span>{activeCustomerOrder.assignedCaptainName}</span>
                          <span className="text-[10px] text-amber-600 font-bold">★ 4.92</span>
                        </div>
                        <div className="text-[10px] text-slate-500">سكوتر بينيلي أسود (الباجور)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setShowChatModal(true)}
                        className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs hover:bg-emerald-800"
                        title="محادثة الكابتن"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href="tel:01198765432"
                        onClick={(e) => e.preventDefault()}
                        className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs hover:bg-black"
                        title="اتصال بالكابتن"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Role Switcher Hint for Tester */}
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>سيناريو التدفق التجريبي المتزامن:</strong>
                    <p className="mt-0.5">
                      قم بالتبديل إلى دور <button onClick={() => setIsAuthModalOpen(true)} className="font-extrabold underline text-emerald-800">التاجر ({activeCustomerOrder.storeName})</button> لقبول الطلب وتجهيزه، أو إلى <button onClick={() => setIsAuthModalOpen(true)} className="font-extrabold underline text-emerald-800">الكابتن (محمود الصياد)</button> لاستلام الطلب وتوصيله. ستتحدث هذه الشاشة تلقائياً!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* If no active order: show Quick Order & Nearby Stores Bottom Sheet */
              <div className="relative z-10 mt-auto p-4 flex flex-col gap-3">
                {/* Search Bar / Quick Navigation */}
                <div className="bg-white rounded-2xl p-3.5 shadow-xl border border-slate-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">متاجر وخدمات مركز الباجور</span>
                    <button
                      onClick={() => setActiveTab('stores')}
                      className="text-[11px] font-extrabold text-emerald-700 hover:underline flex items-center gap-1"
                    >
                      <span>تصفح الكل ({stores.length})</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Horizontal Stores Carousel */}
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        onClick={() => setSelectedStore(store)}
                        className="shrink-0 w-44 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-2.5 border border-slate-200/80 cursor-pointer transition-all group"
                      >
                        <div className="w-full h-20 rounded-lg overflow-hidden mb-2 bg-slate-200 relative">
                          <img
                            src={store.image}
                            alt={store.nameAr}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-white/95 text-slate-800 shadow-2xs">
                            {store.deliveryTimeEst}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-slate-900 truncate">{store.nameAr}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between">
                          <span>{store.categoryAr}</span>
                          <span className="text-amber-600 font-bold flex items-center gap-0.5">
                            ★ {store.rating}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: STORES BROWSER & MARKETPLACE
           ======================================================== */}
        {(activeTab === 'stores' || selectedStore) && (
          <div className="flex-1 w-full h-full flex flex-col overflow-y-auto bg-[#FAFAF9]">
            {selectedStore ? (
              /* STORE DETAIL VIEW WITH PRODUCT MENU */
              <div className="flex-1 flex flex-col pb-24">
                {/* Store Header Banner */}
                <div className="relative w-full h-44 bg-slate-800 shrink-0">
                  <img
                    src={selectedStore.image}
                    alt={selectedStore.nameAr}
                    className="w-full h-full object-cover opacity-90"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  {/* Back button */}
                  <button
                    onClick={() => setSelectedStore(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-800 flex items-center justify-center shadow-md z-10"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* Store Info Overlay */}
                  <div className="absolute bottom-3 right-3 left-3 text-white">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-black tracking-tight">{selectedStore.nameAr}</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                        {selectedStore.isOpen ? 'مفتوح للطلبات' : 'مغلق'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-200 mt-0.5 flex items-center gap-3">
                      <span>{selectedStore.categoryAr}</span>
                      <span>•</span>
                      <span>{selectedStore.deliveryTimeEst}</span>
                      <span>•</span>
                      <span className="text-amber-300 font-bold">★ {selectedStore.rating} ({selectedStore.reviewsCount})</span>
                    </div>
                  </div>
                </div>

                {/* Single Store Policy Banner */}
                <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-900">
                  <span className="font-semibold">سلة الطلب مخصصة لهذا المتجر فقط</span>
                  <span className="font-bold text-emerald-800">توصيل الباجور ١٥ ج.م</span>
                </div>

                {/* Product Catalog */}
                <div className="p-4 flex flex-col gap-3">
                  <h3 className="font-extrabold text-sm text-slate-900">قائمة الأصناف والمنتجات</h3>

                  <div className="flex flex-col gap-2.5">
                    {storeProducts.map((prod) => {
                      const inCart = cartItems.find((ci) => ci.product.id === prod.id);
                      return (
                        <div
                          key={prod.id}
                          className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-900">{prod.nameAr}</span>
                              {!prod.isAvailable && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700">
                                  غير متوفر
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">
                              {prod.descriptionAr}
                            </p>
                            <div className="text-xs font-black text-emerald-800 mt-1">
                              {prod.priceEgp}.00 ج.م <span className="text-[10px] text-slate-400 font-normal">/ {prod.unit}</span>
                            </div>
                          </div>

                          {/* Add to cart / Quantity controls */}
                          <div className="shrink-0">
                            {!prod.isAvailable ? (
                              <button
                                disabled
                                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed"
                              >
                                نفد
                              </button>
                            ) : inCart ? (
                              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl p-1 border border-emerald-200">
                                <button
                                  onClick={() => updateCartItemQty(prod.id, inCart.quantity - 1)}
                                  className="w-6 h-6 rounded-lg bg-white text-emerald-800 flex items-center justify-center font-bold shadow-2xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-black text-emerald-900 px-1">
                                  {inCart.quantity}
                                </span>
                                <button
                                  onClick={() => handleAddProduct(prod, selectedStore)}
                                  className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shadow-2xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddProduct(prod, selectedStore)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm shadow-emerald-700/20 transition-all flex items-center gap-1 active:scale-95"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>إضافة</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Sticky Bottom Cart Bar for this store */}
                {cartItems.length > 0 && (
                  <div className="fixed bottom-12 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl flex items-center justify-between z-30 max-w-[400px] mx-auto">
                    <div>
                      <div className="text-[10px] text-slate-500 font-semibold">
                        السلة ({currentCartStore?.nameAr})
                      </div>
                      <div className="text-sm font-black text-slate-900">
                        {cartTotalEgp}.00 ج.م
                        <span className="text-[10px] text-slate-400 font-normal mr-1">
                          ({cartItems.reduce((s, i) => s + i.quantity, 0)} أصناف)
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="py-2 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>إتمام الطلب</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* STORES DIRECTORY WITH CATEGORY TABS */
              <div className="flex-1 p-4 flex flex-col gap-3.5">
                <div>
                  <h2 className="font-extrabold text-base text-slate-900">متاجر ومطاعم الباجور</h2>
                  <p className="text-xs text-slate-500">اطلب من أي متجر محلي مع توصيل كباتن مشوار الفوري</p>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن متجر، مطعم، صيدلية..."
                    className="w-full py-2.5 pr-9 pl-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Category Filter Pills (Functional Buttons) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    onClick={() => setStoreCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      storeCategoryFilter === 'all'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('restaurant')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      storeCategoryFilter === 'restaurant'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    مطاعم ومأكولات
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('pharmacy')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      storeCategoryFilter === 'pharmacy'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    صيدليات وأدوية
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('supermarket')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                      storeCategoryFilter === 'supermarket'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    سوبرماركت وبقالة
                  </button>
                </div>

                {/* Stores List */}
                <div className="flex flex-col gap-3">
                  {filteredStores.map((store) => (
                    <div
                      key={store.id}
                      onClick={() => setSelectedStore(store)}
                      className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs hover:shadow-md cursor-pointer transition-all flex items-center gap-3 group"
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative">
                        <img
                          src={store.image}
                          alt={store.nameAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-xs text-slate-900 truncate group-hover:text-emerald-800">
                            {store.nameAr}
                          </h3>
                          <span className="text-[10px] font-bold text-amber-600 flex items-center">
                            ★ {store.rating}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-0.5">{store.categoryAr}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">{store.address}</div>

                        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold text-slate-600">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-700" />
                            {store.deliveryTimeEst}
                          </span>
                          <span>•</span>
                          <span>{store.distanceKm} كم</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">توصيل فوري</span>
                        </div>
                      </div>

                      <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: ORDER HISTORY
           ======================================================== */}
        {activeTab === 'history' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">سجل طلبات العميل</h2>
            {customerOrders.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">
                لا توجد طلبات سابقة مسجلة لهذا الحساب حالياً.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {customerOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">{ord.orderNumber} • {ord.storeName}</span>
                      <span className="font-black text-slate-900">{ord.totalEgp}.00 ج.م</span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{ord.createdAt}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {ord.status === 'delivered' ? 'مكتمل بنجاح' : ord.status === 'cancelled' ? 'ملغي' : 'قيد التنفيذ'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-700 border-t border-slate-100 pt-1.5 space-y-0.5">
                      {ord.items.map((i, idx) => (
                        <div key={idx} className="truncate">
                          {i.quantity}× {i.productName}
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span>التسليم: {ord.deliveryAddress}</span>
                      {ord.assignedCaptainName && <span>الكابتن: {ord.assignedCaptainName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 4: PROFILE & CUSTOMER WALLET
           ======================================================== */}
        {activeTab === 'profile' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 pb-8">
            {/* Customer Identity Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-2xl shadow-2xs">
                  {currentUser.avatar}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{currentUser.name}</h3>
                  <p className="text-xs text-slate-500">{currentUser.phone}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 inline-block">
                    {currentUser.roleBadgeAr}
                  </span>
                </div>
              </div>
              <div className="text-left">
                <span className="text-[10px] font-bold text-slate-400 block">نطاق الحساب</span>
                <span className="text-xs font-extrabold text-slate-800">الباجور • المنوفية</span>
              </div>
            </div>

            {/* ====================================================
                WALLET SECTION (محفظة مشوار والرصيد المتاح)
               ==================================================== */}
            <div className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-4 text-white shadow-md flex flex-col gap-3 relative overflow-hidden">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-emerald-200">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold tracking-tight flex items-center gap-1.5">
                      <span>محفظة مشوار (Wallet)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                        0% رسوم
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-200/90">
                      الرصيد المتاح للطلبات والتوصيل الفوري
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-200/90 bg-black/20 px-2 py-0.5 rounded-lg">
                  {customerWalletBalancePiasters.toLocaleString('en-US')} قرش
                </span>
              </div>

              {/* Balance Display */}
              <div className="py-1 flex items-baseline justify-between border-y border-white/10">
                <div>
                  <span className="text-[10px] text-emerald-200 block">الرصيد المتاح حالياً</span>
                  <div className="text-2xl font-black tracking-tight text-white">
                    {customerWalletBalanceEgp.toFixed(2)}{' '}
                    <span className="text-xs font-bold text-emerald-200">ج.م</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-emerald-200 block">حالة المحفظة</span>
                  <span className="text-[11px] font-extrabold text-emerald-300 flex items-center gap-1 justify-end">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>مفعّلة ومؤمّنة</span>
                  </span>
                </div>
              </div>

              {/* Quick Top-Up Buttons */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-emerald-100">
                  شحن فوري للرصيد (إنستاباي / فودافون كاش):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickTopUp(50, 'إنستاباي مصر (InstaPay)')}
                    className="py-2 px-2.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-98 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all border border-white/15"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-300" />
                    <span>شحن +50 ج.م (إنستاباي)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickTopUp(100, 'فودافون كاش')}
                    className="py-2 px-2.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 active:scale-98 font-extrabold text-[11px] flex items-center justify-center gap-1 transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-700" />
                    <span>شحن +100 ج.م (محفظة)</span>
                  </button>
                </div>
              </div>

              {topUpSuccessText && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/30 border border-emerald-300/40 text-[11px] font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                  <span>{topUpSuccessText}</span>
                </div>
              )}
            </div>

            {/* ====================================================
                WALLET TRANSACTION HISTORY (سجل معاملات المحفظة)
               ==================================================== */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">سجل معاملات المحفظة</h4>
                  <p className="text-[10px] text-slate-500">
                    عمليات الشحن، التعويضات، وسداد الطلبات ({customerWalletTransactions.length})
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setWalletFilter('all')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      walletFilter === 'all'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletFilter('credit')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      walletFilter === 'credit'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    إيداع
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletFilter('debit')}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      walletFilter === 'debit'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    خصم
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {customerWalletTransactions
                  .filter((tx) => (walletFilter === 'all' ? true : tx.type === walletFilter))
                  .map((tx) => {
                    const isCredit = tx.type === 'credit';
                    return (
                      <div key={tx.id} className="py-2.5 flex items-start justify-between gap-2.5 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-black text-xs mt-0.5 ${
                              isCredit
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/70'
                            }`}
                          >
                            {isCredit ? '+' : '−'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 truncate">{tx.titleAr}</div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {tx.descriptionAr}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span>{tx.createdAt}</span>
                              {tx.orderNumber && (
                                <span className="font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {tx.orderNumber}
                                </span>
                              )}
                              {tx.paymentChannelAr && (
                                <span className="text-emerald-700 font-semibold">
                                  • {tx.paymentChannelAr}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <div
                            className={`font-black text-xs ${
                              isCredit ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {isCredit ? '+' : '−'}
                            {tx.amountEgp.toFixed(2)} ج.م
                          </div>
                          <div className="text-[9px] text-slate-400 mt-0.5">
                            الرصيد: {(tx.balanceAfterPiasters / 100).toFixed(2)} ج.م
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Customer Preferences & Account Switcher */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              <div className="p-3.5 flex items-center justify-between">
                <span>العنوان المفضل: شارع الجيش - برج الشروق، الباجور</span>
                <span className="text-emerald-700 font-bold">الرئيسي</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>طريقة الدفع الافتراضية: نقداً عند الاستلام / المحفظة</span>
                <span className="text-emerald-700 font-bold">نشط</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>رقم خدمة العملاء بالباجور</span>
                <span className="font-mono text-slate-500">19XXX</span>
              </div>
              <div
                onClick={() => setIsAuthModalOpen(true)}
                className="p-3.5 flex items-center justify-between text-emerald-800 font-bold cursor-pointer hover:bg-slate-50"
              >
                <span>التبديل إلى حساب كابتن أو تاجر (أداة التطوير)</span>
                <ChevronLeft className="w-4 h-4" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Single-Store Cart Drawer / Checkout Sheet */}
      {isCartOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col gap-3.5 max-h-[85%] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">سلة المشتريات وإتمام الطلب</h3>
                <p className="text-[11px] text-emerald-800 font-bold">
                  متجر: {currentCartStore?.nameAr || 'غير محدد'}
                </p>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                السلة فارغة حالياً. أضف منتجات من المتجر لمتابعة الشراء.
              </div>
            ) : (
              <>
                {/* Items in Cart */}
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">{item.product.nameAr}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.product.priceEgp} ج.م × {item.quantity} = {item.product.priceEgp * item.quantity} ج.م
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white rounded-lg p-1 border border-slate-200">
                        <button
                          onClick={() => updateCartItemQty(item.product.id, item.quantity - 1)}
                          className="w-5 h-5 rounded text-slate-700 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black px-1 text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 rounded text-emerald-700 flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="حذف من السلة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    عنوان التوصيل في الباجور:
                  </label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* Order Notes */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    ملاحظات المتجر والكابتن (اختياري):
                  </label>
                  <input
                    type="text"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="مثال: الخبز ساخن، التوصيل للطابق الثالث..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800"
                  />
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    طريقة السداد:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2.5 rounded-xl border text-right transition-all ${
                        paymentMethod === 'cash'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Banknote className="w-4 h-4 text-emerald-700" />
                        <span>كاش عند الاستلام</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">الدفع للكابتن نقداً</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-2.5 rounded-xl border text-right transition-all ${
                        paymentMethod === 'instapay'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs">
                        <Wallet className="w-4 h-4 text-emerald-700" />
                        <span>إنستاباي / محفظة</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">تحويل مباشر للكابتن</div>
                    </button>
                  </div>
                </div>

                {/* Order Total Breakdown */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex flex-col gap-1.5 text-slate-600 font-medium">
                  <div className="flex justify-between">
                    <span>قيمة الأصناف:</span>
                    <span className="font-bold text-slate-800">{cartSubtotalEgp}.00 ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>توصيل مشوار (نطاق الباجور):</span>
                    <span className="font-bold text-slate-800">{cartDeliveryFeeEgp}.00 ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>رسوم دعم المنصة:</span>
                    <span className="font-bold text-slate-800">{cartPlatformFeeEgp}.00 ج.م</span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-sm font-extrabold text-slate-900">
                    <span>الإجمالي المستحق:</span>
                    <span className="text-emerald-800 font-black">{cartTotalEgp}.00 ج.م</span>
                  </div>
                </div>

                {/* Confirm Order Button */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="p-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
                  >
                    متابعة التسوق
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <span>تأكيد وإرسال الطلب الآن ({cartTotalEgp} ج.م)</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Conflict Modal: Single Store Rule */}
      {conflictModal.show && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full text-center flex flex-col gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-sm text-slate-900">
              تغيير متجر السلة
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              سلتك الحالية تحتوي على منتجات من <strong className="text-slate-900">{conflictModal.currentStoreName}</strong>.
              نظام مشوار يتيح الطلب من متجر واحد في كل مشوار لضمان سرعة التوصيل. هل تود تفريغ السلة والبدء بالتسوق من <strong className="text-emerald-800">{conflictModal.pendingStore?.nameAr}</strong>؟
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setConflictModal({ show: false })}
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
              >
                إلغاء والاحتفاظ بالسلة
              </button>
              <button
                onClick={handleConfirmSwitchStore}
                className="py-2.5 rounded-xl bg-emerald-700 text-white font-extrabold text-xs shadow-md"
              >
                تفريغ وبدء التسوق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Simulation Modal */}
      {showChatModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col h-[75%]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  🛵
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">
                    محادثة الكابتن: {activeCustomerOrder?.assignedCaptainName || 'محمود الصياد'}
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-bold">متصل الآن</span>
                </div>
              </div>
              <button
                onClick={() => setShowChatModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages stream */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
              {chatMessages.map((msg) => {
                const isMe = msg.senderRole === 'customer';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[80%] p-2.5 rounded-2xl ${
                        isMe
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={inputChatText}
                onChange={(e) => setInputChatText(e.target.value)}
                placeholder="اكتب رسالة للكابتن..."
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-emerald-600"
              />
              <button
                type="submit"
                className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Mobile Bottom Navigation Bar */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1.5 px-3 flex items-center justify-around shadow-sm shrink-0">
        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('home');
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'home' && !selectedStore
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('stores');
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'stores' || selectedStore
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Store className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المتاجر</span>
        </button>

        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('history');
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'history'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">طلباتي</span>
        </button>

        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('profile');
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'profile'
              ? 'text-emerald-700 font-extrabold'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">حسابي</span>
        </button>
      </div>
    </div>
  );
};
