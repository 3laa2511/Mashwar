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
  RotateCcw
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import { CaptainScreen } from './types';

interface CaptainMobileExperienceProps {
  onSwitchToCustomer?: () => void;
}

export const CaptainMobileExperience: React.FC<CaptainMobileExperienceProps> = ({
  onSwitchToCustomer,
}) => {
  // Online/Offline status
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'radar' | 'trips' | 'wallet' | 'profile'>('radar');

  // Simulated Incoming Request & Trip execution
  const [hasIncomingRequest, setHasIncomingRequest] = useState<boolean>(false);
  const [requestCountdown, setRequestCountdown] = useState<number>(15);
  const [activeTrip, setActiveTrip] = useState<boolean>(false);
  const [tripStep, setTripStep] = useState<number>(1); // 1: going to pickup, 2: arrived pickup, 3: in transit to dropoff, 4: arrived & cash collection, 5: completed
  const [cashCollected, setCashCollected] = useState<boolean>(false);
  const [customerPaidInput, setCustomerPaidInput] = useState<string>('50');

  // Captain stats
  const [todayEarningsEgp, setTodayEarningsEgp] = useState<number>(385);
  const [todayTripsCount, setTodayTripsCount] = useState<number>(8);
  const [cashInHandEgp, setCashInHandEgp] = useState<number>(640);
  const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number>(5);

  // Incoming Request Data (El Bagour Context)
  const currentRequest = {
    id: 'REQ-9142',
    customerName: 'كريم الباجوري',
    customerRating: 4.95,
    serviceType: 'سكوتر طرود سريعة',
    pickupName: 'شارع الجيش - أمام مطعم الشروق',
    pickupDistance: '800 متر • 2 دقيقة',
    dropoffName: 'قرية كفر الباجور - شارع داير الناحية',
    dropoffDistance: '3.6 كم • 8 دقائق',
    fareEgp: 28,
    paymentMethodAr: 'نقداً عند التسليم (كاش)',
    notes: 'طرد أوراق وعلبة دواء هامة يرجى تسليمها للصيدلية',
  };

  // Timer countdown for incoming request
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (hasIncomingRequest && requestCountdown > 0) {
      interval = setInterval(() => {
        setRequestCountdown((c) => {
          if (c <= 1) {
            setHasIncomingRequest(false);
            return 15;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [hasIncomingRequest, requestCountdown]);

  // Handle Accepting Trip
  const handleAcceptTrip = () => {
    setHasIncomingRequest(false);
    setActiveTrip(true);
    setTripStep(1);
    setCashCollected(false);
  };

  // Handle Completing Trip
  const handleCompleteTrip = () => {
    setActiveTrip(false);
    setTripStep(1);
    setTodayEarningsEgp((e) => e + currentRequest.fareEgp);
    setTodayTripsCount((t) => t + 1);
    setCashInHandEgp((c) => c + currentRequest.fareEgp);
  };

  // Cash change calculation
  const customerPaidVal = parseFloat(customerPaidInput) || currentRequest.fareEgp;
  const changeDue = Math.max(0, customerPaidVal - currentRequest.fareEgp);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile Captain Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-xs">
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
              <span>كابتن محمود الصياد</span>
              <span className="text-amber-500 font-bold flex items-center">
                ★ 4.92
              </span>
            </div>
          </div>
        </div>

        {/* Prototype Switch to Customer View */}
        <div className="flex items-center gap-2">
          {onSwitchToCustomer && (
            <button
              onClick={onSwitchToCustomer}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow-xs"
              title="معاينة شاشة العميل"
            >
              <User className="w-3.5 h-3.5" />
              <span>شاشة العميل</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Captain Body */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* TAB 1: RADAR / ACTIVE MAP */}
        {activeTab === 'radar' && (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* Map Canvas Background */}
            <div className="absolute inset-0 z-0">
              <EgyptianMapCanvas
                mode="captain"
                pickupText={activeTrip ? currentRequest.pickupName : 'ميدان المحطة'}
                dropoffText={activeTrip ? currentRequest.dropoffName : 'كفر الباجور'}
                showRoute={activeTrip}
                isCaptainOnline={isOnline}
                hasIncomingRequest={hasIncomingRequest}
                activeDeliveryStep={tripStep}
              />
            </div>

            {/* Floating Top Controls: Online/Offline Switch & Shift Earnings */}
            <div className="relative z-10 p-3 flex flex-col gap-2">
              {/* Online / Offline Status Card */}
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      isOnline ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <div>
                    <div className="font-extrabold text-xs text-slate-900">
                      {isOnline ? 'أنت متصل ومستعد للطلبات' : 'أنت غير متصل (استراحة)'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isOnline ? 'رادار الباجور مفعل • استقبال الطلبات الفورية' : 'لن تصلك أي طلبات جديدة'}
                    </div>
                  </div>
                </div>

                {/* Online Toggle Switch Button */}
                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                    isOnline
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isOnline ? 'إيقاف' : 'اتصال'}</span>
                </button>
              </div>

              {/* Today's Earnings Snapshot Bar */}
              <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-xl p-2.5 shadow-md flex items-center justify-around text-center border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400">أرباح اليوم</div>
                  <div className="text-xs font-black text-emerald-400">{todayEarningsEgp}.00 ج.م</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400">الرحلات</div>
                  <div className="text-xs font-extrabold text-white">{todayTripsCount} مشاوير</div>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <div className="text-[10px] text-slate-400">عهدة الكاش</div>
                  <div className="text-xs font-extrabold text-amber-300">{cashInHandEgp}.00 ج.م</div>
                </div>
              </div>

              {/* Trigger Demo Incoming Request (Helpful testing tool for user) */}
              {!activeTrip && !hasIncomingRequest && isOnline && (
                <button
                  onClick={() => {
                    setRequestCountdown(15);
                    setHasIncomingRequest(true);
                  }}
                  className="mx-auto bg-white/90 backdrop-blur-xs hover:bg-white text-emerald-800 border border-emerald-300/80 px-3 py-1 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  <span>محاكاة طلب وارد جديد (تجربة الكابتن)</span>
                </button>
              )}
            </div>

            {/* MODAL / BOTTOM SHEET: INCOMING REQUEST (High Alert UI with 15s Countdown) */}
            {hasIncomingRequest && !activeTrip && (
              <div className="relative z-30 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t-2 border-emerald-600 flex flex-col gap-3.5 animate-in slide-in-from-bottom duration-300">
                {/* Header & Countdown Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                    <span className="font-black text-sm text-slate-900">طلب مشوار جديد وارد!</span>
                  </div>
                  {/* Circular / Pill countdown */}
                  <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-200 text-xs font-black">
                    <Clock className="w-3.5 h-3.5" />
                    <span>متبقي: {requestCountdown} ثانية</span>
                  </div>
                </div>

                {/* Animated Progress Bar of timer */}
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-rose-600 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${(requestCountdown / 15) * 100}%` }}
                  />
                </div>

                {/* Fare & Service Tag */}
                <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold text-emerald-800">{currentRequest.serviceType}</div>
                    <div className="text-xl font-black text-emerald-950 mt-0.5">
                      {currentRequest.fareEgp}.00 ج.م
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">{currentRequest.paymentMethodAr}</div>
                  </div>
                  <div className="text-left text-xs">
                    <div className="font-bold text-slate-800">{currentRequest.customerName}</div>
                    <div className="text-[10px] text-amber-600 font-bold flex items-center justify-end gap-1">
                      ★ {currentRequest.customerRating}
                    </div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200 inline-block mt-1">
                      عميل موثوق
                    </span>
                  </div>
                </div>

                {/* Locations: Pickup & Dropoff */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col gap-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-600 mt-1 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-400 font-semibold">موقع الاستلام ({currentRequest.pickupDistance})</div>
                      <div className="font-bold text-slate-900">{currentRequest.pickupName}</div>
                    </div>
                  </div>
                  <div className="h-px bg-slate-200 mr-5" />
                  <div className="flex items-start gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-rose-600 mt-1 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[10px] text-slate-400 font-semibold">نقطة التسليم ({currentRequest.dropoffDistance})</div>
                      <div className="font-bold text-slate-900">{currentRequest.dropoffName}</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Accept / Decline */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setHasIncomingRequest(false)}
                    className="py-3 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    تخطي الطلب
                  </button>
                  <button
                    onClick={handleAcceptTrip}
                    className="col-span-2 py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>قبول المشوار الآن</span>
                  </button>
                </div>
              </div>
            )}

            {/* ACTIVE TRIP EXECUTION SHEET */}
            {activeTrip && (
              <div className="relative z-30 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 flex flex-col gap-3.5 max-h-[85%] overflow-y-auto">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />

                {/* Trip Progress Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                    <span className="font-black text-sm text-slate-900">
                      {tripStep === 1 && 'التحرك لنقطة الاستلام'}
                      {tripStep === 2 && 'وصلت لموقع العميل'}
                      {tripStep === 3 && 'في الطريق للوجهة (كفر الباجور)'}
                      {tripStep === 4 && 'تأكيد التسليم وتحصيل الكاش'}
                      {tripStep === 5 && 'اكتمل المشوار بنجاح'}
                    </span>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {currentRequest.fareEgp}.00 ج.م
                  </span>
                </div>

                {/* Customer Contact Bar */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                      👤
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">{currentRequest.customerName}</div>
                      <div className="text-[10px] text-slate-500">طرد خفيف • {currentRequest.paymentMethodAr}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href="tel:01000000000"
                      onClick={(e) => e.preventDefault()}
                      className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xs"
                      title="اتصال بالعميل"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Current Target Location Highlight */}
                <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                  <Navigation className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <div className="text-[10px] text-emerald-800 font-bold">
                      {tripStep <= 2 ? 'الوجهة الحالية: موقع الاستلام' : 'الوجهة الحالية: نقطة التسليم'}
                    </div>
                    <div className="font-extrabold text-slate-900 mt-0.5">
                      {tripStep <= 2 ? currentRequest.pickupName : currentRequest.dropoffName}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {tripStep <= 2 ? currentRequest.pickupDistance : currentRequest.dropoffDistance}
                    </div>
                  </div>
                </div>

                {/* Step 4: Cash Collection Assistant */}
                {tripStep === 4 && (
                  <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-amber-900">
                        تحصيل المبلغ نقداً من العميل
                      </span>
                      <span className="font-black text-sm text-amber-950">
                        المطلوب: {currentRequest.fareEgp} ج.م
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-600 font-semibold shrink-0">المبلغ المستلم:</span>
                      <input
                        type="number"
                        value={customerPaidInput}
                        onChange={(e) => setCustomerPaidInput(e.target.value)}
                        className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:outline-hidden"
                      />
                      <span className="text-slate-500 font-medium">ج.م</span>
                      <div className="flex-1 text-left font-bold text-xs text-emerald-800">
                        الباقي للعميل: <span className="font-black">{changeDue} ج.م</span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={cashCollected}
                        onChange={(e) => setCashCollected(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 accent-emerald-700"
                      />
                      <span>أؤكد استلام كامل المبلغ ({currentRequest.fareEgp} ج.م) نقداً من العميل</span>
                    </label>
                  </div>
                )}

                {/* Step Action Buttons */}
                <div className="pt-1">
                  {tripStep === 1 && (
                    <button
                      onClick={() => setTripStep(2)}
                      className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>وصلت لموقع الاستلام</span>
                    </button>
                  )}

                  {tripStep === 2 && (
                    <button
                      onClick={() => setTripStep(3)}
                      className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2"
                    >
                      <Bike className="w-4 h-4" />
                      <span>استلام الشحنة وبدء المشوار</span>
                    </button>
                  )}

                  {tripStep === 3 && (
                    <button
                      onClick={() => setTripStep(4)}
                      className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>وصلت لنقطة التسليم للعميل</span>
                    </button>
                  )}

                  {tripStep === 4 && (
                    <button
                      onClick={() => {
                        setTripStep(5);
                        handleCompleteTrip();
                      }}
                      disabled={!cashCollected}
                      className={`w-full py-3.5 rounded-xl font-extrabold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                        cashCollected
                          ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/25 cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد التسليم وإنهاء المشوار (+{currentRequest.fareEgp} ج.م)</span>
                    </button>
                  )}

                  {tripStep === 5 && (
                    <div className="text-center py-2 flex flex-col gap-2">
                      <div className="text-xs font-bold text-emerald-800">
                        تم تسجيل الرحلة وإضافة الأرباح لمحفظتك بنجاح!
                      </div>
                      <button
                        onClick={() => {
                          setActiveTrip(false);
                          setTripStep(1);
                        }}
                        className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold"
                      >
                        العودة للرادار والجاهزية
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRIP HISTORY */}
        {activeTab === 'trips' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">سجل مشاوير الكابتن</h2>
            <div className="flex flex-col gap-3">
              {[
                {
                  id: 'CAP-7491',
                  time: 'منذ 35 دقيقة',
                  from: 'ميدان المحطة',
                  to: 'مستشفى الباجور العام',
                  fare: '21.00 ج.م',
                  type: 'سكوتر طرود',
                  status: 'مكتملة',
                },
                {
                  id: 'CAP-7488',
                  time: 'منذ ساعتين',
                  from: 'شارع الجمهورية - أمام بنك مصر',
                  to: 'قرية كفر الباجور',
                  fare: '26.00 ج.م',
                  type: 'سكوتر طرود',
                  status: 'مكتملة',
                },
                {
                  id: 'CAP-7480',
                  time: 'صباح اليوم، 08:30 ص',
                  from: 'مجلس مدينة الباجور',
                  to: 'شارع الجيش',
                  fare: '18.00 ج.م',
                  type: 'سكوتر طرود',
                  status: 'مكتملة',
                },
              ].map((trip) => (
                <div key={trip.id} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{trip.id} • {trip.type}</span>
                    <span className="font-black text-emerald-800 text-sm">+{trip.fare}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>{trip.time}</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
                      {trip.status}
                    </span>
                  </div>
                  <div className="text-slate-700 pt-1 border-t border-slate-100 flex flex-col gap-0.5">
                    <div className="truncate">من: {trip.from}</div>
                    <div className="truncate">إلى: {trip.to}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: WALLET & SUBSCRIPTION */}
        {activeTab === 'wallet' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">المحفظة والاشتراك (0% عمولة)</h2>

            {/* Subscription Status Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200">
                  باقة الكابتن الأسبوعية
                </span>
                <span className="font-extrabold text-xs text-amber-300">
                  نشطة (متبقي {subscriptionDaysLeft} أيام)
                </span>
              </div>
              <div>
                <div className="text-xs text-emerald-200">نموذج اشتراك بدون عمولة</div>
                <div className="text-lg font-black mt-0.5">١٠٠٪ من قيمة المشاوير لك بالكامل</div>
              </div>
              <div className="text-[11px] text-emerald-100/80 pt-2 border-t border-emerald-700/60 flex items-center justify-between">
                <span>تاريخ التجديد: ٢٦ أكتوبر ٢٠٢٥</span>
                <button className="px-2.5 py-1 bg-white text-emerald-950 rounded-lg font-bold text-xs shadow-xs">
                  تجديد الباقة
                </button>
              </div>
            </div>

            {/* Cash in Hand & Remittance Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-800">عهدة الكاش المحصلة</div>
                    <div className="text-[10px] text-slate-500">مبالغ المشاوير المسددة نقداً اليوم</div>
                  </div>
                </div>
                <div className="text-base font-black text-slate-900">{cashInHandEgp}.00 ج.م</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                <span>الحد الأقصى المسموح للعهدة النقدية:</span>
                <span className="font-bold text-slate-800">1,500 ج.م</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center font-black text-2xl">
                👨‍✈️
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">محمود السيد الصياد</h3>
                <p className="text-xs text-slate-500">+20 11 9876 5432</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    كابتن معتمد
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 flex items-center">
                    ★ 4.92 (420 مشوار)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              <div className="p-3.5 flex items-center justify-between">
                <span>بيانات المركبة (سكوتر بينيلي - ٥٨٢٤ م ن و)</span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>وثائق ورخصة القيادة</span>
                <span className="text-emerald-700 font-bold">موثقة وسارية</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>شروط ومعايير السلامة بالباجور</span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>الدعم الفني لكباتن مشوار</span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Captain Mobile Bottom Navigation Bar */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1.5 px-3 flex items-center justify-around shadow-sm">
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
