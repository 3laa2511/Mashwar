import React, { useState, useRef } from 'react';
import {
  Plus,
  Minus,
  RotateCcw,
  Layers,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  Clock,
  Copy,
  Check,
} from 'lucide-react';

interface EgyptianMapCanvasProps {
  mode: 'customer' | 'captain' | 'admin';
  pickupText?: string;
  dropoffText?: string;
  showRoute?: boolean;
  orderStatus?: string;
  distanceKm?: number;
  durationMinutes?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  mapLayerStyle?: 'route' | 'satellite';
  onToggleMapLayerStyle?: () => void;
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onCopyPickup?: () => void;
  onCopyDropoff?: () => void;
  copiedField?: 'pickup' | 'dropoff' | null;
  isCaptainOnline?: boolean;
  hasIncomingRequest?: boolean;
  activeDeliveryStep?: number;
}

export const EgyptianMapCanvas: React.FC<EgyptianMapCanvasProps> = ({
  mode,
  pickupText = 'ميدان المحطة - الباجور',
  dropoffText = 'شارع الجيش - أمام مجلس المدينة',
  showRoute = true,
  orderStatus = 'in_transit',
  distanceKm = 2.4,
  durationMinutes = 18,
  isDarkMode: externalDarkMode,
  onToggleDarkMode,
  mapLayerStyle: externalLayerStyle,
  onToggleMapLayerStyle,
  isFullScreen = false,
  onToggleFullScreen,
  onCopyPickup,
  onCopyDropoff,
  copiedField: externalCopiedField,
}) => {
  // Internal fallbacks if parent doesn't control state
  const [internalDarkMode, setInternalDarkMode] = useState(false);
  const [internalLayerStyle, setInternalLayerStyle] = useState<'route' | 'satellite'>('route');
  const [internalCopied, setInternalCopied] = useState<'pickup' | 'dropoff' | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isDark = externalDarkMode !== undefined ? externalDarkMode : internalDarkMode;
  const layerStyle = externalLayerStyle !== undefined ? externalLayerStyle : internalLayerStyle;
  const activeCopied = externalCopiedField !== undefined ? externalCopiedField : internalCopied;

  const isPickupPulsing = orderStatus === 'at_pickup';
  const isDropoffPulsing = orderStatus === 'in_transit';

  const handleToggleDark = () => {
    if (onToggleDarkMode) onToggleDarkMode();
    else setInternalDarkMode((prev) => !prev);
  };

  const handleToggleLayer = () => {
    if (onToggleMapLayerStyle) onToggleMapLayerStyle();
    else setInternalLayerStyle((prev) => (prev === 'route' ? 'satellite' : 'route'));
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.6, Number((prev + 0.35).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(1, Number((prev - 0.35).toFixed(2)));
      if (next <= 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCopyAddress = (type: 'pickup' | 'dropoff', text: string) => {
    if (type === 'pickup' && onCopyPickup) {
      onCopyPickup();
      return;
    }
    if (type === 'dropoff' && onCopyDropoff) {
      onCopyDropoff();
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setInternalCopied(type);
    setTimeout(() => {
      setInternalCopied((prev) => (prev === type ? null : prev));
    }, 2000);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || zoomScale <= 1) return;
    const maxPan = (zoomScale - 1) * 90;
    const nextX = Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStartRef.current.x));
    const nextY = Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStartRef.current.y));
    setPanOffset({ x: nextX, y: nextY });
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div
      data-testid="mobile-interactive-map-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative w-full h-full overflow-hidden select-none font-['Cairo',sans-serif] transition-colors duration-300 ${
        layerStyle === 'satellite'
          ? 'bg-[#0c211b]'
          : isDark
          ? 'bg-slate-950'
          : 'bg-[#EDEAE2]'
      }`}
    >
      {/* Zoomable & Pannable Vector Map Layer */}
      <div
        className="w-full h-full transition-transform duration-200 ease-out origin-center"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
        }}
      >
        <svg
          viewBox="0 0 400 700"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="cairoGridLight" width="45" height="45" patternUnits="userSpaceOnUse">
              <path
                d="M 45 0 L 0 0 0 45"
                fill="none"
                stroke="#DCD7CC"
                strokeWidth="1"
              />
            </pattern>
            <pattern id="cairoGridDark" width="45" height="45" patternUnits="userSpaceOnUse">
              <path
                d="M 45 0 L 0 0 0 45"
                fill="none"
                stroke="#1e293b"
                strokeWidth="1"
              />
            </pattern>
            <pattern id="satelliteTerrainGrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <rect width="36" height="36" fill="#0f2922" />
              <circle cx="9" cy="9" r="1.2" fill="#34d399" opacity="0.22" />
              <circle cx="27" cy="24" r="1.5" fill="#10b981" opacity="0.18" />
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke="#14532d"
                strokeWidth="0.8"
                opacity="0.55"
              />
            </pattern>
            <linearGradient id="nileWater" x1="0" y1="0" x2="1" y2="1">
              <stop
                offset="0%"
                stopColor={
                  layerStyle === 'satellite'
                    ? '#0369a1'
                    : isDark
                    ? '#0c4a6e'
                    : '#93C5FD'
                }
              />
              <stop
                offset="100%"
                stopColor={
                  layerStyle === 'satellite'
                    ? '#0284c7'
                    : isDark
                    ? '#075985'
                    : '#60A5FA'
                }
              />
            </linearGradient>
            <linearGradient id="routeStroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            {/* Material 3 Drop Shadow for Map Pins */}
            <filter id="mobilePinShadow" x="-35%" y="-35%" width="170%" height="170%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Base Urban Blocks */}
          <rect
            width="400"
            height="700"
            fill={
              layerStyle === 'satellite'
                ? 'url(#satelliteTerrainGrid)'
                : isDark
                ? 'url(#cairoGridDark)'
                : 'url(#cairoGridLight)'
            }
          />

          {/* Satellite Topographic Contour Rings when in Satellite/Terrain mode */}
          {layerStyle === 'satellite' && (
            <g opacity="0.4">
              <ellipse
                cx="120"
                cy="210"
                rx="95"
                ry="55"
                fill="#064e3b"
                stroke="#10b981"
                strokeWidth="0.9"
                strokeDasharray="5 4"
              />
              <ellipse
                cx="290"
                cy="430"
                rx="110"
                ry="65"
                fill="#065f46"
                stroke="#34d399"
                strokeWidth="0.9"
                strokeDasharray="4 4"
              />
            </g>
          )}

          {/* Green Agricultural Delta Zones around El-Bagour */}
          <path
            d="M 0 0 L 140 0 L 110 180 L 0 210 Z"
            fill={
              layerStyle === 'satellite'
                ? '#064e3b'
                : isDark
                ? '#064e3b'
                : '#D9EAD3'
            }
            opacity={isDark || layerStyle === 'satellite' ? '0.55' : '0.7'}
          />
          <path
            d="M 270 420 L 400 390 L 400 700 L 240 700 Z"
            fill={
              layerStyle === 'satellite'
                ? '#065f46'
                : isDark
                ? '#064e3b'
                : '#D9EAD3'
            }
            opacity={isDark || layerStyle === 'satellite' ? '0.5' : '0.65'}
          />
          <circle
            cx="320"
            cy="150"
            r="55"
            fill={
              layerStyle === 'satellite'
                ? '#047857'
                : isDark
                ? '#065f46'
                : '#D1E7DD'
            }
            opacity="0.55"
          />

          {/* Bagour Canal (ترعة الباجورية) */}
          <path
            d="M -20 110 Q 120 150, 195 310 T 420 560"
            fill="none"
            stroke="url(#nileWater)"
            strokeWidth="26"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M -20 110 Q 120 150, 195 310 T 420 560"
            fill="none"
            stroke={layerStyle === 'satellite' || isDark ? '#38bdf8' : '#DBEAFE'}
            strokeWidth="3"
            strokeDasharray="8 8"
            opacity="0.55"
          />

          {/* Secondary Local Roads */}
          <g
            stroke={
              layerStyle === 'satellite'
                ? '#1e3a2f'
                : isDark
                ? '#1e293b'
                : '#FFFFFF'
            }
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            opacity="0.9"
          >
            <path d="M 40 0 L 95 700" />
            <path d="M 0 240 L 400 190" />
            <path d="M 0 380 L 400 330" />
            <path d="M 160 0 L 260 700" />
            <path d="M 310 0 L 290 700" />
            <path d="M 0 510 L 400 470" />
          </g>

          {/* Major Arterial Highways (شارع الجيش / طريق شبين الكوم - الباجور / طريق بنها) */}
          <g
            stroke={
              layerStyle === 'satellite'
                ? '#d97706'
                : isDark
                ? '#334155'
                : '#FDE68A'
            }
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M -10 440 Q 180 350, 410 270" />
            <path d="M 190 -10 Q 210 340, 145 710" />
          </g>
          <g
            stroke={
              layerStyle === 'satellite'
                ? '#fbbf24'
                : isDark
                ? '#475569'
                : '#F59E0B'
            }
            strokeWidth="1.5"
            strokeDasharray="6 6"
            fill="none"
          >
            <path d="M -10 440 Q 180 350, 410 270" />
            <path d="M 190 -10 Q 210 340, 145 710" />
          </g>

          {/* Neighborhood Arabic Labels on Map */}
          <g
            className="font-['Cairo',sans-serif]"
            fill={
              layerStyle === 'satellite'
                ? '#a7f3d0'
                : isDark
                ? '#94a3b8'
                : '#64748B'
            }
            fontSize="10"
            fontWeight="700"
            textAnchor="middle"
          >
            <text x="95" y="95">حي المحطة</text>
            <text x="305" y="135">شارع الجيش</text>
            <text x="115" y="295">كوبري الباجور</text>
            <text x="295" y="255">مجلس المدينة</text>
            <text x="85" y="485">طريق شبين الكوم</text>
            <text x="295" y="495">حي السلام</text>
            <text x="210" y="175" fill={layerStyle === 'satellite' || isDark ? '#38bdf8' : '#2563EB'} fontSize="9">
              ترعة الباجورية
            </text>
          </g>

          {/* Active Trip Route Polyline */}
          {showRoute && (
            <>
              {/* Route Shadow */}
              <path
                d="M 125 225 C 165 235, 195 270, 205 315 C 215 355, 255 365, 280 355"
                fill="none"
                stroke="#064E3B"
                strokeWidth="9"
                strokeLinecap="round"
                opacity="0.22"
              />
              {/* Main Animated Route Line */}
              <path
                d="M 125 225 C 165 235, 195 270, 205 315 C 215 355, 255 365, 280 355"
                fill="none"
                stroke="url(#routeStroke)"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* Animated Directional Dashes */}
              <path
                d="M 125 225 C 165 235, 195 270, 205 315 C 215 355, 255 365, 280 355"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeDasharray="4 8"
                strokeLinecap="round"
              />

              {/* Pickup Material 3 SVG Pin Marker (pulses on at_pickup) */}
              <g
                transform="translate(125, 225)"
                filter="url(#mobilePinShadow)"
                data-testid="mobile-map-pickup-pin"
              >
                {isPickupPulsing && (
                  <>
                    <circle cx="0" cy="0" r="24" fill="#10B981" opacity="0.28">
                      <animate attributeName="r" values="12;28;12" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.45;0.05;0.45" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="0" cy="0" r="16" fill="none" stroke="#34D399" strokeWidth="2.5">
                      <animate attributeName="r" values="9;21;9" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                <circle cx="0" cy="2" r="4" fill="#0f172a" opacity="0.3" />
                <path
                  d="M 0 0 C -8 -9 -13 -16 -13 -23 A 13 13 0 1 1 13 -23 C 13 -16 8 -9 0 0 Z"
                  fill="#047857"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle cx="0" cy="-23" r="5" fill="#FFFFFF" />
              </g>

              {/* Dropoff Material 3 SVG Pin Marker (pulses on in_transit) */}
              <g
                transform="translate(280, 355)"
                filter="url(#mobilePinShadow)"
                data-testid="mobile-map-dropoff-pin"
              >
                {isDropoffPulsing && (
                  <>
                    <circle cx="0" cy="0" r="24" fill="#F59E0B" opacity="0.3">
                      <animate attributeName="r" values="12;28;12" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.5;0.05;0.5" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle cx="0" cy="0" r="16" fill="none" stroke="#FBBF24" strokeWidth="2.5">
                      <animate attributeName="r" values="9;21;9" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
                <circle cx="0" cy="2" r="4" fill="#0f172a" opacity="0.3" />
                <path
                  d="M 0 0 C -8 -9 -13 -16 -13 -23 A 13 13 0 1 1 13 -23 C 13 -16 8 -9 0 0 Z"
                  fill="#D97706"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <circle cx="0" cy="-23" r="5" fill="#FFFFFF" />
              </g>
            </>
          )}

          {/* Nearby Available Captain Markers (Motorcycles & Cars) */}
          <g transform="translate(198, 300)">
            <circle cx="0" cy="0" r="16" fill="#0F172A" stroke="#10B981" strokeWidth="2.5" />
            <text x="0" y="4" textAnchor="middle" fontSize="12">🛵</text>
          </g>

          <g transform="translate(155, 165)">
            <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#047857" strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fontSize="10">🛵</text>
          </g>

          <g transform="translate(255, 265)">
            <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#D97706" strokeWidth="2" />
            <text x="0" y="4" textAnchor="middle" fontSize="10">🚗</text>
          </g>

          {mode === 'admin' && (
            <>
              <g transform="translate(90, 340)">
                <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#047857" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fontSize="10">🛵</text>
              </g>
              <g transform="translate(310, 420)">
                <circle cx="0" cy="0" r="13" fill="#FFFFFF" stroke="#047857" strokeWidth="2" />
                <text x="0" y="4" textAnchor="middle" fontSize="10">📦</text>
              </g>
            </>
          )}
        </svg>
      </div>

      {/* Floating Route Pill on Map Top with Copy Pickup & Copy Dropoff Buttons */}
      {showRoute && (
        <div
          className="absolute top-2.5 inset-x-2.5 z-10 pointer-events-auto"
          dir="rtl"
        >
          <div
            className={`backdrop-blur-md rounded-2xl px-2.5 py-2 shadow-md border flex items-center justify-between gap-1.5 text-[10px] ${
              isDark || layerStyle === 'satellite'
                ? 'bg-slate-900/90 border-slate-700 text-slate-100'
                : 'bg-white/95 border-slate-200/90 text-slate-800'
            }`}
          >
            {/* Pickup Address + Copy Button */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span
                className={`w-2 h-2 rounded-full bg-emerald-600 shrink-0 ${
                  isPickupPulsing ? 'animate-ping' : ''
                }`}
              />
              <span className="font-bold truncate">{pickupText}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyAddress('pickup', pickupText);
                }}
                title="نسخ عنوان الاستلام (Copy Pickup Address)"
                className={`p-1 rounded-lg border transition shrink-0 cursor-pointer hover:scale-105 active:scale-95 ${
                  activeCopied === 'pickup'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : isDark || layerStyle === 'satellite'
                    ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {activeCopied === 'pickup' ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>

            <span className="text-slate-400 font-bold shrink-0">←</span>

            {/* Dropoff Address + Copy Button */}
            <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
              <span
                className={`w-2 h-2 rounded-full bg-amber-500 shrink-0 ${
                  isDropoffPulsing ? 'animate-ping' : ''
                }`}
              />
              <span className="font-bold truncate">{dropoffText}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyAddress('dropoff', dropoffText);
                }}
                title="نسخ عنوان التوصيل (Copy Dropoff Address)"
                className={`p-1 rounded-lg border transition shrink-0 cursor-pointer hover:scale-105 active:scale-95 ${
                  activeCopied === 'dropoff'
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : isDark || layerStyle === 'satellite'
                    ? 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {activeCopied === 'dropoff' ? (
                  <Check className="w-2.5 h-2.5" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Corner Controls Bar (Top-Right & Top-Left under Route Pill): Travel Estimate Badge + Layer/Theme/Fullscreen Toggles */}
      <div
        className="absolute top-14 inset-x-2.5 z-10 flex items-center justify-between gap-1.5 pointer-events-none"
        dir="rtl"
      >
        {/* Estimated Travel Time & Distance Badge Overlay */}
        <div
          data-testid="mobile-map-travel-estimate-badge"
          className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900/90 text-white border border-slate-700/80 shadow-md backdrop-blur-md text-[10px] font-extrabold"
        >
          <Clock className="w-3 h-3 text-amber-400 shrink-0" />
          <span>~{durationMinutes} د</span>
          <span className="text-slate-400">•</span>
          <span className="text-emerald-300">{distanceKm} كم</span>
        </div>

        {/* Map Layer Style (Satellite/Terrain vs Route) + Dark Mode + Full-Screen Toggles */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleLayer();
            }}
            title="تبديل طبقة الخريطة (Route Overview / Satellite Terrain)"
            className={`px-2 py-1 rounded-xl border text-[10px] font-extrabold flex items-center gap-1 shadow-md backdrop-blur-md transition cursor-pointer hover:scale-105 active:scale-95 ${
              layerStyle === 'satellite'
                ? 'bg-emerald-700 text-white border-emerald-500'
                : 'bg-slate-900/90 text-slate-100 border-slate-700/80 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{layerStyle === 'satellite' ? 'تضاريس • Satellite' : 'مسار • Route'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleDark();
            }}
            title="تبديل الوضع الليلي/النهاري للخريطة"
            className="w-7 h-7 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow-md backdrop-blur-md flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95"
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-200" />
            )}
          </button>

          {onToggleFullScreen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFullScreen();
              }}
              title={isFullScreen ? 'تصغير الخريطة' : 'ملء الشاشة للخريطة'}
              className="w-7 h-7 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white border border-slate-700/80 shadow-md backdrop-blur-md flex items-center justify-center transition cursor-pointer hover:scale-105 active:scale-95"
            >
              {isFullScreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Dedicated Touch-Optimized '+' and '-' Zoom Control Buttons on Map Corner */}
      <div
        data-testid="mobile-map-zoom-controls"
        className="absolute left-2.5 top-24 z-10 flex flex-col gap-1.5 pointer-events-auto"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          disabled={zoomScale >= 2.6}
          aria-label="تكبير الخريطة (Zoom In +)"
          title="تكبير الخريطة (+)"
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 disabled:opacity-40 text-white border border-slate-700/80 shadow-lg flex items-center justify-center font-black text-sm transition cursor-pointer hover:scale-105 active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          disabled={zoomScale <= 1}
          aria-label="تصغير الخريطة (Zoom Out -)"
          title="تصغير الخريطة (-)"
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 disabled:opacity-40 text-white border border-slate-700/80 shadow-lg flex items-center justify-center font-black text-sm transition cursor-pointer hover:scale-105 active:scale-95"
        >
          <Minus className="w-4 h-4" />
        </button>

        {zoomScale > 1.02 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleResetZoom();
            }}
            title="إعادة ضبط الزووم (1x)"
            className="w-8 h-7 rounded-xl bg-amber-500/95 hover:bg-amber-400 text-slate-950 border border-amber-300 shadow-lg flex items-center justify-center text-[10px] font-black transition cursor-pointer hover:scale-105 active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
