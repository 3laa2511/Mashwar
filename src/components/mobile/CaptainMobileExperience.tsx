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
  Info
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import { useMarketplace, MarketplaceOrder } from '../../store/marketplaceStore';

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
    orders,
    captainAcceptDelivery,
    captainUpdateStep,
    captainConfirmCashCollection,
    setIsAuthModalOpen,
  } = useMarketplace();

  // Active Tab: radar, trips, wallet, profile
  const [activeTab, setActiveTab] = useState<'radar' | 'trips' | 'wallet' | 'profile'>('radar');

  // Request countdown timer
  const [requestCountdown, setRequestCountdown] = useState<number>(15);
  const [skippedOrders, setSkippedOrders] = useState<string[]>([]);

  // Cash collection interactive form
  const [customerPaidInput, setCustomerPaidInput] = useState<string>('');
  const [cashConfirmed, setCashConfirmed] = useState<boolean>(false);

  // Active assigned delivery order for this captain
  const activeAssignedOrder = orders.find(
    (o) =>
      o.assignedCaptainId === currentUser.id &&
      ['captain_assigned', 'at_pickup', 'in_transit'].includes(o.status)
  );

  // Ready orders waiting for dispatch (not yet assigned and not skipped)
  const incomingDispatchOrder = !activeAssignedOrder && isCaptainOnline
    ? orders.find(
        (o) => o.status === 'ready_for_pickup' && !skippedOrders.includes(o.id)
      )
    : null;

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
    captainAcceptDelivery(orderId);
    setCashConfirmed(false);
  };

  // Handle Skip
  const handleSkip = (orderId: string) => {
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

        {/* Prototype Switchers */}
        <div className="flex items-center gap-2">
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
                  <div className="text-xs font-extrabold text-amber-300">{captainCashHoldingEgp}.00 ج.م</div>
                </div>
              </div>
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

                {/* Items preview */}
                <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80">
                  الأصناف: {incomingDispatchOrder.items.map((i) => `${i.quantity}× ${i.productName}`).join('، ')}
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
                      {activeAssignedOrder.status === 'captain_assigned' && 'التحرك لموقع المتجر'}
                      {activeAssignedOrder.status === 'at_pickup' && 'استلام الطلب من التاجر'}
                      {activeAssignedOrder.status === 'in_transit' && 'في الطريق للعميل'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {activeAssignedOrder.orderNumber}
                  </span>
                </div>

                {/* Current Target Location Highlight */}
                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 flex items-start gap-2.5">
                  <Navigation className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="text-[10px] text-emerald-800 font-bold">
                      {activeAssignedOrder.status !== 'in_transit'
                        ? 'الوجهة الحالية: موقع المتجر'
                        : 'الوجهة الحالية: موقع العميل'}
                    </div>
                    <div className="font-extrabold text-slate-900 mt-0.5">
                      {activeAssignedOrder.status !== 'in_transit'
                        ? `${activeAssignedOrder.storeName} - ${activeAssignedOrder.storeAddress}`
                        : `${activeAssignedOrder.customerName} - ${activeAssignedOrder.deliveryAddress}`}
                    </div>
                  </div>
                </div>

                {/* Customer / Store Contact info */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-extrabold text-slate-900">
                      {activeAssignedOrder.customerName} ({activeAssignedOrder.customerPhone})
                    </div>
                    <div className="text-[10px] text-slate-500">
                      الدفع: {activeAssignedOrder.paymentMethod === 'cash' ? 'كاش عند التسليم' : 'إلكتروني'}
                    </div>
                  </div>
                  <a
                    href="tel:01012345678"
                    onClick={(e) => e.preventDefault()}
                    className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs"
                    title="اتصال"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>

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
                <div>
                  {activeAssignedOrder.status === 'captain_assigned' && (
                    <button
                      onClick={() => captainUpdateStep(activeAssignedOrder.id, 'at_pickup')}
                      className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>وصلت لموقع المتجر لاستلام الطلب</span>
                    </button>
                  )}

                  {activeAssignedOrder.status === 'at_pickup' && (
                    <button
                      onClick={() => captainUpdateStep(activeAssignedOrder.id, 'in_transit')}
                      className="w-full py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5"
                    >
                      <Bike className="w-4 h-4" />
                      <span>استلمت الشحنة وبدأت التحرك للعميل</span>
                    </button>
                  )}

                  {activeAssignedOrder.status === 'in_transit' && (
                    <button
                      onClick={() => captainConfirmCashCollection(activeAssignedOrder.id)}
                      disabled={!cashConfirmed}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition-all ${
                        cashConfirmed
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-emerald-700/20'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد التسليم وتحصيل الكاش (+{activeAssignedOrder.deliveryFeeEgp} ج.م)</span>
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
          </div>
        )}
      </div>

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
