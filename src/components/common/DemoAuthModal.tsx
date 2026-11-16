import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Phone,
  KeyRound,
  LogOut,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { DEMO_PERSONAS, useMarketplace } from '../../store/marketplaceStore';
import {
  auth,
  isValidEgyptianPhone,
  normalizeEgyptianPhoneE164,
  sendFirebasePhoneOtp,
  ensureFirebasePhoneUserProfile,
  firebaseSignOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type RecaptchaVerifier,
  type User as FirebaseUser,
} from '../../lib/firebase';

interface DemoAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoAuthModal: React.FC<DemoAuthModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, switchDemoUser } = useMarketplace();
  const [authMode, setAuthMode] = useState<'firebase_phone' | 'quick_switch'>('firebase_phone');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(auth.currentUser);

  // Firebase Phone OTP state
  const [phoneInput, setPhoneInput] = useState('01012345678');
  const [displayNameInput, setDisplayNameInput] = useState('أحمد سعيد المنوفي');
  const [otpInput, setOtpInput] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = window.setInterval(() => {
      setCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [cooldownSec]);

  useEffect(() => {
    if (!isOpen && verifierRef.current) {
      try {
        verifierRef.current.clear();
      } catch {
        // Ignore cleanup errors
      }
      verifierRef.current = null;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const mapFirebaseAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
      return 'مزود الدخول برقم الهاتف غير مفعّل بعد في Firebase Console. يرجى تفعيل Phone من Authentication -> Sign-in method ثم إضافة نطاق المعاينة في Authorized domains.';
    }
    if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
      return 'نطاق المعاينة الحالي غير مضاف في Authorized domains داخل Firebase Console -> Authentication -> Settings.';
    }
    if (code === 'auth/invalid-phone-number') {
      return 'رقم الهاتف غير صالح. يرجى إدخال رقم مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.';
    }
    if (code === 'auth/invalid-verification-code') {
      return 'رمز التحقق (OTP) غير صحيح. يرجى مراجعة الرسالة والمحاولة مجدداً.';
    }
    if (code === 'auth/code-expired') {
      return 'انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.';
    }
    if (code === 'auth/too-many-requests') {
      return 'تم تجاوز الحد المسموح لطلبات التحقق مؤقتاً. يرجى الانتظار دقيقة قبل المحاولة مجدداً.';
    }
    return `تعذر إتمام المصادقة: ${msg}`;
  };

  const handleSendFirebaseOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!isValidEgyptianPhone(phoneInput)) {
      setAuthError('يرجى إدخال رقم موبايل مصري صحيح مكون من ١١ رقماً (مثال: 01012345678).');
      return;
    }

    setIsSendingOtp(true);
    try {
      const { confirmationResult: conf, verifier, e164 } = await sendFirebasePhoneOtp(
        phoneInput,
        'mashwar-recaptcha-container',
        verifierRef.current
      );
      verifierRef.current = verifier;
      setConfirmationResult(conf);
      setStep('otp');
      setCooldownSec(60);
      setAuthSuccess(`تم إرسال رمز التحقق عبر SMS إلى ${e164}`);
    } catch (err) {
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch {
          // ignore
        }
        verifierRef.current = null;
      }
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyFirebaseOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) return;
    const code = otpInput.trim();
    if (code.length < 6) {
      setAuthError('يرجى إدخال رمز التحقق المكون من ٦ أرقام.');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError(null);
    try {
      const credential = await confirmationResult.confirm(code);
      await ensureFirebasePhoneUserProfile(credential.user, displayNameInput.trim());

      const verifiedPhone = credential.user.phoneNumber || normalizeEgyptianPhoneE164(phoneInput);
      switchDemoUser({
        id: credential.user.uid,
        name: displayNameInput.trim() || credential.user.displayName || 'عميل مشوار الباجور',
        phone: verifiedPhone,
        role: 'customer',
        roleBadgeAr: 'عميل موثق (OTP)',
        avatar: '📱',
      });
      setAuthSuccess('تم التحقق من رقم الهاتف وتوثيق الحساب بنجاح!');
      onClose();
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleSignOutFirebase = async () => {
    await firebaseSignOut(auth);
    setStep('phone');
    setOtpInput('');
    setConfirmationResult(null);
    setAuthSuccess(null);
    setAuthError(null);
    switchDemoUser(DEMO_PERSONAS[0]);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 font-['Cairo',sans-serif]"
      dir="rtl"
    >
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">تسجيل الدخول والتوثيق — مشوار</h2>
              <p className="text-[11px] text-slate-500">
                توثيق برقم الهاتف المصري (Firebase Phone OTP) أو تبديل أدوار التجربة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="px-5 pt-3 flex items-center gap-2">
          <button
            onClick={() => setAuthMode('firebase_phone')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'firebase_phone'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>دخول برقم الهاتف (OTP)</span>
          </button>
          <button
            onClick={() => setAuthMode('quick_switch')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              authMode === 'quick_switch'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            محاكاة الأدوار (كابتن / تاجر)
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          {authMode === 'firebase_phone' ? (
            <div className="flex flex-col gap-3">
              {firebaseUser ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-emerald-950">حسابك موثق بنجاح عبر Firebase</div>
                      <div className="text-xs text-emerald-800 font-mono" dir="ltr">
                        {firebaseUser.phoneNumber || firebaseUser.email || firebaseUser.uid}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-emerald-900 bg-white/80 rounded-xl p-2.5 border border-emerald-200/80">
                    يتم حفظ طلباتك ومشاويرك تلقائياً على قاعدة بيانات Cloud Firestore المرتبطة بحسابك الموثق.
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs"
                    >
                      متابعة في التطبيق
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOutFirebase}
                      className="px-3 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>خروج</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3.5">
                  <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200/70">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      طريقة الدخول الأساسية في الباجور: أدخل رقم هاتفك المصري لاستلام رمز التحقق SMS عبر Firebase Authentication.
                    </span>
                  </div>

                  {authError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold leading-relaxed flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div>{authError}</div>
                        <button
                          type="button"
                          onClick={() => setAuthMode('quick_switch')}
                          className="mt-1.5 text-emerald-800 underline font-extrabold"
                        >
                          التبديل مؤقتاً لمحاكاة الأدوار المحلية ←
                        </button>
                      </div>
                    </div>
                  )}

                  {authSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{authSuccess}</span>
                    </div>
                  )}

                  {step === 'phone' ? (
                    <form onSubmit={handleSendFirebaseOtp} className="flex flex-col gap-4 pt-1">
                      {/* Material 3 Outlined TextField: Display Name */}
                      <div className="relative">
                        <label
                          htmlFor="m3-name-input"
                          className="absolute -top-2 right-3 bg-slate-50 px-1.5 text-[11px] font-bold text-emerald-800 z-10 rounded"
                        >
                          الاسم الكامل (اختياري)
                        </label>
                        <input
                          id="m3-name-input"
                          type="text"
                          value={displayNameInput}
                          onChange={(e) => setDisplayNameInput(e.target.value)}
                          placeholder="أحمد المنوفي"
                          className="w-full px-3.5 py-3 rounded-2xl border-2 border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-700 transition-colors"
                        />
                      </div>

                      {/* Material 3 Outlined TextField: Localized Egypt +20 Phone Input */}
                      <div className="relative">
                        <label
                          htmlFor="m3-egypt-phone"
                          className="absolute -top-2 right-3 bg-slate-50 px-1.5 text-[11px] font-bold text-emerald-800 z-10 rounded"
                        >
                          رقم الهاتف المحمول (مصر +20)
                        </label>
                        <div
                          className="flex items-center rounded-2xl border-2 border-slate-300 bg-white focus-within:border-emerald-700 transition-colors overflow-hidden"
                          dir="ltr"
                        >
                          <div className="flex items-center gap-1.5 px-3 py-3 bg-emerald-50/90 border-r border-slate-200 text-xs font-black text-emerald-950 shrink-0 select-none">
                            <span aria-hidden="true">🇪🇬</span>
                            <span className="font-mono">+20</span>
                          </div>
                          <input
                            id="m3-egypt-phone"
                            type="tel"
                            inputMode="tel"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="1012345678"
                            className="w-full px-3 py-3 font-mono text-sm font-bold text-slate-900 bg-transparent focus:outline-hidden"
                          />
                          <Phone className="w-4 h-4 text-slate-400 mr-3 shrink-0 pointer-events-none" />
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1.5 px-1 block">
                          الصيغة الدولية المعتمدة: <strong className="font-mono text-emerald-800" dir="ltr">{normalizeEgyptianPhoneE164(phoneInput)}</strong> (فودافون • أورنج • اتصالات • WE)
                        </span>
                      </div>

                      <div id="mashwar-recaptcha-container" />

                      {/* Material 3 FilledButton */}
                      <button
                        type="submit"
                        disabled={isSendingOtp}
                        className="w-full py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        {isSendingOtp ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جاري إرسال رمز التحقق...</span>
                          </>
                        ) : (
                          <>
                            <span>إرسال رمز التحقق SMS (OTP)</span>
                            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyFirebaseOtp} className="flex flex-col gap-3.5">
                      <div className="text-center">
                        <span className="text-xs font-extrabold text-slate-800">
                          أدخل رمز التحقق المكون من ٦ أرقام
                        </span>
                        <p className="text-[11px] text-emerald-800 font-mono font-bold mt-0.5" dir="ltr">
                          {normalizeEgyptianPhoneE164(phoneInput)}
                        </p>
                      </div>

                      {/* Material 3 Outlined Segmented 6-Digit OTP Input */}
                      <div className="grid grid-cols-6 gap-1.5" dir="ltr">
                        {[0, 1, 2, 3, 4, 5].map((idx) => {
                          const digit = otpInput[idx] || '';
                          return (
                            <input
                              key={idx}
                              id={`m3-otp-cell-${idx}`}
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={digit}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/\D/g, '');
                                if (cleaned.length > 1) {
                                  const pasted = cleaned.slice(0, 6);
                                  setOtpInput(pasted);
                                  const targetIdx = Math.min(5, pasted.length - 1);
                                  document.getElementById(`m3-otp-cell-${targetIdx}`)?.focus();
                                  return;
                                }
                                const chars = otpInput.padEnd(6, ' ').split('');
                                chars[idx] = cleaned || ' ';
                                const nextOtp = chars.join('').replace(/\s+$/g, '').replace(/\s/g, '');
                                setOtpInput(nextOtp);
                                if (cleaned && idx < 5) {
                                  document.getElementById(`m3-otp-cell-${idx + 1}`)?.focus();
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !digit && idx > 0) {
                                  document.getElementById(`m3-otp-cell-${idx - 1}`)?.focus();
                                }
                              }}
                              className={`h-12 text-center font-mono text-lg font-black rounded-2xl border-2 bg-white text-slate-900 focus:outline-hidden transition-all ${
                                digit
                                  ? 'border-emerald-700 bg-emerald-50/40'
                                  : 'border-slate-300 focus:border-emerald-700'
                              }`}
                            />
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStep('phone');
                            setOtpInput('');
                            setAuthError(null);
                          }}
                          className="px-4 py-2.5 rounded-full border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
                        >
                          تغيير الرقم
                        </button>
                        <button
                          type="submit"
                          disabled={isVerifyingOtp || otpInput.length < 6}
                          className="flex-1 py-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md shadow-emerald-700/20 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                        >
                          {isVerifyingOtp ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>جاري التحقق...</span>
                            </>
                          ) : (
                            <span>تأكيد الرمز والدخول</span>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={cooldownSec > 0 || isSendingOtp}
                        onClick={handleSendFirebaseOtp}
                        className="text-[11px] font-bold text-emerald-800 disabled:text-slate-400 flex items-center justify-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>
                          {cooldownSec > 0
                            ? `إعادة إرسال الرمز بعد ${cooldownSec} ثانية`
                            : 'إعادة إرسال رمز التحقق'}
                        </span>
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="bg-amber-50/90 border border-amber-200/70 rounded-xl p-2.5 flex items-start gap-2 text-[11px] text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  التبديل السريع يتيح معاينة واجهات الكابتن والتاجر في المحاكاة المحلية مع عزل مسارات الإدارة.
                </span>
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
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>الباجور • المنوفية • مشوار</span>
          <span className="font-semibold text-emerald-800">توثيق رقم الهاتف + OTP</span>
        </div>
      </div>
    </div>
  );
};

