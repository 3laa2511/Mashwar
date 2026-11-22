import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Crosshair,
  ArrowUpDown,
  MapPin,
  Clock,
  Navigation,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import {
  RIDE_TIER_PRICING,
  VehicleTier,
  calculateSmartGeolocationFare,
  findNearestLandmarkByCoords,
} from '../../lib/firestoreSchemas';
import { EL_BAGOUR_LANDMARKS_LIST } from '../../store/marketplaceStore';

export interface SmartFareAppliedPayload {
  pickupLandmarkId: string;
  dropoffLandmarkId: string;
  vehicleTier: VehicleTier;
  gpsCoords: { lat: number; lng: number; accuracyMeters: number | null } | null;
  roadDistanceKm: number;
  etaMinutes: number;
  totalEgp: number;
}

interface SmartFareCalculatorCardProps {
  initialPickupId?: string;
  initialDropoffId?: string;
  initialVehicleTier?: VehicleTier;
  fallbackGpsLocation?: {
    lat: number;
    lng: number;
    accuracyMeters: number | null;
  };
  onApplyCalculation: (payload: SmartFareAppliedPayload) => void;
  onClose?: () => void;
}

export const SmartFareCalculatorCard: React.FC<SmartFareCalculatorCardProps> = ({
  initialPickupId = 'lm_station',
  initialDropoffId = 'lm_kafr_bagour',
  initialVehicleTier = 'tuktuk',
  fallbackGpsLocation,
  onApplyCalculation,
  onClose,
}) => {
  const [pickupId, setPickupId] = useState<string>(initialPickupId);
  const [dropoffId, setDropoffId] = useState<string>(initialDropoffId);
  const [vehicleTier, setVehicleTier] = useState<VehicleTier>(initialVehicleTier);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'active' | 'fallback'>('idle');
  const [liveGpsCoords, setLiveGpsCoords] = useState<{
    lat: number;
    lng: number;
    accuracyMeters: number | null;
  } | null>(null);
  const [useGpsCoordinates, setUseGpsCoordinates] = useState<boolean>(false);
  const [gpsMessageAr, setGpsMessageAr] = useState<string | null>(null);

  const pickupLandmark =
    EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === pickupId) || EL_BAGOUR_LANDMARKS_LIST[0];
  const dropoffLandmark =
    EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === dropoffId) || EL_BAGOUR_LANDMARKS_LIST[1];

  const effectivePickupCoords = useMemo(() => {
    if (useGpsCoordinates && liveGpsCoords) {
      return { lat: liveGpsCoords.lat, lng: liveGpsCoords.lng };
    }
    return { lat: pickupLandmark.lat, lng: pickupLandmark.lng };
  }, [useGpsCoordinates, liveGpsCoords, pickupLandmark]);

  const isSameStop = !useGpsCoordinates && pickupLandmark.id === dropoffLandmark.id;
  const isRuralRoute = pickupLandmark.isRural || dropoffLandmark.isRural;

  const tierEstimates = useMemo(() => {
    const tiers: VehicleTier[] = ['tuktuk', 'scooter', 'car'];
    return tiers.map((tier) => ({
      tier,
      meta: RIDE_TIER_PRICING[tier],
      fare: calculateSmartGeolocationFare({
        pickupLat: effectivePickupCoords.lat,
        pickupLng: effectivePickupCoords.lng,
        dropoffLat: dropoffLandmark.lat,
        dropoffLng: dropoffLandmark.lng,
        vehicleTier: tier,
        isRural: isRuralRoute,
      }),
    }));
  }, [effectivePickupCoords, dropoffLandmark, isRuralRoute]);

  const selectedEstimate =
    tierEstimates.find((t) => t.tier === vehicleTier) || tierEstimates[0];

  const applyGpsCoordinatesToNearestLandmark = (
    lat: number,
    lng: number,
    accuracyMeters: number | null,
    status: 'active' | 'fallback'
  ) => {
    setLiveGpsCoords({ lat, lng, accuracyMeters });
    setUseGpsCoordinates(true);
    setGpsStatus(status);

    const nearest = findNearestLandmarkByCoords(lat, lng, EL_BAGOUR_LANDMARKS_LIST);
    if (nearest) {
      setPickupId(nearest.landmark.id);
      if (nearest.landmark.id === dropoffId) {
        const alternative = EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id !== nearest.landmark.id);
        if (alternative) setDropoffId(alternative.id);
      }
      setGpsMessageAr(
        status === 'active'
          ? `تم رصد موقعك الفعلي (${lat.toFixed(4)}, ${lng.toFixed(4)}) · الأقرب: ${nearest.landmark.nameAr}`
          : `تم اعتماد إحداثيات الباجور (${lat.toFixed(4)}, ${lng.toFixed(4)}) · الأقرب: ${nearest.landmark.nameAr}`
      );
    }
  };

  const handleDetectCurrentGps = () => {
    setGpsStatus('locating');
    setGpsMessageAr('جاري تحديد إحداثيات موقعك الحالي عبر GPS...');

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          applyGpsCoordinatesToNearestLandmark(
            Number(pos.coords.latitude.toFixed(6)),
            Number(pos.coords.longitude.toFixed(6)),
            Math.round(pos.coords.accuracy || 15),
            'active'
          );
        },
        () => {
          const fallbackLat = fallbackGpsLocation?.lat ?? 30.4328;
          const fallbackLng = fallbackGpsLocation?.lng ?? 31.0339;
          applyGpsCoordinatesToNearestLandmark(
            fallbackLat,
            fallbackLng,
            fallbackGpsLocation?.accuracyMeters ?? 25,
            'fallback'
          );
        },
        { enableHighAccuracy: true, timeout: 4500, maximumAge: 5000 }
      );
    } else {
      const fallbackLat = fallbackGpsLocation?.lat ?? 30.4328;
      const fallbackLng = fallbackGpsLocation?.lng ?? 31.0339;
      applyGpsCoordinatesToNearestLandmark(
        fallbackLat,
        fallbackLng,
        fallbackGpsLocation?.accuracyMeters ?? 25,
        'fallback'
      );
    }
  };

  const handleSwapStops = () => {
    setUseGpsCoordinates(false);
    const oldPickup = pickupId;
    setPickupId(dropoffId);
    setDropoffId(oldPickup);
  };

  return (
    <div
      data-testid="smart-fare-calculator-card"
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3 text-xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-extrabold text-sm text-slate-900 truncate">
              حاسبة الأسعار الذكية بالـ GPS
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              تقدير المسافة الفعلية والتكلفة بين قرى ومناطق الباجور
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق حاسبة الأسعار"
            className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Geolocation Detection Row */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="smart-fare-gps-btn"
            onClick={handleDetectCurrentGps}
            disabled={gpsStatus === 'locating'}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-60"
          >
            {gpsStatus === 'locating' ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <Crosshair className="w-4 h-4 text-emerald-400" />
            )}
            <span>
              {gpsStatus === 'locating'
                ? 'جاري تحديد الموقع...'
                : 'تحديد موقعي الحالي عبر GPS'}
            </span>
          </button>

          {liveGpsCoords && (
            <button
              type="button"
              onClick={() => setUseGpsCoordinates((prev) => !prev)}
              className={`min-h-[44px] px-3 rounded-xl border text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                useGpsCoordinates
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {useGpsCoordinates ? 'إحداثيات GPS مفعّلة' : 'تفعيل إحداثياتي'}
            </button>
          )}
        </div>

        {gpsMessageAr && (
          <div
            data-testid="smart-fare-gps-status"
            className="px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-[10px] font-bold text-emerald-900 tabular-nums"
          >
            {gpsMessageAr}
          </div>
        )}
      </div>

      {/* Pickup & Dropoff Pickers */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700">مسار الرحلة:</span>
          <button
            type="button"
            onClick={handleSwapStops}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>عكس الاتجاه</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              نقطة الانطلاق {useGpsCoordinates && liveGpsCoords ? '(محددة عبر GPS)' : ''}:
            </label>
            <select
              data-testid="smart-fare-pickup-select"
              value={pickupId}
              onChange={(e) => {
                setUseGpsCoordinates(false);
                setPickupId(e.target.value);
              }}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
            >
              {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  {lm.nameAr} {lm.isRural ? '(قرية)' : '(مركز)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              نقطة الوصول:
            </label>
            <select
              data-testid="smart-fare-dropoff-select"
              value={dropoffId}
              onChange={(e) => setDropoffId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600"
            >
              {EL_BAGOUR_LANDMARKS_LIST.map((lm) => (
                <option key={lm.id} value={lm.id}>
                  {lm.nameAr} {lm.isRural ? '(قرية)' : '(مركز)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500 tabular-nums px-1">
          <span>
            انطلاق: {effectivePickupCoords.lat.toFixed(4)}, {effectivePickupCoords.lng.toFixed(4)}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            وصول: {dropoffLandmark.lat.toFixed(4)}, {dropoffLandmark.lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Vehicle Tier Comparison */}
      <div className="grid grid-cols-3 gap-1.5">
        {tierEstimates.map(({ tier, meta, fare }) => {
          const active = vehicleTier === tier;
          return (
            <button
              key={tier}
              type="button"
              data-testid={`smart-fare-tier-${tier}`}
              onClick={() => setVehicleTier(tier)}
              className={`min-h-[68px] p-2 rounded-xl border text-right flex flex-col justify-between transition cursor-pointer ${
                active
                  ? 'bg-emerald-700 border-emerald-700 text-white shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-emerald-50/50'
              }`}
            >
              <span className="text-[11px] font-extrabold truncate w-full">
                {meta.labelAr}
              </span>
              <div className="flex items-baseline justify-between gap-1 mt-1 tabular-nums">
                <span className={`text-sm font-black ${active ? 'text-white' : 'text-emerald-800'}`}>
                  {fare.totalEgp} ج
                </span>
                <span className={`text-[10px] ${active ? 'text-emerald-100' : 'text-slate-500'}`}>
                  {fare.etaMinutes} د
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Results & Breakdown */}
      {isSameStop ? (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[11px]">
          يرجى اختيار نقطة وصول مختلفة عن نقطة الانطلاق لحساب المسافة والتكلفة الدقيقة.
        </div>
      ) : (
        <div
          data-testid="smart-fare-result-box"
          className="p-3 rounded-xl bg-slate-900 text-white flex flex-col gap-2"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-3 text-[11px] text-slate-300 tabular-nums">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <MapPin className="w-3.5 h-3.5" />
                <span>{selectedEstimate.fare.roadDistanceKm} كم</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>~{selectedEstimate.fare.etaMinutes} دقيقة</span>
              </span>
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">
              خط مستقيم {selectedEstimate.fare.straightLineKm} كم
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 tabular-nums">
            <div>
              فتحة العداد:{' '}
              <strong className="text-white">
                {Math.round(selectedEstimate.fare.baseFarePiasters / 100)} ج.م
              </strong>
            </div>
            <div>
              تكلفة المسافة:{' '}
              <strong className="text-white">
                {Math.round(selectedEstimate.fare.distanceFarePiasters / 100)} ج.م
              </strong>
            </div>
            {selectedEstimate.fare.ruralSurchargePiasters > 0 && (
              <div>
                بدل القرى:{' '}
                <strong className="text-amber-300">
                  +{Math.round(selectedEstimate.fare.ruralSurchargePiasters / 100)} ج.م
                </strong>
              </div>
            )}
            <div>
              رسوم المنصة:{' '}
              <strong className="text-white">
                {Math.round(selectedEstimate.fare.platformFeePiasters / 100)} ج.م
              </strong>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">التكلفة التقديرية للمشوار</span>
              <span
                data-testid="smart-fare-total-egp"
                className="text-lg font-black text-emerald-400 tabular-nums"
              >
                {selectedEstimate.fare.totalEgp}.00 ج.م
              </span>
            </div>

            <button
              type="button"
              data-testid="smart-fare-apply-btn"
              onClick={() =>
                onApplyCalculation({
                  pickupLandmarkId: pickupLandmark.id,
                  dropoffLandmarkId: dropoffLandmark.id,
                  vehicleTier,
                  gpsCoords: useGpsCoordinates ? liveGpsCoords : null,
                  roadDistanceKm: selectedEstimate.fare.roadDistanceKm,
                  etaMinutes: selectedEstimate.fare.etaMinutes,
                  totalEgp: selectedEstimate.fare.totalEgp,
                })
              }
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] flex items-center gap-1.5 cursor-pointer transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>اعتماد في الحجز</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
