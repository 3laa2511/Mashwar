import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Navigation,
  Phone,
  MessageSquare,
  Package,
  Bike,
  Store,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
  Edit3,
  DollarSign,
  Share2,
  AlertTriangle,
  Activity,
  Zap,
  Volume2,
  VolumeX,
  Lock,
  Banknote,
  CheckCircle2,
  Send,
  Star,
  Battery,
  BatteryLow,
  BatteryCharging,
} from 'lucide-react';
import { ActiveOrderStaticMapThumbnail } from './ActiveOrderStaticMapThumbnail';
import { SosEmergencySheet } from './SosEmergencySheet';
import {
  useMarketplace,
  MarketplaceOrder,
  formatHumanReadableAcceptedTimestamp,
} from '../../store/marketplaceStore';

interface OrderTrackingScreenProps {
  order?: MarketplaceOrder | null;
  orderId?: string;
  onBackToHome?: () => void;
  onOpenOrderSummary?: (order: MarketplaceOrder) => void;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  order: propOrder,
  orderId,
  onBackToHome,
}) => {
  const {
    orders,
    activeCustomerOrder,
    refreshOrderStatus,
    simulateInstantCaptainAccept,
    customerApproveOrderQuote,
    captainVerifyRidePinAndStart,
    captainUpdateStep,
    updateOrderNotes,
    updateOrderDriverTip,
    chatMessages,
    sendChatMessage,
    setActiveChatThreadId,
    submitDriverReview,
    isFirestoreRealtimeActive,
    batteryLevelPercent,
    isCharging,
    isBatterySaverActive,
    batterySaverPreference,
    setBatterySaverPreference,
    simulatedBatteryPercent,
    setSimulatedBatteryPercent,
    gpsUpdateIntervalMs,
    gpsTrackingLocation,
    forceGpsSyncNow,
  } = useMarketplace();

  // Resolve target order
  const order =
    propOrder ??
    (orderId ? orders.find((o) => o.id === orderId || o.orderNumber === orderId) : null) ??
    activeCustomerOrder;

  // Map & Controls State
  const [mapZoomScale, setMapZoomScale] = useState<number>(1);
  const [mapLayerStyle, setMapLayerStyle] = useState<'route' | 'satellite'>('route');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<'pickup' | 'dropoff' | null>(null);

  // Refresh & Skeleton State
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshProgress, setRefreshProgress] = useState<number>(0);
  const [refreshDone, setRefreshDone] = useState<boolean>(false);

  // Haptic Feedback Simulation
  const [isHapticShaking, setIsHapticShaking] = useState<boolean>(false);
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch {
      // Ignore vibration errors
    }
    setIsHapticShaking(false);
    window.requestAnimationFrame(() => setIsHapticShaking(true));
  };

  useEffect(() => {
    if (!isHapticShaking) return;
    const t = window.setTimeout(() => setIsHapticShaking(false), 320);
    return () => window.clearTimeout(t);
  }, [isHapticShaking]);

  // Sound & Status Slide-in Notification
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(true);
  const [audioCueText, setAudioCueText] = useState<string | null>(null);
  const [isSlideIn, setIsSlideIn] = useState<boolean>(false);
  const prevStatusRef = useRef<string | undefined>(order?.status);

  // ETA countdown
  const durationMins =
    order?.estimatedDuration ??
    order?.estimatedDurationMinutes ??
    (order?.distanceKm ? Math.round(order.distanceKm * 5 + 4) : 18);
  const [etaSeconds, setEtaSeconds] = useState<number>(durationMins * 60);

  useEffect(() => {
    setEtaSeconds(durationMins * 60);
  }, [order?.id, durationMins]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formattedEta = `${String(Math.floor(etaSeconds / 60)).padStart(2, '0')}:${String(
    etaSeconds % 60
  ).padStart(2, '0')}`;

  // Sound effect
  const playSound = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      window.setTimeout(() => ctx.close().catch(() => {}), 500);
    } catch {
      // Ignore audio error
    }
  };

  useEffect(() => {
    if (order?.status && prevStatusRef.current && prevStatusRef.current !== order.status) {
      setIsSlideIn(true);
      if (isSoundEnabled) {
        playSound();
        setAudioCueText(`🔔 تقدمت حالة الطلب: ${order.status}`);
      }
    }
    prevStatusRef.current = order?.status;
  }, [order?.status, isSoundEnabled]);

  useEffect(() => {
    if (!isSlideIn) return;
    const t = window.setTimeout(() => setIsSlideIn(false), 500);
    return () => window.clearTimeout(t);
  }, [isSlideIn]);

  useEffect(() => {
    if (!audioCueText) return;
    const t = window.setTimeout(() => setAudioCueText(null), 3000);
    return () => window.clearTimeout(t);
  }, [audioCueText]);

  // Pull-to-refresh
  const [pullDist, setPullDist] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing || (containerRef.current?.scrollTop ?? 0) > 4) return;
    if (e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || touchStartY.current === null || isRefreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDist(Math.min(80, Math.round(delta * 0.5)));
    } else {
      setPullDist(0);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling) return;
    const shouldRefresh = pullDist >= 48;
    touchStartY.current = null;
    setIsPulling(false);
    setPullDist(0);
    if (shouldRefresh && !isRefreshing) {
      handleManualRefresh();
    }
  };

  const handleManualRefresh = async () => {
    if (isRefreshing || !order) return;
    triggerHaptic();
    setIsRefreshing(true);
    setRefreshDone(false);
    setRefreshProgress(30);
    await new Promise((r) => setTimeout(r, 200));
    setRefreshProgress(75);
    await refreshOrderStatus(order.id);
    await new Promise((r) => setTimeout(r, 180));
    setRefreshProgress(100);
    setIsRefreshing(false);
    setRefreshDone(true);
    setTimeout(() => {
      setRefreshProgress(0);
      setRefreshDone(false);
    }, 1600);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    triggerHaptic();
    setMapZoomScale((prev) => Math.min(3, Number((prev + 0.35).toFixed(2))));
  };
  const handleZoomOut = () => {
    triggerHaptic();
    setMapZoomScale((prev) => Math.max(1, Number((prev - 0.35).toFixed(2))));
  };
  const handleResetZoom = () => {
    triggerHaptic();
    setMapZoomScale(1);
  };

  // Copy address
  const handleCopy = (field: 'pickup' | 'dropoff', text: string) => {
    triggerHaptic();
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Advance status simulation
  const handleAdvance = () => {
    if (!order) return;
    triggerHaptic();
    const st = order.status;
    if (['created', 'searching_captain', 'accepted_by_store', 'preparing', 'ready_for_pickup'].includes(st)) {
      simulateInstantCaptainAccept(order.id);
    } else if (st === 'captain_assigned') {
      captainUpdateStep(order.id, 'at_pickup');
    } else if (st === 'at_pickup') {
      captainUpdateStep(order.id, 'picked_up');
    } else if (st === 'picked_up') {
      if (order.serviceType === 'ride' && order.ridePin) {
        captainVerifyRidePinAndStart(order.id, order.ridePin);
      } else {
        captainUpdateStep(order.id, 'in_transit');
      }
    } else if (st === 'in_transit') {
      captainUpdateStep(order.id, 'delivered');
    }
  };

  // Interactive panels
  const [activeInlineTool, setActiveInlineTool] = useState<'none' | 'notes' | 'tip' | 'share' | 'call' | 'chat'>('none');
  const [isTimelineExpanded, setIsTimelineExpanded] = useState<boolean>(true);
  const [notesDraft, setNotesDraft] = useState<string>(order?.orderNotes || order?.notes || '');
  const [notesSaved, setNotesSaved] = useState<boolean>(false);
  const [customTipInput, setCustomTipInput] = useState<string>('');
  const [showSosSheet, setShowSosSheet] = useState<boolean>(false);
  const [liveLinkCopied, setLiveLinkCopied] = useState<boolean>(false);
  const [captainPhoneCopied, setCaptainPhoneCopied] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingTags, setRatingTags] = useState<string[]>(['أخلاق عالية']);
  const [ratingFeedbackText, setRatingFeedbackText] = useState<string>('');
  const [ratingSubmittedDone, setRatingSubmittedDone] = useState<boolean>(false);
  const tipEgp = order?.driverTipEgp ?? 0;

  useEffect(() => {
    setActiveChatThreadId(order?.id || null);
    return () => setActiveChatThreadId(null);
  }, [order?.id, setActiveChatThreadId]);

  const orderThreadMessages = order
    ? chatMessages.filter((m) => m.orderId === order.id)
    : [];

  const pickupAddress = order?.storeAddress || order?.pickupAddress || 'ميدان المحطة - وسط الباجور';
  const dropoffAddress = order?.deliveryAddress || 'شارع الجيش - برج الشروق، الباجور';
  const liveLinkUrl = order ? `https://mashwar-bagour.eg/live/${order.orderNumber}` : '';

  const acceptedText = order
    ? formatHumanReadableAcceptedTimestamp(order.acceptedAtIso, order.acceptedAt)
    : null;

  if (!order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#FAFAF9] text-slate-700 font-['Cairo',sans-serif]">
        <Package className="w-12 h-12 text-slate-400 mb-2" />
        <h3 className="font-extrabold text-sm text-slate-900">لا يوجد طلب نشط حالياً</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          قم بحجز مشوار أو توصيل طرد أو طلب من أحد المتاجر لبدء التتبع الحي.
        </p>
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="mt-4 px-4 py-2 rounded-xl bg-emerald-700 text-white font-extrabold text-xs shadow-sm cursor-pointer hover:bg-emerald-600 transition"
          >
            العودة للرئيسية
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-testid="order-tracking-screen"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-y-auto select-none transition-all ${
        isSlideIn ? 'animate-m3-slide-in' : ''
      } ${isHapticShaking ? 'animate-haptic-shake' : ''}`}
      dir="rtl"
    >
      {/* Pull-to-refresh banner */}
      {(pullDist > 0 || isRefreshing) && (
        <div
          data-testid="mobile-pull-to-refresh-indicator"
          className="w-full py-1 px-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-center gap-2 text-[10px] font-extrabold text-emerald-800 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 ${isRefreshing || pullDist >= 48 ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'جاري تحديث الخريطة والتسلسل...' : pullDist >= 48 ? 'أفلت للتحديث' : 'اسحب للأسفل للتحديث'}</span>
        </div>
      )}

      {/* Audio Cue Banner */}
      {audioCueText && (
        <div
          data-testid="mobile-audio-notification-toast"
          className="px-3 py-1.5 bg-amber-50 border-b border-amber-300 text-amber-900 text-[10px] font-bold flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 text-amber-600 animate-bounce shrink-0" />
            <span>{audioCueText}</span>
          </div>
          <button onClick={() => setAudioCueText(null)} className="font-black text-amber-800">✕</button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-white px-3.5 pt-2.5 pb-2 border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-xs text-slate-900 truncate">
                تتبع الطلب {order.orderNumber}
              </h2>
              <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200">
                {order.totalEgp}.00 ج.م
              </span>
            </div>
            <p className="text-[10px] text-slate-500 truncate">{order.storeName}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="mobile-sound-toggle-btn"
            onClick={() => {
              triggerHaptic();
              setIsSoundEnabled((prev) => !prev);
            }}
            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
              isSoundEnabled ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
            title="الصوت"
          >
            {isSoundEnabled ? <Volume2 className="w-3 h-3 text-amber-600" /> : <VolumeX className="w-3 h-3 text-slate-400" />}
          </button>

          {order.status !== 'delivered' && (
            <button
              type="button"
              data-testid="mobile-advance-status-btn"
              onClick={handleAdvance}
              className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shadow-2xs transition"
              title="تقديم المرحلة"
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>المرحلة التالية</span>
            </button>
          )}

          <button
            type="button"
            data-testid="mobile-refresh-order-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-100 hover:bg-slate-200 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer transition"
          >
            <RefreshCw className={`w-3 h-3 text-emerald-700 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? '...' : 'تحديث'}</span>
          </button>

          <button
            type="button"
            data-testid="sos-emergency-btn"
            onClick={() => {
              triggerHaptic();
              setShowSosSheet(true);
            }}
            className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer shadow-2xs transition"
            title="طوارئ الباجور ومشاركة GPS"
          >
            <ShieldCheck className="w-3 h-3" />
            <span>SOS</span>
          </button>
        </div>
      </div>

      <div
        data-testid="active-order-tracking-widget"
        data-status-animation={isSlideIn ? 'slide-in' : 'settled'}
        data-haptic-feedback={isHapticShaking ? 'active' : 'idle'}
        data-pull-to-refresh={
          isRefreshing
            ? 'refreshing'
            : pullDist >= 48
              ? 'ready'
              : pullDist > 0
                ? 'pulling'
                : 'idle'
        }
        data-pull-distance={Math.round(pullDist)}
        data-audio-cue={audioCueText ? 'playing' : 'idle'}
        data-sound-enabled={isSoundEnabled ? 'true' : 'false'}
        className="p-3 flex flex-col gap-2.5 pb-20"
      >
        {/* =====================================================================
            INTEGRATED ACTIVE ORDER STATIC MAP THUMBNAIL COMPONENT
            Matches 'active-order-static-map-thumbnail' data-testid contract
            with zoom, layer toggle, landmarks, pan controls, and pulsing pins.
           ===================================================================== */}
        <ActiveOrderStaticMapThumbnail
          orderStatus={order.status}
          pickupAddress={pickupAddress}
          dropoffAddress={dropoffAddress}
          distanceKm={order.distanceKm || 2.4}
          durationMinutes={durationMins}
          etaSeconds={etaSeconds}
          isRefreshing={isRefreshing}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => {
            triggerHaptic();
            setIsDarkMode((prev) => !prev);
          }}
          mapLayerStyle={mapLayerStyle}
          onToggleMapLayerStyle={() => {
            triggerHaptic();
            setMapLayerStyle((prev) => (prev === 'route' ? 'satellite' : 'route'));
          }}
          mapZoomScale={mapZoomScale}
          onMapZoomScaleChange={setMapZoomScale}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => {
            triggerHaptic();
            setIsFullScreen((prev) => !prev);
          }}
          copiedField={copiedField}
          onCopyAddress={handleCopy}
          onTriggerHaptic={triggerHaptic}
        />

        {/* Dual Metric Strip: Accepted Timestamp + Dynamic ETA Countdown Timer */}
        <div className="grid grid-cols-2 gap-2">
          {acceptedText ? (
            <div
              data-testid="active-order-accepted-timestamp"
              className="p-2 rounded-xl bg-emerald-50/90 border border-emerald-200/90 flex flex-col justify-between text-[11px] text-emerald-950"
            >
              <div className="flex items-center gap-1 font-bold text-emerald-800">
                <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                <span>وقت قبول الطلب:</span>
              </div>
              <span className="font-black text-emerald-900 text-[11px] mt-0.5 truncate">{acceptedText}</span>
            </div>
          ) : (
            <div
              data-testid="active-order-pending-timestamp"
              className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 flex flex-col justify-between text-[11px] text-amber-900"
            >
              <span className="font-bold flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600 animate-spin" />
                <span>الإنشاء: {order.createdAt}</span>
              </span>
              <span className="font-extrabold text-amber-800 text-[10px] mt-0.5">بانتظار القبول...</span>
            </div>
          )}

          <div
            data-testid="active-order-eta-timer"
            className="p-2 rounded-xl bg-slate-900 text-white border border-slate-800 flex items-center justify-between"
          >
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">الوصول المتوقع (ETA)</span>
              <span className="font-mono font-black text-sm text-amber-400">{formattedEta}</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-lg border border-emerald-800">
              ~{durationMins} د
            </span>
          </div>
        </div>

        {/* Battery Saver & Adaptive GPS Polling Telemetry Bar */}
        <div
          data-testid="tracking-battery-saver-card"
          className={`p-3 rounded-2xl border flex flex-col gap-2.5 text-xs ${
            isBatterySaverActive
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-white border-slate-200/80 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : isBatterySaverActive ? (
                <BatteryLow className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Battery className="w-4 h-4 text-emerald-700 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="font-extrabold text-[11px] truncate">
                  {isBatterySaverActive
                    ? 'وضع توفير الطاقة نشط — تقليل تحديث GPS'
                    : 'تتبع GPS بالوضع القياسي عالي الدقة'}
                </div>
                <div className="text-[10px] opacity-80 tabular-nums truncate">
                  شحن {batteryLevelPercent}% · تحديث كل {Math.round(gpsUpdateIntervalMs / 1000)} ث · آخر مزامنة {gpsTrackingLocation.lastUpdatedAt}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={forceGpsSyncNow}
              className="min-h-[44px] px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-extrabold text-slate-800 shrink-0 cursor-pointer"
            >
              تحديث الموقع
            </button>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200/70 pt-2">
            <button
              type="button"
              data-testid="tracking-battery-saver-toggle"
              onClick={() =>
                setBatterySaverPreference(batterySaverPreference === 'always_on' ? 'auto' : 'always_on')
              }
              className={`flex-1 min-h-[44px] px-2.5 rounded-xl font-extrabold text-[11px] border cursor-pointer transition ${
                batterySaverPreference === 'always_on'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {batterySaverPreference === 'always_on'
                ? 'وضع التوفير مفعل يدوياً'
                : 'تلقائي عند أقل من ٢٠٪'}
            </button>
            <button
              type="button"
              data-testid="tracking-battery-simulate-low-btn"
              onClick={() => setSimulatedBatteryPercent(simulatedBatteryPercent !== null && simulatedBatteryPercent < 20 ? null : 15)}
              className={`min-h-[44px] px-3 rounded-xl font-extrabold text-[11px] border cursor-pointer transition ${
                simulatedBatteryPercent !== null && simulatedBatteryPercent < 20
                  ? 'bg-slate-900 text-amber-300 border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {simulatedBatteryPercent !== null && simulatedBatteryPercent < 20 ? 'إلغاء محاكاة ١٥٪' : 'اختبار شحن ١٥٪'}
            </button>
          </div>
        </div>

        {/* Ride 4-Digit Security PIN + Family Trusted / Multi-Stop / Quote Cards */}
        {order.ridePin && order.status !== 'delivered' && order.status !== 'cancelled' && (
          <div
            data-testid="ride-security-pin-card"
            className="p-3 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 flex items-center justify-between gap-2 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-[11px] font-black text-emerald-300">كود أمان بدء الرحلة (OTP)</div>
                <div className="text-[10px] text-slate-300">
                  أخبر الكابتن بالكود عند الركوب فقط{order.requiresFamilyTrustedDriver ? ' • كابتن عائلات موثوق' : ''}
                </div>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-mono font-black text-base tracking-widest tabular-nums">
              {order.ridePin}
            </div>
          </div>
        )}

        {order.status === 'quote_ready' && (
          <div className="p-3 rounded-2xl bg-amber-50 border-2 border-amber-400 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950">عرض سعر جاهز من {order.storeName}</span>
              <span className="text-sm font-black text-emerald-800 tabular-nums">{order.totalEgp} ج.م</span>
            </div>
            {order.quoteNotes && (
              <p className="text-[11px] text-amber-900 font-semibold">{order.quoteNotes}</p>
            )}
            <button
              type="button"
              onClick={() => customerApproveOrderQuote(order.id)}
              className="w-full min-h-[44px] py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>اعتماد السعر والبدء بالتوصيل</span>
            </button>
          </div>
        )}

        {(order.storeNames && order.storeNames.length > 1) || (order.cashChangeForEgp && order.cashChangeForEgp > 0) ? (
          <div className="px-3 py-2 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-700">
            {order.storeNames && order.storeNames.length > 1 && (
              <span>سلة مجمعة ({order.storeNames.length} محلات): {order.storeNames.join(' ← ')}</span>
            )}
            {order.cashChangeForEgp && order.cashChangeForEgp > 0 && (
              <span className="flex items-center gap-1 text-emerald-800">
                <Banknote className="w-3.5 h-3.5" />
                <span>فكة مطلوبة من ورقة {order.cashChangeForEgp} ج.م</span>
              </span>
            )}
          </div>
        ) : null}

        {/* Stepper Timeline */}
        <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsTimelineExpanded((p) => !p)}
              className="text-[11px] font-extrabold text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              <span>مراحل توصيل الطلب في الباجور</span>
              {isTimelineExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <span
              data-testid="active-order-status-badge"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              {order.status}
            </span>
          </div>

          {isTimelineExpanded && (
            <div data-testid="active-order-vertical-timeline" className="space-y-2 pt-1 border-t border-slate-100">
              {[
                { key: 'created', title: 'تم إنشاء الطلب', desc: order.createdAt, done: true },
                {
                  key: 'searching',
                  title: 'تأكيد الطلب وتوجيه الكابتن',
                  desc: acceptedText || 'جاري مطابقة أقرب كابتن',
                  done: ['accepted_by_store', 'preparing', 'merchant_accepted', 'ready_for_pickup', 'captain_assigned', 'at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(order.status),
                },
                {
                  key: 'at_pickup',
                  title: 'وصول الكابتن لنقطة الاستلام',
                  desc: pickupAddress,
                  done: ['at_pickup', 'picked_up', 'in_transit', 'delivered'].includes(order.status),
                },
                {
                  key: 'in_transit',
                  title: 'الكابتن في الطريق إليك',
                  desc: dropoffAddress,
                  done: ['in_transit', 'delivered'].includes(order.status),
                },
                {
                  key: 'delivered',
                  title: 'تم إتمام المشوار والتسليم',
                  desc: `${order.totalEgp}.00 ج.م`,
                  done: order.status === 'delivered',
                },
              ].map((step, idx) => (
                <div key={step.key} className="flex items-start gap-2 text-xs">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5 ${
                      step.done ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step.done ? '✓' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-[11px] text-slate-900">{step.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls Grid (Call, Chat, Notes, Tip, Share) */}
        <div data-testid="active-order-actions-grid" className="grid grid-cols-5 gap-1">
          <button
            type="button"
            data-testid="call-captain-btn"
            onClick={() => {
              triggerHaptic();
              setActiveInlineTool((p) => (p === 'call' ? 'none' : 'call'));
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer ${
              activeInlineTool === 'call' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700 hover:text-emerald-900'
            }`}
          >
            <Phone className={`w-3.5 h-3.5 ${activeInlineTool === 'call' ? 'text-white' : 'text-emerald-700'}`} />
            <span className="text-[10px] font-extrabold">اتصال</span>
          </button>

          <button
            type="button"
            data-testid="tracking-chat-btn"
            onClick={() => {
              triggerHaptic();
              setActiveInlineTool((p) => (p === 'chat' ? 'none' : 'chat'));
            }}
            className={`relative p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer ${
              activeInlineTool === 'chat' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700 hover:text-emerald-900'
            }`}
          >
            <MessageSquare className={`w-3.5 h-3.5 ${activeInlineTool === 'chat' ? 'text-white' : 'text-emerald-700'}`} />
            <span className="text-[10px] font-extrabold">محادثة</span>
            {orderThreadMessages.length > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                {orderThreadMessages.length}
              </span>
            )}
          </button>

          <button
            type="button"
            data-testid="message-captain-btn"
            onClick={() => {
              triggerHaptic();
              setActiveInlineTool((p) => (p === 'notes' ? 'none' : 'notes'));
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer ${
              activeInlineTool === 'notes' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700'
            }`}
          >
            <Edit3 className={`w-3.5 h-3.5 ${activeInlineTool === 'notes' ? 'text-white' : 'text-amber-600'}`} />
            <span className="text-[10px] font-extrabold">ملاحظات</span>
          </button>

          <button
            type="button"
            data-testid="add-tip-btn"
            onClick={() => {
              triggerHaptic();
              setActiveInlineTool((p) => (p === 'tip' ? 'none' : 'tip'));
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer ${
              activeInlineTool === 'tip' || tipEgp > 0 ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700'
            }`}
          >
            <DollarSign className={`w-3.5 h-3.5 ${activeInlineTool === 'tip' || tipEgp > 0 ? 'text-white' : 'text-emerald-700'}`} />
            <span className="text-[10px] font-extrabold">{tipEgp > 0 ? `+${tipEgp} ج` : 'إكرامية'}</span>
          </button>

          <button
            type="button"
            data-testid="share-live-link-btn"
            onClick={() => {
              triggerHaptic();
              setActiveInlineTool((p) => (p === 'share' ? 'none' : 'share'));
            }}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition hover:scale-105 active:scale-95 cursor-pointer ${
              activeInlineTool === 'share' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-700'
            }`}
          >
            <Share2 className={`w-3.5 h-3.5 ${activeInlineTool === 'share' ? 'text-white' : 'text-slate-700'}`} />
            <span className="text-[10px] font-extrabold">مشاركة</span>
          </button>
        </div>

        {/* Inline Real-Time Chat Panel (Firestore Threads) */}
        {activeInlineTool === 'chat' && (
          <div data-testid="tracking-chat-panel" className="p-3 rounded-2xl bg-white border-2 border-emerald-200 flex flex-col gap-2 text-xs shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-700" />
                <span className="font-extrabold text-slate-900">محادثة آمنة مع {order.assignedCaptainName || 'الكابتن'}</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {isFirestoreRealtimeActive ? 'متزامن لحظياً' : 'محادثة مشوار'}
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 p-1 bg-slate-50 rounded-xl">
              {orderThreadMessages.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-3">
                  ابدأ المحادثة مع الكابتن لتنسيق نقطة الالتقاء أو علامات الطريق
                </p>
              ) : (
                orderThreadMessages.map((msg) => {
                  const isMine = msg.senderRole === 'customer';
                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[11px] ${
                        isMine
                          ? 'self-start bg-emerald-700 text-white rounded-br-xs'
                          : 'self-end bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                      }`}
                    >
                      <div className="text-[9px] opacity-75 font-bold mb-0.5">
                        {msg.senderName} • {msg.time}
                      </div>
                      <div className="font-semibold">{msg.text}</div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
              {['أنا منتظر عند المدخل', 'كود الأمان معي جاهز', 'رن عليا لما توصل'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => sendChatMessage(order.id, chip)}
                  className="shrink-0 px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 text-[10px] font-bold cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                sendChatMessage(order.id, chatInput);
                setChatInput('');
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="اكتب رسالتك للكابتن..."
                className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900"
              />
              <button
                type="submit"
                className="p-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
                title="إرسال"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* Inline Call Captain Panel */}
        {activeInlineTool === 'call' && (
          <div data-testid="call-captain-panel" className="p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-950">
                التواصل مع الكابتن: {order.assignedCaptainName || 'جاري الإسناد'}
              </span>
              <button
                type="button"
                onClick={() => setActiveInlineTool('none')}
                className="text-[11px] text-slate-500 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`tel:${order.assignedCaptainPhone || '01198765432'}`}
                className="flex-1 min-h-[40px] py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="font-mono" dir="ltr">{order.assignedCaptainPhone || '01198765432'}</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  const phone = order.assignedCaptainPhone || '01198765432';
                  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(phone).catch(() => {});
                  }
                  setCaptainPhoneCopied(true);
                  setTimeout(() => setCaptainPhoneCopied(false), 2000);
                }}
                className="px-3 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                {captainPhoneCopied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{captainPhoneCopied ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Inline Notes Panel */}
        {activeInlineTool === 'notes' && (
          <form
            data-testid="edit-notes-section"
            onSubmit={(e) => {
              e.preventDefault();
              if (!order) return;
              updateOrderNotes(order.id, notesDraft.trim());
              setNotesSaved(true);
              setTimeout(() => setNotesSaved(false), 2000);
            }}
            className="p-2.5 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col gap-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11px] text-amber-950">ملاحظات الطلب للكابتن:</span>
              {notesSaved && <span className="text-[10px] font-black text-emerald-700">تم الحفظ ✓</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                data-testid="edit-order-notes-input"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="أضف ملاحظات التوصيل..."
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-xs text-slate-900"
              />
              <button
                type="submit"
                data-testid="save-order-notes-btn"
                className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-[11px] font-extrabold cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </form>
        )}

        {/* Inline Tip Panel */}
        {activeInlineTool === 'tip' && (
          <div data-testid="add-tip-section" className="p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11px] text-emerald-950">إكرامية الكابتن:</span>
              <span className="text-[10px] font-black text-emerald-800">+{tipEgp} ج.م</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[5, 10, 20].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  data-testid={`tip-preset-${amt}`}
                  onClick={() => {
                    updateOrderDriverTip(order.id, amt);
                    setCustomTipInput(String(amt));
                  }}
                  className={`py-1.5 rounded-xl font-extrabold text-[11px] border cursor-pointer ${
                    tipEgp === amt ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-800 border-slate-200'
                  }`}
                >
                  {amt} ج
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  updateOrderDriverTip(order.id, 0);
                  setCustomTipInput('');
                }}
                className="py-1.5 rounded-xl font-bold text-[10px] bg-white text-slate-500 border border-slate-200 cursor-pointer"
              >
                بدون
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateOrderDriverTip(order.id, Math.max(0, Math.round(Number(customTipInput) || 0)));
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="number"
                min={0}
                max={500}
                step={1}
                value={customTipInput}
                onChange={(e) => setCustomTipInput(e.target.value)}
                placeholder="مبلغ مخصص بالجنيه..."
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-xs font-mono text-slate-900"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold cursor-pointer"
              >
                تطبيق
              </button>
            </form>
          </div>
        )}

        {/* Inline Share Panel */}
        {activeInlineTool === 'share' && (
          <div data-testid="share-live-link-panel" className="p-2.5 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-[11px] text-slate-900">مشاركة الرابط المباشر:</span>
              <button onClick={() => setActiveInlineTool('none')} className="text-[10px] text-slate-500 cursor-pointer">✕</button>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={liveLinkUrl}
                className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-mono text-slate-700"
              />
              <button
                type="button"
                data-testid="copy-live-link-btn"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(liveLinkUrl).catch(() => {});
                  }
                  setLiveLinkCopied(true);
                  setTimeout(() => setLiveLinkCopied(false), 2000);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                {liveLinkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{liveLinkCopied ? 'تم' : 'نسخ'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Post-Ride & Post-Delivery Driver Rating & Feedback Card */}
        {order.status === 'delivered' && (
          <div
            data-testid="tracking-post-ride-rating-card"
            className="p-3.5 rounded-2xl bg-white border-2 border-amber-300 shadow-xs flex flex-col gap-2.5"
          >
            {order.customerRating || ratingSubmittedDone ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>تم حفظ تقييمك للكابتن بنجاح</span>
                  </span>
                  <div className="flex items-center gap-0.5 text-amber-500 font-black text-xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{order.customerRating || ratingStars} / 5</span>
                  </div>
                </div>
                {(order.customerFeedback || ratingFeedbackText) && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                    “{order.customerFeedback || ratingFeedbackText}”
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      قيّم تجربتك مع {order.assignedCaptainName || 'الكابتن'}
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      يساهم تقييمك في تحسين جودة كباتن الباجور ومكافأة الملتزمين
                    </p>
                  </div>
                  <span className="text-[10px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                    {ratingStars} ★
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingStars(star)}
                      className="p-1 cursor-pointer transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          star <= ratingStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['سرعة الوصول', 'أخلاق عالية', 'قيادة آمنة', 'فكة مظبوطة', 'نظافة المركبة'].map((tag) => {
                    const active = ratingTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setRatingTags((prev) =>
                            prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag].slice(0, 5)
                          )
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          active
                            ? 'bg-amber-50 border-amber-400 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={2}
                  value={ratingFeedbackText}
                  onChange={(e) => setRatingFeedbackText(e.target.value)}
                  placeholder="اكتب ملاحظتك أو رأيك في المشوار والكابتن (اختياري)..."
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 resize-none"
                />

                <button
                  type="button"
                  onClick={async () => {
                    await submitDriverReview(order.id, {
                      rating: ratingStars,
                      tags: ratingTags,
                      feedback: ratingFeedbackText,
                    });
                    setRatingSubmittedDone(true);
                  }}
                  className="w-full min-h-[40px] py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs cursor-pointer"
                >
                  إرسال التقييم وحفظه
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <SosEmergencySheet
        isOpen={showSosSheet}
        onClose={() => setShowSosSheet(false)}
        orderId={order.id}
        orderNumber={order.orderNumber}
      />
    </div>
  );
};
