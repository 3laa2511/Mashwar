import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  User,
  Bike,
  Store,
  ShieldCheck,
  CheckCircle2,
  LogIn,
  ArrowRight,
  Phone,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { DEMO_PERSONAS, DemoUser, useMarketplace } from '../../store/marketplaceStore';

interface DemoAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoAuthModal: React.FC<DemoAuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, switchDemoUser } = useMarketplace();
  const [authMode, setAuthMode] = useState<'quick_switch' | 'simulated_login'>('quick_switch');
  const [phoneInput, setPhoneInput] = useState('01012345678');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [simulatedRole, setSimulatedRole] = useState<'customer' | 'captain' | 'merchant'>('customer');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSimulatedSubmitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneInput.length >= 10) {
      setStep('otp');
      setOtpInput('1234'); // Pre-fill mock OTP for smooth testing
    }
  };

  const handleSimulatedVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setTimeout(() => {
      // Find matching persona or pick default
      let targetPersona = DEMO_PERSONAS.find((p) => p.phone === phoneInput);
      if (!targetPersona) {
        targetPersona = DEMO_PERSONAS.find((p) => p.role === simulatedRole) || DEMO_PERSONAS[0];
      }
      switchDemoUser(targetPersona);
      setIsVerifying(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 font-['Cairo',sans-serif]" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">التبديل بين حسابات المحاكاة المحلية (Non-Production Sandbox)</h2>
              <p className="text-[11px] text-slate-500">محاكاة واجهات العميل والكابتن والتاجر فقط — معزولة عن واجهات الإدارة والإنتاج</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security & Simulation Transparency Notice */}
        <div className="bg-amber-50/90 border-b border-amber-200/70 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-extrabold text-amber-950 block mb-0.5">
              بيئة محاكاة محلية معزولة (Non-Production Sandbox Mode):
            </strong>
            تقتصر هذه النافذة على محاكاة حسابات العميل والكابتن والتاجر في الذاكرة المحلية للمتصفح فقط. تم إزالة حسابات المالك وإدارة العمليات من مبدل الحسابات، وتخضع كافة مسارات الإدارة <code className="font-mono text-[11px]">/api/v1/admin/*</code> للتحقق الصارم من رمز مصادقة الخادم (Fail-Closed 401/403).
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 flex items-center gap-2">
          <button
            onClick={() => setAuthMode('quick_switch')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              authMode === 'quick_switch'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            التبديل السريع للحسابات (١-كليك)
          </button>
          <button
            onClick={() => setAuthMode('simulated_login')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              authMode === 'simulated_login'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            محاكاة تسجيل الدخول برقم الهاتف
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          {authMode === 'quick_switch' ? (
            <div className="flex flex-col gap-2.5">
              <div className="text-xs font-bold text-slate-500 mb-0.5">
                اختر الحساب التجريبي لمعاينة واجهته وبياناته الخاصة:
              </div>

              {DEMO_PERSONAS.map((persona) => {
                const isActive = currentUser.id === persona.id;
                return (
                  <button
                    key={persona.id}
                    onClick={() => switchDemoUser(persona)}
                    className={`p-3.5 rounded-2xl border text-right transition-all flex items-center justify-between group ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xl shadow-2xs">
                        {persona.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-800">
                            {persona.name}
                          </span>
                          {isActive && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-700 text-white">
                              الحساب الحالي
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {persona.roleBadgeAr} • {persona.phone}
                        </div>
                        {persona.vehicleInfo && (
                          <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                            {persona.vehicleInfo}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center text-xs font-bold text-slate-400 group-hover:text-emerald-700">
                      <span>دخول</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Simulated Phone / OTP Flow */
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3.5">
              {step === 'phone' ? (
                <form onSubmit={handleSimulatedSubmitPhone} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      أدخل رقم الموبايل المصري
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="01012345678"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-right"
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      سيتم إرسال رمز تأكيد تجريبي للمتابعة
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      اختر الدور المطلوب اختباره
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSimulatedRole('customer')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          simulatedRole === 'customer'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        عميل
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedRole('captain')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          simulatedRole === 'captain'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        كابتن
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimulatedRole('merchant')}
                        className={`p-2 rounded-xl border text-xs font-bold text-center transition-all ${
                          simulatedRole === 'merchant'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        تاجر
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all mt-1"
                  >
                    <span>إرسال كود التحقق التجريبي</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSimulatedVerifyOtp} className="flex flex-col gap-3">
                  <div className="text-center">
                    <span className="text-xs font-extrabold text-slate-800">
                      تم إرسال كود التأكيد للرقم {phoneInput}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      (تم تعبئة الكود التجريبي 1234 تلقائياً لتسهيل التجربة)
                    </p>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      maxLength={4}
                      className="w-full py-2 text-center font-mono text-xl tracking-widest rounded-xl border border-slate-300 bg-white text-slate-900 font-black focus:outline-hidden focus:border-emerald-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('phone')}
                      className="p-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-100"
                    >
                      تغيير الرقم
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <span>جاري التحقق...</span>
                      ) : (
                        <span>تأكيد والدخول للواجهة</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>الباجور • المنوفية • نموذج تشغيل تجريبي</span>
          <span className="font-semibold text-emerald-800">عمولة ٠٪ للكباتن والتجار</span>
        </div>
      </div>
    </div>
  );
};
