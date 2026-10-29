import React, { useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
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
  Info,
  Bell,
  ArrowUpDown,
  HeadphonesIcon,
  Zap,
  Lock,
  RefreshCw,
  Share2,
  Edit3,
  FileText,
  DollarSign,
  Copy,
  Check,
  Activity
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import {
  useMarketplace,
  StoreItem,
  ProductItem,
  MarketplaceOrder,
  EL_BAGOUR_LANDMARKS_LIST,
  formatHumanReadableAcceptedTimestamp
} from '../../store/marketplaceStore';

interface CustomerMobileExperienceProps {
  onSwitchToCaptain?: () => void;
  onOpenAuthModal?: () => void;
}

interface QuotePreviewData {
  quoteId: string;
  distanceKm: number;
  etaMinutes: number;
  baseFareEgp: number;
  distanceFareEgp: number;
  ruralSurchargeEgp: number;
  platformFeeEgp: number;
  totalEgp: number;
  totalPiasters: number;
  signaturePreview: string;
  isLiveBackendQuote?: boolean;
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
    forceAddToCartNewStore,
    cartSubtotalEgp,
    cartDeliveryFeeEgp,
    cartPlatformFeeEgp,
    cartTotalEgp,
    orders,
    submitNewOrder,
    submitRideOrPackageOrder,
    simulateInstantCaptainAccept,
    customerCancelOrder,
    rateOrderCaptain,
    updateOrderNotes,
    updateOrderFeedback,
    refreshOrderStatus,
    activeCustomerOrder,
    chatMessages,
    sendChatMessage,
    setIsAuthModalOpen,
    customerWalletBalanceEgp,
    walletTransactions,
    topUpCustomerWallet,
    notifications,
    markAllNotificationsRead,
    complaints,
    submitComplaint,
    customerNavTab,
    setCustomerNavTab,
  } = useMarketplace();

  // Navigation tab: home | ride_booking | stores | history | profile
  const [activeTab, setActiveTabState] = useState<'home' | 'ride_booking' | 'stores' | 'history' | 'profile'>(customerNavTab);

  useEffect(() => {
    setActiveTabState(customerNavTab);
  }, [customerNavTab]);

  const setActiveTab = (tab: 'home' | 'ride_booking' | 'stores' | 'history' | 'profile') => {
    setActiveTabState(tab);
    setCustomerNavTab(tab);
  };

  // Browsing & Store Views
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);
  const [storeCategoryFilter, setStoreCategoryFilter] = useState<'all' | 'restaurant' | 'pharmacy' | 'supermarket'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Ride & Package Booking Flow State
  const [bookingServiceMode, setBookingServiceMode] = useState<'errand' | 'package' | 'heavy' | 'passenger_locked'>('errand');
  const [pickupLandmarkId, setPickupLandmarkId] = useState<string>('lm_station');
  const [dropoffLandmarkId, setDropoffLandmarkId] = useState<string>('lm_army_st');
  const [customPickupNote, setCustomPickupNote] = useState<string>('');
  const [customDropoffNote, setCustomDropoffNote] = useState<string>('');
  const [tripNotes, setTripNotes] = useState<string>('مشوار خاص سريع داخل الباجور');
  const [recipientPhone, setRecipientPhone] = useState<string>('01012345678');
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'vodafone_cash'>('cash');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<QuotePreviewData | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);

  // Cart / Checkout Drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('شارع الجيش - برج الشروق، الباجور');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'vodafone_cash'>('cash');
  const [orderNotes, setOrderNotes] = useState('');

  // Wallet Top-Up Modal State
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [topUpAmountEgp, setTopUpAmountEgp] = useState<number>(100);
  const [topUpMethodLabel, setTopUpMethodLabel] = useState<string>('إنستاباي (InstaPay)');

  // Notifications & Support Modals
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintOrderNum, setComplaintOrderNum] = useState('#MSH-8102');
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDetails, setComplaintDetails] = useState('');

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

  // =========================================================================
  // NEW INTEGRATED MOBILE TRACKING & ORDER HISTORY UX STATES
  // =========================================================================
  const [isTrackingSheetMinimized, setIsTrackingSheetMinimized] = useState(false);
  const [activeInlineTool, setActiveInlineTool] = useState<'none' | 'notes' | 'tip' | 'share'>('none');
  const [isVerticalTimelineExpanded, setIsVerticalTimelineExpanded] = useState(false);
  const [isFareBreakdownOpen, setIsFareBreakdownOpen] = useState(false);

  // Dynamic ETA Countdown Timer state inside mobile app
  const activeDurationMinutes =
    activeCustomerOrder?.estimatedDuration ??
    activeCustomerOrder?.estimatedDurationMinutes ??
    (activeCustomerOrder?.estimatedMinutes
      ? parseInt(
          String(activeCustomerOrder.estimatedMinutes)
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .match(/\d+/)?.[0] || '18',
          10
        )
      : 18);
  const [mobileEtaSeconds, setMobileEtaSeconds] = useState<number>(activeDurationMinutes * 60);

  useEffect(() => {
    setMobileEtaSeconds(activeDurationMinutes * 60);
  }, [activeCustomerOrder?.id, activeDurationMinutes]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMobileEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedMobileEta = `${String(Math.floor(mobileEtaSeconds / 60)).padStart(2, '0')}:${String(
    mobileEtaSeconds % 60
  ).padStart(2, '0')}`;

  // Manual Refresh with visual progress bar feedback inside mobile app
  const [isRefreshingMobile, setIsRefreshingMobile] = useState(false);
  const [mobileRefreshProgress, setMobileRefreshProgress] = useState(0);
  const [mobileRefreshDone, setMobileRefreshDone] = useState(false);

  const handleMobileManualRefresh = async () => {
    if (isRefreshingMobile || !activeCustomerOrder) return;
    setIsRefreshingMobile(true);
    setMobileRefreshDone(false);
    setMobileRefreshProgress(30);
    await new Promise((r) => setTimeout(r, 120));
    setMobileRefreshProgress(75);
    await refreshOrderStatus(activeCustomerOrder.id);
    setMobileRefreshProgress(100);
    setIsRefreshingMobile(false);
    setMobileRefreshDone(true);
    setIsTimelinePulsingMobile(true);
    setTimeout(() => {
      setMobileRefreshProgress(0);
      setMobileRefreshDone(false);
    }, 1800);
  };

  // Subtle Pulse Animation on Status Timeline whenever order status changes
  const [isTimelinePulsingMobile, setIsTimelinePulsingMobile] = useState(false);
  const prevMobileStatusRef = useRef<string | undefined>(activeCustomerOrder?.status);

  useEffect(() => {
    if (
      activeCustomerOrder?.status &&
      prevMobileStatusRef.current &&
      prevMobileStatusRef.current !== activeCustomerOrder.status
    ) {
      setIsTimelinePulsingMobile(true);
    }
    prevMobileStatusRef.current = activeCustomerOrder?.status;
  }, [activeCustomerOrder?.status]);

  useEffect(() => {
    if (!isTimelinePulsingMobile) return;
    const t = window.setTimeout(() => setIsTimelinePulsingMobile(false), 2200);
    return () => window.clearTimeout(t);
  }, [isTimelinePulsingMobile]);

  // Inline Edit Order Notes state inside mobile app
  const [mobileNotesDraft, setMobileNotesDraft] = useState<string>(
    activeCustomerOrder?.orderNotes ?? activeCustomerOrder?.notes ?? ''
  );
  const [mobileNotesSaved, setMobileNotesSaved] = useState(false);

  useEffect(() => {
    setMobileNotesDraft(activeCustomerOrder?.orderNotes ?? activeCustomerOrder?.notes ?? '');
  }, [activeCustomerOrder?.id, activeCustomerOrder?.orderNotes, activeCustomerOrder?.notes]);

  const handleSaveMobileOrderNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomerOrder) return;
    updateOrderNotes(activeCustomerOrder.id, mobileNotesDraft.trim());
    setMobileNotesSaved(true);
    setTimeout(() => setMobileNotesSaved(false), 2000);
  };

  // Add Tip (Captain Gratuity) state inside mobile app
  const [mobileTipEgp, setMobileTipEgp] = useState<number>(0);
  const [mobileCustomTipInput, setMobileCustomTipInput] = useState<string>('');

  const handleSelectMobilePresetTip = (amount: number) => {
    setMobileTipEgp(amount);
    setMobileCustomTipInput(String(amount));
    setIsFareBreakdownOpen(true);
  };

  const handleApplyMobileCustomTip = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(0, Math.round(Number(mobileCustomTipInput) || 0));
    setMobileTipEgp(parsed);
    setIsFareBreakdownOpen(true);
  };

  // Share Live Link state inside mobile app
  const [mobileLiveLinkCopied, setMobileLiveLinkCopied] = useState(false);
  const mobileLiveTrackingUrl = activeCustomerOrder
    ? `https://mashwar-bagour.eg/live/${encodeURIComponent(activeCustomerOrder.orderNumber)}?token=bagour_live`
    : '';

  const handleCopyMobileLiveLink = () => {
    if (!mobileLiveTrackingUrl) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mobileLiveTrackingUrl).catch(() => {});
    }
    setMobileLiveLinkCopied(true);
    setTimeout(() => setMobileLiveLinkCopied(false), 2000);
  };

  // Modals / Bottom Sheets inside mobile phone frame
  const [showCaptainProfileModal, setShowCaptainProfileModal] = useState(false);
  const [showCallCaptainModal, setShowCallCaptainModal] = useState(false);
  const [copiedCaptainPhone, setCopiedCaptainPhone] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showSosEmergencyModal, setShowSosEmergencyModal] = useState(false);
  const [mobileSosLocationShared, setMobileSosLocationShared] = useState(false);
  const [mobileSosCalledService, setMobileSosCalledService] = useState<string | null>(null);
  const [summarySheetOrder, setSummarySheetOrder] = useState<MarketplaceOrder | null>(null);

  // Order History Feedback drafts & saved indicators
  const [historyFeedbackDrafts, setHistoryFeedbackDrafts] = useState<Record<string, string>>({});
  const [historyFeedbackSavedMap, setHistoryFeedbackSavedMap] = useState<Record<string, boolean>>({});

  // Selected pickup & dropoff landmark objects
  const pickupLandmark = EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === pickupLandmarkId) || EL_BAGOUR_LANDMARKS_LIST[0];
  const dropoffLandmark = EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === dropoffLandmarkId) || EL_BAGOUR_LANDMARKS_LIST[1];

  // Fetch authoritative quote from /api/v1/quotes whenever pickup, dropoff, or category changes
  useEffect(() => {
    let isMounted = true;
    const computeQuote = async () => {
      if (pickupLandmark.id === dropoffLandmark.id) {
        setBookingError('يرجى اختيار نقطة وصول مختلفة عن نقطة الانطلاق لحساب المسافة والتسعيرة.');
        setQuoteData(null);
        return;
      }
      if (bookingServiceMode === 'passenger_locked') {
        setBookingError(null);
        setQuoteData(null);
        return;
      }
      setBookingError(null);
      setIsLoadingQuote(true);

      const distKm = Number(
        Math.max(
          1.4,
          Math.abs(pickupLandmark.distanceFromCenterKm - dropoffLandmark.distanceFromCenterKm) + 1.6
        ).toFixed(1)
      );
      const isRuralRoute = pickupLandmark.isRural || dropoffLandmark.isRural;
      const heavyExtraEgp = bookingServiceMode === 'heavy' ? 10 : 0;

      try {
        const res = await fetch('/api/v1/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceTypeId: bookingServiceMode === 'errand' ? 'errand' : 'package',
            distanceKm: distKm,
            isRuralOrVillage: isRuralRoute,
            pickupLandmark: pickupLandmark.nameAr,
            dropoffLandmark: dropoffLandmark.nameAr,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.data) {
            const q = json.data;
            const baseFareEgp = Math.round((q.baseFarePiasters ?? 1500) / 100) + heavyExtraEgp;
            const distanceFareEgp = Math.round((q.distanceFarePiasters ?? 0) / 100);
            const ruralSurchargeEgp = Math.round((q.ruralSurchargePiasters ?? 0) / 100);
            const platformFeeEgp = Math.round((q.platformFeePiasters ?? 200) / 100);
            const totalEgp = baseFareEgp + distanceFareEgp + ruralSurchargeEgp + platformFeeEgp;
            const totalPiasters = totalEgp * 100;

            setQuoteData({
              quoteId: q.quoteId || 'qt_live',
              distanceKm: q.distanceKm || distKm,
              etaMinutes: q.estimatedDurationMinutes || Math.max(7, Math.round(distKm * 4 + 4)),
              baseFareEgp,
              distanceFareEgp,
              ruralSurchargeEgp,
              platformFeeEgp,
              totalEgp,
              totalPiasters,
              signaturePreview: String(q.signature || 'hmac_sha256').slice(0, 14),
              isLiveBackendQuote: true,
            });
            setIsLoadingQuote(false);
            return;
          }
        }
      } catch {
        // Fallback deterministic calculation if offline
      }

      if (isMounted) {
        const baseFareEgp = (bookingServiceMode === 'heavy' ? 25 : 15);
        const distanceFareEgp = Math.max(0, Math.round(Math.max(0, distKm - 1.5) * 4));
        const ruralSurchargeEgp = isRuralRoute ? 5 : 0;
        const platformFeeEgp = 2;
        const totalEgp = baseFareEgp + distanceFareEgp + ruralSurchargeEgp + platformFeeEgp;
        setQuoteData({
          quoteId: `qt_bagour_${Date.now().toString().slice(-4)}`,
          distanceKm: distKm,
          etaMinutes: Math.max(7, Math.round(distKm * 4 + 4)),
          baseFareEgp,
          distanceFareEgp,
          ruralSurchargeEgp,
          platformFeeEgp,
          totalEgp,
          totalPiasters: totalEgp * 100,
          signaturePreview: 'hmac_sha256_ok',
          isLiveBackendQuote: false,
        });
        setIsLoadingQuote(false);
      }
    };

    computeQuote();
    return () => {
      isMounted = false;
    };
  }, [pickupLandmarkId, dropoffLandmarkId, bookingServiceMode, pickupLandmark, dropoffLandmark]);

  // Swap pickup and dropoff
  const handleSwapLocations = () => {
    const temp = pickupLandmarkId;
    setPickupLandmarkId(dropoffLandmarkId);
    setDropoffLandmarkId(temp);
  };

  // Submit direct Ride / Errand / Package booking
  const handleConfirmRideOrPackage = () => {
    if (bookingServiceMode === 'passenger_locked') {
      setBookingError('خدمة نقل الركاب بالسيارات الخاصة معلقة نظامياً التزاماً بالقانون رقم ٧٣ لسنة ٢٠١٨. يمكنك حجز "مشوار خاص سريع (سكوتر)" أو "توصيل طرد".');
      return;
    }
    if (pickupLandmarkId === dropoffLandmarkId) {
      setBookingError('نقطة الانطلاق ونقطة الوصول متطابقتان. يرجى اختيار وجهة مختلفة.');
      return;
    }
    if (!/^01[0125][0-9]{8}$/.test(recipientPhone.trim())) {
      setBookingError('يرجى إدخال رقم هاتف مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).');
      return;
    }
    if (!quoteData) return;

    if (bookingPaymentMethod === 'wallet' && customerWalletBalanceEgp < quoteData.totalEgp) {
      setBookingError(`رصيد المحفظة المتاح (${customerWalletBalanceEgp} ج.م) غير كافٍ لتغطية تكلفة المشوار (${quoteData.totalEgp} ج.م). يرجى شحن الرصيد أولاً أو اختيار الدفع نقداً.`);
      return;
    }

    const pickupFull = customPickupNote.trim()
      ? `${pickupLandmark.nameAr} (${customPickupNote.trim()})`
      : pickupLandmark.nameAr;
    const dropoffFull = customDropoffNote.trim()
      ? `${dropoffLandmark.nameAr} (${customDropoffNote.trim()})`
      : dropoffLandmark.nameAr;

    const created = submitRideOrPackageOrder({
      serviceType: bookingServiceMode === 'errand' ? 'errand' : 'package',
      vehicleCategory:
        bookingServiceMode === 'heavy'
          ? 'van'
          : bookingServiceMode === 'package'
          ? 'motorcycle'
          : 'scooter',
      pickupAddress: pickupFull,
      deliveryAddress: dropoffFull,
      distanceKm: quoteData.distanceKm,
      isRural: pickupLandmark.isRural || dropoffLandmark.isRural,
      paymentMethod: bookingPaymentMethod,
      notes: tripNotes,
      itemDescription:
        bookingServiceMode === 'errand'
          ? `مشوار خاص سريع: ${tripNotes || 'طلب خاص داخل الباجور'}`
          : bookingServiceMode === 'heavy'
          ? `نقل خفيف وبضائع: ${tripNotes || 'شحنة تجارية'}`
          : `توصيل طرد وأمانة: ${tripNotes || 'طرد مغلف'}`,
      recipientPhone: recipientPhone.trim(),
      quoteData: {
        quoteId: quoteData.quoteId,
        signature: quoteData.signaturePreview,
        baseFarePiasters: quoteData.baseFareEgp * 100,
        distanceFarePiasters: quoteData.distanceFareEgp * 100,
        ruralSurchargePiasters: quoteData.ruralSurchargeEgp * 100,
        platformFeePiasters: quoteData.platformFeeEgp * 100,
        totalFarePiasters: quoteData.totalPiasters,
        estimatedDurationMinutes: `${quoteData.etaMinutes} دقيقة`,
      },
    });

    if (created) {
      setSelectedStore(null);
      setActiveTab('home');
    }
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

  // Handle Add Funds submission
  const handleConfirmTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (topUpAmountEgp <= 0) return;
    topUpCustomerWallet(topUpAmountEgp, topUpMethodLabel);
    setShowAddFundsModal(false);
  };

  // Handle Complaint submission
  const handleComplaintSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintSubject.trim()) return;
    submitComplaint({
      orderNumber: complaintOrderNum,
      categoryAr: 'شكوى خدمة وتوصيل',
      subjectAr: complaintSubject,
      descriptionAr: complaintDetails,
    });
    setComplaintSubject('');
    setComplaintDetails('');
    setShowComplaintModal(false);
  };

  // Products belonging to the selected store
  const storeProducts = selectedStore
    ? products.filter((p) => p.storeId === selectedStore.id)
    : [];

  // Customer's orders
  const customerOrders = orders.filter((o) => o.customerId === currentUser.id);
  const unreadNotificationsCount = notifications.filter((n) => !n.isRead).length;

  // Human-readable accepted timestamp for the active order
  const activeAcceptedTimestampText = activeCustomerOrder
    ? formatHumanReadableAcceptedTimestamp(activeCustomerOrder.acceptedAtIso, activeCustomerOrder.acceptedAt)
    : null;

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile App Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-3.5 pt-3 pb-2.5 border-b border-slate-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shadow-xs shadow-emerald-700/20">
            م
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">مشوار</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {currentUser.name}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span className="truncate max-w-[125px]">الباجور • المنوفية</span>
            </div>
          </div>
        </div>

        {/* Action Controls: Wallet Pill, Notifications Bell, Cart & Role Switcher */}
        <div className="flex items-center gap-1.5">
          {/* Quick Wallet Balance Pill */}
          <button
            onClick={() => {
              setSelectedStore(null);
              setActiveTab('profile');
            }}
            className="px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 flex items-center gap-1 transition-colors"
            title="الرصيد المتاح في محفظة مشوار"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-[10px] font-black">{customerWalletBalanceEgp} ج.م</span>
          </button>

          {/* Notifications Bell */}
          <button
            onClick={() => {
              setShowNotificationsDrawer(true);
              markAllNotificationsRead();
            }}
            className="relative w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 flex items-center justify-center transition-colors"
            title="الإشعارات والتنبيهات"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

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
            className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full transition-colors flex items-center gap-0.5 shadow-2xs"
            title="تبديل الحساب التجريبي"
          >
            <span>🔄</span>
            <span>دور</span>
          </button>
        </div>
      </div>

      {/* Main Dynamic Viewport */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* ========================================================
            TAB 1: HOME (Map + Active Order Tracking OR Service Hub)
           ======================================================== */}
        {activeTab === 'home' && !selectedStore && (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* Map Canvas Background */}
            <div className="absolute inset-0 z-0">
              <EgyptianMapCanvas
                mode="customer"
                pickupText={
                  activeCustomerOrder
                    ? activeCustomerOrder.storeAddress
                    : pickupLandmark.nameAr
                }
                dropoffText={
                  activeCustomerOrder
                    ? activeCustomerOrder.deliveryAddress
                    : dropoffLandmark.nameAr
                }
                showRoute={true}
              />
            </div>

            {/* If there is an active order in progress AND sheet is minimized: show floating mini-tracker + full Home Service Hub */}
            {activeCustomerOrder && isTrackingSheetMinimized && (
              <div className="relative z-10 p-3 pb-0">
                <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-xl border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-white truncate">
                          طلب نشط {activeCustomerOrder.orderNumber}
                        </span>
                        <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded-md border border-amber-400/30">
                          ETA {formattedMobileEta}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 truncate mt-0.5">
                        {activeCustomerOrder.storeName} • {activeCustomerOrder.totalEgp + mobileTipEgp}.00 ج.م
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTrackingSheetMinimized(false)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold flex items-center gap-1 shrink-0 shadow-sm cursor-pointer"
                  >
                    <span>توسيع التتبع</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* If there is an active order in progress and not minimized: show Cohesive Live Tracking Sheet */}
            {activeCustomerOrder && !isTrackingSheetMinimized ? (
              <div className="relative z-10 mt-auto bg-white rounded-t-3xl p-3.5 shadow-2xl border-t border-slate-100 flex flex-col gap-2.5 max-h-[89%] overflow-y-auto">
                {/* Sheet Top Bar: Drag Handle + Minimize Toggle + SOS & Refresh */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsTrackingSheetMinimized(true)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
                    title="تصغير بطاقة التتبع لعرض الخريطة والخدمات"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>تصغير للخريطة</span>
                  </button>

                  <div className="w-10 h-1 bg-slate-300 rounded-full" />

                  <div className="flex items-center gap-1.5">
                    {/* Manual Refresh Button with Progress Bar */}
                    <button
                      type="button"
                      onClick={handleMobileManualRefresh}
                      disabled={isRefreshingMobile}
                      className={`relative overflow-hidden px-2.5 py-1 rounded-lg border text-[10px] font-extrabold flex flex-col items-center justify-center transition cursor-pointer ${
                        isRefreshingMobile
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : mobileRefreshDone
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-slate-100 hover:bg-slate-200/80 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <RefreshCw className={`w-3 h-3 text-emerald-700 ${isRefreshingMobile ? 'animate-spin' : ''}`} />
                        <span>
                          {isRefreshingMobile
                            ? 'جاري التحديث...'
                            : mobileRefreshDone
                            ? 'تم التحديث ✓'
                            : 'تحديث'}
                        </span>
                      </div>
                      {(isRefreshingMobile || mobileRefreshProgress > 0) && (
                        <div className="w-full h-0.5 bg-slate-200 rounded-full overflow-hidden mt-0.5">
                          <div
                            className={`h-full bg-emerald-600 transition-all duration-150 ${
                              mobileRefreshProgress >= 100
                                ? 'w-full'
                                : mobileRefreshProgress >= 70
                                ? 'w-3/4'
                                : 'w-1/3'
                            }`}
                          />
                        </div>
                      )}
                    </button>

                    {/* SOS Emergency Assistance Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSosLocationShared(false);
                        setMobileSosCalledService(null);
                        setShowSosEmergencyModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-black flex items-center gap-1 transition cursor-pointer"
                      title="طوارئ الباجور ومشاركة الموقع"
                    >
                      <ShieldCheck className="w-3 h-3 text-rose-600" />
                      <span>SOS طوارئ</span>
                    </button>
                  </div>
                </div>

                {/* Status Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping shrink-0" />
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                      {activeCustomerOrder.status === 'created' && 'تم إرسال الطلب للمتجر • بانتظار الموافقة'}
                      {activeCustomerOrder.status === 'searching_captain' && 'جاري البحث عن أقرب كابتن متاح في الباجور...'}
                      {(activeCustomerOrder.status === 'accepted_by_store' ||
                        activeCustomerOrder.status === 'preparing' ||
                        activeCustomerOrder.status === 'merchant_accepted') &&
                        'المتجر قبل طلبك ويقوم بتجهيزه الآن 🍳'}
                      {activeCustomerOrder.status === 'ready_for_pickup' && 'الطلب جاهز • بانتظار استلام الكابتن'}
                      {activeCustomerOrder.status === 'captain_assigned' && 'تم تعيين الكابتن • في الطريق للاستلام 🛵'}
                      {activeCustomerOrder.status === 'at_pickup' && 'الكابتن وصل لنقطة الاستلام'}
                      {activeCustomerOrder.status === 'picked_up' && 'الكابتن استلم الطلب من نقطة الانطلاق 📦'}
                      {activeCustomerOrder.status === 'in_transit' && 'الكابتن في الطريق إليك الآن 🛵'}
                      {activeCustomerOrder.status === 'delivered' && 'تم إتمام المشوار والتسليم بنجاح!'}
                    </span>
                  </div>
                  <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    {activeCustomerOrder.orderNumber}
                  </span>
                </div>

                {/* Dual Metric Strip: Accepted Timestamp + Dynamic ETA Countdown Timer */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Accepted Timestamp Box */}
                  {activeAcceptedTimestampText ? (
                    <div
                      data-testid="active-order-accepted-timestamp"
                      className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-200/90 flex flex-col justify-between text-[11px] text-emerald-950"
                    >
                      <div className="flex items-center gap-1 font-bold text-emerald-800">
                        <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>وقت قبول الطلب:</span>
                      </div>
                      <span className="font-black text-emerald-900 text-[11px] mt-0.5 truncate">
                        {activeAcceptedTimestampText}
                      </span>
                    </div>
                  ) : (
                    <div
                      data-testid="active-order-pending-timestamp"
                      className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 flex flex-col justify-between text-[11px] text-amber-900"
                    >
                      <span className="font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                        <span>الإنشاء: {activeCustomerOrder.createdAt}</span>
                      </span>
                      <span className="font-extrabold text-amber-800 text-[10px] mt-0.5">بانتظار القبول...</span>
                    </div>
                  )}

                  {/* Dynamic ETA Countdown Box */}
                  <div className="p-2 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">الوصول المتوقع (ETA)</span>
                      <span className="font-mono font-black text-sm text-amber-400">
                        {formattedMobileEta}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-800">
                      ~{activeDurationMinutes} د
                    </span>
                  </div>
                </div>

                {/* Horizontal Stepper + Expandable Vertical Status Timeline (with Pulse Animation) */}
                <div
                  className={`flex flex-col gap-2 rounded-2xl transition-all duration-500 ${
                    isTimelinePulsingMobile
                      ? 'ring-2 ring-emerald-500/50 bg-emerald-50/50 p-2 animate-pulse'
                      : ''
                  }`}
                >
                  {activeCustomerOrder.serviceType === 'restaurant_store' ? (
                    <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['created', 'accepted_by_store', 'preparing', 'merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ١. إرسال الطلب
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['accepted_by_store', 'preparing', 'merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٢. قبول وتجهيز
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['ready_for_pickup', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٣. مع الكابتن
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          activeCustomerOrder.status === 'delivered'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٤. تم التسليم
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1 text-center text-[9px] font-bold">
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['searching_captain', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ١. طلب كابتن
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٢. قبول الكابتن
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          ['at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status)
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٣. في الطريق
                      </div>
                      <div
                        className={`p-1.5 rounded-lg ${
                          activeCustomerOrder.status === 'delivered'
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        ٤. الوصول
                      </div>
                    </div>
                  )}

                  {/* Toggle for Detailed Vertical Status Timeline */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={() => setIsVerticalTimelineExpanded((prev) => !prev)}
                      className="text-[10px] font-extrabold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                    >
                      <Activity className="w-3 h-3 text-emerald-700" />
                      <span>
                        {isVerticalTimelineExpanded
                          ? 'إخفاء التسلسل الزمني المفصل'
                          : 'عرض التسلسل الزمني لحالات الطلب'}
                      </span>
                      {isVerticalTimelineExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    {isTimelinePulsingMobile && (
                      <span className="text-[10px] font-bold text-emerald-700 animate-pulse">
                        • تحديث حي للحالة
                      </span>
                    )}
                  </div>

                  {/* Expanded Vertical Status Timeline */}
                  {isVerticalTimelineExpanded && (
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200/80 flex flex-col gap-2">
                      {[
                        {
                          key: 'created',
                          title: 'تم إنشاء الطلب واستلامه',
                          desc: `وقت الإنشاء: ${activeCustomerOrder.createdAt}`,
                          done: true,
                          active: activeCustomerOrder.status === 'created',
                        },
                        {
                          key: 'searching',
                          title: 'تأكيد المتجر وتوجيه أقرب كابتن بالباجور',
                          desc: activeAcceptedTimestampText || 'جاري مطابقة أقرب كابتن في نطاق الباجور',
                          done: ['accepted_by_store', 'preparing', 'merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status),
                          active: ['searching_captain', 'accepted_by_store', 'preparing', 'ready_for_pickup'].includes(activeCustomerOrder.status),
                        },
                        {
                          key: 'at_pickup',
                          title: 'وصول الكابتن لنقطة الاستلام',
                          desc: activeCustomerOrder.storeAddress,
                          done: ['at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(activeCustomerOrder.status),
                          active: ['captain_assigned', 'at_pickup'].includes(activeCustomerOrder.status),
                        },
                        {
                          key: 'in_transit',
                          title: 'الكابتن في الطريق إليك الآن',
                          desc: `الوجهة: ${activeCustomerOrder.deliveryAddress}`,
                          done: ['in_transit', 'delivered'].includes(activeCustomerOrder.status),
                          active: ['picked_up', 'in_transit'].includes(activeCustomerOrder.status),
                        },
                        {
                          key: 'delivered',
                          title: 'إتمام التسليم وتحصيل الحساب',
                          desc: `${activeCustomerOrder.totalEgp + mobileTipEgp}.00 ج.م`,
                          done: activeCustomerOrder.status === 'delivered',
                          active: activeCustomerOrder.status === 'delivered',
                        },
                      ].map((step, idx, arr) => (
                        <div key={step.key} className="relative flex items-start gap-2.5">
                          {idx < arr.length - 1 && (
                            <div
                              className={`absolute right-[9px] top-5 bottom-[-10px] w-0.5 ${
                                step.done ? 'bg-emerald-600' : 'bg-slate-200'
                              }`}
                            />
                          )}
                          <div
                            className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                              step.active
                                ? 'bg-emerald-700 text-white ring-2 ring-emerald-200'
                                : step.done
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-white text-slate-400 border border-slate-200'
                            }`}
                          >
                            {step.done ? '✓' : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-[11px] font-extrabold ${
                                  step.active
                                    ? 'text-emerald-800'
                                    : step.done
                                    ? 'text-slate-900'
                                    : 'text-slate-400'
                                }`}
                              >
                                {step.title}
                              </span>
                              {step.active && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  الحالة الحالية
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Searching Captain Instant Simulation & Cancel Actions */}
                {(activeCustomerOrder.status === 'searching_captain' || activeCustomerOrder.status === 'created') && (
                  <div className="p-2.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-2">
                    <div className="text-[11px]">
                      <div className="font-extrabold text-emerald-400 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        <span>رادار كباتن الباجور نشط</span>
                      </div>
                      <p className="text-[10px] text-slate-300 mt-0.5">
                        يمكنك الانتظار أو محاكاة قبول الكابتن فوراً لاختبار التتبع الحي.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => simulateInstantCaptainAccept(activeCustomerOrder.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] shadow-xs transition-all cursor-pointer"
                      >
                        محاكاة قبول الكابتن ⚡
                      </button>
                      <button
                        onClick={() => setShowCancelConfirmModal(true)}
                        className="px-2 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 font-bold text-[10px] cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {/* Captain Card if Assigned (with View Captain Profile, Call Dialer Sheet, and Chat Sheet) */}
                {activeCustomerOrder.assignedCaptainName && (
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCaptainProfileModal(true)}
                      className="flex items-center gap-2.5 text-right flex-1 min-w-0 cursor-pointer group"
                      title="عرض ملف الكابتن وتفاصيل المركبة"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-base shadow-xs shrink-0 group-hover:scale-105 transition">
                        🛵
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1">
                          <span className="truncate group-hover:text-emerald-800">
                            {activeCustomerOrder.assignedCaptainName}
                          </span>
                          <span className="text-[10px] text-amber-600 font-bold shrink-0">★ 4.92</span>
                        </div>
                        <div className="text-[10px] text-slate-600 font-semibold truncate">
                          {activeCustomerOrder.assignedCaptainVehicle || 'سكوتر بينيلي أسود • م ن ف ٤٩٢١'}
                        </div>
                        <div className="text-[9px] font-extrabold text-emerald-700 mt-0.5 flex items-center gap-0.5">
                          <span>عرض ملف الكابتن والمركبة</span>
                          <ChevronLeft className="w-3 h-3" />
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowChatModal(true)}
                        className="relative w-9 h-9 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs hover:bg-emerald-800 cursor-pointer"
                        title="محادثة الكابتن (رسائل سريعة)"
                      >
                        <MessageSquare className="w-4 h-4" />
                        {chatMessages.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center">
                            {chatMessages.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCallCaptainModal(true)}
                        className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs hover:bg-black cursor-pointer"
                        title="اتصال هاتفي بالكابتن"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Organized 4-Action Quick Control Bar (Same Mashwar Design Language) */}
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSummarySheetOrder(activeCustomerOrder)}
                    className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-slate-200/90 hover:border-emerald-200 flex flex-col items-center justify-center gap-1 text-slate-700 hover:text-emerald-900 transition cursor-pointer"
                  >
                    <Package className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-[10px] font-extrabold">ملخص الطلب</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveInlineTool((prev) => (prev === 'notes' ? 'none' : 'notes'))
                    }
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      activeInlineTool === 'notes'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 hover:bg-emerald-50 border-slate-200/90 text-slate-700'
                    }`}
                  >
                    <Edit3 className={`w-3.5 h-3.5 ${activeInlineTool === 'notes' ? 'text-white' : 'text-amber-600'}`} />
                    <span className="text-[10px] font-extrabold">الملاحظات</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveInlineTool((prev) => (prev === 'tip' ? 'none' : 'tip'))
                    }
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      activeInlineTool === 'tip' || mobileTipEgp > 0
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 hover:bg-emerald-50 border-slate-200/90 text-slate-700'
                    }`}
                  >
                    <DollarSign className={`w-3.5 h-3.5 ${activeInlineTool === 'tip' || mobileTipEgp > 0 ? 'text-white' : 'text-emerald-700'}`} />
                    <span className="text-[10px] font-extrabold">
                      {mobileTipEgp > 0 ? `إكرامية +${mobileTipEgp}` : 'إكرامية'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveInlineTool((prev) => (prev === 'share' ? 'none' : 'share'))
                    }
                    className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                      activeInlineTool === 'share'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 hover:bg-emerald-50 border-slate-200/90 text-slate-700'
                    }`}
                  >
                    <Share2 className={`w-3.5 h-3.5 ${activeInlineTool === 'share' ? 'text-white' : 'text-slate-700'}`} />
                    <span className="text-[10px] font-extrabold">مشاركة</span>
                  </button>
                </div>

                {/* Inline Panel 1: Edit Order Notes */}
                {activeInlineTool === 'notes' && (
                  <form
                    onSubmit={handleSaveMobileOrderNotes}
                    className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[11px] text-amber-950 flex items-center gap-1">
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        <span>ملاحظات الطلب للكابتن والمتجر:</span>
                      </span>
                      {mobileNotesSaved && (
                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          تم الحفظ ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={mobileNotesDraft}
                        onChange={(e) => setMobileNotesDraft(e.target.value)}
                        placeholder="أضف أو عدّل ملاحظات التوصيل..."
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                      >
                        حفظ
                      </button>
                    </div>
                  </form>
                )}

                {/* Inline Panel 2: Add Captain Tip (Gratuity) */}
                {activeInlineTool === 'tip' && (
                  <div className="p-2.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[11px] text-emerald-950">
                        إكرامية الكابتن (١٠٠٪ للكابتن):
                      </span>
                      <span className="text-[10px] font-black text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                        +{mobileTipEgp} ج.م
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[5, 10, 15].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleSelectMobilePresetTip(amt)}
                          className={`py-1.5 rounded-xl font-extrabold text-[11px] border transition cursor-pointer ${
                            mobileTipEgp === amt
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-emerald-50'
                          }`}
                        >
                          {amt} ج.م
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setMobileTipEgp(0);
                          setMobileCustomTipInput('');
                        }}
                        className="py-1.5 rounded-xl font-bold text-[10px] bg-white text-slate-500 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        بدون
                      </button>
                    </div>
                    <form onSubmit={handleApplyMobileCustomTip} className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={mobileCustomTipInput}
                        onChange={(e) => setMobileCustomTipInput(e.target.value)}
                        placeholder="مبلغ مخصص بالجنيه..."
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs text-slate-900 font-mono"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold shrink-0 cursor-pointer"
                      >
                        تطبيق
                      </button>
                    </form>
                  </div>
                )}

                {/* Inline Panel 3: Share Live Link */}
                {activeInlineTool === 'share' && (
                  <div className="p-2.5 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-[11px] text-slate-900 flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>مشاركة رابط التتبع المباشر مع العائلة:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveInlineTool('none')}
                        className="text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        إغلاق ✕
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        readOnly
                        value={mobileLiveTrackingUrl}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono text-slate-700"
                      />
                      <button
                        type="button"
                        onClick={handleCopyMobileLiveLink}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-extrabold flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {mobileLiveLinkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{mobileLiveLinkCopied ? 'تم النسخ' : 'نسخ'}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `تابع مسار طلبي في مشوار الباجور (${activeCustomerOrder.orderNumber}): ${mobileLiveTrackingUrl}`
                        )}`}
                        className="py-1.5 rounded-xl bg-emerald-700 text-white text-[10px] font-extrabold text-center"
                      >
                        مشاركة عبر واتساب
                      </a>
                      <a
                        href={`sms:?body=${encodeURIComponent(
                          `تتبع طلبي في مشوار الباجور (${activeCustomerOrder.orderNumber}): ${mobileLiveTrackingUrl}`
                        )}`}
                        className="py-1.5 rounded-xl bg-slate-800 text-white text-[10px] font-extrabold text-center"
                      >
                        رسالة نصية SMS
                      </a>
                    </div>
                  </div>
                )}

                {/* Order / Trip Details + Expandable Fare Breakdown Card */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                      {activeCustomerOrder.serviceType === 'errand' ? (
                        <Bike className="w-3.5 h-3.5 text-emerald-700" />
                      ) : activeCustomerOrder.serviceType === 'package' ? (
                        <Package className="w-3.5 h-3.5 text-amber-600" />
                      ) : (
                        <Store className="w-3.5 h-3.5 text-emerald-700" />
                      )}
                      <span>{activeCustomerOrder.storeName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFareBreakdownOpen((prev) => !prev)}
                      className="font-black text-emerald-800 flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <span>{activeCustomerOrder.totalEgp + mobileTipEgp}.00 ج.م</span>
                      {isFareBreakdownOpen ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                      )}
                    </button>
                  </div>

                  {/* Expandable Fare Breakdown Details */}
                  {isFareBreakdownOpen && (
                    <div className="p-2 rounded-xl bg-white border border-slate-200/80 space-y-1 text-[10px] text-slate-600 my-0.5">
                      <div className="font-extrabold text-slate-800 border-b border-slate-100 pb-1 mb-1">
                        تفاصيل تكلفة المشوار والفاتورة:
                      </div>
                      {activeCustomerOrder.subtotalEgp > 0 && (
                        <div className="flex justify-between">
                          <span>قيمة الأصناف والمنتجات:</span>
                          <span className="font-bold text-slate-900">{activeCustomerOrder.subtotalEgp}.00 ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>فتحة العداد الأساسية (Base Fare):</span>
                        <span className="font-bold text-slate-900">15.00 ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span>تكلفة المسافة ({activeCustomerOrder.distanceKm || 1.8} كم):</span>
                        <span className="font-bold text-slate-900">
                          {Math.max(0, (activeCustomerOrder.deliveryFeeEgp || 15) - 15)}.00 ج.م
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>بدل القرى والأطراف (Rural Surcharge):</span>
                        <span className="font-bold text-amber-700">
                          {activeCustomerOrder.ruralSurchargeEgp || 0}.00 ج.م
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>رسوم تشغيل المنصة (Platform Fee):</span>
                        <span className="font-bold text-slate-900">
                          {activeCustomerOrder.platformFeeEgp || 2}.00 ج.م
                        </span>
                      </div>
                      {mobileTipEgp > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>إكرامية الكابتن (Captain Tip):</span>
                          <span>+{mobileTipEgp}.00 ج.م</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-100 font-black text-slate-900 text-[11px]">
                        <span>الإجمالي الكلي المستحق:</span>
                        <span className="text-emerald-800">
                          {activeCustomerOrder.totalEgp + mobileTipEgp}.00 ج.م
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 text-slate-600">
                    {activeCustomerOrder.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[11px]">
                        <span>{item.quantity}× {item.productName}</span>
                        <span className="font-bold">{item.unitPriceEgp * item.quantity} ج.م</span>
                      </div>
                    ))}
                  </div>

                  {/* Persisted Notes Preview if present */}
                  {(activeCustomerOrder.orderNotes || activeCustomerOrder.notes) && (
                    <div className="text-[10px] text-amber-900 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/70 flex items-center justify-between">
                      <span className="truncate">
                        <strong>الملاحظات:</strong> {activeCustomerOrder.orderNotes || activeCustomerOrder.notes}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveInlineTool('notes')}
                        className="text-[9px] font-extrabold text-amber-800 underline shrink-0 mr-1 cursor-pointer"
                      >
                        تعديل
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-600 pt-1 border-t border-slate-200 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="truncate">من: {activeCustomerOrder.storeAddress}</span>
                      {activeCustomerOrder.distanceKm && (
                        <span className="font-bold text-slate-700 shrink-0">{activeCustomerOrder.distanceKm} كم</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate">إلى: {activeCustomerOrder.deliveryAddress}</span>
                      <span className="font-bold text-amber-800 shrink-0">
                        الدفع:{' '}
                        {activeCustomerOrder.paymentMethod === 'cash'
                          ? 'كاش عند الاستلام'
                          : activeCustomerOrder.paymentMethod === 'wallet'
                          ? 'محفظة مشوار'
                          : 'إلكتروني'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Row: Role Switcher Hint & Cancel Order Button */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>جرب دور</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSwitchToCaptain) onSwitchToCaptain();
                        else setIsAuthModalOpen(true);
                      }}
                      className="font-extrabold underline text-emerald-800 cursor-pointer"
                    >
                      الكابتن
                    </button>
                    <span>أو</span>
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="font-extrabold underline text-emerald-800 cursor-pointer"
                    >
                      التاجر
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold cursor-pointer"
                    >
                      سجل طلباتي
                    </button>
                    {activeCustomerOrder.status !== 'delivered' &&
                      activeCustomerOrder.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => setShowCancelConfirmModal(true)}
                          className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold cursor-pointer"
                        >
                          إلغاء الطلب
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              /* If no active order: show Complete Service Launcher (Ride / Package / Stores) + Nearby Stores */
              <div className="relative z-10 mt-auto p-3.5 flex flex-col gap-2.5">
                {/* Primary Service Selection Hub */}
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">ماذا تريد أن تطلب في الباجور اليوم؟</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ٠٪ عمولة خفية
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setBookingServiceMode('errand');
                        setActiveTab('ride_booking');
                      }}
                      className="p-2.5 rounded-2xl bg-emerald-50/90 hover:bg-emerald-100 border border-emerald-200 flex flex-col items-center text-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                        <Bike className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-900">حجز مشوار</span>
                      <span className="text-[9px] text-emerald-800 font-bold">كابتن فوري</span>
                    </button>

                    <button
                      onClick={() => {
                        setBookingServiceMode('package');
                        setActiveTab('ride_booking');
                      }}
                      className="p-2.5 rounded-2xl bg-amber-50/90 hover:bg-amber-100 border border-amber-200 flex flex-col items-center text-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                        <Package className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-900">توصيل طرد</span>
                      <span className="text-[9px] text-amber-900 font-bold">أمانات وشحن</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('stores')}
                      className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 flex flex-col items-center text-center gap-1 transition-all active:scale-95 cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-xs">
                        <Store className="w-5 h-5" />
                      </div>
                      <span className="font-extrabold text-[11px] text-slate-900">المتاجر</span>
                      <span className="text-[9px] text-slate-600 font-bold">مطاعم وصيدليات</span>
                    </button>
                  </div>
                </div>

                {/* Nearby Stores Carousel */}
                <div className="bg-white rounded-2xl p-3 shadow-xl border border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">أشهر متاجر الباجور المتاحة الآن</span>
                    <button
                      onClick={() => setActiveTab('stores')}
                      className="text-[11px] font-extrabold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>عرض الكل ({stores.length})</span>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Horizontal Stores Carousel */}
                  <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {stores.map((store) => (
                      <div
                        key={store.id}
                        onClick={() => setSelectedStore(store)}
                        className="shrink-0 w-40 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-2 border border-slate-200/80 cursor-pointer transition-all group"
                      >
                        <div className="w-full h-16 rounded-lg overflow-hidden mb-1.5 bg-slate-200 relative">
                          <img
                            src={store.image}
                            alt={store.nameAr}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute top-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-sm bg-white/95 text-slate-800 shadow-2xs">
                            {store.deliveryTimeEst}
                          </span>
                        </div>
                        <div className="font-bold text-[11px] text-slate-900 truncate">{store.nameAr}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 flex items-center justify-between">
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
            TAB 2: COMPLETE RIDE / ERRAND & PACKAGE BOOKING JOURNEY
           ======================================================== */}
        {activeTab === 'ride_booking' && !selectedStore && (
          <div className="flex-1 w-full h-full flex flex-col overflow-y-auto bg-[#FAFAF9]">
            {/* Interactive Map Route Preview Header */}
            <div className="relative w-full h-36 shrink-0 border-b border-slate-200">
              <EgyptianMapCanvas
                mode="customer"
                pickupText={pickupLandmark.nameAr}
                dropoffText={dropoffLandmark.nameAr}
                showRoute={pickupLandmarkId !== dropoffLandmarkId}
              />
              {quoteData && (
                <div className="absolute bottom-2 left-2 z-10 bg-slate-900/90 backdrop-blur-xs text-white px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-2 shadow-md">
                  <span className="text-emerald-400 font-black">{quoteData.distanceKm} كم</span>
                  <span>•</span>
                  <span>الوصول خلال ~{quoteData.etaMinutes} د</span>
                </div>
              )}
            </div>

            <div className="p-3.5 flex flex-col gap-3 pb-20">
              {/* Service Category Tabs */}
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1.5">
                  ١. اختر نوع الخدمة والمركبة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingServiceMode('errand')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2 cursor-pointer ${
                      bookingServiceMode === 'errand'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Bike className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs">مشوار خاص سريع</div>
                      <div className="text-[10px] text-slate-500">كابتن سكوتر / موتوسيكل</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingServiceMode('package')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2 cursor-pointer ${
                      bookingServiceMode === 'package'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Package className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs">توصيل طرد / أمانة</div>
                      <div className="text-[10px] text-slate-500">مستندات، أدوية، طرود</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingServiceMode('heavy')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2 cursor-pointer ${
                      bookingServiceMode === 'heavy'
                        ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <Car className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs">نقل خفيف وبضائع</div>
                      <div className="text-[10px] text-slate-500">شحنات ثقيلة للتجار</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBookingServiceMode('passenger_locked')}
                    className={`p-2.5 rounded-xl border text-right transition-all flex items-start gap-2 cursor-pointer ${
                      bookingServiceMode === 'passenger_locked'
                        ? 'border-amber-500 bg-amber-50 text-amber-950'
                        : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-extrabold text-xs">نقل ركاب ملاكي</div>
                      <div className="text-[9px] text-amber-800 font-bold">معلق (قانون ٧٣/٢٠١٨)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Regulatory Notice if Passenger Ride is clicked */}
              {bookingServiceMode === 'passenger_locked' && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-col gap-1.5">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>تنبيه الامتثال التنظيمي (القانون رقم ٧٣ لسنة ٢٠١٨)</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    يرفض الخادم الخلفي (`POST /api/v1/quotes`) طلبات نقل الركاب بالسيارات الملاكي برمز `451 Unavailable For Legal Reasons` لحين استكمال ترخيص جهاز تنظيم النقل البري. يمكنك فوراً استخدام <strong>مشوار خاص سريع</strong> أو <strong>توصيل طرد</strong>.
                  </p>
                </div>
              )}

              {/* Pickup & Destination Selection Card */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-800">٢. تحديد نقطة الانطلاق والوصول بالباجور:</span>
                  <button
                    type="button"
                    onClick={handleSwapLocations}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>عكس المسار</span>
                  </button>
                </div>

                {/* Pickup Select */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-emerald-800 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>نقطة الانطلاق (الاستلام):</span>
                  </label>
                  <select
                    value={pickupLandmarkId}
                    onChange={(e) => setPickupLandmarkId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                  >
                    {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                      <option key={lm.id} value={lm.id}>
                        {lm.nameAr} {lm.isRural ? '(قرية / أطراف)' : '(وسط المدينة)'}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customPickupNote}
                    onChange={(e) => setCustomPickupNote(e.target.value)}
                    placeholder="تفاصيل إضافية للانطلاق (مثال: بجوار صيدلية...)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700"
                  />
                </div>

                {/* Dropoff Select */}
                <div className="flex flex-col gap-1 pt-1 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-rose-700 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>نقطة الوصول (التسليم):</span>
                  </label>
                  <select
                    value={dropoffLandmarkId}
                    onChange={(e) => setDropoffLandmarkId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                  >
                    {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                      <option key={lm.id} value={lm.id}>
                        {lm.nameAr} {lm.isRural ? '(قرية / أطراف)' : '(وسط المدينة)'}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={customDropoffNote}
                    onChange={(e) => setCustomDropoffNote(e.target.value)}
                    placeholder="تفاصيل إضافية للوصول (مثال: الدور الثالث شقة ٥)"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] text-slate-700"
                  />
                </div>
              </div>

              {/* Trip Description & Recipient Phone */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs grid grid-cols-1 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    وصف المشوار أو محتوى الطرد:
                  </label>
                  <input
                    type="text"
                    value={tripNotes}
                    onChange={(e) => setTripNotes(e.target.value)}
                    placeholder="مثال: توصيل أوراق هامة / شراء طلبات..."
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    رقم هاتف المستلم للتواصل:
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
                <label className="text-[10px] font-bold text-slate-700 block mb-1.5">
                  ٣. وسيلة الدفع المفضلة:
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setBookingPaymentMethod('cash')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                      bookingPaymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    💵 كاش للكابتن
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingPaymentMethod('wallet')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                      bookingPaymentMethod === 'wallet'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    💳 المحفظة ({customerWalletBalanceEgp} ج)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingPaymentMethod('instapay')}
                    className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                      bookingPaymentMethod === 'instapay'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    ⚡ إنستاباي
                  </button>
                </div>
              </div>

              {/* Authoritative Quote Breakdown Card */}
              {quoteData && (
                <div className="p-3 rounded-2xl bg-slate-900 text-white flex flex-col gap-1.5 text-xs shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>تسعيرة الخادم الموقعة (Piasters Engine)</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      {quoteData.isLiveBackendQuote ? `LIVE API • #${quoteData.signaturePreview}` : `#${quoteData.signaturePreview}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                    <div>فتحة العداد الأساسية: <strong className="text-white">{quoteData.baseFareEgp} ج.م</strong></div>
                    <div>حساب المسافة ({quoteData.distanceKm} كم): <strong className="text-white">{quoteData.distanceFareEgp} ج.م</strong></div>
                    {quoteData.ruralSurchargeEgp > 0 && (
                      <div>بدل قرى / وزن إضافي: <strong className="text-amber-300">{quoteData.ruralSurchargeEgp} ج.م</strong></div>
                    )}
                    <div>رسوم تشغيل المنصة: <strong className="text-white">{quoteData.platformFeeEgp} ج.م</strong></div>
                  </div>
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الإجمالي النهائي المستحق</span>
                      <span className="text-base font-black text-emerald-400">
                        {quoteData.totalEgp}.00 ج.م{' '}
                        <span className="text-[10px] text-slate-400 font-mono">({quoteData.totalPiasters} قرش)</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                      ١٠٠٪ من التوصيل للكابتن
                    </span>
                  </div>
                </div>
              )}

              {/* Validation Error Banner */}
              {bookingError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{bookingError}</span>
                </div>
              )}

              {/* Confirm Booking Button */}
              <button
                type="button"
                disabled={isLoadingQuote || bookingServiceMode === 'passenger_locked' || !quoteData}
                onClick={handleConfirmRideOrPackage}
                className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs shadow-lg flex items-center justify-center gap-2 transition-all ${
                  bookingServiceMode === 'passenger_locked' || !quoteData
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/25 active:scale-95 cursor-pointer'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>
                  {isLoadingQuote
                    ? 'جاري حساب التسعيرة...'
                    : `تأكيد وطلب كابتن الآن (${quoteData?.totalEgp || 0} ج.م)`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: STORES BROWSER & MARKETPLACE
           ======================================================== */}
        {(activeTab === 'stores' || selectedStore) && (
          <div className="flex-1 w-full h-full flex flex-col overflow-y-auto bg-[#FAFAF9]">
            {selectedStore ? (
              /* STORE DETAIL VIEW WITH PRODUCT MENU */
              <div className="flex-1 flex flex-col pb-24">
                {/* Store Header Banner */}
                <div className="relative w-full h-40 bg-slate-800 shrink-0">
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
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-800 flex items-center justify-center shadow-md z-10 cursor-pointer"
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
                                  className="w-6 h-6 rounded-lg bg-white text-emerald-800 flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-black text-emerald-900 px-1">
                                  {inCart.quantity}
                                </span>
                                <button
                                  onClick={() => handleAddProduct(prod, selectedStore)}
                                  className="w-6 h-6 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold shadow-2xs cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleAddProduct(prod, selectedStore)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold shadow-sm shadow-emerald-700/20 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
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
                      className="py-2 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
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

                {/* Category Filter Buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  <button
                    onClick={() => setStoreCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      storeCategoryFilter === 'all'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('restaurant')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      storeCategoryFilter === 'restaurant'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    مطاعم ومأكولات
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('pharmacy')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                      storeCategoryFilter === 'pharmacy'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    صيدليات وأدوية
                  </button>
                  <button
                    onClick={() => setStoreCategoryFilter('supermarket')}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
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
            TAB 4: ORDER & TRIP HISTORY (WITH 1-5 STAR RATING & FEEDBACK)
           ======================================================== */}
        {activeTab === 'history' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 pb-16">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-base text-slate-900">سجل المشاوير والطلبات</h2>
                <p className="text-[10px] text-slate-500">تقييم الكباتن ومراجعة الفواتير السابقة بالباجور</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {customerOrders.length} طلبات
              </span>
            </div>
            {customerOrders.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-500">
                لا توجد طلبات سابقة مسجلة لهذا الحساب حالياً.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {customerOrders.map((ord) => {
                  const acceptedText = formatHumanReadableAcceptedTimestamp(ord.acceptedAtIso, ord.acceptedAt);
                  const currentRating = ord.customerRating ?? 0;
                  const feedbackDraft =
                    historyFeedbackDrafts[ord.id] ?? ord.orderFeedback ?? ord.customerFeedback ?? '';
                  const isFeedbackSaved =
                    Boolean(historyFeedbackSavedMap[ord.id]) ||
                    Boolean(ord.orderFeedback || ord.customerFeedback);

                  return (
                    <div
                      key={ord.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-slate-900">
                          {ord.orderNumber} • {ord.storeName}
                        </span>
                        <span className="font-black text-emerald-800">{ord.totalEgp}.00 ج.م</span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>الإنشاء: {ord.createdAt}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSummarySheetOrder(ord)}
                            className="text-[10px] font-extrabold text-emerald-700 hover:underline px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer"
                          >
                            ملخص الطلب
                          </button>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-700'
                                : ord.status === 'cancelled'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {ord.status === 'delivered'
                              ? 'مكتمل بنجاح'
                              : ord.status === 'cancelled'
                              ? 'ملغي'
                              : 'قيد التنفيذ'}
                          </span>
                        </div>
                      </div>

                      {acceptedText && (
                        <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50/70 px-2.5 py-1 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                          <span>وقت قبول الطلب:</span>
                          <span>{acceptedText}</span>
                        </div>
                      )}

                      <div className="text-[11px] text-slate-700 border-t border-slate-100 pt-1.5 space-y-0.5">
                        {ord.items.map((i, idx) => (
                          <div key={idx} className="truncate">
                            {i.quantity}× {i.productName}
                          </div>
                        ))}
                      </div>

                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 flex items-center justify-between">
                        <span className="truncate">التسليم: {ord.deliveryAddress}</span>
                        {ord.assignedCaptainName && (
                          <span className="font-semibold text-slate-700 shrink-0">
                            الكابتن: {ord.assignedCaptainName}
                          </span>
                        )}
                      </div>

                      {/* Post-Delivery 1-5 Star Rating System inside Mobile History */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-extrabold text-slate-700">تقييم الكابتن:</span>
                          {currentRating > 0 && (
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                              {currentRating}/5 ★
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((starVal) => {
                            const isFilled = starVal <= currentRating;
                            return (
                              <button
                                key={starVal}
                                type="button"
                                onClick={() => rateOrderCaptain(ord.id, starVal)}
                                className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold flex items-center gap-0.5 transition cursor-pointer ${
                                  isFilled
                                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400'
                                }`}
                              >
                                <Star
                                  className={`w-3 h-3 ${
                                    isFilled ? 'text-amber-500 fill-amber-400' : 'text-slate-400'
                                  }`}
                                />
                                <span>{starVal}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Order Feedback Textarea inside Mobile History */}
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          updateOrderFeedback(ord.id, feedbackDraft.trim());
                          setHistoryFeedbackSavedMap((prev) => ({ ...prev, [ord.id]: true }));
                        }}
                        className="pt-2 border-t border-slate-100 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-extrabold text-slate-700">
                            ملاحظات وتعليق تجربة التوصيل:
                          </label>
                          {isFeedbackSaved && (
                            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              تم حفظ التعليق ✓
                            </span>
                          )}
                        </div>
                        <textarea
                          rows={2}
                          value={feedbackDraft}
                          onChange={(e) =>
                            setHistoryFeedbackDrafts((prev) => ({
                              ...prev,
                              [ord.id]: e.target.value,
                            }))
                          }
                          placeholder="اكتب رأيك في سرعة وجودة توصيل الكابتن..."
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-800 focus:outline-hidden focus:border-emerald-600 resize-none"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 truncate">
                            {ord.orderFeedback || ord.customerFeedback
                              ? `التعليق المسجل: ${ord.orderFeedback || ord.customerFeedback}`
                              : 'لم يتم إضافة تعليق بعد'}
                          </span>
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-extrabold shrink-0 cursor-pointer"
                          >
                            حفظ التعليق
                          </button>
                        </div>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 5: PROFILE, CUSTOMER WALLET & SUPPORT/COMPLAINTS
           ======================================================== */}
        {activeTab === 'profile' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5 pb-16">
            {/* Customer Identity Card */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl shadow-2xs">
                  {currentUser.avatar}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">{currentUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{currentUser.phone}</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 inline-block">
                    {currentUser.roleBadgeAr}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-extrabold cursor-pointer"
              >
                تبديل الدور
              </button>
            </div>

            {/* PROMINENT CUSTOMER WALLET SECTION (AVAILABLE CREDIT + ADD FUNDS + PROTOTYPE NOTICE) */}
            <div
              data-testid="customer-wallet-section"
              className="rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 text-white p-4 shadow-lg flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-emerald-200 font-bold">
                        محفظة مشوار الرقمية (Available Credit)
                      </span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        محاكاة تجريبية (Prototype)
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 block">
                      الرصيد المتاح للمشاوير والطلبات (في الإنتاج يتطلب Webhook موثق)
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddFundsModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة رصيد (Add Funds)</span>
                </button>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-white/10">
                <div>
                  <span className="text-2xl font-black tracking-tight text-white">
                    {customerWalletBalanceEgp}.00 ج.م
                  </span>
                  <span className="text-[10px] text-emerald-300 mr-2 font-mono">
                    ({customerWalletBalanceEgp * 100} قرش)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-200 bg-white/10 px-2 py-0.5 rounded-full">
                  إنستاباي • فودافون كاش
                </span>
              </div>
            </div>

            {/* Wallet Transaction History */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-xs text-slate-900">سجل معاملات المحفظة (Transaction History)</h4>
                <span className="text-[10px] text-slate-400 font-bold">{walletTransactions.length} حركات</span>
              </div>
              <div className="divide-y divide-slate-100">
                {walletTransactions.map((tx) => (
                  <div key={tx.id} className="py-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 text-[11px]">{tx.titleAr}</div>
                      <div className="text-[10px] text-slate-400">
                        {tx.timestampAr} • {tx.methodAr}
                      </div>
                    </div>
                    <span
                      className={`font-black text-xs ${
                        tx.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {tx.type === 'credit' ? '+' : '-'}
                      {tx.amountEgp}.00 ج.م
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Support & Complaints Section */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <HeadphonesIcon className="w-4 h-4 text-emerald-700" />
                  <h4 className="font-extrabold text-xs text-slate-900">الدعم الفني والشكاوى بالباجور</h4>
                </div>
                <button
                  onClick={() => setShowComplaintModal(true)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold cursor-pointer"
                >
                  + تقديم شكوى أو مقترح
                </button>
              </div>

              {complaints.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {complaints.map((c) => (
                    <div key={c.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{c.subjectAr}</span>
                        <span className="text-[10px] text-slate-500 mr-1.5">({c.orderNumber})</span>
                      </div>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        {c.status === 'open' ? 'قيد المراجعة' : 'تم الحل'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Funds Modal (Clearly Labeled Prototype Simulation) */}
      {showAddFundsModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmTopUp}
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">شحن رصيد محفظة مشوار</h3>
                <span className="text-[10px] font-bold text-amber-700">
                  محاكاة تجريبية (Prototype Simulation)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFundsModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-900 leading-relaxed">
              <strong>تنبيه الأمان المالي:</strong> هذا الشحن محاكاة لتجربة المستخدم فقط. في بيئة الإنتاج الفعلية لا يُضاف الرصيد إلا عبر إشعار دفع موقع رقمياً (`POST /api/v1/webhooks/payments/paymob`).
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">اختر قيمة الشحن (١٠ إلى ٥٠٠٠ ج.م):</label>
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 200].map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    onClick={() => setTopUpAmountEgp(amt)}
                    className={`py-2 rounded-xl font-black text-xs border cursor-pointer ${
                      topUpAmountEgp === amt
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    +{amt} ج.م
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">وسيلة الإيداع التجريبية:</label>
              <select
                value={topUpMethodLabel}
                onChange={(e) => setTopUpMethodLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800"
              >
                <option value="إنستاباي (InstaPay)">إنستاباي (InstaPay)</option>
                <option value="فودافون كاش (Vodafone Cash)">فودافون كاش (Vodafone Cash)</option>
                <option value="بطاقة بنكية (ميزة / فيزا)">بطاقة بنكية (ميزة / فيزا)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              تأكيد شحن تجريبي +{topUpAmountEgp} ج.م الآن
            </button>
          </form>
        </div>
      )}

      {/* Notifications Drawer */}
      {showNotificationsDrawer && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[75%] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900">التنبيهات والإشعارات الفورية</h3>
              <button
                onClick={() => setShowNotificationsDrawer(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{n.titleAr}</span>
                    <span className="text-[10px] text-slate-400">{n.timeAr}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">{n.bodyAr}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Support / Complaint Modal */}
      {showComplaintModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <form
            onSubmit={handleComplaintSubmit}
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-sm w-full flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-extrabold text-sm text-slate-900">تقديم بلاغ أو شكوى</h3>
              <button
                type="button"
                onClick={() => setShowComplaintModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">رقم الطلب المرتبط:</label>
              <input
                type="text"
                value={complaintOrderNum}
                onChange={(e) => setComplaintOrderNum(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">عنوان الشكوى:</label>
              <input
                type="text"
                value={complaintSubject}
                onChange={(e) => setComplaintSubject(e.target.value)}
                placeholder="مثال: تأخر في التوصيل / استفسار عن الفاتورة"
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">التفاصيل:</label>
              <textarea
                rows={2}
                value={complaintDetails}
                onChange={(e) => setComplaintDetails(e.target.value)}
                placeholder="اكتب التفاصيل ليقوم مدير العمليات بمراجعتها فوراً..."
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
            >
              إرسال البلاغ لغرفة عمليات الباجور
            </button>
          </form>
        </div>
      )}

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
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
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
                          className="w-5 h-5 rounded text-slate-700 flex items-center justify-center font-bold cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black px-1 text-slate-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartItemQty(item.product.id, item.quantity + 1)}
                          className="w-5 h-5 rounded text-emerald-700 flex items-center justify-center font-bold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
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
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      💵 كاش عند الاستلام
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      💳 المحفظة ({customerWalletBalanceEgp} ج)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-2 rounded-xl border font-bold text-center cursor-pointer ${
                        paymentMethod === 'instapay'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      ⚡ إنستاباي
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
                    className="p-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    متابعة التسوق
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
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
                className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs cursor-pointer"
              >
                إلغاء والاحتفاظ بالسلة
              </button>
              <button
                onClick={handleConfirmSwitchStore}
                className="py-2.5 rounded-xl bg-emerald-700 text-white font-extrabold text-xs shadow-md cursor-pointer"
              >
                تفريغ وبدء التسوق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Simulation Modal with Predefined Quick Messages */}
      {showChatModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col h-[78%]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  🛵
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900">
                    محادثة الكابتن: {activeCustomerOrder?.assignedCaptainName || 'كابتن محمد سعيد'}
                  </h4>
                  <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    متصل الآن في الباجور
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowChatModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
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
                      className={`max-w-[82%] p-2.5 rounded-2xl ${
                        isMe
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/70'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">{msg.time}</span>
                  </div>
                );
              })}
            </div>

            {/* Predefined Quick Messages Bar */}
            <div className="pt-2 pb-1.5 border-t border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 block mb-1">
                رسائل سريعة جاهزة للكابتن:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'أنا في انتظارك',
                  'أين أنت الآن؟',
                  'تواصل معي عند الوصول',
                  'شكراً لك يا كابتن',
                ].map((quickMsg) => (
                  <button
                    key={quickMsg}
                    type="button"
                    onClick={() => {
                      if (!activeCustomerOrder) return;
                      sendChatMessage(activeCustomerOrder.id, quickMsg);
                    }}
                    className="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold transition cursor-pointer"
                  >
                    {quickMsg}
                  </button>
                ))}
              </div>
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
                className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Captain Profile Bottom Sheet Modal */}
      {showCaptainProfileModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[82%] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center text-lg shadow-xs">
                  🛵
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-sm text-slate-900">
                      {activeCustomerOrder?.assignedCaptainName || 'كابتن محمد سعيد'}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black">
                      موثق بالباجور ✓
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold">
                    كابتن توصيل معتمد • مركز الباجور، المنوفية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCaptainProfileModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rating & Completed Trips in El Bagour */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-amber-800">تقييم الكابتن العام</span>
                <span className="text-lg font-black text-amber-600 mt-0.5 flex items-center gap-1">
                  <span>4.92</span>
                  <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
                </span>
                <span className="text-[9px] text-amber-700 font-bold">من تقييمات أهالي الباجور</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-emerald-800">إجمالي المشاوير بالباجور</span>
                <span className="text-lg font-black text-emerald-700 mt-0.5">348 مشوار</span>
                <span className="text-[9px] text-emerald-700 font-bold">نسبة التزام 99.4%</span>
              </div>
            </div>

            {/* Vehicle Details Card */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                <Bike className="w-4 h-4 text-emerald-700" />
                <span>بيانات المركبة المسجلة:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[9px] text-slate-400 block font-bold">نوع المركبة</span>
                  <span className="font-extrabold text-slate-800">باجاج بوكسر 150 (موتوسيكل)</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                  <span className="text-[9px] text-slate-400 block font-bold">رقم اللوحة</span>
                  <span className="font-extrabold text-slate-800 font-mono">م ن ف • ٤٨٢١</span>
                </div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-bold">نطاق الخدمة الأساسي:</span>
                <span className="font-extrabold text-emerald-800">الباجور، سبك الضحاك، جروان، بهناي</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowCaptainProfileModal(false);
                  setShowCallCaptainModal(true);
                }}
                className="py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>اتصال بالكابتن</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCaptainProfileModal(false);
                  setShowChatModal(true);
                }}
                className="py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>مراسلة فورية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call Captain Dialer Bottom Sheet Modal */}
      {showCallCaptainModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-slate-900">الاتصال الهاتفي بالكابتن</h4>
                  <p className="text-[10px] text-slate-500 font-bold">
                    {activeCustomerOrder?.assignedCaptainName || 'كابتن محمد سعيد'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCallCaptainModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-500 block">رقم هاتف الكابتن المسجل</span>
              <p className="font-mono font-black text-lg text-slate-900 tracking-wider" dir="ltr">
                {activeCustomerOrder?.assignedCaptainPhone || '01198765432'}
              </p>
              <span className="text-[10px] text-emerald-700 font-bold block">
                متاح للرد لمتابعة طلبك رقم {activeCustomerOrder?.orderNumber}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${activeCustomerOrder?.assignedCaptainPhone || '01198765432'}`}
                className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>اتصال مباشر الآن</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const phone = activeCustomerOrder?.assignedCaptainPhone || '01198765432';
                  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(phone).catch(() => {});
                  }
                  setCopiedCaptainPhone(true);
                  setTimeout(() => setCopiedCaptainPhone(false), 2000);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCaptainPhone ? 'تم النسخ ✓' : 'نسخ الرقم'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Order Summary Bottom Sheet Modal */}
      {summarySheetOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[82%] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-black text-sm text-slate-900">
                    ملخص تفاصيل الطلب {summarySheetOrder.orderNumber}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-black">
                    {summarySheetOrder.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                  تاريخ الإنشاء: {summarySheetOrder.createdAt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSummarySheetOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pickup & Dropoff Addresses */}
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">نقطة الاستلام (Pickup):</span>
                  <span className="font-extrabold text-slate-900">
                    {summarySheetOrder.pickupAddress || summarySheetOrder.storeName}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1.5 border-t border-slate-200/60">
                <Navigation className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">عنوان التوصيل (Dropoff):</span>
                  <span className="font-extrabold text-slate-900">
                    {summarySheetOrder.deliveryAddress}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Description */}
            <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-1.5 text-xs">
              <span className="text-[10px] font-extrabold text-slate-500 block">
                محتويات الطلب والأصناف:
              </span>
              {summarySheetOrder.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                  <span>
                    {item.quantity}x {item.productName}
                  </span>
                  <span>{item.unitPriceEgp * item.quantity}.00 ج.م</span>
                </div>
              ))}
              {(summarySheetOrder.orderNotes || summarySheetOrder.notes) && (
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 text-[10px] text-amber-800 font-bold">
                  ملاحظات العميل: {summarySheetOrder.orderNotes || summarySheetOrder.notes}
                </div>
              )}
            </div>

            {/* Customer & Captain Info */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[9px] text-slate-400 font-bold block">بيانات العميل</span>
                <span className="font-extrabold text-slate-800 block">{summarySheetOrder.customerName}</span>
                <span className="font-mono text-[10px] text-slate-600">{summarySheetOrder.customerPhone}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-[9px] text-slate-400 font-bold block">الكابتن والدفع</span>
                <span className="font-extrabold text-slate-800 block">
                  {summarySheetOrder.assignedCaptainName || 'كابتن محمد سعيد'}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">
                  {summarySheetOrder.paymentMethod === 'cash' ? 'الدفع نقداً عند الاستلام' : 'محفظة مشوار'}
                </span>
              </div>
            </div>

            {/* Total Row */}
            <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <span className="text-xs font-bold">إجمالي الطلب شامل التوصيل</span>
              <span className="text-sm font-black text-emerald-400">
                {summarySheetOrder.totalEgp + (summarySheetOrder.id === activeCustomerOrder?.id ? mobileTipEgp : 0)}.00 ج.م
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Bottom Sheet Modal */}
      {showCancelConfirmModal && activeCustomerOrder && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center gap-2.5 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">تأكيد إلغاء الطلب الحالي؟</h4>
                <p className="text-[11px] text-slate-500 font-bold">
                  الطلب رقم {activeCustomerOrder.orderNumber} • {activeCustomerOrder.storeName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم تحديث حالة الطلب فوراً إلى ملغي وإشعار المتجر والكابتن في الباجور.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  customerCancelOrder(activeCustomerOrder.id);
                  setShowCancelConfirmModal(false);
                }}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer shadow-xs"
              >
                نعم، تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirmModal(false)}
                className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs cursor-pointer"
              >
                تراجع واستمرار الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Emergency Assistance Bottom Sheet Modal (El Bagour) */}
      {showSosEmergencyModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[84%] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-rose-950">طوارئ وأمان مشوار الباجور (SOS)</h4>
                  <p className="text-[10px] text-rose-600 font-bold">
                    مشاركة الموقع الفوري والاتصال السريع بالطوارئ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSosEmergencyModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live GPS Location & Emergency Contact in El Bagour */}
            <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-rose-900">جهة اتصال الطوارئ المسجلة بالباجور:</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-rose-700 font-black text-[10px] border border-rose-200">
                  الباجور • المنوفية
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-rose-100 flex items-center justify-between">
                <div>
                  <span className="font-black text-slate-900 block">د. سامح المنوفي (أقارب - الباجور)</span>
                  <span className="font-mono text-[11px] text-slate-600" dir="ltr">
                    01099881122
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  30.4312° N, 31.0365° E
                </span>
              </div>

              <button
                type="button"
                onClick={() => setMobileSosLocationShared(true)}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>
                  {mobileSosLocationShared
                    ? 'تم إرسال الموقع الحي لجهة الطوارئ بنجاح ✓'
                    : 'مشاركة موقعي الحي الآن مع جهة الطوارئ'}
                </span>
              </button>
            </div>

            {/* Emergency Services in El Bagour */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-500 block">
                أرقام طوارئ مركز ومدينة الباجور المباشرة:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSosCalledService('شرطة النجدة بالباجور (122)')}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex flex-col items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-rose-400" />
                  <span>شرطة النجدة (122)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileSosCalledService('إسعاف الباجور المركزي (123)')}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex flex-col items-center gap-1 cursor-pointer"
                >
                  <Phone className="w-4 h-4 text-emerald-400" />
                  <span>إسعاف الباجور (123)</span>
                </button>
              </div>
              {mobileSosCalledService && (
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold text-center">
                  جاري الاتصال الفوري بـ: {mobileSosCalledService} — تم إرفاق إحداثيات المشوار
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Customer Mobile Bottom Navigation Bar (5 Unified Destinations, Touch Targets >= 44px) */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1 px-2 flex items-center justify-around shadow-sm shrink-0">
        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('home');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'home' && !selectedStore
              ? 'text-emerald-700 font-extrabold bg-emerald-50/60'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('ride_booking');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'ride_booking' && !selectedStore
              ? 'text-emerald-700 font-extrabold bg-emerald-50/60'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Bike className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">مشوار/طرد</span>
        </button>

        <button
          onClick={() => {
            setSelectedStore(null);
            setActiveTab('stores');
          }}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'stores' || selectedStore
              ? 'text-emerald-700 font-extrabold bg-emerald-50/60'
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
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-emerald-700 font-extrabold bg-emerald-50/60'
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
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'text-emerald-700 font-extrabold bg-emerald-50/60'
              : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المحفظة</span>
        </button>
      </div>
    </div>
  );
};
