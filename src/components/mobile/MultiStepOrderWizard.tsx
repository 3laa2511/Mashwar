import React, { useState, useMemo } from 'react';
import {
  Store,
  Car,
  Bike,
  Package,
  MapPin,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Plus,
  Minus,
  ShieldCheck,
  Navigation,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import {
  useMarketplace,
  EL_BAGOUR_LANDMARKS_LIST,
} from '../../store/marketplaceStore';
import {
  auth,
  syncDeliveryOrderToFirestore,
  syncRideToFirestore,
} from '../../lib/firebase';

export type WizardServiceCategory = 'delivery' | 'ride';
export type WizardRideVehicle = 'tuktuk' | 'car' | 'package';
export type WizardStep = 1 | 2 | 3;

interface MultiStepOrderWizardProps {
  initialCategory?: WizardServiceCategory;
  onOrderCreated: () => void;
  onOpenAuthModal?: () => void;
}

export const MultiStepOrderWizard: React.FC<MultiStepOrderWizardProps> = ({
  initialCategory = 'delivery',
  onOrderCreated,
  onOpenAuthModal,
}) => {
  const {
    currentUser,
    stores,
    products,
    customerWalletBalanceEgp,
    submitDirectStoreOrder,
    submitRideOrPackageOrder,
  } = useMarketplace();

  const [step, setStep] = useState<WizardStep>(1);
  const [serviceCategory, setServiceCategory] = useState<WizardServiceCategory>(initialCategory);

  // Delivery state
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || 'store_1');
  const [itemQtyMap, setItemQtyMap] = useState<Record<string, number>>({});
  const [deliveryDropoffId, setDeliveryDropoffId] = useState<string>('lm_army_st');

  // Ride state
  const [rideVehicle, setRideVehicle] = useState<WizardRideVehicle>('tuktuk');
  const [pickupLandmarkId, setPickupLandmarkId] = useState<string>('lm_station');
  const [dropoffLandmarkId, setDropoffLandmarkId] = useState<string>('lm_hospital');
  const [recipientPhone, setRecipientPhone] = useState<string>(
    currentUser.phone && /^01[0125][0-9]{8}$/.test(currentUser.phone)
      ? currentUser.phone
      : '01012345678'
  );

  // Shared state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'vodafone_cash'>('cash');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || stores[0],
    [stores, selectedStoreId]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.storeId === selectedStore?.id && p.isAvailable),
    [products, selectedStore]
  );

  const pickupLandmark = useMemo(
    () => EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === pickupLandmarkId) || EL_BAGOUR_LANDMARKS_LIST[0],
    [pickupLandmarkId]
  );

  const dropoffLandmark = useMemo(
    () =>
      EL_BAGOUR_LANDMARKS_LIST.find(
        (l) => l.id === (serviceCategory === 'delivery' ? deliveryDropoffId : dropoffLandmarkId)
      ) || EL_BAGOUR_LANDMARKS_LIST[1],
    [serviceCategory, deliveryDropoffId, dropoffLandmarkId]
  );

  const selectedItemsList = useMemo(() => {
    return storeProducts
      .filter((p) => (itemQtyMap[p.id] || 0) > 0)
      .map((p) => ({ product: p, quantity: itemQtyMap[p.id] }));
  }, [storeProducts, itemQtyMap]);

  const deliverySubtotalEgp = useMemo(
    () => selectedItemsList.reduce((sum, i) => sum + i.product.priceEgp * i.quantity, 0),
    [selectedItemsList]
  );

  const estimatedDistanceKm = useMemo(() => {
    if (serviceCategory === 'delivery') return selectedStore?.distanceKm || 2.1;
    if (pickupLandmarkId === dropoffLandmarkId) return 1.2;
    return pickupLandmark.isRural || dropoffLandmark.isRural ? 4.8 : 2.6;
  }, [serviceCategory, selectedStore, pickupLandmarkId, dropoffLandmarkId, pickupLandmark, dropoffLandmark]);

  const rideFareBreakdown = useMemo(() => {
    const isRural = pickupLandmark.isRural || dropoffLandmark.isRural;
    const baseFareEgp = rideVehicle === 'car' ? 28 : 15;
    const ratePerKm = rideVehicle === 'car' ? 7.5 : 4.5;
    const distanceFareEgp = Math.round(Math.max(0, estimatedDistanceKm - 1.5) * ratePerKm);
    const ruralSurchargeEgp = isRural ? 5 : 0;
    const platformFeeEgp = 2;
    const totalEgp = baseFareEgp + distanceFareEgp + ruralSurchargeEgp + platformFeeEgp;
    return { baseFareEgp, distanceFareEgp, ruralSurchargeEgp, platformFeeEgp, totalEgp, isRural };
  }, [rideVehicle, estimatedDistanceKm, pickupLandmark, dropoffLandmark]);

  const deliveryFareBreakdown = useMemo(() => {
    const isRural = dropoffLandmark.isRural;
    const deliveryFeeEgp = selectedStore?.deliveryFeeEgp ?? 15;
    const ruralSurchargeEgp = isRural ? 5 : 0;
    const platformFeeEgp = 2;
    const totalEgp = deliverySubtotalEgp + deliveryFeeEgp + ruralSurchargeEgp + platformFeeEgp;
    return { deliveryFeeEgp, ruralSurchargeEgp, platformFeeEgp, totalEgp, isRural };
  }, [selectedStore, dropoffLandmark, deliverySubtotalEgp]);

  const finalTotalEgp =
    serviceCategory === 'delivery' ? deliveryFareBreakdown.totalEgp : rideFareBreakdown.totalEgp;

  const updateQty = (productId: string, delta: number) => {
    setErrorMsg(null);
    setItemQtyMap((prev) => {
      const next = Math.max(0, (prev[productId] || 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[productId];
      else copy[productId] = next;
      return copy;
    });
  };

  const handleNextFromStep2 = () => {
    setErrorMsg(null);
    if (serviceCategory === 'delivery') {
      if (selectedItemsList.length === 0) {
        setErrorMsg('يرجى اختيار صنف واحد على الأقل من المتجر للمتابعة.');
        return;
      }
    } else {
      if (pickupLandmarkId === dropoffLandmarkId) {
        setErrorMsg('نقطة الانطلاق والوصول متطابقتان. يرجى اختيار وجهة مختلفة.');
        return;
      }
    }
    setStep(3);
  };

  const handleConfirmOrder = async () => {
    setErrorMsg(null);
    if (paymentMethod === 'wallet' && customerWalletBalanceEgp < finalTotalEgp) {
      setErrorMsg(`رصيد المحفظة (${customerWalletBalanceEgp} ج.م) غير كافٍ لسداد ${finalTotalEgp} ج.م.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (serviceCategory === 'delivery') {
        if (!selectedStore || selectedItemsList.length === 0) {
          setErrorMsg('يرجى اختيار المتجر والأصناف أولاً.');
          setIsSubmitting(false);
          return;
        }
        const created = submitDirectStoreOrder({
          storeId: selectedStore.id,
          items: selectedItemsList,
          deliveryAddress: dropoffLandmark.nameAr,
          paymentMethod,
          notes: notes.trim() || undefined,
        });

        if (created && auth.currentUser) {
          try {
            await syncDeliveryOrderToFirestore({
              orderId: created.id,
              orderNumber: created.orderNumber,
              storeName: selectedStore.nameAr,
              pickupLandmark: selectedStore.address,
              dropoffLandmark: dropoffLandmark.nameAr,
              itemsSummary: created.itemDescription,
              isRural: created.isRural,
              distanceKm: created.distanceKm,
              subtotalPiasters: created.subtotalEgp * 100,
              deliveryFeePiasters: created.deliveryFeeEgp * 100,
              totalFarePiasters: created.totalFarePiasters,
              paymentMethod,
              serviceType: 'restaurant_store',
            });
          } catch {
            // Firestore error already logged cleanly via handleFirestoreError; keep local order flow alive
          }
        }
      } else {
        const isPackage = rideVehicle === 'package';
        const vehicleCategory =
          rideVehicle === 'car' ? 'car' : rideVehicle === 'package' ? 'motorcycle' : 'tuktuk';

        const created = submitRideOrPackageOrder({
          serviceType: isPackage ? 'package' : 'ride',
          vehicleCategory,
          pickupAddress: pickupLandmark.nameAr,
          deliveryAddress: dropoffLandmark.nameAr,
          distanceKm: estimatedDistanceKm,
          isRural: rideFareBreakdown.isRural,
          paymentMethod,
          notes: notes.trim() || undefined,
          itemDescription: isPackage
            ? `توصيل طرد سريع: ${notes.trim() || 'أمانة داخل الباجور'}`
            : rideVehicle === 'car'
            ? `مشوار سيارة ملاكي من ${pickupLandmark.nameAr} إلى ${dropoffLandmark.nameAr}`
            : `مشوار توكتوك الباجور من ${pickupLandmark.nameAr} إلى ${dropoffLandmark.nameAr}`,
          recipientPhone,
          quoteData: {
            quoteId: `qt_wiz_${Date.now().toString().slice(-4)}`,
            signature: 'mashwar_bagour_verified',
            baseFarePiasters: rideFareBreakdown.baseFareEgp * 100,
            distanceFarePiasters: rideFareBreakdown.distanceFareEgp * 100,
            ruralSurchargePiasters: rideFareBreakdown.ruralSurchargeEgp * 100,
            platformFeePiasters: rideFareBreakdown.platformFeeEgp * 100,
            totalFarePiasters: rideFareBreakdown.totalEgp * 100,
            estimatedDurationMinutes: `${Math.max(6, Math.round(estimatedDistanceKm * 4 + 3))} دقيقة`,
          },
        });

        if (created && auth.currentUser) {
          try {
            if (isPackage) {
              await syncDeliveryOrderToFirestore({
                orderId: created.id,
                orderNumber: created.orderNumber,
                storeName: 'توصيل طرد وأمانات',
                pickupLandmark: pickupLandmark.nameAr,
                dropoffLandmark: dropoffLandmark.nameAr,
                itemsSummary: created.itemDescription,
                isRural: created.isRural,
                distanceKm: created.distanceKm,
                subtotalPiasters: 0,
                deliveryFeePiasters: created.deliveryFeeEgp * 100,
                totalFarePiasters: created.totalFarePiasters,
                paymentMethod,
                serviceType: 'package',
              });
            } else {
              await syncRideToFirestore({
                rideId: created.id,
                rideNumber: created.orderNumber,
                vehicleTier: rideVehicle === 'car' ? 'car' : 'tuktuk',
                pickupLandmark: pickupLandmark.nameAr,
                dropoffLandmark: dropoffLandmark.nameAr,
                distanceKm: created.distanceKm,
                estimatedFarePiasters: created.totalFarePiasters,
                paymentMethod,
              });
            }
          } catch {
            // Firestore error already logged cleanly via handleFirestoreError
          }
        }
      }

      onOrderCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3.5 pb-20" dir="rtl">
      {/* Firebase Auth Nudge if unauthenticated */}
      {!auth.currentUser && onOpenAuthModal && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-2.5 flex items-center justify-between gap-2">
          <div className="text-[11px] font-bold text-amber-950">
            سجّل برقم هاتفك (OTP) لحفظ طلبك على السحابة مباشرة
          </div>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="shrink-0 px-2.5 py-1 rounded-xl bg-amber-600 text-white text-[10px] font-extrabold"
          >
            دخول OTP
          </button>
        </div>
      )}

      {/* 3-Step Progress Header */}
      <div className="bg-white rounded-2xl p-2.5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-1">
        {[
          { num: 1 as WizardStep, label: '١. نوع الخدمة' },
          { num: 2 as WizardStep, label: '٢. التفاصيل' },
          { num: 3 as WizardStep, label: '٣. التأكيد' },
        ].map((item, idx) => {
          const isActive = step === item.num;
          const isDone = step > item.num;
          return (
            <React.Fragment key={item.num}>
              <button
                type="button"
                onClick={() => {
                  if (item.num < step) setStep(item.num);
                }}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : isDone
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isDone && <CheckCircle2 className="w-3 h-3" />}
                <span>{item.label}</span>
              </button>
              {idx < 2 && <ChevronLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ================= STEP 1: SERVICE SELECTION ================= */}
      {step === 1 && (
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold text-slate-800">
            اختر نوع الخدمة المطلوبة الآن في الباجور:
          </div>

          <button
            type="button"
            onClick={() => setServiceCategory('delivery')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
              serviceCategory === 'delivery'
                ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">توصيل متاجر ومطاعم (Delivery)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {stores.length} متاجر
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                اطلب من مطاعم وصيدليات وسوبر ماركت الباجور مباشرة لباب بيتك.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setServiceCategory('ride')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 ${
              serviceCategory === 'ride'
                ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-black text-sm text-slate-900">حجز مشوار (توكتوك / سيارة)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                  من ١٥ ج.م
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                تنقل فوري بتوكتوك موثق أو سيارة ملاكي أو أرسل طرداً سريعاً بسعر واضح مسبقاً.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 mt-1"
          >
            <span>متابعة إلى تحديد التفاصيل</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= STEP 2: CONFIGURE DETAILS ================= */}
      {step === 2 && serviceCategory === 'delivery' && (
        <div className="flex flex-col gap-3">
          {/* Merchant Selector */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <span className="text-[11px] font-extrabold text-slate-800">١. اختر المتجر المحلي:</span>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {stores.map((store) => {
                const active = store.id === selectedStore?.id;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => {
                      setSelectedStoreId(store.id);
                      setItemQtyMap({});
                    }}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-right transition-all ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-extrabold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">{store.nameAr}</div>
                    <div className="text-[10px] text-slate-500">
                      {store.categoryAr} • توصيل {store.deliveryFeeEgp} ج
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Picker */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-800">
                ٢. أصناف {selectedStore?.nameAr}:
              </span>
              <span className="text-[11px] font-black text-emerald-700">
                المجموع: {deliverySubtotalEgp} ج.م
              </span>
            </div>
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {storeProducts.map((prod) => {
                const qty = itemQtyMap[prod.id] || 0;
                return (
                  <div
                    key={prod.id}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-slate-900 truncate">{prod.nameAr}</div>
                      <div className="text-[10px] text-emerald-800 font-bold">{prod.priceEgp} ج.م</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(prod.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-5 text-center text-xs font-black">{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(prod.id, 1)}
                        className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dropoff Landmark */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <label className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
              <span>٣. عنوان التوصيل في الباجور:</span>
            </label>
            <select
              value={deliveryDropoffId}
              onChange={(e) => setDeliveryDropoffId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
            >
              {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  {lm.nameAr} {lm.isRural ? '(قرية +٥ ج)' : '(وسط المدينة)'}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات للمتجر أو الكابتن (اختياري)..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-3 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5"
            >
              <span>مراجعة الطلب ({deliveryFareBreakdown.totalEgp} ج.م)</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && serviceCategory === 'ride' && (
        <div className="flex flex-col gap-3">
          {/* Vehicle Tier Selector: TukTuk / Car / Package */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <span className="text-[11px] font-extrabold text-slate-800">١. اختر نوع المركبة:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRideVehicle('tuktuk')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  rideVehicle === 'tuktuk'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <Bike className="w-5 h-5 text-emerald-700" />
                <span className="text-[11px] font-black">توكتوك</span>
                <span className="text-[9px] text-slate-500">١٥ ج بداية</span>
              </button>

              <button
                type="button"
                onClick={() => setRideVehicle('car')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  rideVehicle === 'car'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <Car className="w-5 h-5 text-slate-900" />
                <span className="text-[11px] font-black">سيارة ملاكي</span>
                <span className="text-[9px] text-slate-500">٢٨ ج بداية</span>
              </button>

              <button
                type="button"
                onClick={() => setRideVehicle('package')}
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all ${
                  rideVehicle === 'package'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <Package className="w-5 h-5 text-amber-600" />
                <span className="text-[11px] font-black">توصيل طرد</span>
                <span className="text-[9px] text-slate-500">١٥ ج بداية</span>
              </button>
            </div>
          </div>

          {/* Pickup & Dropoff */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-800">٢. مسار المشوار:</span>
              <button
                type="button"
                onClick={() => {
                  const tmp = pickupLandmarkId;
                  setPickupLandmarkId(dropoffLandmarkId);
                  setDropoffLandmarkId(tmp);
                }}
                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1"
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>عكس</span>
              </button>
            </div>

            <select
              value={pickupLandmarkId}
              onChange={(e) => setPickupLandmarkId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
            >
              {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  من: {lm.nameAr}
                </option>
              ))}
            </select>

            <select
              value={dropoffLandmarkId}
              onChange={(e) => setDropoffLandmarkId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900"
            >
              {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  إلى: {lm.nameAr}
                </option>
              ))}
            </select>

            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="رقم التواصل (010...)"
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-mono"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="علامة مميزة لنقطة الركوب (اختياري)..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-3 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5"
            >
              <span>مراجعة الأجرة ({rideFareBreakdown.totalEgp} ج.م)</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: REVIEW & CONFIRM ================= */}
      {step === 3 && (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>
                  {serviceCategory === 'delivery'
                    ? `توصيل من ${selectedStore?.nameAr}`
                    : rideVehicle === 'car'
                    ? 'مشوار سيارة ملاكي'
                    : rideVehicle === 'package'
                    ? 'توصيل طرد سريع'
                    : 'مشوار توكتوك الباجور'}
                </span>
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800 font-bold">
                {estimatedDistanceKm} كم
              </span>
            </div>

            <div className="text-[11px] text-slate-300 flex flex-col gap-1">
              <div>
                <strong className="text-white">من:</strong>{' '}
                {serviceCategory === 'delivery' ? selectedStore?.address : pickupLandmark.nameAr}
              </div>
              <div>
                <strong className="text-white">إلى:</strong> {dropoffLandmark.nameAr}
              </div>
              {serviceCategory === 'delivery' && (
                <div>
                  <strong className="text-white">الأصناف:</strong>{' '}
                  {selectedItemsList.map((i) => `${i.quantity}× ${i.product.nameAr}`).join('، ')}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold">الإجمالي النهائي المستحق</span>
              <span className="text-lg font-black text-emerald-400">{finalTotalEgp}.00 ج.م</span>
            </div>
          </div>

          {/* Payment Method */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200">
            <span className="text-[11px] font-extrabold text-slate-800 block mb-1.5">وسيلة الدفع:</span>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-2 rounded-xl border font-bold ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                💵 كاش
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-2 rounded-xl border font-bold ${
                  paymentMethod === 'wallet'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                💳 المحفظة ({customerWalletBalanceEgp})
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-2 rounded-xl border font-bold ${
                  paymentMethod === 'instapay'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                ⚡ إنستاباي
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-3.5 py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4" />
              <span>تعديل</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmOrder}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري تأكيد وإرسال الطلب...'
                  : `تأكيد الطلب الآن (${finalTotalEgp} ج.م)`}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>السعر شامل كافة الرسوم • متابعة فورية على الخريطة</span>
          </div>
        </div>
      )}
    </div>
  );
};
