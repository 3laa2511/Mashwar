import React, { useState, useEffect, useId } from 'react';
import {
  Clock,
  Navigation,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  RotateCcw,
  RotateCw,
  Copy,
  Check,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Compass,
  Activity,
  MapPin,
} from 'lucide-react';
import { PinchZoomPan } from '../common/PinchZoomPan';

export interface ActiveOrderStaticMapThumbnailProps {
  orderStatus: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm?: number;
  durationMinutes?: number;
  etaSeconds?: number;
  isRefreshing?: boolean;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  mapLayerStyle?: 'route' | 'satellite';
  onToggleMapLayerStyle?: () => void;
  mapZoomScale?: number;
  onMapZoomScaleChange?: (nextZoom: number) => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  copiedField?: 'pickup' | 'dropoff' | null;
  onCopyAddress?: (field: 'pickup' | 'dropoff', text: string) => void;
  onTriggerHaptic?: () => void;
  compact?: boolean;
}

export const ActiveOrderStaticMapThumbnail: React.FC<ActiveOrderStaticMapThumbnailProps> = ({
  orderStatus,
  pickupAddress,
  dropoffAddress,
  distanceKm = 2.4,
  durationMinutes = 18,
  etaSeconds,
  isRefreshing = false,
  isDarkMode: controlledDarkMode,
  onToggleDarkMode,
  mapLayerStyle: controlledLayerStyle,
  onToggleMapLayerStyle,
  mapZoomScale: controlledZoomScale,
  onMapZoomScaleChange,
  isFullScreen: controlledFullScreen,
  onToggleFullScreen,
  copiedField: controlledCopiedField,
  onCopyAddress,
  onTriggerHaptic,
  compact = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gridPatternId = `bagourMapGrid_${uid}`;
  const pinShadowId = `m3MapPinShadow_${uid}`;
  const heatBlurId = `trafficHeatBlur_${uid}`;

  // Internal fallback states so the component works both controlled and uncontrolled
  const [internalDarkMode, setInternalDarkMode] = useState<boolean>(false);
  const [internalLayerStyle, setInternalLayerStyle] = useState<'route' | 'satellite'>('route');
  const [internalZoomScale, setInternalZoomScale] = useState<number>(1);
  const [internalFullScreen, setInternalFullScreen] = useState<boolean>(false);
  const [internalCopiedField, setInternalCopiedField] = useState<'pickup' | 'dropoff' | null>(null);

  // Enhanced interactive map controls state
  const [mapPan, setMapPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [showTrafficHeatmap, setShowTrafficHeatmap] = useState<boolean>(false);

  // Real-time El Bagour weather indicator state (via Google Maps Weather API proxy)
  const [weatherState, setWeatherState] = useState<{
    status: 'loading' | 'ready' | 'unavailable';
    condition: 'sun' | 'cloud' | 'rain';
    temperatureC: number | null;
  }>({
    status: 'loading',
    condition: 'sun',
    temperatureC: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    const loadElBagourWeather = async () => {
      try {
        const res = await fetch('/api/v1/weather/el-bagour', {
          method: 'GET',
          signal: controller.signal,
        });

        const json = (await res.json().catch(() => null)) as {
          success?: boolean;
          error?: { code?: string };
          data?: {
            available?: boolean;
            condition?: 'sun' | 'cloud' | 'rain';
            temperatureC?: number | null;
          };
        } | null;

        if (res.status === 429 || json?.error?.code === 'RESOURCE_EXHAUSTED') {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          if (isMounted) {
            setWeatherState({ status: 'unavailable', condition: 'cloud', temperatureC: null });
          }
          return;
        }

        if (
          res.ok &&
          json?.success &&
          json.data?.available &&
          typeof json.data.temperatureC === 'number'
        ) {
          if (isMounted) {
            setWeatherState({
              status: 'ready',
              condition: json.data.condition ?? 'sun',
              temperatureC: json.data.temperatureC,
            });
          }
        } else if (isMounted) {
          setWeatherState({ status: 'unavailable', condition: 'cloud', temperatureC: null });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (isMounted) {
          setWeatherState({ status: 'unavailable', condition: 'cloud', temperatureC: null });
        }
      }
    };

    loadElBagourWeather();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const isDarkMode = controlledDarkMode ?? internalDarkMode;
  const mapLayerStyle = controlledLayerStyle ?? internalLayerStyle;
  const mapZoomScale = controlledZoomScale ?? internalZoomScale;
  const isFullScreen = controlledFullScreen ?? internalFullScreen;
  const copiedField = controlledCopiedField !== undefined ? controlledCopiedField : internalCopiedField;

  const setZoom = (next: number) => {
    const clamped = Number(Math.max(1, Math.min(3.5, next)).toFixed(2));
    setInternalZoomScale(clamped);
    onMapZoomScaleChange?.(clamped);
  };

  const handleToggleTheme = () => {
    onTriggerHaptic?.();
    if (onToggleDarkMode) {
      onToggleDarkMode();
    } else {
      setInternalDarkMode((prev) => !prev);
    }
  };

  const handleToggleLayer = () => {
    onTriggerHaptic?.();
    if (onToggleMapLayerStyle) {
      onToggleMapLayerStyle();
    } else {
      setInternalLayerStyle((prev) => (prev === 'route' ? 'satellite' : 'route'));
    }
  };

  const handleToggleFullScreen = () => {
    onTriggerHaptic?.();
    if (onToggleFullScreen) {
      onToggleFullScreen();
    } else {
      setInternalFullScreen((prev) => !prev);
    }
  };

  const handleCopy = (field: 'pickup' | 'dropoff', address: string) => {
    onTriggerHaptic?.();
    if (onCopyAddress) {
      onCopyAddress(field, address);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(address).catch(() => {});
    }
    setInternalCopiedField(field);
    window.setTimeout(() => setInternalCopiedField(null), 1800);
  };

  // Zoom controls
  const handleZoomIn = () => {
    onTriggerHaptic?.();
    setZoom(mapZoomScale + 0.35);
  };

  const handleZoomOut = () => {
    onTriggerHaptic?.();
    const next = Math.max(1, Number((mapZoomScale - 0.35).toFixed(2)));
    setZoom(next);
    if (next <= 1) {
      setMapPan({ x: 0, y: 0 });
    }
  };

  // Directional N/S/E/W panning controls
  const PAN_STEP = 26;
  const maxPanOffset = Math.max(56, (mapZoomScale - 1) * 90);
  const clampPan = (val: number) => Math.max(-maxPanOffset, Math.min(maxPanOffset, val));

  const handlePanDirection = (dx: number, dy: number) => {
    onTriggerHaptic?.();
    setMapPan((prev) => ({
      x: clampPan(prev.x + dx),
      y: clampPan(prev.y + dy),
    }));
  };

  // 90-degree clockwise rotation increments
  const handleRotateClockwise = () => {
    onTriggerHaptic?.();
    setRotationDeg((prev) => (prev + 90) % 360);
  };

  // Auto-Center re-centers pan, zoom, and rotation on the active route path
  const handleAutoCenter = () => {
    onTriggerHaptic?.();
    setMapPan({ x: 0, y: 0 });
    setZoom(1);
    setRotationDeg(0);
  };

  // Real-time remaining trip distance calculation based on order status and live ETA countdown
  const baseProgressByStatus = (() => {
    switch (orderStatus) {
      case 'created':
      case 'searching_captain':
      case 'accepted_by_store':
      case 'preparing':
      case 'merchant_accepted':
      case 'ready_for_pickup':
        return 0.05;
      case 'captain_assigned':
        return 0.25;
      case 'at_pickup':
        return 0.42;
      case 'picked_up':
        return 0.58;
      case 'in_transit':
        return 0.72;
      case 'delivered':
        return 1;
      default:
        return 0.35;
    }
  })();

  const totalEtaSeconds = Math.max(60, durationMinutes * 60);
  const etaFractionElapsed =
    typeof etaSeconds === 'number'
      ? Math.max(0, Math.min(1, 1 - etaSeconds / totalEtaSeconds))
      : 0;
  const effectiveProgress =
    orderStatus === 'delivered'
      ? 1
      : Math.min(0.96, Math.max(baseProgressByStatus, baseProgressByStatus + etaFractionElapsed * 0.22));

  const remainingDistanceKm =
    orderStatus === 'delivered'
      ? 0
      : Math.max(0.1, Number((distanceKm * (1 - effectiveProgress)).toFixed(1)));

  // Rider SVG position interpolated along route (65,88) -> (290,48)
  const riderX = Math.round(65 + (290 - 65) * effectiveProgress);
  const riderY = Math.round(88 + (48 - 88) * effectiveProgress - Math.sin(effectiveProgress * Math.PI) * 14);

  // Real-time destination bearing angle (degrees clockwise from North/Up), adjusted for manual canvas rotation
  const bearingSampleProgress = effectiveProgress >= 0.99 ? 0.94 : effectiveProgress;
  const bearingOriginX = 65 + (290 - 65) * bearingSampleProgress;
  const bearingOriginY = 88 + (48 - 88) * bearingSampleProgress - Math.sin(bearingSampleProgress * Math.PI) * 14;
  const rawBearingDeg = (Math.atan2(290 - bearingOriginX, -(48 - bearingOriginY)) * 180) / Math.PI;
  const destinationBearingDeg = Math.round((((rawBearingDeg + rotationDeg) % 360) + 360) % 360);

  if (isRefreshing) {
    return (
      <div
        data-testid="static-map-skeleton-loader"
        className="rounded-2xl border border-slate-200 bg-slate-100 p-3 h-44 flex flex-col justify-between animate-pulse font-['Cairo',sans-serif]"
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 rounded-lg bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-16 rounded-lg bg-slate-300" />
            <div className="h-5 w-6 rounded-lg bg-slate-300" />
          </div>
        </div>
        <div className="flex items-center justify-around py-3">
          <div className="w-7 h-7 rounded-full bg-emerald-300/70" />
          <div className="h-1.5 flex-1 mx-4 rounded-full bg-slate-300" />
          <div className="w-7 h-7 rounded-full bg-amber-300/70" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-6 rounded-lg bg-slate-300" />
          <div className="h-6 rounded-lg bg-slate-300" />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="active-order-static-map-thumbnail"
      data-map-view-mode={isFullScreen ? 'fullscreen' : 'thumbnail'}
      data-theme-mode={isDarkMode ? 'dark' : 'light'}
      data-map-layer={mapLayerStyle}
      data-map-zoom={mapZoomScale.toFixed(2)}
      data-map-rotation={rotationDeg}
      data-pan-x={Math.round(mapPan.x)}
      data-pan-y={Math.round(mapPan.y)}
      data-traffic-heatmap={showTrafficHeatmap ? 'true' : 'false'}
      data-landmarks-visible={showLandmarks ? 'true' : 'false'}
      data-remaining-km={remainingDistanceKm.toFixed(1)}
      data-compass-bearing={destinationBearingDeg}
      data-weather-status={weatherState.status}
      data-weather-condition={weatherState.status === 'ready' ? weatherState.condition : 'unavailable'}
      data-marker-pulse={orderStatus === 'at_pickup' || orderStatus === 'in_transit' ? 'active' : 'idle'}
      data-loading-skeleton="false"
      aria-busy="false"
      aria-label="El Bagour Route Static Map Thumbnail"
      className={`rounded-2xl border overflow-hidden transition-colors duration-300 shadow-md font-['Cairo',sans-serif] ${
        mapLayerStyle === 'satellite'
          ? 'bg-[#0c211b] border-emerald-800/80 text-white'
          : isDarkMode
          ? 'bg-slate-950 border-slate-800 text-white'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Top Map Control Bar: Layer Toggle, Traffic Heatmap, Landmarks, Theme & Fullscreen */}
      <div
        className={`px-2 py-1.5 border-b flex items-center justify-between gap-1 text-[10px] flex-wrap ${
          mapLayerStyle === 'satellite' || isDarkMode
            ? 'bg-slate-900/95 border-slate-800 text-slate-200'
            : 'bg-slate-50 border-slate-200/80 text-slate-700'
        }`}
      >
        <div className="flex items-center gap-1 font-extrabold truncate">
          <Navigation className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="truncate">مسار الباجور • {distanceKm} كم</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {/* Layer Toggle: Route Overview vs Satellite/Terrain */}
          <button
            type="button"
            data-testid="toggle-map-layer-btn"
            onClick={handleToggleLayer}
            className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-extrabold flex items-center gap-1 transition shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${
              mapLayerStyle === 'satellite'
                ? 'bg-emerald-700 text-white border-emerald-500'
                : isDarkMode
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="تبديل طبقة الخريطة (Route / Satellite Terrain)"
          >
            <Layers className="w-2.5 h-2.5 text-amber-500" />
            <span>{mapLayerStyle === 'satellite' ? 'تضاريس' : 'مسار'}</span>
          </button>

          {/* Traffic Heatmap Overlay Toggle */}
          <button
            type="button"
            data-testid="toggle-traffic-heatmap-btn"
            aria-pressed={showTrafficHeatmap}
            onClick={() => {
              onTriggerHaptic?.();
              setShowTrafficHeatmap((prev) => !prev);
            }}
            className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-extrabold flex items-center gap-1 transition shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${
              showTrafficHeatmap
                ? 'bg-rose-600 text-white border-rose-500'
                : isDarkMode || mapLayerStyle === 'satellite'
                ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="عرض خريطة الكثافة المرورية بالباجور (Traffic Heatmap)"
          >
            <Activity className="w-2.5 h-2.5 text-amber-400" />
            <span>المرور</span>
          </button>

          {/* Landmarks Layer Toggle (Hospital, Station, Council) */}
          <button
            type="button"
            data-testid="toggle-map-landmarks-btn"
            aria-pressed={showLandmarks}
            onClick={() => {
              onTriggerHaptic?.();
              setShowLandmarks((prev) => !prev);
            }}
            className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-extrabold flex items-center gap-1 transition shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${
              showLandmarks
                ? 'bg-slate-800 text-amber-300 border-slate-600'
                : isDarkMode || mapLayerStyle === 'satellite'
                ? 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
            title="إظهار معالم الباجور (Hospital • Station • Council)"
          >
            <MapPin className="w-2.5 h-2.5 text-amber-400" />
            <span>المعالم</span>
          </button>

          {/* Dark / Light Theme Toggle */}
          <button
            type="button"
            data-testid="toggle-map-theme-btn"
            onClick={handleToggleTheme}
            className={`px-1.5 py-0.5 rounded-lg border text-[9px] font-extrabold flex items-center gap-0.5 transition shadow-xs cursor-pointer hover:scale-105 active:scale-95 ${
              isDarkMode
                ? 'bg-slate-800 text-amber-300 border-slate-700'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
            title="تبديل ألوان الخريطة (ليلي / نهاري)"
          >
            {isDarkMode ? <Sun className="w-2.5 h-2.5 text-amber-400" /> : <Moon className="w-2.5 h-2.5 text-slate-600" />}
            <span>{isDarkMode ? 'نهاري' : 'ليلي'}</span>
          </button>

          {/* Full-Screen Toggle */}
          <button
            type="button"
            data-testid="toggle-fullscreen-map-btn"
            onClick={handleToggleFullScreen}
            className="px-1.5 py-0.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-600 text-[9px] font-extrabold flex items-center gap-0.5 transition shadow-xs cursor-pointer hover:scale-105 active:scale-95"
            title="عرض الخريطة بملء الشاشة"
          >
            {isFullScreen ? <Minimize2 className="w-2.5 h-2.5" /> : <Maximize2 className="w-2.5 h-2.5" />}
            <span>{isFullScreen ? 'تصغير' : 'ملء'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Canvas Viewport */}
      <div className={`relative ${isFullScreen ? 'h-56' : compact ? 'h-36' : 'h-44'} w-full overflow-hidden`}>
        {/* TOP-RIGHT OVERLAY: Destination Compass Needle + Travel Time + Remaining Distance + Compact Weather */}
        <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1 pointer-events-none">
          <div className="flex items-center gap-1">
            <div
              data-testid="map-travel-estimate-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/95 text-white border border-slate-700 shadow-lg text-[9px] font-extrabold font-['Cairo',sans-serif]"
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>~{durationMinutes} د</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-300">{distanceKm} كم</span>
            </div>

            {/* Top-Right Captain Compass Needle Overlay (Points Toward Destination) */}
            <div
              data-testid="map-captain-compass"
              data-bearing-deg={destinationBearingDeg}
              role="img"
              aria-label={`اتجاه الكابتن نحو الوجهة ${destinationBearingDeg}°`}
              title={`اتجاه الوجهة: ${destinationBearingDeg}°`}
              className="w-7 h-7 rounded-full bg-slate-900/95 border border-slate-700 shadow-lg flex items-center justify-center relative shrink-0"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 transition-transform duration-300 ease-out"
                style={{ transform: `rotate(${destinationBearingDeg}deg)` }}
                aria-hidden="true"
              >
                <polygon points="12,3 15.2,12 12,10.5 8.8,12" fill="#10b981" />
                <polygon points="12,21 14.5,12.5 12,13.5 9.5,12.5" fill="#64748b" />
                <circle cx="12" cy="12" r="1.4" fill="#f8fafc" />
              </svg>
            </div>
          </div>

          {/* Real-Time Remaining Trip Distance Label */}
          <div
            data-testid="map-remaining-distance-badge"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/95 text-slate-100 border border-slate-700 shadow-lg text-[9px] font-extrabold font-['Cairo',sans-serif]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {orderStatus === 'delivered'
                ? 'تم الوصول للوجهة (0.0 كم)'
                : `المتبقي: ${remainingDistanceKm.toFixed(1)} كم`}
            </span>
          </div>

          {/* Compact El Bagour Weather Indicator (Icon + Temperature Only) */}
          <div
            data-testid="map-weather-indicator"
            aria-label={
              weatherState.status === 'ready' && weatherState.temperatureC !== null
                ? `طقس الباجور ${weatherState.temperatureC}°`
                : 'طقس الباجور'
            }
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/95 text-slate-100 border border-slate-700 shadow-lg text-[9px] font-extrabold font-['Cairo',sans-serif]"
          >
            {weatherState.status === 'ready' && weatherState.condition === 'sun' && (
              <Sun className="w-2.5 h-2.5 text-amber-400 shrink-0" aria-hidden="true" />
            )}
            {weatherState.status === 'ready' && weatherState.condition === 'rain' && (
              <CloudRain className="w-2.5 h-2.5 text-sky-400 shrink-0" aria-hidden="true" />
            )}
            {(weatherState.status !== 'ready' || weatherState.condition === 'cloud') && (
              <Cloud className="w-2.5 h-2.5 text-slate-300 shrink-0" aria-hidden="true" />
            )}
            <span dir="ltr">
              {weatherState.status === 'ready' && weatherState.temperatureC !== null
                ? `${weatherState.temperatureC}°C`
                : '--°'}
            </span>
          </div>
        </div>

        {/* TOP-LEFT CORNER: Circular Rotate (90° clockwise) + Auto-Center Button */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          {/* Circular 90-degree Clockwise Rotate Button */}
          <button
            type="button"
            data-testid="map-rotate-btn"
            onClick={handleRotateClockwise}
            aria-label="تدوير الخريطة 90 درجة مع عقارب الساعة"
            title={`تدوير 90° (الحالي: ${rotationDeg}°)`}
            className="w-8 h-8 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-100 hover:text-amber-400 border border-slate-700 shadow-lg flex items-center justify-center transition transform hover:scale-105 active:scale-95 cursor-pointer relative"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {rotationDeg !== 0 && (
              <span className="absolute -bottom-1 -right-1 px-1 rounded-full bg-amber-500 text-slate-950 text-[7px] font-black leading-tight shadow-sm">
                {rotationDeg}°
              </span>
            )}
          </button>

          {/* Auto-Center Route Button */}
          <button
            type="button"
            data-testid="map-auto-center-btn"
            onClick={handleAutoCenter}
            aria-label="إعادة توسيط الخريطة على المسار"
            title="توسيط تلقائي للمسار (Auto-Center)"
            className="h-8 px-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-100 hover:text-emerald-300 border border-slate-700 shadow-lg flex items-center gap-1 text-[9px] font-extrabold font-['Cairo',sans-serif] transition transform hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Compass className="w-3 h-3 text-emerald-400" />
            <span>توسيط</span>
          </button>
        </div>

        {/* Traffic Heatmap Compact Legend when Active */}
        {showTrafficHeatmap && (
          <div
            data-testid="map-traffic-heatmap-legend"
            className="absolute top-12 left-2 z-20 px-2 py-1 rounded-lg bg-slate-900/95 border border-slate-700 text-slate-100 shadow-lg text-[8px] font-bold flex items-center gap-1.5 pointer-events-none"
          >
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />سلس</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />متوسط</span>
            <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />زحام</span>
          </div>
        )}

        {/* BOTTOM-LEFT CORNER: Touch-Optimized '+' and '-' Material 3 Zoom Controls */}
        <div
          data-testid="map-pinch-zoom-controls"
          className="absolute bottom-2 left-2 z-20 flex items-center gap-1"
        >
          <button
            type="button"
            data-testid="map-zoom-in-btn"
            onClick={handleZoomIn}
            disabled={mapZoomScale >= 3.5}
            aria-label="تكبير الخريطة (+)"
            title="تكبير (+)"
            className="w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 disabled:opacity-40 text-white border border-slate-700 shadow-lg flex items-center justify-center font-black text-xs transition transform hover:scale-105 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            data-testid="map-zoom-out-btn"
            onClick={handleZoomOut}
            disabled={mapZoomScale <= 1}
            aria-label="تصغير الخريطة (-)"
            title="تصغير (-)"
            className="w-8 h-8 rounded-xl bg-slate-900/95 hover:bg-slate-800 disabled:opacity-40 text-white border border-slate-700 shadow-lg flex items-center justify-center font-black text-xs transition transform hover:scale-105 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          {(mapZoomScale > 1.02 || mapPan.x !== 0 || mapPan.y !== 0 || rotationDeg !== 0) && (
            <button
              type="button"
              data-testid="map-zoom-reset-btn"
              onClick={handleAutoCenter}
              title="إعادة ضبط الزووم والموضع"
              className="px-2 h-8 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[9px] shadow-lg flex items-center gap-0.5 transition transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>{Math.round(mapZoomScale * 100)}%</span>
            </button>
          )}
        </div>

        {/* BOTTOM-RIGHT CORNER: Directional N / S / E / W Manual Panning Arrow Buttons */}
        <div
          data-testid="map-pan-controls"
          role="group"
          aria-label="أزرار تحريك الخريطة في الاتجاهات الأربعة"
          className="absolute bottom-2 right-2 z-20 grid grid-cols-3 gap-0.5 p-1 rounded-xl bg-slate-900/90 border border-slate-700/90 shadow-lg backdrop-blur-xs"
        >
          <div />
          <button
            type="button"
            data-testid="map-pan-north-btn"
            aria-label="تحريك الخريطة شمالاً (N)"
            title="شمال (N)"
            onClick={() => handlePanDirection(0, PAN_STEP)}
            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-amber-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <div />
          <button
            type="button"
            data-testid="map-pan-east-btn"
            aria-label="تحريك الخريطة شرقاً (E)"
            title="شرق (E)"
            onClick={() => handlePanDirection(-PAN_STEP, 0)}
            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-amber-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={handleAutoCenter}
            aria-label="مركز الخريطة"
            title="المركز"
            className="w-5 h-5 rounded-md bg-slate-950 text-emerald-400 text-[8px] font-black flex items-center justify-center cursor-pointer"
          >
            •
          </button>
          <button
            type="button"
            data-testid="map-pan-west-btn"
            aria-label="تحريك الخريطة غرباً (W)"
            title="غرب (W)"
            onClick={() => handlePanDirection(PAN_STEP, 0)}
            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-amber-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
          <div />
          <button
            type="button"
            data-testid="map-pan-south-btn"
            aria-label="تحريك الخريطة جنوباً (S)"
            title="جنوب (S)"
            onClick={() => handlePanDirection(0, -PAN_STEP)}
            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 hover:text-amber-400 flex items-center justify-center transition active:scale-90 cursor-pointer"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <div />
        </div>

        {/* Interactive Pinch-to-Zoom, Pan & Rotation Map Surface */}
        <PinchZoomPan
          scale={mapZoomScale}
          onScaleChange={setZoom}
          pan={mapPan}
          onPanChange={setMapPan}
          showControls={false}
          className="w-full h-full"
        >
          <div
            data-testid="map-rotation-wrapper"
            style={{
              transform: `rotate(${rotationDeg}deg)`,
              transformOrigin: 'center center',
            }}
            className="w-full h-full transition-transform duration-300 ease-out"
          >
            <svg viewBox="0 0 360 140" className="w-full h-full object-cover select-none font-['Cairo',sans-serif]">
              <defs>
                <pattern id={gridPatternId} width="24" height="24" patternUnits="userSpaceOnUse">
                  <path
                    d="M 24 0 L 0 0 0 24"
                    fill="none"
                    stroke={mapLayerStyle === 'satellite' ? '#14532d' : isDarkMode ? '#1e293b' : '#cbd5e1'}
                    strokeWidth="0.8"
                  />
                </pattern>
                <filter id={pinShadowId} x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.45" />
                </filter>
                <filter id={heatBlurId} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" />
                </filter>
              </defs>

              {/* Base Background */}
              <rect
                width="360"
                height="140"
                fill={mapLayerStyle === 'satellite' ? '#0f2922' : isDarkMode ? '#0f172a' : '#f8fafc'}
              />
              <rect width="360" height="140" fill={`url(#${gridPatternId})`} />

              {/* Satellite/Terrain Topographic Contours */}
              {mapLayerStyle === 'satellite' && (
                <g opacity="0.5">
                  <ellipse cx="88" cy="70" rx="68" ry="40" fill="#064e3b" stroke="#10b981" strokeWidth="0.9" strokeDasharray="4 3" />
                  <ellipse cx="268" cy="64" rx="74" ry="44" fill="#065f46" stroke="#34d399" strokeWidth="0.9" strokeDasharray="4 3" />
                  <path d="M 15 28 Q 95 10 185 30 T 345 18" fill="none" stroke="#34d399" strokeWidth="0.7" opacity="0.45" />
                </g>
              )}

              {/* El Bagour Secondary Roads */}
              <g
                stroke={mapLayerStyle === 'satellite' ? '#134e4a' : isDarkMode ? '#334155' : '#e2e8f0'}
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
              >
                <path d="M 20 50 L 340 50" />
                <path d="M 140 12 L 140 130" />
                <path d="M 245 12 L 245 130" />
              </g>

              {/* Bagour Canal Ribbon */}
              <path
                d="M 0 115 Q 130 95 220 65 T 360 30"
                fill="none"
                stroke={mapLayerStyle === 'satellite' || isDarkMode ? '#0284c7' : '#93c5fd'}
                strokeWidth="14"
                strokeLinecap="round"
                opacity="0.5"
              />

              {/* Traffic Heatmap Congestion Overlay Layer */}
              {showTrafficHeatmap && (
                <g data-testid="map-traffic-heatmap-layer">
                  {/* Glow halos */}
                  <g filter={`url(#${heatBlurId})`} opacity="0.7" fill="none" strokeLinecap="round">
                    <path d="M 48 92 C 95 92, 120 74, 155 64" stroke="#f43f5e" strokeWidth="11" />
                    <path d="M 155 64 C 185 52, 210 48, 245 50" stroke="#f59e0b" strokeWidth="10" />
                    <path d="M 245 50 L 315 52" stroke="#10b981" strokeWidth="9" />
                    <path d="M 140 22 L 140 118" stroke="#f59e0b" strokeWidth="7" />
                  </g>
                  {/* Crisp arterial congestion lines */}
                  <g fill="none" strokeLinecap="round">
                    <path d="M 48 92 C 95 92, 120 74, 155 64" stroke="#e11d48" strokeWidth="3.5" />
                    <path d="M 155 64 C 185 52, 210 48, 245 50" stroke="#d97706" strokeWidth="3.5" />
                    <path d="M 245 50 L 315 52" stroke="#059669" strokeWidth="3.5" />
                  </g>
                </g>
              )}

              {/* Active Route Polyline */}
              <path
                d="M 65 88 C 130 88, 165 44, 290 48"
                fill="none"
                stroke="#10b981"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path
                d="M 65 88 C 130 88, 165 44, 290 48"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                strokeLinecap="round"
              />

              {/* Landmarks Overlay Layer: Hospital, Station, Council (Cairo font + Slate palette) */}
              {showLandmarks && (
                <g data-testid="map-landmarks-layer" className="font-['Cairo',sans-serif]">
                  {/* Station Landmark */}
                  <g transform="translate(88, 34)">
                    <rect x="-32" y="-10" width="64" height="17" rx="5" fill="#0f172a" fillOpacity="0.92" stroke="#475569" strokeWidth="0.9" />
                    <circle cx="-23" cy="-1.5" r="2.5" fill="#38bdf8" />
                    <text x="4" y="1.5" textAnchor="middle" fill="#f8fafc" fontSize="6.5" fontWeight="700">
                      Station • المحطة
                    </text>
                  </g>

                  {/* Hospital Landmark */}
                  <g transform="translate(192, 24)">
                    <rect x="-36" y="-10" width="72" height="17" rx="5" fill="#0f172a" fillOpacity="0.92" stroke="#475569" strokeWidth="0.9" />
                    <circle cx="-27" cy="-1.5" r="2.5" fill="#fb7185" />
                    <text x="4" y="1.5" textAnchor="middle" fill="#f8fafc" fontSize="6.5" fontWeight="700">
                      Hospital • المستشفى
                    </text>
                  </g>

                  {/* Council Landmark */}
                  <g transform="translate(262, 108)">
                    <rect x="-34" y="-10" width="68" height="17" rx="5" fill="#0f172a" fillOpacity="0.92" stroke="#475569" strokeWidth="0.9" />
                    <circle cx="-25" cy="-1.5" r="2.5" fill="#fbbf24" />
                    <text x="4" y="1.5" textAnchor="middle" fill="#f8fafc" fontSize="6.5" fontWeight="700">
                      Council • المجلس
                    </text>
                  </g>
                </g>
              )}

              {/* Pickup Material 3 SVG Pin */}
              <g
                transform="translate(65, 88)"
                filter={`url(#${pinShadowId})`}
                data-testid="map-svg-pickup-pin"
              >
                {orderStatus === 'at_pickup' && (
                  <circle cx="0" cy="-10" r="16" fill="#10b981" opacity="0.35">
                    <animate attributeName="r" values="9;20;9" dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <path
                  d="M 0 0 C -6 -7 -10 -12 -10 -17 A 10 10 0 1 1 10 -17 C 10 -12 6 -7 0 0 Z"
                  fill="#047857"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                />
                <circle cx="0" cy="-17" r="3.8" fill="#ffffff" />
              </g>

              {/* Captain Live Scooter Marker */}
              <g transform={`translate(${riderX}, ${riderY})`} filter={`url(#${pinShadowId})`}>
                <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                <text x="0" y="3.5" textAnchor="middle" fontSize="9">🛵</text>
              </g>

              {/* Dropoff Material 3 SVG Pin */}
              <g
                transform="translate(290, 48)"
                filter={`url(#${pinShadowId})`}
                data-testid="map-svg-dropoff-pin"
              >
                {orderStatus === 'in_transit' && (
                  <circle cx="0" cy="-10" r="16" fill="#f59e0b" opacity="0.35">
                    <animate attributeName="r" values="9;20;9" dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                )}
                <path
                  d="M 0 0 C -6 -7 -10 -12 -10 -17 A 10 10 0 1 1 10 -17 C 10 -12 6 -7 0 0 Z"
                  fill="#d97706"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                />
                <circle cx="0" cy="-17" r="3.8" fill="#ffffff" />
              </g>
            </svg>
          </div>
        </PinchZoomPan>
      </div>

      {/* Bottom Copy Pickup & Dropoff Address Controls */}
      <div
        className={`px-2.5 py-1.5 border-t grid grid-cols-2 gap-1.5 text-[10px] ${
          mapLayerStyle === 'satellite' || isDarkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200/80'
        }`}
      >
        <button
          type="button"
          data-testid="copy-pickup-address-btn"
          onClick={() => handleCopy('pickup', pickupAddress)}
          className={`px-2 py-1 rounded-xl border flex items-center justify-between gap-1 transition cursor-pointer hover:scale-105 active:scale-95 ${
            copiedField === 'pickup'
              ? 'bg-emerald-700 text-white border-emerald-600'
              : isDarkMode || mapLayerStyle === 'satellite'
              ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
          }`}
          title="نسخ عنوان الاستلام (Copy Pickup Address)"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-bold truncate">
              {copiedField === 'pickup' ? 'تم النسخ ✓' : `استلام: ${pickupAddress}`}
            </span>
          </div>
          {copiedField === 'pickup' ? (
            <Check className="w-3 h-3 shrink-0" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400 shrink-0" />
          )}
        </button>

        <button
          type="button"
          data-testid="copy-dropoff-address-btn"
          onClick={() => handleCopy('dropoff', dropoffAddress)}
          className={`px-2 py-1 rounded-xl border flex items-center justify-between gap-1 transition cursor-pointer hover:scale-105 active:scale-95 ${
            copiedField === 'dropoff'
              ? 'bg-amber-500 text-slate-950 border-amber-400'
              : isDarkMode || mapLayerStyle === 'satellite'
              ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
          }`}
          title="نسخ عنوان التوصيل (Copy Dropoff Address)"
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="font-bold truncate">
              {copiedField === 'dropoff' ? 'تم النسخ ✓' : `وصول: ${dropoffAddress}`}
            </span>
          </div>
          {copiedField === 'dropoff' ? (
            <Check className="w-3 h-3 shrink-0" />
          ) : (
            <Copy className="w-3 h-3 text-slate-400 shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
};
