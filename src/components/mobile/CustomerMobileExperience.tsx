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
  Share2,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { EgyptianMapCanvas } from './EgyptianMapCanvas';
import { CustomerScreen } from './types';

interface CustomerMobileExperienceProps {
  onSwitchToCaptain?: () => void;
}

export const CustomerMobileExperience: React.FC<CustomerMobileExperienceProps> = ({
  onSwitchToCaptain,
}) => {
  // Screen state
  const [screen, setScreen] = useState<CustomerScreen>('home');
  const [activeTab, setActiveTab] = useState<'home' | 'history' | 'offers' | 'profile'>('home');

  // Booking & Location states
  const [pickup, setPickup] = useState('ميدان المحطة - وسط الباجور');
  const [dropoff, setDropoff] = useState('مستشفى الباجور العام');
  const [selectedService, setSelectedService] = useState<'scooter' | 'car' | 'store'>('scooter');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'vodafone_cash'>('cash');
  const [isRuralDestination, setIsRuralDestination] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [notes, setNotes] = useState('');

  // Active Trip Simulation States
  const [tripStep, setTripStep] = useState<number>(1); // 1: assigned, 2: at pickup, 3: in transit, 4: delivered
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'captain' | 'customer'; text: string; time: string }>>([
    { sender: 'captain', text: 'السلام عليكم، أنا في طريقي لميدان المحطة عند صيدلية العزبي.', time: '10:43 ص' },
    { sender: 'customer', text: 'وعليكم السلام، تمام أنا بانتظارك أمام الصيدلية.', time: '10:44 ص' },
  ]);
  const [inputChatText, setInputChatText] = useState('');
  const [showLocationPickerModal, setShowLocationPickerModal] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'pickup' | 'dropoff'>('dropoff');

  // Egyptian Landmarks for Quick Select
  const LANDMARKS = [
    { name: 'مستشفى الباجور العام', area: 'شارع المحطة', dist: 2.8, type: 'health' },
    { name: 'شارع الجيش - برج الشروق', area: 'وسط المدينة', dist: 1.4, type: 'commercial' },
    { name: 'مجلس مدينة الباجور', area: 'الشارع الجديد', dist: 1.9, type: 'gov' },
    { name: 'شارع الجمهورية - أمام بنك مصر', area: 'الشارع الرئيسي', dist: 2.1, type: 'bank' },
    { name: 'قرية كفر الباجور', area: 'طريق بحري', dist: 4.2, type: 'rural' },
    { name: 'قرية شنتنا الحجر', area: 'طريق قبلي', dist: 5.6, type: 'rural' },
    { name: 'مجمع مواقف الباجور الجديد', area: 'طريق بنها', dist: 3.1, type: 'transport' },
  ];

  // Pricing calculation (Integer Piasters logic converted to EGP)
  const baseFareEgp = selectedService === 'scooter' ? 15 : selectedService === 'car' ? 25 : 18;
  const distanceKm = isRuralDestination ? 4.8 : 2.8;
  const distanceFareEgp = Math.round(Math.max(0, distanceKm - 1.5) * 4);
  const ruralSurchargeEgp = isRuralDestination ? 5 : 0;
  const platformFeeEgp = 2;
  const grossFareEgp = baseFareEgp + distanceFareEgp + ruralSurchargeEgp + platformFeeEgp;
  const totalFareEgp = Math.max(10, grossFareEgp - appliedDiscount);

  // Handle Search & Request flow
  const handleRequestRide = () => {
    setScreen('searching');
    setTimeout(() => {
      setScreen('active_trip');
      setTripStep(1);
    }, 2400);
  };

  const handleSendMessage = () => {
    if (!inputChatText.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'customer',
        text: inputChatText.trim(),
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setInputChatText('');
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'captain',
          text: 'تمام يا فندم، ثواني وأكون عندك بإذن الله.',
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 1500);
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#FAFAF9] text-slate-800 font-['Cairo',sans-serif] overflow-hidden select-none" dir="rtl">
      {/* Top Mobile App Bar */}
      <div className="relative z-20 bg-white/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-slate-100 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-sm shadow-sm shadow-emerald-700/20">
            م
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">مشوار</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                العميل
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <MapPin className="w-3 h-3 text-emerald-600" />
              <span>الباجور، المنوفية</span>
            </div>
          </div>
        </div>

        {/* Prototype Quick Role Switcher Pill */}
        <div className="flex items-center gap-2">
          {onSwitchToCaptain && (
            <button
              onClick={onSwitchToCaptain}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1 shadow-xs"
              title="معاينة شاشة الكابتن"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>شاشة الكابتن</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Screen Content Area */}
      <div className="relative flex-1 w-full overflow-hidden flex flex-col">
        {/* TAB 1: HOME SCREEN (Interactive Ride & Delivery Experience) */}
        {activeTab === 'home' && (
          <div className="relative flex-1 w-full h-full flex flex-col">
            {/* Map Canvas - Occupies background of home */}
            <div className="absolute inset-0 z-0">
              <EgyptianMapCanvas
                mode="customer"
                pickupText={pickup}
                dropoffText={dropoff}
                showRoute={screen !== 'home' || dropoff !== ''}
                onMapClick={() => {
                  if (screen === 'booking') setScreen('home');
                }}
              />
            </div>

            {/* SCREEN STATE A: DEFAULT HOME (Search & Destination Selection) */}
            {screen === 'home' && (
              <div className="relative z-10 mt-auto p-4 flex flex-col gap-3">
                {/* Floating Search / Where To Box */}
                <div className="bg-white rounded-2xl p-4 shadow-xl border border-slate-100 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">إلى أين نصلك اليوم؟</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      توصيل فوري ⚡
                    </span>
                  </div>

                  {/* Destination Input Trigger */}
                  <div
                    onClick={() => {
                      setPickerTarget('dropoff');
                      setShowLocationPickerModal(true);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 cursor-pointer transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Search className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400">حدد الوجهة المطلوبة</div>
                      <div className="text-sm font-bold text-slate-800 truncate">
                        {dropoff || 'اضغط هنا لاختيار المكان في الباجور'}
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Quick Landmark Chips */}
                  <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
                    <button
                      onClick={() => {
                        setDropoff('مستشفى الباجور العام');
                        setScreen('booking');
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/60 font-semibold text-slate-700 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>المستشفى العام</span>
                    </button>
                    <button
                      onClick={() => {
                        setDropoff('شارع الجيش - برج الشروق');
                        setScreen('booking');
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/60 font-semibold text-slate-700 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>شارع الجيش</span>
                    </button>
                    <button
                      onClick={() => {
                        setDropoff('مجلس مدينة الباجور');
                        setScreen('booking');
                      }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200/60 font-semibold text-slate-700 transition-colors"
                    >
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      <span>مجلس المدينة</span>
                    </button>
                  </div>
                </div>

                {/* Service Highlights Card */}
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-100 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setSelectedService('scooter');
                      setScreen('booking');
                    }}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      selectedService === 'scooter'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center mb-1">
                      <Bike className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">سكوتر فوري</span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">من ١٥ ج.م</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedService('car');
                      setScreen('booking');
                    }}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      selectedService === 'car'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-1">
                      <Car className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">سيارة طرود</span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">من ٢٥ ج.م</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedService('store');
                      setScreen('booking');
                    }}
                    className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all ${
                      selectedService === 'store'
                        ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-1">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold">طلبات متاجر</span>
                    <span className="text-[10px] text-slate-500 font-medium mt-0.5">توصيل طلبات</span>
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN STATE B: BOOKING & ESTIMATE SHEET */}
            {screen === 'booking' && (
              <div className="relative z-10 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 flex flex-col gap-4 max-h-[82%] overflow-y-auto">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />

                {/* Pickup & Destination Locations Row */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 flex flex-col gap-2">
                  <div
                    onClick={() => {
                      setPickerTarget('pickup');
                      setShowLocationPickerModal(true);
                    }}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-400 font-semibold">نقطة الانطلاق</div>
                      <div className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700">
                        {pickup}
                      </div>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold">تعديل</span>
                  </div>

                  <div className="h-px bg-slate-200 mr-5" />

                  <div
                    onClick={() => {
                      setPickerTarget('dropoff');
                      setShowLocationPickerModal(true);
                    }}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div className="w-3 h-3 rounded-full bg-rose-600 ring-4 ring-rose-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-slate-400 font-semibold">نقطة الوصول</div>
                      <div className="text-xs font-bold text-slate-800 truncate group-hover:text-rose-700">
                        {dropoff}
                      </div>
                    </div>
                    <span className="text-[10px] text-rose-700 font-semibold">تعديل</span>
                  </div>
                </div>

                {/* Service Selection Cards */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">اختر نوع المشوار</span>
                    <span className="text-[10px] text-slate-500 font-medium">المسافة: {distanceKm} كم تقريباً</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div
                      onClick={() => setSelectedService('scooter')}
                      className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                        selectedService === 'scooter'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Bike className="w-5 h-5 text-emerald-700" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-700 text-white">
                          الأسرع
                        </span>
                      </div>
                      <div className="text-xs font-extrabold text-slate-900">سكوتر فوري</div>
                      <div className="text-[10px] text-slate-500">طرود وخفيف</div>
                      <div className="text-xs font-black text-emerald-800 mt-1">
                        {selectedService === 'scooter' ? totalFareEgp : 21} ج.م
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedService('car')}
                      className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                        selectedService === 'car'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Car className="w-5 h-5 text-slate-700" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          بضائع
                        </span>
                      </div>
                      <div className="text-xs font-extrabold text-slate-900">سيارة نقل</div>
                      <div className="text-[10px] text-slate-500">أوزان وحجم أكبر</div>
                      <div className="text-xs font-black text-emerald-800 mt-1">
                        {selectedService === 'car' ? totalFareEgp : 31} ج.م
                      </div>
                    </div>

                    <div
                      onClick={() => setSelectedService('store')}
                      className={`p-3 rounded-xl border text-right cursor-pointer transition-all ${
                        selectedService === 'store'
                          ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <ShoppingBag className="w-5 h-5 text-amber-700" />
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          متاجر
                        </span>
                      </div>
                      <div className="text-xs font-extrabold text-slate-900">شراء وتوصيل</div>
                      <div className="text-[10px] text-slate-500">من أي متجر</div>
                      <div className="text-xs font-black text-emerald-800 mt-1">
                        {selectedService === 'store' ? totalFareEgp : 24} ج.م
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rural Destination Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">توصيل للقرى والعزب المحيطة</div>
                      <div className="text-[10px] text-slate-500">كفر الباجور، شنتنا الحجر، جروان (+٥ ج.م)</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isRuralDestination}
                    onChange={(e) => setIsRuralDestination(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 accent-emerald-700 cursor-pointer"
                  />
                </div>

                {/* Payment Method Selector */}
                <div>
                  <div className="text-xs font-bold text-slate-700 mb-1.5">طريقة الدفع</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        paymentMethod === 'cash'
                          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="text-right">
                        <div className="text-xs">نقداً (كاش للكابتن)</div>
                        <div className="text-[9px] text-slate-500">الدفع عند استلام الطلب</div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                        paymentMethod === 'instapay'
                          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <Wallet className="w-4 h-4 text-emerald-700 shrink-0" />
                      <div className="text-right">
                        <div className="text-xs">إنستاباي / محفظة</div>
                        <div className="text-[9px] text-slate-500">تحويل مباشر للكابتن</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Authoritative Fare Calculation Breakdown */}
                <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 text-xs flex flex-col gap-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>الأجرة الأساسية والبداية:</span>
                    <span className="font-semibold">{baseFareEgp}.00 ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span>فارق المسافة ({distanceKm} كم):</span>
                    <span className="font-semibold">{distanceFareEgp}.00 ج.م</span>
                  </div>
                  {isRuralDestination && (
                    <div className="flex justify-between text-amber-700">
                      <span>بدل انتقال طريق قروي:</span>
                      <span className="font-semibold">+{ruralSurchargeEgp}.00 ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>رسوم خدمة منصة مشوار:</span>
                    <span className="font-semibold">+{platformFeeEgp}.00 ج.م</span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-sm font-extrabold text-slate-900">
                    <span>الإجمالي التقديري المعتمد:</span>
                    <span className="text-emerald-700 font-black">{totalFareEgp}.00 ج.م</span>
                  </div>
                </div>

                {/* Regulatory Safety Lock Notice */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>توصيل ونقل بضائع مرخص بالباجور • نقل الركاب معلق التزاماً بالقانون ٧٣</span>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setScreen('home')}
                    className="p-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleRequestRide}
                    className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
                  >
                    <span>طلب مشوار الآن</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-800 text-xs font-bold">
                      {totalFareEgp} ج.م
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* SCREEN STATE C: SEARCHING FOR CAPTAIN */}
            {screen === 'searching' && (
              <div className="relative z-10 mt-auto bg-white rounded-t-3xl p-6 shadow-2xl border-t border-slate-100 flex flex-col items-center text-center gap-4">
                <div className="relative flex items-center justify-center my-4">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 animate-ping absolute" />
                  <div className="w-16 h-16 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-xl z-10">
                    <Bike className="w-8 h-8 animate-bounce" />
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 mb-1">
                    جاري إرسال الطلب لأقرب كابتن في الباجور...
                  </h3>
                  <p className="text-xs text-slate-500">
                    يتم البحث بين كباتن مشوار المعتمدين المتواجدين بالقرب من ميدان المحطة
                  </p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-600 h-1.5 rounded-full w-2/3 animate-pulse" />
                </div>
                <button
                  onClick={() => setScreen('booking')}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 py-1"
                >
                  إلغاء البحث
                </button>
              </div>
            )}

            {/* SCREEN STATE D: CAPTAIN ASSIGNED & ACTIVE TRIP TRACKING */}
            {screen === 'active_trip' && (
              <div className="relative z-10 mt-auto bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-100 flex flex-col gap-3.5 max-h-[85%] overflow-y-auto">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto" />

                {/* Status Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping" />
                    <span className="font-extrabold text-sm text-slate-900">
                      {tripStep === 1 && 'تم قبول المشوار • الكابتن في الطريق'}
                      {tripStep === 2 && 'الكابتن وصل لنقطة الاستلام'}
                      {tripStep === 3 && 'جاري توصيل الطلب للوجهة'}
                      {tripStep === 4 && 'تم توصيل الطلب بنجاح'}
                    </span>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {tripStep === 4 ? 'مكتمل' : 'خلال ٤ دقائق'}
                  </span>
                </div>

                {/* Progress Stepper */}
                <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                  <div className={`p-1.5 rounded-lg ${tripStep >= 1 ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    تم القبول
                  </div>
                  <div className={`p-1.5 rounded-lg ${tripStep >= 2 ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    عند الاستلام
                  </div>
                  <div className={`p-1.5 rounded-lg ${tripStep >= 3 ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    في الطريق
                  </div>
                  <div className={`p-1.5 rounded-lg ${tripStep >= 4 ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    تم التسليم
                  </div>
                </div>

                {/* Captain Information Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow flex items-center justify-center font-bold text-lg text-slate-700">
                        👨‍✈️
                      </div>
                      <div className="absolute -bottom-1 -left-1 bg-emerald-600 text-white rounded-full p-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                        <span>محمود الصياد</span>
                        <span className="flex items-center text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 rounded">
                          <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 mr-0.5" /> 4.92
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">سكوتر بينيلي أسود • ٥٨٢٤ م ن و</div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        كابتن معتمد بالباجور (٤٢٠ مشوار)
                      </div>
                    </div>
                  </div>

                  {/* Call & Chat action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowChatModal(true)}
                      className="w-9 h-9 rounded-full bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200 flex items-center justify-center shadow-xs transition-colors"
                      title="محادثة الكابتن"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <a
                      href="tel:01000000000"
                      onClick={(e) => e.preventDefault()}
                      className="w-9 h-9 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 flex items-center justify-center shadow-md shadow-emerald-700/20 transition-colors"
                      title="اتصال بالكابتن"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Route Points Review */}
                <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span className="font-bold text-slate-800">من:</span>
                    <span className="truncate">{pickup}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-600" />
                    <span className="font-bold text-slate-800">إلى:</span>
                    <span className="truncate">{dropoff}</span>
                  </div>
                </div>

                {/* Payment reminder */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
                  <span className="font-bold text-amber-900">المبلغ المطلوب سداده نقداً:</span>
                  <span className="font-black text-amber-950 text-sm">{totalFareEgp}.00 ج.م</span>
                </div>

                {/* Simulation Step Advance Controls (for prototype demonstration) */}
                <div className="pt-1 flex items-center gap-2">
                  {tripStep < 4 ? (
                    <button
                      onClick={() => setTripStep((s) => Math.min(4, s + 1))}
                      className="flex-1 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                    >
                      محاكاة الخطوة التالية ({tripStep === 1 ? 'وصول الكابتن' : tripStep === 2 ? 'بدء الرحلة' : 'التسليم'})
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setScreen('home');
                        setTripStep(1);
                      }}
                      className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                    >
                      إنهاء والعودة للرئيسية
                    </button>
                  )}
                  {tripStep < 3 && (
                    <button
                      onClick={() => setScreen('home')}
                      className="px-3 py-2.5 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl"
                    >
                      إلغاء
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TRIP HISTORY SCREEN */}
        {activeTab === 'history' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">سجل المشاوير والطلبات</h2>
            <div className="flex flex-col gap-3">
              {[
                {
                  id: 'MSH-8421',
                  date: 'اليوم، 09:15 ص',
                  from: 'ميدان المحطة - وسط الباجور',
                  to: 'مستشفى الباجور العام',
                  fare: '21.00 ج.م',
                  status: 'delivered',
                  type: 'سكوتر طرود',
                  captain: 'محمود الصياد',
                },
                {
                  id: 'MSH-8390',
                  date: 'أمس، 07:45 م',
                  from: 'شارع الجيش - برج الشروق',
                  to: 'قرية كفر الباجور',
                  fare: '26.00 ج.م',
                  status: 'delivered',
                  type: 'سكوتر طرود',
                  captain: 'طارق الغريب',
                },
                {
                  id: 'MSH-8312',
                  date: '١٨ أكتوبر، 02:20 م',
                  from: 'مطعم البرنس - شارع الجمهورية',
                  to: 'مجلس مدينة الباجور',
                  fare: '19.00 ج.م',
                  status: 'delivered',
                  type: 'طلبات متجر',
                  captain: 'أحمد عبد الرازق',
                },
              ].map((trip) => (
                <div key={trip.id} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{trip.type}</span>
                    <span className="font-extrabold text-emerald-800">{trip.fare}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{trip.date}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      تم التسليم بنجاح
                    </span>
                  </div>
                  <div className="text-xs text-slate-700 flex flex-col gap-1 border-t border-slate-100 pt-2">
                    <div className="truncate">من: {trip.from}</div>
                    <div className="truncate">إلى: {trip.to}</div>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                    <span>الكابتن: {trip.captain}</span>
                    <button
                      onClick={() => {
                        setDropoff(trip.to);
                        setActiveTab('home');
                        setScreen('booking');
                      }}
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      طلب مشوار مماثل
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PROMOS & OFFERS */}
        {activeTab === 'offers' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <h2 className="font-extrabold text-base text-slate-900">عروض وخصومات الباجور</h2>
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white shadow-lg flex flex-col gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 w-max">
                عرض الإطلاق الأول
              </span>
              <h3 className="font-black text-lg">خصم ٥ ج.م على أول ٣ مشاوير</h3>
              <p className="text-xs text-emerald-100/80">
                استخدم كود الخصم عند طلب أي سكوتر أو سيارة داخل نطاق مركز الباجور
              </p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-700/60">
                <span className="font-mono font-bold text-amber-300 text-sm tracking-wider">BAGOUR2025</span>
                <button
                  onClick={() => {
                    setAppliedDiscount(5);
                    setActiveTab('home');
                  }}
                  className="px-3 py-1 bg-white text-emerald-900 text-xs font-bold rounded-lg shadow-sm"
                >
                  تطبيق الكود
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PROFILE */}
        {activeTab === 'profile' && (
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl">
                أ
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">أحمد محمد عبد اللطيف</h3>
                <p className="text-xs text-slate-500">+20 10 1234 5678</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1 inline-block">
                  عميل مميز (الباجور)
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs divide-y divide-slate-100 text-xs text-slate-700 font-semibold">
              <div className="p-3.5 flex items-center justify-between">
                <span>العناوين المحفوظة (المنزل، العمل)</span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>المحفظة الإلكترونية والرصيد</span>
                <span className="text-emerald-700 font-bold">0.00 ج.م</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <span>مركز المساعدة والدعم الفني</span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </div>
              <div className="p-3.5 flex items-center justify-between text-slate-500">
                <span>إصدار التطبيق</span>
                <span className="font-mono">v1.0.0-elbagour</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location Picker Modal (Quick Landmark Selection) */}
      {showLocationPickerModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl flex flex-col gap-3 max-h-[80%] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-900">
                {pickerTarget === 'pickup' ? 'حدد موقع الانطلاق في الباجور' : 'حدد وجهة التوصيل'}
              </span>
              <button
                onClick={() => setShowLocationPickerModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {LANDMARKS.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (pickerTarget === 'pickup') {
                      setPickup(item.name);
                    } else {
                      setDropoff(item.name);
                      if (item.type === 'rural') setIsRuralDestination(true);
                      else setIsRuralDestination(false);
                      setScreen('booking');
                    }
                    setShowLocationPickerModal(false);
                  }}
                  className="p-3 rounded-xl border border-slate-100 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800">{item.name}</div>
                      <div className="text-[10px] text-slate-500">{item.area}</div>
                    </div>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-400">{item.dist} كم</span>
                    {item.type === 'rural' && (
                      <div className="text-[9px] text-amber-600 font-bold">قرية محيطة</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-App Chat Modal with Captain */}
      {showChatModal && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col font-['Cairo',sans-serif]">
          <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-bold">
                👨‍✈️
              </div>
              <div>
                <div className="font-extrabold text-xs">كابتن محمود الصياد</div>
                <div className="text-[10px] text-emerald-400">متصل الآن • سكوتر بينيلي</div>
              </div>
            </div>
            <button
              onClick={() => setShowChatModal(false)}
              className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 p-4 bg-slate-50 overflow-y-auto flex flex-col gap-2.5">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[78%] p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'customer'
                    ? 'mr-auto bg-emerald-700 text-white rounded-bl-xs'
                    : 'ml-auto bg-white text-slate-800 shadow-xs border border-slate-200/70 rounded-br-xs'
                }`}
              >
                <div>{msg.text}</div>
                <div className={`text-[9px] mt-1 text-left ${msg.sender === 'customer' ? 'text-emerald-200' : 'text-slate-400'}`}>
                  {msg.time}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
            <input
              type="text"
              value={inputChatText}
              onChange={(e) => setInputChatText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="اكتب رسالة للكابتن..."
              className="flex-1 px-3.5 py-2 bg-slate-100 rounded-xl text-xs focus:outline-hidden focus:ring-1 focus:ring-emerald-600 text-slate-800"
            />
            <button
              onClick={handleSendMessage}
              className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-sm hover:bg-emerald-800 active:scale-95 transition-transform"
            >
              <Send className="w-4 h-4 transform rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* Customer Mobile Bottom Navigation Bar */}
      <div className="relative z-20 bg-white border-t border-slate-100 py-1.5 px-3 flex items-center justify-around shadow-sm">
        <button
          onClick={() => {
            setActiveTab('home');
            setScreen('home');
          }}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'home' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'history' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">رحلاتي</span>
        </button>

        <button
          onClick={() => setActiveTab('offers')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-colors ${
            activeTab === 'offers' ? 'text-emerald-700 font-extrabold' : 'text-slate-400 font-medium hover:text-slate-600'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">العروض</span>
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
