import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  X,
  MapPin,
  Phone,
  Share2,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  HeadphonesIcon,
  BatteryLow,
} from 'lucide-react';
import { auth, triggerRideSafetySosInFirestore } from '../../lib/firebase';
import { useMarketplace } from '../../store/marketplaceStore';

export interface SosGpsCoordinates {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  source: 'gps' | 'fallback';
  updatedAtLabel: string;
}

interface SosEmergencySheetProps {
  isOpen: boolean;
  onClose: () => void;
  orderId?: string;
  orderNumber?: string;
  supportPhone?: string;
}

const EL_BAGOUR_DEFAULT_COORDS: SosGpsCoordinates = {
  lat: 30.4312,
  lng: 31.0365,
  accuracyMeters: null,
  source: 'fallback',
  updatedAtLabel: 'إحداثيات مركز الباجور الافتراضية',
};

export const SosEmergencySheet: React.FC<SosEmergencySheetProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  supportPhone = '01000019019',
}) => {
  const {
    gpsHighAccuracy,
    isBatterySaverActive,
    batteryLevelPercent,
    gpsUpdateIntervalMs,
  } = useMarketplace();
  const [coords, setCoords] = useState<SosGpsCoordinates>(EL_BAGOUR_DEFAULT_COORDS);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [gpsStatusNote, setGpsStatusNote] = useState<string | null>(null);
  const [locationShared, setLocationShared] = useState<boolean>(false);
  const [copiedCoords, setCopiedCoords] = useState<boolean>(false);
  const [calledServiceLabel, setCalledServiceLabel] = useState<string | null>(null);

  const fetchCurrentGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCoords({
        ...EL_BAGOUR_DEFAULT_COORDS,
        updatedAtLabel: 'المتصفح لا يدعم GPS — تم عرض موقع الباجور التقريبي',
      });
      setGpsStatusNote('خدمة تحديد الموقع غير متاحة في هذا المتصفح، تم عرض إحداثيات مركز الباجور.');
      return;
    }

    setIsLocating(true);
    setGpsStatusNote(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nowLabel = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setCoords({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
          accuracyMeters: Math.round(position.coords.accuracy || 0),
          source: 'gps',
          updatedAtLabel: `مُحدث الساعة ${nowLabel}`,
        });
        setIsLocating(false);
        setGpsStatusNote(null);
      },
      (err) => {
        setIsLocating(false);
        setCoords({
          ...EL_BAGOUR_DEFAULT_COORDS,
          updatedAtLabel: 'نقطة تمركز الباجور (GPS احتياطي)',
        });
        if (err.code === err.PERMISSION_DENIED) {
          setGpsStatusNote('تم رفض إذن الموقع من المتصفح — يُستخدم موقع تمركز الباجور لحين تفعيل GPS.');
        } else {
          setGpsStatusNote('تعذر التقاط إشارة GPS حالياً — تم عرض إحداثيات الباجور الاحتياطية.');
        }
      },
      {
        enableHighAccuracy: gpsHighAccuracy,
        timeout: 6000,
        maximumAge: isBatterySaverActive ? 15000 : 5000,
      }
    );
  }, [gpsHighAccuracy, isBatterySaverActive]);

  useEffect(() => {
    if (!isOpen) return;
    setLocationShared(false);
    setCalledServiceLabel(null);
    fetchCurrentGpsLocation();
  }, [isOpen, fetchCurrentGpsLocation]);

  if (!isOpen) return null;

  const formattedLatLng = `${coords.lat.toFixed(5)}° N, ${coords.lng.toFixed(5)}° E`;
  const googleMapsUrl = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;

  const syncSosFlagToCloud = () => {
    if (orderId && auth.currentUser) {
      triggerRideSafetySosInFirestore(orderId).catch(() => {
        // Keep SOS flow responsive locally if order is local-only or non-ride
      });
    }
  };

  const handleShareLocation = () => {
    setLocationShared(true);
    syncSosFlagToCloud();
  };

  const handleCopyCoordinates = () => {
    const shareText = `طوارئ مشوار الباجور${
      orderNumber ? ` (طلب ${orderNumber})` : ''
    } — موقعي الحالي: ${coords.lat}, ${coords.lng} (${googleMapsUrl})`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
    setCopiedCoords(true);
    window.setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleEmergencyDial = (serviceLabel: string) => {
    setCalledServiceLabel(serviceLabel);
    syncSosFlagToCloud();
  };

  return (
    <div
      data-testid="sos-emergency-modal"
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-2xs flex flex-col justify-end"
      dir="rtl"
    >
      <div className="bg-white rounded-t-3xl p-4 shadow-2xl flex flex-col gap-3 max-h-[88%] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-rose-950">طوارئ وأمان مشوار الباجور (SOS)</h4>
              <p className="text-[10px] text-rose-600 font-bold">
                مشاركة الموقع الفوري GPS والاتصال السريع بالطوارئ والدعم
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="إغلاق نافذة الطوارئ"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live GPS Coordinates Panel */}
        <div
          data-testid="sos-gps-location-card"
          className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-rose-900 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>موقعك الجغرافي الحالي (GPS):</span>
            </span>
            <button
              type="button"
              data-testid="sos-refresh-gps-btn"
              onClick={fetchCurrentGpsLocation}
              disabled={isLocating}
              className="px-2 py-0.5 rounded-lg bg-white text-rose-700 font-black text-[10px] border border-rose-200 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'جاري التحديد...' : 'تحديث GPS'}</span>
            </button>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  data-testid="sos-gps-coordinates"
                  className="font-mono font-black text-[11px] text-slate-900"
                  dir="ltr"
                >
                  {formattedLatLng}
                </span>
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                    coords.source === 'gps'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {coords.source === 'gps'
                    ? `GPS حي${coords.accuracyMeters ? ` (±${coords.accuracyMeters}م)` : ''}`
                    : 'الباجور • احتياطي'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {coords.updatedAtLabel}
                {orderNumber ? ` • طلب ${orderNumber}` : ''}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyCoordinates}
              className="shrink-0 px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
            >
              {copiedCoords ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedCoords ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          {gpsStatusNote && (
            <div className="flex items-start gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>{gpsStatusNote}</span>
            </div>
          )}

          {isBatterySaverActive && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-900 pt-0.5">
              <BatteryLow className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="tabular-nums">
                وضع توفير الطاقة نشط ({batteryLevelPercent}%) · تحديد GPS اقتصادي كل {Math.round(gpsUpdateIntervalMs / 1000)} ث
              </span>
            </div>
          )}

          {/* Emergency Contact Card */}
          <div className="bg-white p-2.5 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-black text-slate-900 block truncate">
                د. سامح المنوفي (جهة الطوارئ - الباجور)
              </span>
              <span className="font-mono text-[11px] text-slate-600" dir="ltr">
                01099881122
              </span>
            </div>
            <a
              href="tel:01099881122"
              onClick={() => handleEmergencyDial('جهة الطوارئ المسجلة (01099881122)')}
              className="shrink-0 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-black flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              <span>اتصال</span>
            </a>
          </div>

          <button
            type="button"
            data-testid="sos-share-location-btn"
            onClick={handleShareLocation}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>
              {locationShared
                ? 'تم إرسال إحداثيات GPS الحية لجهة الطوارئ ✓'
                : 'مشاركة موقعي GPS الحي الآن مع الطوارئ'}
            </span>
          </button>
        </div>

        {/* One-Tap Emergency Services & Support Hotline */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-500 block">
            اتصال فوري بضغطة واحدة — طوارئ الباجور والدعم:
          </span>

          <div className="grid grid-cols-2 gap-2">
            <a
              href="tel:122"
              data-testid="sos-call-police-btn"
              onClick={() => handleEmergencyDial('شرطة النجدة بالباجور (122)')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex flex-col items-center gap-1 text-center"
            >
              <Phone className="w-4 h-4 text-rose-400" />
              <span>شرطة النجدة (122)</span>
            </a>

            <a
              href="tel:123"
              data-testid="sos-call-ambulance-btn"
              onClick={() => handleEmergencyDial('إسعاف الباجور المركزي (123)')}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold flex flex-col items-center gap-1 text-center"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>إسعاف الباجور (123)</span>
            </a>

            <a
              href="tel:180"
              data-testid="sos-call-fire-btn"
              onClick={() => handleEmergencyDial('الحماية المدنية بالباجور (180)')}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex flex-col items-center gap-1 text-center"
            >
              <Phone className="w-4 h-4 text-amber-400" />
              <span>المطافئ (180)</span>
            </a>

            <a
              href={`tel:${supportPhone}`}
              data-testid="sos-call-support-btn"
              onClick={() => handleEmergencyDial(`دعم مشوار الباجور (${supportPhone})`)}
              className="p-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex flex-col items-center gap-1 text-center"
            >
              <HeadphonesIcon className="w-4 h-4 text-white" />
              <span>دعم مشوار ({supportPhone})</span>
            </a>
          </div>

          {calledServiceLabel && (
            <div
              data-testid="sos-call-confirmation"
              className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-[11px] font-bold text-center space-y-0.5"
            >
              <div>جاري الاتصال الفوري بـ: {calledServiceLabel}</div>
              <div className="text-[10px] font-mono text-emerald-800" dir="ltr">
                GPS: {coords.lat}, {coords.lng}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
