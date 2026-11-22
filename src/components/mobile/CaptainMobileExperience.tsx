import React, { useState, useEffect } from 'react';
import {
  Navigation,
  Power,
  TrendingUp,
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  Star,
  DollarSign,
  Bike,
  User,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  X,
  CreditCard,
  Banknote,
  RotateCcw,
  Store,
  Info,
  Volume2,
  VolumeX,
  Lock,
  Shield,
  MessageSquare,
  Send,
  Battery,
  BatteryLow,
  BatteryCharging,
  Bell,
  BellRing,
  Check,
  Music,
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import {
  playDispatchChime,
  isDispatchSoundMuted,
  setDispatchSoundMuted,
  CAPTAIN_SOUND_PROFILES,
  previewCaptainAlertSound,
} from './SoundAlertHelper';
import {
  useMarketplace,
  MarketplaceOrder,
  formatHumanReadableAcceptedTimestamp
} from '../../store/marketplaceStore';

interface CaptainMobileExperienceProps {
  onSwitchToCustomer?: () => void;
  onOpenAuthModal?: () => void;
}

export const CaptainMobileExperience: React.FC<CaptainMobileExperienceProps> = ({
  onSwitchToCustomer,
  onOpenAuthModal,
}) => {
  const {
    currentUser,
    isCaptainOnline,
    setIsCaptainOnline,
    captainEarningsEgp,
    captainCompletedDeliveries,
    captainCashHoldingEgp,
    captains,
    systemSettings,
    orders,
    captainAcceptDelivery,
    captainVerifyRidePinAndStart,
    captainUpdateStep,
    captainConfirmCashCollection,
    chatMessages,
    sendChatMessage,
    setActiveChatThreadId,
    isFirestoreRealtimeActive,
    setIsAuthModalOpen,
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
    captainNotifications,
    latestCaptainAlert,
    dismissLatestCaptainAlert,
    markCaptainNotificationRead,
    markAllCaptainNotificationsRead,
    captainCustomSound,
    updateCaptainCustomSound,
    simulateElBagourCaptainDispatchAlert,
  } = useMarketplace();

  // Active Tab: radar, trips, wallet, profile
  const [activeTab, setActiveTab] = useState<'radar' | 'trips' | 'wallet' | 'profile'>('radar');

  // Sound Mute & Notifications & Ride PIN & Chat Feedback
  const [soundMuted, setSoundMuted] = useState<boolean>(isDispatchSoundMuted);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState<boolean>(false);
  const [acceptErrorMsg, setAcceptErrorMsg] = useState<string | null>(null);
  const [ridePinInput, setRidePinInput] = useState<string>('');
  const [pinErrorMsg, setPinErrorMsg] = useState<string | null>(null);
  const [showCaptainChat, setShowCaptainChat] = useState<boolean>(false);
  const [captainChatInput, setCaptainChatInput] = useState<string>('');
  const lastAlertedOrderIdRef = React.useRef<string | null>(null);
  const unreadCaptainNotifCount = captainNotifications.filter((n) => !n.isRead).length;

  // Request countdown timer
  const [requestCountdown, setRequestCountdown] = useState<number>(15);
  const [skippedOrders, setSkippedOrders] = useState<string[]>([]);

  // Cash collection interactive form
  const [customerPaidInput, setCustomerPaidInput] = useState<string>('');
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);

  const currentCaptainRecord =
    captains.find((c) => c.id === (currentUser.captainRecordId || 'cpt_02')) || captains[1];
  const cashCeilingEgp = Math.round(
    (currentCaptainRecord?.cashCeilingPiasters || systemSettings.cashCeilingPiasters) / 100
  );
  const isOverCashCeiling = captainCashHoldingEgp >= cashCeilingEgp;

  // Active assigned delivery order for this captain
  const activeAssignedOrder = orders.find(
    (o) =>
      o.assignedCaptainId === currentUser.id &&
      ['captain_assigned', 'at_pickup', 'picked_up', 'in_transit'].includes(o.status)
  );

  useEffect(() => {
    setActiveChatThreadId(activeAssignedOrder?.id || null);
    return () => setActiveChatThreadId(null);
  }, [activeAssignedOrder?.id, setActiveChatThreadId]);

  const activeThreadMessages = activeAssignedOrder
    ? chatMessages.filter((m) => m.orderId === activeAssignedOrder.id)
    : [];

  // Ready store orders OR direct customer ride/package requests waiting for dispatch
  const incomingDispatchOrder = !activeAssignedOrder && isCaptainOnline
    ? orders.find(
        (o) =>
          (o.status === 'ready_for_pickup' || o.status === 'searching_captain') &&
          !skippedOrders.includes(o.id)
      )
    : null;

  // Play Web Audio dispatch chime when a new incoming dispatch appears
  useEffect(() => {
    if (incomingDispatchOrder && incomingDispatchOrder.id !== lastAlertedOrderIdRef.current) {
      lastAlertedOrderIdRef.current = incomingDispatchOrder.id;
      playDispatchChime('captain', captainCustomSound);
    }
  }, [incomingDispatchOrder, captainCustomSound]);

  // Countdown timer when an incoming dispatch order appears
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (incomingDispatchOrder && requestCountdown > 0) {
      interval = setInterval(() => {
        setRequestCountdown((c) => {
          if (c <= 1) {
            setSkippedOrders((prev) => [...prev, incomingDispatchOrder.id]);
            return 15;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [incomingDispatchOrder, requestCountdown]);

  // Handle Accept
  const handleAccept = (orderId: string) => {
    setAcceptErrorMsg(null);
    const res = captainAcceptDelivery(orderId);
    if (!res.success) {
      setAcceptErrorMsg(res.messageAr || 'تعذر قبول الطلب حالياً.');
      return;
    }
    setCashConfirmed(false);
    setRidePinInput('');
    setPinErrorMsg(null);
  };

  // Handle Skip
  const handleSkip = (orderId: string) => {
    setAcceptErrorMsg(null);
    setSkippedOrders((prev) => [...prev, orderId]);
    setRequestCountdown(15);
  };

  // Completed trips assigned strictly to this captain
  const captainPastOrders = orders.filter(
    (o) => o.assignedCaptainId === currentUser.id && o.status === 'delivered'
  );

  // Cash calculation
  const totalDue = activeAssignedOrder ? activeAssignedOrder.totalEgp : 0;
  const paidVal = parseFloat(customerPaidInput) || totalDue;
  const changeDue = Math.max(0, paidVal - totalDue);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile Captain Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center font-bold text-sm shadow-xs">
            <Bike className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900">مشوار كابتن</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-900 text-emerald-300">
                الباجور
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <span>كابتن: {currentUser.name}</span>
              <span className="text-amber-500 font-bold flex items-center">
                ★ 4.92
              </span>
            </div>
          </div>
        </div>

        {/* Notifications Bell, Sound Mute & Switchers */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="captain-notifications-btn"
            onClick={() => setShowNotificationsDrawer(true)}
            className={`relative min-h-[44px] min-w-[44px] px-2 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
              unreadCaptainNotifCount > 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
            title="إشعارات الطلبات الواردة بالباجور"
            aria-label="إشعارات الكابتن"
          >
            {unreadCaptainNotifCount > 0 ? (
              <BellRing className="w-4 h-4 text-emerald-700" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
            {unreadCaptainNotifCount > 0 && (
              <span
                data-testid="captain-notifications-unread-badge"
                className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center tabular-nums shadow-xs"
              >
                {unreadCaptainNotifCount > 9 ? '9+' : unreadCaptainNotifCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !soundMuted;
              setSoundMuted(next);
              setDispatchSoundMuted(next);
            }}
            className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border text-[11px] font-bold flex items-center justify-center transition-colors cursor-pointer ${
              soundMuted
                ? 'bg-slate-100 border-slate-200 text-slate-500'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
            title={soundMuted ? 'تفعيل صوت التنبيهات' : 'كتم صوت التنبيهات'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onSwitchToCustomer && (
            <button
              onClick={onSwitchToCustomer}
              className="text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-full transition-colors flex items-center gap-1"
              title="معاينة شاشة العميل"
            >
              <User className="w-3.5 h-3.5" />
              <span>العميل</span>
            </button>
          )}

          <button
            onClick={() => {
              if (onOpenAuthModal) onOpenAuthModal();
              else setIsAuthModalOpen(true);
            }}
            className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-full transition-colors flex items-center gap-1 border border-emerald-200"
            title="تبديل الحساب"
          >
            <span>🔄</span>
            <span>تبديل</span>
          </button>
        </div>
      </div>

      {/* Main Captain Body Viewport */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* ========================================================
            TAB 1: RADAR / LIVE DISPATCH & DELIVERY PROGRESSION
           ======================================================== */}
        {activeTab === 'radar' && (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* Map Canvas Background */}
            <div className="absolute inset-0 z-0">
              <EgyptianMapCanvas
                mode="captain"
                pickupText={activeAssignedOrder ? activeAssignedOrder.storeAddress : 'ميدان المحطة'}
                dropoffText={activeAssignedOrder ? activeAssignedOrder.deliveryAddress : 'شارع الجيش'}
                showRoute={Boolean(activeAssignedOrder)}
                isCaptainOnline={isCaptainOnline}
                hasIncomingRequest={Boolean(incomingDispatchOrder)}
                activeDeliveryStep={
                  activeAssignedOrder?.status === 'captain_assigned'
                    ? 1
                    : activeAssignedOrder?.status === 'at_pickup'
                    ? 2
                    : 3
                }
              />
            </div>

            {/* Top Online/Offline & Shift Summary Bar */}
            <div className="relative z-10 p-3 flex flex-col gap-2">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      isCaptainOnline
                        ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-xs text-slate-900">
                      {isCaptainOnline ? 'متصل وجاهز للطلبات' : 'غير متصل (استراحة)'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isCaptainOnline ? 'رادار الباجور مفعل • استقبال فوري' : 'لن تصلك طلبات جديدة'}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsCaptainOnline(!isCaptainOnline)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs ${
                    isCaptainOnline
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isCaptainOnline ? 'إيقاف' : 'اتصال'}</span>
                </button>
              </div>

              {/* Earnings Strip */}
              <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-xl p-2 shadow-md flex items-center justify-around text-center border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">أرباح اليوم (٠٪ عمولة)</div>
                  <div className="text-xs font-black text-emerald-400">{captainEarningsEgp}.00 ج.م</div>
                </div>
                <div className="h-5 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400">الرحلات المكتملة</div>
                  <div className="text-xs font-extrabold text-white">{captainCompletedDeliveries} مشاوير</div>
                </div>
                <div className="h-5 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400">عهدة الكاش</div>
                  <div className={`text-xs font-extrabold tabular-nums ${isOverCashCeiling ? 'text-rose-400' : 'text-amber-300'}`}>
                    {captainCashHoldingEgp}.00 / {cashCeilingEgp} ج
                  </div>
                </div>
              </div>

              {/* Adaptive GPS & Battery Saver Strip */}
              <div
                data-testid="captain-battery-gps-strip"
                className={`rounded-xl px-3 py-2 border flex items-center justify-between gap-2 text-[11px] backdrop-blur-md shadow-sm ${
                  isBatterySaverActive
                    ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                    : 'bg-white/95 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 font-bold">
                  {isCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : isBatterySaverActive ? (
                    <BatteryLow className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate tabular-nums">
                    {isBatterySaverActive
                      ? `توفير الطاقة (${batteryLevelPercent}%) · بث GPS كل ${Math.round(gpsUpdateIntervalMs / 1000)} ث`
                      : `بث GPS حي كل ${Math.round(gpsUpdateIntervalMs / 1000)} ث · البطارية ${batteryLevelPercent}%`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`px-2 py-1 rounded-lg text-[10px] font-extrabold shrink-0 cursor-pointer ${
                    isBatterySaverActive
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  إعدادات الطاقة
                </button>
              </div>

              {/* Live In-App Firestore Captain Dispatch Notification Banner */}
              {latestCaptainAlert && (
                <div
                  data-testid="captain-live-notification-banner"
                  className="bg-slate-950/95 text-white rounded-2xl p-3 border border-emerald-500/60 shadow-xl flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                        <BellRing className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300">
                            {latestCaptainAlert.zoneArea}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {latestCaptainAlert.orderNumber}
                          </span>
                        </div>
                        <div className="font-black text-xs text-white mt-0.5 truncate">
                          {latestCaptainAlert.titleAr}
                        </div>
                        <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                          {latestCaptainAlert.bodyAr}
                        </p>
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-[10px] text-slate-400 block">صافي العائد</span>
                      <span className="text-sm font-black text-emerald-400 tabular-nums">
                        +{latestCaptainAlert.estimatedEarningsEgp} ج.م
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        markCaptainNotificationRead(latestCaptainAlert.id);
                        dismissLatestCaptainAlert();
                        setShowNotificationsDrawer(true);
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
                    >
                      عرض في مركز الإشعارات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        markCaptainNotificationRead(latestCaptainAlert.id);
                        dismissLatestCaptainAlert();
                      }}
                      className="min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      تم
                    </button>
                  </div>
                </div>
              )}

              {isOverCashCeiling && (
                <div className="bg-rose-600 text-white rounded-xl p-2.5 shadow-md flex items-start gap-2 text-[11px] font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-200" />
                  <div>
                    تجاوزت سقف العهدة النقدية ({cashCeilingEgp} ج.م)! لن تتمكن من قبول طلبات الكاش الجديدة حتى تقوم بتوريد العهدة للإدارة.
                  </div>
                </div>
              )}

              {acceptErrorMsg && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-2.5 text-[11px] font-extrabold">
                  {acceptErrorMsg}
                </div>
              )}

              {skippedOrders.length > 0 && !incomingDispatchOrder && !activeAssignedOrder && (
                <div className="bg-amber-50/95 backdrop-blur-md border border-amber-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-950 shadow-md">
                  <span className="font-bold text-[11px]">
                    تم تخطي {skippedOrders.length} طلبات في الرادار
                  </span>
                  <button
                    onClick={() => {
                      setSkippedOrders([]);
                      setRequestCountdown(15);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة عرض الطلبات (Retry)</span>
                  </button>
                </div>
              )}
            </div>

            {/* INCOMING DISPATCH MODAL SHEET (When a merchant finishes an order) */}
            {incomingDispatchOrder && !activeAssignedOrder && (
              <div className="relative z-30 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t-2 border-emerald-600 flex flex-col gap-3 animate-in slide-in-from-bottom duration-300">
                {/* Header & Countdown */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span className="font-black text-sm text-slate-900">طلب توصيل جديد وارد!</span>
                  </div>
                  <div className="flex items-center gap-1 bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full border border-rose-200 text-xs font-black">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{requestCountdown} ثانية</span>
                  </div>
                </div>

                {/* Progress countdown bar */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-600 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(requestCountdown / 15) * 100}%` }}
                  />
                </div>

                {/* Store and Fare details */}
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800">أجرة التوصيل لك</span>
                    <div className="text-xl font-black text-emerald-950 mt-0.5">
                      +{incomingDispatchOrder.deliveryFeeEgp}.00 ج.م
                    </div>
                    <span className="text-[10px] text-slate-500">
                      المطلوب تحصيله كاش: {incomingDispatchOrder.totalEgp} ج.م
                    </span>
                  </div>
                  <div className="text-left text-xs">
                    <div className="font-extrabold text-slate-900">{incomingDispatchOrder.storeName}</div>
                    <div className="text-[10px] text-slate-500">{incomingDispatchOrder.storeAddress}</div>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white text-emerald-800 border border-emerald-200 inline-block mt-1">
                      جاهز للاستلام الفوري
                    </span>
                  </div>
                </div>

                {/* Route points */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span className="font-bold text-slate-700">استلام من:</span>
                    <span className="truncate">{incomingDispatchOrder.storeName} ({incomingDispatchOrder.storeAddress})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="font-bold text-slate-700">تسليم إلى:</span>
                    <span className="truncate">{incomingDispatchOrder.customerName} ({incomingDispatchOrder.deliveryAddress})</span>
                  </div>
                </div>

                {/* Items & Change & Family Trusted preview */}
                <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 flex flex-col gap-1">
                  <div>
                    الأصناف: {incomingDispatchOrder.items.map((i) => `${i.quantity}× ${i.productName}`).join('، ')}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    {incomingDispatchOrder.cashChangeForEgp && incomingDispatchOrder.cashChangeForEgp > 0 ? (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        العميل معه ورقة {incomingDispatchOrder.cashChangeForEgp} ج.م (مطلوب فكة)
                      </span>
                    ) : incomingDispatchOrder.paymentMethod === 'cash' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        العميل معه فكة مظبوطة
                      </span>
                    ) : null}
                    {incomingDispatchOrder.requiresFamilyTrustedDriver && (
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-emerald-300 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>مشوار عائلات موثوق</span>
                      </span>
                    )}
                  </div>
                  {incomingDispatchOrder.voiceNoteTranscript && (
                    <div className="text-[10px] text-amber-900 bg-amber-50/70 px-2 py-1 rounded">
                      🎙️ {incomingDispatchOrder.voiceNoteTranscript}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleSkip(incomingDispatchOrder.id)}
                    className="py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    تخطي
                  </button>
                  <button
                    onClick={() => handleAccept(incomingDispatchOrder.id)}
                    className="col-span-2 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>قبول التوصيل الآن (+{incomingDispatchOrder.deliveryFeeEgp} ج.م)</span>
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE ASSIGNED DELIVERY SHEET (Linear State Transitions) */}
            {activeAssignedOrder && (
              <div className="relative z-30 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 flex flex-col gap-3.5 max-h-[85%] overflow-y-auto">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto" />

                {/* Header Stage */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                    <span className="font-black text-sm text-slate-900">
                      {activeAssignedOrder.status === 'captain_assigned' &&
                        (activeAssignedOrder.serviceType === 'restaurant_store'
                          ? 'التحرك لموقع المتجر'
                          : 'التحرك لنقطة الانطلاق')}
                      {activeAssignedOrder.status === 'at_pickup' &&
                        (activeAssignedOrder.serviceType === 'restaurant_store'
                          ? 'استلام الطلب من التاجر'
                          : 'عند نقطة الانطلاق / استلام المشوار')}
                      {activeAssignedOrder.status === 'picked_up' && 'تم استلام الشحنة • بدء التحرك للعميل'}
                      {activeAssignedOrder.status === 'in_transit' && 'في الطريق للوجهة النهائية'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {activeAssignedOrder.orderNumber}
                  </span>
                </div>

                {/* Accepted Timestamp Badge */}
                {(activeAssignedOrder.acceptedAtIso || activeAssignedOrder.acceptedAt) && (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-[11px] text-emerald-900">
                    <span className="font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>وقت قبول الطلب:</span>
                    </span>
                    <span className="font-black text-emerald-800">
                      {formatHumanReadableAcceptedTimestamp(
                        activeAssignedOrder.acceptedAtIso,
                        activeAssignedOrder.acceptedAt
                      )}
                    </span>
                  </div>
                )}

                {/* Current Target Location Highlight */}
                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-start gap-2.5">
                  <Navigation className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="text-[10px] text-emerald-800 font-bold">
                      {activeAssignedOrder.status === 'captain_assigned' || activeAssignedOrder.status === 'at_pickup'
                        ? 'الوجهة الحالية: نقطة الاستلام / الانطلاق'
                        : 'الوجهة الحالية: موقع تسليم العميل'}
                    </div>
                    <div className="font-extrabold text-slate-900 mt-0.5">
                      {activeAssignedOrder.status === 'captain_assigned' || activeAssignedOrder.status === 'at_pickup'
                        ? `${activeAssignedOrder.storeName} - ${activeAssignedOrder.storeAddress}`
                        : `${activeAssignedOrder.customerName} - ${activeAssignedOrder.deliveryAddress}`}
                    </div>
                  </div>
                </div>

                {/* Customer / Store Contact info + Live Chat Toggle */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 truncate">
                      {activeAssignedOrder.customerName} ({activeAssignedOrder.customerPhone})
                    </div>
                    <div className="text-[10px] text-slate-500">
                      الدفع: {activeAssignedOrder.paymentMethod === 'cash' ? 'كاش عند التسليم' : 'إلكتروني'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCaptainChat((p) => !p)}
                      className={`relative px-2.5 h-8 rounded-full font-extrabold text-[11px] flex items-center gap-1 cursor-pointer transition ${
                        showCaptainChat
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-emerald-300 text-emerald-800'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>محادثة</span>
                      {activeThreadMessages.length > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black">
                          {activeThreadMessages.length}
                        </span>
                      )}
                    </button>
                    <a
                      href={`tel:${activeAssignedOrder.customerPhone || '01012345678'}`}
                      className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs"
                      title="اتصال"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Captain-Customer Real-Time Firestore Chat Drawer */}
                {showCaptainChat && (
                  <div
                    data-testid="captain-order-chat-panel"
                    className="p-3 rounded-2xl bg-slate-50 border border-emerald-200 flex flex-col gap-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">
                        محادثة مباشرة مع {activeAssignedOrder.customerName}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {isFirestoreRealtimeActive ? 'مباشر Firestore' : 'متصل'}
                      </span>
                    </div>

                    <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 p-1.5 bg-white rounded-xl border border-slate-200/80">
                      {activeThreadMessages.length === 0 ? (
                        <div className="text-[10px] text-slate-400 text-center py-2">
                          لا توجد رسائل بعد. تواصل مع العميل للتأكيد.
                        </div>
                      ) : (
                        activeThreadMessages.map((msg) => {
                          const isCaptain = msg.senderRole === 'captain';
                          return (
                            <div
                              key={msg.id}
                              className={`max-w-[85%] px-2.5 py-1.5 rounded-xl text-[11px] ${
                                isCaptain
                                  ? 'self-start bg-emerald-700 text-white'
                                  : 'self-end bg-slate-100 text-slate-900'
                              }`}
                            >
                              <div className="text-[9px] opacity-75 font-bold">
                                {msg.senderName} • {msg.time}
                              </div>
                              <div>{msg.text}</div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
                      {['أنا في الطريق إليك الآن', 'وصلت أمام الموقع', 'معي الفكة المطلوبة'].map((quick) => (
                        <button
                          key={quick}
                          type="button"
                          onClick={() => sendChatMessage(activeAssignedOrder.id, quick)}
                          className="shrink-0 px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                        >
                          {quick}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!captainChatInput.trim()) return;
                        sendChatMessage(activeAssignedOrder.id, captainChatInput);
                        setCaptainChatInput('');
                      }}
                      className="flex items-center gap-1.5"
                    >
                      <input
                        type="text"
                        value={captainChatInput}
                        onChange={(e) => setCaptainChatInput(e.target.value)}
                        placeholder="اكتب رسالة للعميل..."
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900"
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

                {/* If In Transit: Cash Collection Confirmation section */}
                {activeAssignedOrder.status === 'in_transit' && (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-amber-900">تحصيل المبلغ نقداً:</span>
                      <span className="font-black text-amber-950 text-sm">
                        المطلوب: {activeAssignedOrder.totalEgp}.00 ج.م
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-600 font-semibold shrink-0">المستلم:</span>
                      <input
                        type="number"
                        placeholder={activeAssignedOrder.totalEgp.toString()}
                        value={customerPaidInput}
                        onChange={(e) => setCustomerPaidInput(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold"
                      />
                      <span className="text-slate-500">ج.م</span>
                      <div className="flex-1 text-left font-bold text-emerald-800">
                        الباقي: {changeDue} ج.م
                      </div>
                    </div>

                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={cashConfirmed}
                        onChange={(e) => setCashConfirmed(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 accent-emerald-700"
                      />
                      <span>أؤكد استلام كامل المبلغ ({activeAssignedOrder.totalEgp} ج.م) نقداً من العميل</span>
                    </label>
                  </div>
                )}

                {/* Stage Progression Buttons */}
                <div className="flex flex-col gap-2">
                  {activeAssignedOrder.status === 'captain_assigned' && (
                    <button
                      onClick={() => captainUpdateStep(activeAssignedOrder.id, 'at_pickup')}
                      className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>١. وصلت لنقطة الانطلاق / الاستلام (at_pickup)</span>
                    </button>
                  )}

                  {activeAssignedOrder.status === 'at_pickup' && activeAssignedOrder.serviceType !== 'ride' && (
                    <button
                      onClick={() => captainUpdateStep(activeAssignedOrder.id, 'picked_up')}
                      className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>٢. تأكيد استلام الطلب / الطرد</span>
                    </button>
                  )}

                  {((activeAssignedOrder.status === 'at_pickup' && activeAssignedOrder.serviceType === 'ride') ||
                    activeAssignedOrder.status === 'picked_up') &&
                    (activeAssignedOrder.serviceType === 'ride' && activeAssignedOrder.ridePin ? (
                      <div className="p-3 rounded-2xl bg-slate-900 text-white border border-emerald-500/40 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                          <Lock className="w-4 h-4" />
                          <span>أدخل كود أمان العميل (٤ أرقام) لبدء الرحلة</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            maxLength={4}
                            inputMode="numeric"
                            value={ridePinInput}
                            onChange={(e) => {
                              setRidePinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                              setPinErrorMsg(null);
                            }}
                            placeholder="••••"
                            className="w-28 py-2 px-3 rounded-xl bg-slate-800 border border-slate-700 text-center font-mono font-black text-base tracking-widest text-amber-300"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const res = captainVerifyRidePinAndStart(activeAssignedOrder.id, ridePinInput);
                              if (!res.success) setPinErrorMsg(res.messageAr);
                            }}
                            className="flex-1 min-h-[44px] py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer"
                          >
                            تحقق وابدأ الرحلة
                          </button>
                        </div>
                        {pinErrorMsg && (
                          <div className="text-[11px] font-bold text-rose-300">{pinErrorMsg}</div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => captainUpdateStep(activeAssignedOrder.id, 'in_transit')}
                        className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bike className="w-4 h-4" />
                        <span>٣. بدء التحرك نحو وجهة العميل</span>
                      </button>
                    ))}

                  {activeAssignedOrder.status === 'in_transit' && (
                    <button
                      onClick={() => captainConfirmCashCollection(activeAssignedOrder.id)}
                      disabled={activeAssignedOrder.paymentMethod === 'cash' && !cashConfirmed}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all ${
                        activeAssignedOrder.paymentMethod !== 'cash' || cashConfirmed
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-emerald-700/20'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>٤. تأكيد التسليم وتحصيل الكاش (+{activeAssignedOrder.deliveryFeeEgp} ج.م)</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: CAPTAIN TRIP HISTORY
           ======================================================== */}
        {activeTab === 'trips' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">سجل المشاوير المكتملة للكابتن</h2>
            {captainPastOrders.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-xs text-slate-400">
                لا توجد مشاوير مكتملة مسجلة في هذه الوردية بعد.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {captainPastOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900">
                        {ord.orderNumber} • {ord.storeName}
                      </span>
                      <span className="font-black text-emerald-800">
                        +{ord.deliveryFeeEgp}.00 ج.م
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex justify-between">
                      <span>العميل: {ord.customerName}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        مكتمل وتحصيل كاش
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      التسليم: {ord.deliveryAddress}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 3: WALLET & SUBSCRIPTION
           ======================================================== */}
        {activeTab === 'wallet' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3.5">
            <h2 className="font-extrabold text-base text-slate-900">المحفظة والاشتراك (٠٪ عمولة)</h2>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white shadow-lg flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200">
                  باقة الكابتن الأسبوعية
                </span>
                <span className="text-xs font-bold text-amber-300">سارية (متبقي ٥ أيام)</span>
              </div>
              <div>
                <h3 className="font-black text-lg">١٠٠٪ من قيمة المشاوير لك بالكامل</h3>
                <p className="text-xs text-emerald-100/80">
                  لا نقتطع نسب مئوية من مشاويرك داخل مركز الباجور.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">أرباح اليوم:</span>
                <span className="font-black text-emerald-800 text-sm">{captainEarningsEgp}.00 ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">عهدة الكاش المحصلة باليد:</span>
                <span className="font-black text-amber-900 text-sm">{captainCashHoldingEgp}.00 ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">سقف العهدة المسموح:</span>
                <span className="font-bold text-slate-800">1,000 ج.م</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 4: PROFILE
           ======================================================== */}
        {activeTab === 'profile' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-2xl shadow-xs">
                {currentUser.avatar}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">{currentUser.name}</h3>
                <p className="text-xs text-slate-500">{currentUser.phone}</p>
                <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                  {currentUser.vehicleInfo}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              <div className="p-3.5 flex items-center justify-between">
                <span>التقييم العام في الباجور</span>
                <span className="text-amber-600 font-bold">★ 4.92 (420 مشوار)</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>حالة الوثائق والرخصة</span>
                <span className="text-emerald-700 font-bold">معتمدة وسارية</span>
              </div>
            </div>

            {/* Captain Battery Saver & GPS Telemetry Controls */}
            <div
              data-testid="captain-profile-battery-saver"
              className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col gap-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isBatterySaverActive ? (
                    <BatteryLow className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Battery className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-extrabold text-slate-900">وضع توفير الطاقة (GPS الكابتن)</h4>
                    <span className="text-[10px] text-slate-500 tabular-nums">
                      الشحن: {batteryLevelPercent}% · معدل البث: كل {Math.round(gpsUpdateIntervalMs / 1000)} ث · آخر مزامنة {gpsTrackingLocation.lastUpdatedAt}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={forceGpsSyncNow}
                  className="min-h-[44px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold cursor-pointer"
                >
                  مزامنة الآن
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { id: 'auto', label: 'تلقائي (< ٢٠٪)' },
                  { id: 'always_on', label: 'تشغيل دائم' },
                  { id: 'off', label: 'إيقاف التوفير' },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBatterySaverPreference(opt.id)}
                    className={`min-h-[44px] px-2 rounded-xl border text-[10px] font-extrabold cursor-pointer transition ${
                      batterySaverPreference === opt.id
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <span className="text-[10px] text-slate-500 font-semibold">
                  اختبار انخفاض البطارية أقل من ٢٠٪:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSimulatedBatteryPercent(
                      simulatedBatteryPercent !== null && simulatedBatteryPercent < 20 ? null : 15
                    )
                  }
                  className={`min-h-[44px] px-3 rounded-xl border text-[10px] font-extrabold cursor-pointer ${
                    simulatedBatteryPercent !== null && simulatedBatteryPercent < 20
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {simulatedBatteryPercent !== null && simulatedBatteryPercent < 20
                    ? 'استعادة الشحن الطبيعي'
                    : 'محاكاة بطارية ١٥٪'}
                </button>
              </div>
            </div>

            {/* Captain Custom Dispatch Alert Sound Settings */}
            <div
              data-testid="captain-profile-sound-settings"
              className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col gap-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-slate-900">تخصيص صوت تنبيه طلبات الباجور</h4>
                    <span className="text-[10px] text-slate-500">
                      يعمل تلقائياً عند ورود طلب جديد عبر Firestore
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => previewCaptainAlertSound(captainCustomSound)}
                  className="min-h-[44px] px-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>تجربة</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CAPTAIN_SOUND_PROFILES.map((profile) => {
                  const selected = captainCustomSound === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => {
                        updateCaptainCustomSound(profile.id);
                        previewCaptainAlertSound(profile.id);
                      }}
                      className={`min-h-[44px] p-2 rounded-xl border text-right transition cursor-pointer ${
                        selected
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-extrabold text-[11px]">{profile.labelAr}</div>
                      <div
                        className={`text-[9px] mt-0.5 line-clamp-1 ${
                          selected ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {profile.descriptionAr}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* IN-APP CAPTAIN NOTIFICATIONS DRAWER & SOUND CUSTOMIZER */}
      {showNotificationsDrawer && (
        <div
          data-testid="captain-notifications-drawer"
          className="absolute inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex flex-col justify-end"
        >
          <div className="bg-white rounded-t-3xl max-h-[88%] flex flex-col overflow-hidden shadow-2xl border-t border-slate-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-sm text-slate-900">إشعارات طلبات الباجور</h3>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 tabular-nums">
                      {unreadCaptainNotifCount} جديد
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isFirestoreRealtimeActive
                      ? 'بث لحظي مباشر عبر Firestore + تنبيه صوتي'
                      : 'بث محلي فوري + مزامنة Firestore'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowNotificationsDrawer(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                aria-label="إغلاق الإشعارات"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {/* Quick Actions Bar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="captain-test-notification-btn"
                  onClick={() => simulateElBagourCaptainDispatchAlert()}
                  className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>محاكاة إشعار طلب جديد</span>
                </button>
                {unreadCaptainNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllCaptainNotificationsRead()}
                    className="min-h-[44px] px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>قراءة الكل</span>
                  </button>
                )}
              </div>

              {/* Custom Alert Sound Picker */}
              <div
                data-testid="captain-sound-selector"
                className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-amber-800" />
                    <span className="font-extrabold text-xs text-slate-900">
                      نغمة تنبيه الطلبات المخصصة
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !soundMuted;
                        setSoundMuted(next);
                        setDispatchSoundMuted(next);
                      }}
                      className={`min-h-[36px] px-2.5 rounded-lg border text-[10px] font-extrabold cursor-pointer ${
                        soundMuted
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-white border-amber-300 text-amber-900'
                      }`}
                    >
                      {soundMuted ? 'الصوت مكتوم' : 'الصوت مفعل'}
                    </button>
                    <button
                      type="button"
                      onClick={() => previewCaptainAlertSound(captainCustomSound)}
                      className="min-h-[36px] px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black cursor-pointer"
                    >
                      تجربة الصوت
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {CAPTAIN_SOUND_PROFILES.map((profile) => {
                    const selected = captainCustomSound === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        data-testid={`captain-sound-option-${profile.id}`}
                        onClick={() => {
                          updateCaptainCustomSound(profile.id);
                          previewCaptainAlertSound(profile.id);
                        }}
                        className={`min-h-[44px] p-2 rounded-xl border text-right transition cursor-pointer ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-800 border-amber-200/80 hover:border-amber-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-extrabold text-[11px]">{profile.labelAr}</span>
                          {selected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                        </div>
                        <span
                          className={`text-[9px] block mt-0.5 line-clamp-1 ${
                            selected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {profile.descriptionAr}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notifications Feed */}
              <div className="flex flex-col gap-2">
                {captainNotifications.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    لا توجد إشعارات واردة حالياً. سيتم إشعارك فوراً فور إنشاء أي طلب في مركز الباجور.
                  </div>
                ) : (
                  captainNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => markCaptainNotificationRead(notif.id)}
                      className={`w-full text-right p-3 rounded-2xl border transition flex flex-col gap-1 cursor-pointer ${
                        notif.isRead
                          ? 'bg-white border-slate-200 text-slate-700'
                          : 'bg-emerald-50/70 border-emerald-300 text-slate-900 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {!notif.isRead && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 shrink-0">
                            {notif.zoneArea}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 truncate">
                            {notif.orderNumber}
                          </span>
                        </div>
                        <span className="text-xs font-black text-emerald-800 tabular-nums shrink-0">
                          +{notif.estimatedEarningsEgp} ج.م
                        </span>
                      </div>
                      <div className="font-extrabold text-xs text-slate-900">{notif.titleAr}</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{notif.bodyAr}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>{notif.timeAr}</span>
                        <span>
                          {notif.source === 'firestore' ? 'Firestore مباشر' : 'إشعار محلي'}
                          {notif.isRead ? ' • مقروء' : ' • اضغط للتحديد كمقروء'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Captain Mobile Bottom Navigation Bar */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1.5 px-3 flex items-center justify-around shadow-sm shrink-0">
        <button
          onClick={() => setActiveTab('radar')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'radar' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرادار</span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'trips' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرحلات</span>
        </button>

        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'wallet' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">المحفظة</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'profile' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">حسابي</span>
        </button>
      </div>
    </div>
  );
};
