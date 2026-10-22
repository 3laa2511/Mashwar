import React from 'react';
import { MapPin, Navigation, Bike, Car, Compass, Layers, Shield } from 'lucide-react';

interface EgyptianMapCanvasProps {
  mode: 'customer' | 'captain';
  pickupText?: string;
  dropoffText?: string;
  showRoute?: boolean;
  isCaptainOnline?: boolean;
  hasIncomingRequest?: boolean;
  activeDeliveryStep?: number;
  onMapClick?: () => void;
}

export const EgyptianMapCanvas: React.FC<EgyptianMapCanvasProps> = ({
  mode,
  pickupText = 'ميدان المحطة - وسط الباجور',
  dropoffText = 'مستشفى الباجور العام',
  showRoute = true,
  isCaptainOnline = true,
  hasIncomingRequest = false,
  activeDeliveryStep = 1,
  onMapClick,
}) => {
  return (
    <div
      onClick={onMapClick}
      className="relative w-full h-full bg-[#E5E9EC] overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage: `
          radial-gradient(#CBD5E1 1.5px, transparent 1.5px),
          linear-gradient(to right, rgba(226, 232, 240, 0.6) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(226, 232, 240, 0.6) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px, 48px 48px, 48px 48px',
      }}
    >
      {/* SVG Vector Map Layer representing El Bagour streets, railways, and Nile Delta canal */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Subtle canal gradient */}
          <linearGradient id="canalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.7" />
          </linearGradient>

          {/* Route path gradient */}
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Heat map radial gradients for captain mode */}
          <radialGradient id="demandGlow1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="demandGlow2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Agricultural green belts surrounding the town */}
        <path d="M 0 0 L 110 0 L 80 140 L 0 160 Z" fill="#DCFCE7" opacity="0.6" />
        <path d="M 310 0 L 400 0 L 400 220 L 330 180 Z" fill="#DCFCE7" opacity="0.5" />
        <path d="M 0 440 L 90 410 L 120 600 L 0 600 Z" fill="#DCFCE7" opacity="0.6" />
        <path d="M 300 480 L 400 450 L 400 600 L 320 600 Z" fill="#DCFCE7" opacity="0.5" />

        {/* Waterway (ترعة الباجور الرئيسية) */}
        <path
          d="M 60 0 Q 75 180 110 300 T 145 600"
          fill="none"
          stroke="url(#canalGradient)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Railway line (خط سكة حديد منوف - بنها) */}
        <path
          d="M 330 0 L 290 260 L 250 600"
          fill="none"
          stroke="#94A3B8"
          strokeWidth="3"
          strokeDasharray="6,5"
        />

        {/* Secondary residential grid lines */}
        <g stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round">
          <line x1="20" y1="120" x2="380" y2="120" />
          <line x1="30" y1="210" x2="370" y2="210" />
          <line x1="20" y1="360" x2="380" y2="360" />
          <line x1="40" y1="460" x2="360" y2="460" />
          <line x1="160" y1="50" x2="160" y2="550" />
          <line x1="240" y1="70" x2="240" y2="530" />
          <line x1="90" y1="80" x2="310" y2="300" strokeWidth="2" strokeDasharray="4,4" />
        </g>

        {/* Main Thoroughfares (شارع الجيش، شارع الجمهورية، طريق بنها الزراعي) */}
        {/* Shara'a El-Gaysh */}
        <path
          d="M 20 280 L 150 280 L 280 290 L 380 270"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 20 280 L 150 280 L 280 290 L 380 270"
          fill="none"
          stroke="#F8FAFC"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Shara'a El-Gomhouriya */}
        <path
          d="M 200 40 L 200 230 L 210 390 L 205 570"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M 200 40 L 200 230 L 210 390 L 205 570"
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="13"
          strokeLinecap="round"
        />

        {/* Central Square Ring (ميدان المحطة) */}
        <circle cx="205" cy="285" r="32" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="4" />
        <circle cx="205" cy="285" r="16" fill="#047857" opacity="0.12" />

        {/* High Demand Heatspots (Captain Mode Only) */}
        {mode === 'captain' && isCaptainOnline && (
          <g>
            <circle cx="205" cy="285" r="70" fill="url(#demandGlow1)" />
            <circle cx="210" cy="420" r="45" fill="url(#demandGlow2)" />
          </g>
        )}

        {/* Active Route Polyline (Customer Booking / Captain Active Trip) */}
        {showRoute && (
          <g>
            {/* Route Shadow / Glow */}
            <path
              d="M 205 285 L 205 380 L 215 440 L 260 455"
              fill="none"
              stroke="#047857"
              strokeWidth="10"
              strokeOpacity="0.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Route Line */}
            <path
              d="M 205 285 L 205 380 L 215 440 L 260 455"
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="8 3"
              className="animate-pulse"
            />
          </g>
        )}
      </svg>

      {/* Street and Landmark Text Labels (Realistic Egyptian Cartography) */}
      <div className="absolute top-[38px] left-[155px] -translate-x-1/2 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs text-[10px] font-bold text-slate-700 pointer-events-none">
        طريق بنها الزراعي
      </div>
      <div className="absolute top-[252px] left-[55px] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs text-[10px] font-bold text-slate-700 pointer-events-none">
        شارع الجيش
      </div>
      <div className="absolute top-[320px] left-[125px] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs text-[10px] font-bold text-slate-600 pointer-events-none">
        ميدان المحطة
      </div>
      <div className="absolute top-[465px] left-[245px] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded shadow-xs text-[10px] font-bold text-slate-700 pointer-events-none">
        شارع الجمهورية
      </div>

      {/* High-Demand Surge Tag (Captain Mode) */}
      {mode === 'captain' && isCaptainOnline && (
        <div className="absolute top-[215px] left-[165px] bg-rose-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shadow-md animate-bounce pointer-events-none flex items-center gap-1">
          <span>+٢٥٪ طلب عالي</span>
        </div>
      )}

      {/* Customer Mode: Nearby Captain Pins Moving on Map */}
      {mode === 'customer' && (
        <>
          {/* Captain 1 (Scooter near Station Square) */}
          <div className="absolute top-[240px] left-[250px] -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700">
            <div className="relative group">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-emerald-500/30">
                <Bike className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap">
                ٣ دقيقة
              </div>
            </div>
          </div>

          {/* Captain 2 (Scooter on Shara'a El-Gaysh) */}
          <div className="absolute top-[295px] left-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-7 h-7 rounded-full bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg border-2 border-white">
              <Bike className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          {/* Captain 3 (Car for light cargo on Gomhouriya street) */}
          <div className="absolute top-[160px] left-[200px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Car className="w-4 h-4" />
              </div>
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-emerald-950 text-white text-[9px] font-bold px-1.5 py-0.2 rounded whitespace-nowrap">
                ٦ دقيقة
              </div>
            </div>
          </div>
        </>
      )}

      {/* Pickup Location Marker (Green Pin with Pulsing Ripple) */}
      <div className="absolute top-[285px] left-[205px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-12 h-12 rounded-full bg-emerald-600/20 animate-ping" />
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-3 border-white z-10">
            <div className="w-3 h-3 rounded-full bg-white" />
          </div>
          {/* Pickup floating pill */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-emerald-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap flex items-center gap-1 z-20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>نقطة الانطلاق (أنت هنا)</span>
          </div>
        </div>
      </div>

      {/* Destination Location Marker (Dropoff Pin) */}
      {showRoute && (
        <div className="absolute top-[455px] left-[260px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xl border-3 border-white z-10">
              <MapPin className="w-4 h-4" />
            </div>
            {/* Dropoff floating pill */}
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap z-20">
              <span>الوجهة ({dropoffText.split('-')[0].trim()})</span>
            </div>
          </div>
        </div>
      )}

      {/* Captain Self Location & Orientation Pin (Captain Mode) */}
      {mode === 'captain' && (
        <div className="absolute top-[285px] left-[205px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative flex items-center justify-center">
            {isCaptainOnline ? (
              <>
                <div className="absolute w-16 h-16 rounded-full bg-emerald-500/25 animate-ping" />
                <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-2xl border-3 border-white z-10">
                  <Navigation className="w-5 h-5 text-white transform rotate-45" />
                </div>
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-emerald-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow whitespace-nowrap z-20">
                  موقعك الحالي (متصل)
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-600 text-white flex items-center justify-center shadow-xl border-3 border-white z-10">
                  <Navigation className="w-5 h-5 text-slate-300" />
                </div>
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-slate-800 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow whitespace-nowrap z-20">
                  غير متصل
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Floating Map Utility Buttons (Recenter / GPS & Layer Toggle) */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="w-9 h-9 rounded-full bg-white/95 text-slate-700 shadow-md flex items-center justify-center hover:bg-white active:scale-95 transition-transform"
          title="موقعي الحالي"
        >
          <Compass className="w-4 h-4 text-emerald-700" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="w-9 h-9 rounded-full bg-white/95 text-slate-700 shadow-md flex items-center justify-center hover:bg-white active:scale-95 transition-transform"
          title="طبقات الخريطة"
        >
          <Layers className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* El Bagour Local Hub Tag */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-md text-xs font-bold text-slate-800 flex items-center gap-1.5 z-10 border border-slate-100">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>الباجور • المنوفية</span>
      </div>
    </div>
  );
};
