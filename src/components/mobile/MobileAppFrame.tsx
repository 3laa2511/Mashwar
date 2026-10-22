import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Maximize2,
  Bike,
  User,
  Store,
  Sparkles,
  Info,
  CheckCircle2,
  Layers,
  MapPin,
  ShieldCheck,
  KeyRound,
  ShieldAlert
} from 'lucide-react';
import { CustomerMobileExperience } from './CustomerMobileExperience';
import { CaptainMobileExperience } from './CaptainMobileExperience';
import { MerchantMobileExperience } from './MerchantMobileExperience';
import { DemoAuthModal } from '../common/DemoAuthModal';
import { useMarketplace, DEMO_PERSONAS, DemoUser } from '../../store/marketplaceStore';

interface MobileAppFrameProps {
  onOpenOperationsDashboard?: () => void;
}

export const MobileAppFrame: React.FC<MobileAppFrameProps> = ({
  onOpenOperationsDashboard,
}) => {
  const { currentUser, switchDemoUser, isAuthModalOpen, setIsAuthModalOpen } = useMarketplace();
  const [deviceModel, setDeviceModel] = useState<'iphone' | 'android' | 'fluid'>('iphone');

  // Handle persona selection
  const handleSelectRole = (role: 'customer' | 'captain' | 'merchant') => {
    const target = DEMO_PERSONAS.find((p) => p.role === role);
    if (target) switchDemoUser(target);
  };

  return (
    <div className="flex-1 w-full bg-slate-950 flex flex-col items-center justify-start p-2 sm:p-4 overflow-y-auto font-['Cairo',sans-serif]" dir="rtl">
      {/* Simulation Notice Banner */}
      <div className="w-full max-w-4xl bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 mb-3 text-xs leading-relaxed text-amber-200 flex items-start gap-3 shadow-md">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-amber-300 font-extrabold">
              أداة محاكاة تطويرية للمنظومة متعددة الأدوار (Multi-Role Demo Simulation):
            </strong>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors flex items-center gap-1 shadow-sm shrink-0"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>إدارة الحسابات التجريبية والمصادقة</span>
            </button>
          </div>
          <p className="mt-1 text-[11px] text-amber-200/90">
            توضح هذه الواجهة المحاكاة التفاعلية لسوق مشوار بالباجور: الحسابات أدناه تحاكي تسجيل الدخول وليست صلاحيات أمنية إنتاجية؛ تم عزل بيانات المتاجر بحيث لا يرى تاجر منتجات أو مبيعات متجر آخر، ولا يرى الكابتن أرباح كابتن آخر.
          </p>
        </div>
      </div>

      {/* Top Experience & Persona Controller Bar */}
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-3 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Persona Selectors (Customer vs Captain vs Merchant vs Operations) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">الدور النشط:</span>
          <div className="bg-slate-950 p-1 rounded-xl flex items-center border border-slate-800 gap-1">
            <button
              onClick={() => handleSelectRole('customer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentUser.role === 'customer'
                  ? 'bg-emerald-700 text-white shadow-md font-black ring-1 ring-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>العميل</span>
            </button>

            <button
              onClick={() => handleSelectRole('captain')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentUser.role === 'captain'
                  ? 'bg-emerald-700 text-white shadow-md font-black ring-1 ring-emerald-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              <span>الكابتن</span>
            </button>

            <button
              onClick={() => handleSelectRole('merchant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                currentUser.role === 'merchant'
                  ? 'bg-amber-600 text-white shadow-md font-black ring-1 ring-amber-500/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>التاجر</span>
            </button>

            {onOpenOperationsDashboard && (
              <button
                onClick={onOpenOperationsDashboard}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all border-r border-slate-800 mr-1"
                title="لوحة تحكم وعمليات المالك"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">إدارة العمليات</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewport & Device Frame Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 hidden sm:inline">إطار العرض:</span>
          <div className="bg-slate-950 p-1 rounded-xl flex items-center border border-slate-800 gap-1">
            <button
              onClick={() => setDeviceModel('iphone')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                deviceModel === 'iphone' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="iPhone 16 Pro (390px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>آيفون</span>
            </button>

            <button
              onClick={() => setDeviceModel('android')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                deviceModel === 'android' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Samsung Galaxy S24"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>أندرويد</span>
            </button>

            <button
              onClick={() => setDeviceModel('fluid')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                deviceModel === 'fluid' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="ملء الإطار التفاعلي"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>تفاعلي كامل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Target Focus Review Note */}
      <div className="w-full max-w-4xl mb-3 flex items-center justify-between text-xs px-2 text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>الحساب المسجل حالياً:</span>
          <strong className="text-white">
            {currentUser.name} ({currentUser.roleBadgeAr})
          </strong>
        </div>
        <div className="text-[11px] text-slate-500 hidden sm:block">
          الباجور • المنوفية • منظومة سوق وتوصيل متكاملة
        </div>
      </div>

      {/* Interactive Mobile Device Viewport */}
      <div className="flex justify-center w-full my-auto pb-8">
        {deviceModel === 'fluid' ? (
          /* Fluid / Full Width Responsive Screen */
          <div className="w-full max-w-md h-[780px] bg-white rounded-3xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col relative ring-8 ring-slate-900/50">
            {/* Minimal Mobile Status Bar */}
            <div className="bg-slate-900 text-white text-[10px] px-5 py-1.5 flex justify-between items-center shrink-0 font-sans" dir="ltr">
              <span className="font-semibold">10:42 AM</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>📶</span>
                <span>100% 🔋</span>
              </div>
            </div>

            {/* Screen Component */}
            <div className="flex-1 w-full overflow-hidden flex flex-col">
              {currentUser.role === 'customer' && (
                <CustomerMobileExperience
                  onSwitchToCaptain={() => handleSelectRole('captain')}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                />
              )}
              {currentUser.role === 'captain' && (
                <CaptainMobileExperience
                  onSwitchToCustomer={() => handleSelectRole('customer')}
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                />
              )}
              {currentUser.role === 'merchant' && (
                <MerchantMobileExperience
                  onOpenAuthModal={() => setIsAuthModalOpen(true)}
                />
              )}
              {currentUser.role === 'operations' && (
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-900 text-white gap-3">
                  <ShieldCheck className="w-12 h-12 text-amber-400" />
                  <h3 className="font-extrabold text-base">حساب إدارة العمليات</h3>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    تم اختيار حساب مدير العمليات ({currentUser.name}). لعرض غرفة تحكم العمليات الشاملة والمصممة للشاشات الكبيرة اضغط على الزر أدناه:
                  </p>
                  {onOpenOperationsDashboard && (
                    <button
                      onClick={onOpenOperationsDashboard}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs shadow-lg mt-2"
                    >
                      فتح لوحة تحكم وعمليات المالك
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Phone Shell (iPhone / Android) */
          <div
            className={`relative transition-all duration-300 shadow-2xl ${
              deviceModel === 'iphone'
                ? 'w-[390px] h-[780px] rounded-[50px] p-3.5 bg-slate-900 border-4 border-slate-700 ring-1 ring-slate-600/30'
                : 'w-[400px] h-[790px] rounded-[40px] p-3 bg-slate-900 border-4 border-slate-600 ring-1 ring-slate-500/30'
            }`}
          >
            {/* Outer Hardware Buttons Simulation */}
            <div className="absolute -left-[7px] top-28 w-[3px] h-9 bg-slate-600 rounded-l-md" />
            <div className="absolute -left-[7px] top-42 w-[3px] h-12 bg-slate-600 rounded-l-md" />
            <div className="absolute -left-[7px] top-58 w-[3px] h-12 bg-slate-600 rounded-l-md" />
            <div className="absolute -right-[7px] top-36 w-[3px] h-16 bg-slate-600 rounded-r-md" />

            {/* Inner Phone Screen */}
            <div className="w-full h-full bg-[#FAFAF9] rounded-[38px] overflow-hidden flex flex-col relative shadow-inner">
              {/* Dynamic Island / Camera Notch (iPhone Style) */}
              {deviceModel === 'iphone' ? (
                <div className="relative bg-white pt-2 pb-1 px-6 flex items-center justify-between z-40 shrink-0 font-sans" dir="ltr">
                  <span className="text-[11px] font-bold text-slate-900">10:42</span>
                  <div className="w-24 h-5 bg-black rounded-full flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-900 ring-1 ring-slate-800" />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-800 font-bold">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-slate-700 rounded-xs p-0.5 flex items-center">
                      <div className="h-full w-full bg-emerald-600 rounded-2xs" />
                    </div>
                  </div>
                </div>
              ) : (
                /* Android Hole-Punch Style */
                <div className="relative bg-white pt-2 pb-1 px-5 flex items-center justify-between z-40 shrink-0 font-sans" dir="ltr">
                  <span className="text-[11px] font-bold text-slate-900">10:42</span>
                  <div className="w-3.5 h-3.5 bg-black rounded-full mx-auto" />
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-800 font-bold">
                    <span>5G</span>
                    <span>🔋 98%</span>
                  </div>
                </div>
              )}

              {/* Mobile Screen Experience */}
              <div className="flex-1 w-full overflow-hidden flex flex-col">
                {currentUser.role === 'customer' && (
                  <CustomerMobileExperience
                    onSwitchToCaptain={() => handleSelectRole('captain')}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                )}
                {currentUser.role === 'captain' && (
                  <CaptainMobileExperience
                    onSwitchToCustomer={() => handleSelectRole('customer')}
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                )}
                {currentUser.role === 'merchant' && (
                  <MerchantMobileExperience
                    onOpenAuthModal={() => setIsAuthModalOpen(true)}
                  />
                )}
                {currentUser.role === 'operations' && (
                  <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-slate-900 text-white gap-3">
                    <ShieldCheck className="w-12 h-12 text-amber-400" />
                    <h3 className="font-extrabold text-base">حساب إدارة العمليات</h3>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                      تم اختيار حساب مدير العمليات ({currentUser.name}). لعرض غرفة تحكم العمليات الشاملة والمصممة للشاشات الكبيرة اضغط على الزر أدناه:
                    </p>
                    {onOpenOperationsDashboard && (
                      <button
                        onClick={onOpenOperationsDashboard}
                        className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-extrabold text-xs shadow-lg mt-2"
                      >
                        فتح لوحة تحكم وعمليات المالك
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Home Indicator Bar (iOS / Modern Android) */}
              <div className="bg-white pb-1 pt-1 flex justify-center shrink-0">
                <div className="w-32 h-1 bg-slate-300 rounded-full" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Demo Auth Switcher Modal */}
      <DemoAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};
