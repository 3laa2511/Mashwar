/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Smartphone, ShieldCheck, AlertTriangle, Navigation } from 'lucide-react';
import { MobileAppFrame } from './components/mobile/MobileAppFrame';
import { OwnerAdminDashboard } from './components/OwnerAdminDashboard';

export function App() {
  const [viewMode, setViewMode] = useState<'mobile' | 'operations'>('mobile');
  const [isGmpQuotaExceeded, setIsGmpQuotaExceeded] = useState<boolean>(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setIsGmpQuotaExceeded(true);
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]"
    >
      {/* Google Maps Platform Quota Exceeded Fallback Banner */}
      {isGmpQuotaExceeded && (
        <div
          data-testid="gmp-quota-exceeded-banner"
          role="alert"
          className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-extrabold flex items-center justify-center gap-2 shrink-0"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            تجاوزت حصة خرائط جوجل — تم تفعيل وضع الخرائط المحلية لضمان استمرار التتبع والخدمة.
          </span>
        </div>
      )}

      {/* Compact Top App Mode Switcher (Mobile App Frame vs Owner Operations) */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white leading-tight">
              مشوار — Mashwar Mobile App
            </h1>
            <p className="text-[11px] text-slate-400">
              تطبيق الموبايل للتوصيل والمشاوير • الباجور، المنوفية
            </p>
          </div>
        </div>

        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'mobile'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>تطبيق الموبايل</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('operations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'operations'
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>إدارة العمليات والمالك</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'mobile' ? (
          <MobileAppFrame onOpenOperationsDashboard={() => setViewMode('operations')} />
        ) : (
          <OwnerAdminDashboard />
        )}
      </div>
    </div>
  );
}

export default App;
