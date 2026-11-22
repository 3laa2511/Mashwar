import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Heart,
  Calendar,
  Clock,
  Mic,
  MicOff,
  Trash2,
  DollarSign,
  Camera,
  FileText,
  Tag,
  Banknote,
  Shield,
  Wand2,
  Loader2,
  ShoppingBag,
} from 'lucide-react';
import {
  useMarketplace,
  EL_BAGOUR_LANDMARKS_LIST,
} from '../../store/marketplaceStore';
import { auth } from '../../lib/firebase';
import { type CashChangeOptionEgp } from '../../lib/firestoreSchemas';

export type WizardServiceCategory = 'delivery' | 'ride' | 'prescription_list';
export type WizardRideVehicle = 'tuktuk' | 'car' | 'package';
export type WizardStep = 1 | 2 | 3;

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDefaultFutureTime(): string {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const hh = String(future.getHours()).padStart(2, '0');
  const mm = String(future.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface ExtractedStructuredItem {
  nameAr: string;
  quantity?: string;
  unit?: string;
  notes?: string;
  estimatedCategory?: string;
}

interface MultiStepOrderWizardProps {
  initialCategory?: WizardServiceCategory;
  onOrderCreated: () => void;
  onOpenAuthModal?: () => void;
  onOpenCartAfterAdd?: () => void;
}

export const MultiStepOrderWizard: React.FC<MultiStepOrderWizardProps> = ({
  initialCategory = 'delivery',
  onOrderCreated,
  onOpenAuthModal,
  onOpenCartAfterAdd,
}) => {
  const {
    currentUser,
    stores,
    products,
    customerWalletBalanceEgp,
    favoriteProductIds,
    toggleFavoriteProduct,
    isFavoriteProduct,
    toggleFavoriteService,
    isFavoriteService,
    addExtractedItemsToCart,
    submitDirectStoreOrder,
    submitPrescriptionOrder,
    submitRideOrPackageOrder,
    applyPromoCode,
  } = useMarketplace();

  const [step, setStep] = useState<WizardStep>(1);
  const [serviceCategory, setServiceCategory] = useState<WizardServiceCategory>(initialCategory);

  // Delivery state
  const [selectedStoreId, setSelectedStoreId] = useState<string>(stores[0]?.id || 'merchant_basha');
  const [itemQtyMap, setItemQtyMap] = useState<Record<string, number>>({});
  const [deliveryDropoffId, setDeliveryDropoffId] = useState<string>('lm_shorouk');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);

  // Prescription / Grocery List AI state
  const [rxStoreId, setRxStoreId] = useState<string>('merchant_amana');
  const [rxExtractedItems, setRxExtractedItems] = useState<string[]>([]);
  const [rxStructuredItems, setRxStructuredItems] = useState<ExtractedStructuredItem[]>([]);
  const [rxSummary, setRxSummary] = useState<string>('');
  const [rxWarningAr, setRxWarningAr] = useState<string | null>(null);
  const [rxCartAddedFeedback, setRxCartAddedFeedback] = useState<string | null>(null);
  const [rxManualInput, setRxManualInput] = useState<string>('');
  const [rxPreviewUrl, setRxPreviewUrl] = useState<string | null>(null);
  const [isParsingAi, setIsParsingAi] = useState<boolean>(false);
  const [aiErrorMsg, setAiErrorMsg] = useState<string | null>(null);

  // Ride state
  const [rideVehicle, setRideVehicle] = useState<WizardRideVehicle>('tuktuk');
  const [pickupLandmarkId, setPickupLandmarkId] = useState<string>('lm_station');
  const [dropoffLandmarkId, setDropoffLandmarkId] = useState<string>('lm_hospital');
  const [requiresFamilyTrustedDriver, setRequiresFamilyTrustedDriver] = useState<boolean>(false);
  const [recipientPhone, setRecipientPhone] = useState<string>(
    currentUser.phone && /^01[0125][0-9]{8}$/.test(currentUser.phone)
      ? currentUser.phone
      : '01012345678'
  );

  // Schedule state (Date & Time Picker -> scheduled_for)
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState<string>(getTodayIsoDate);
  const [scheduledTime, setScheduledTime] = useState<string>(getDefaultFutureTime);

  // Voice-to-Text Recording state (SpeechRecognition API)
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);
  const [voiceNoteTranscript, setVoiceNoteTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [voiceDurationSec, setVoiceDurationSec] = useState<number>(0);
  const [voiceStatusNotice, setVoiceStatusNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Shared state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'wallet' | 'instapay' | 'vodafone_cash'>('cash');
  const [cashChangeForEgp, setCashChangeForEgp] = useState<CashChangeOptionEgp>(0);
  const [promoInput, setPromoInput] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discountEgp: number; titleAr: string } | null>(null);
  const [promoFeedback, setPromoFeedback] = useState<string | null>(null);
  const [driverTipEgp, setDriverTipEgp] = useState<number>(0);
  const [customTipInput, setCustomTipInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup error
        }
      }
    };
  }, []);

  const stopVoiceRecording = () => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore stop error
      }
      recognitionRef.current = null;
    }
    setIsRecordingVoice(false);
    setInterimTranscript('');
  };

  const startVoiceRecording = () => {
    setVoiceStatusNotice(null);
    const SpeechRecCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecCtor) {
      setVoiceStatusNotice(
        'متصفحك الحالي لا يدعم التفريغ الصوتي التلقائي (SpeechRecognition). يمكنك كتابة الملاحظة الصوتية يدوياً بالأسفل.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecCtor();
      recognition.lang = 'ar-EG';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';
          if (result.isFinal) {
            finalChunk += `${text} `;
          } else {
            interimChunk += text;
          }
        }
        if (finalChunk.trim()) {
          setVoiceNoteTranscript((prev) =>
            prev ? `${prev.trim()} ${finalChunk.trim()}`.slice(0, 300) : finalChunk.trim().slice(0, 300)
          );
        }
        setInterimTranscript(interimChunk);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const errCode = event.error;
        if (errCode === 'not-allowed' || errCode === 'service-not-allowed') {
          setVoiceStatusNotice('لم يتم منح إذن الميكروفون. فعّل الميكروفون أو اكتب التعليمات نصياً.');
        } else if (errCode !== 'aborted') {
          setVoiceStatusNotice('تعذر التقاط الصوت بوضوح، يمكنك التحدث مرة أخرى أو التعديل يدوياً.');
        }
        stopVoiceRecording();
      };

      recognition.onend = () => {
        if (timerIntervalRef.current !== null) {
          window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        setIsRecordingVoice(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecordingVoice(true);
      timerIntervalRef.current = window.setInterval(() => {
        setVoiceDurationSec((prev) => {
          if (prev >= 119) {
            stopVoiceRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setVoiceStatusNotice('تعذر بدء التسجيل الصوتي حالياً. يمكنك كتابة التعليمات مباشرة.');
      stopVoiceRecording();
    }
  };

  const applySchedulePreset = (preset: '1h' | 'tonight' | 'tomorrow_am') => {
    setScheduleMode('scheduled');
    const now = new Date();
    if (preset === '1h') {
      const target = new Date(now.getTime() + 60 * 60 * 1000);
      setScheduledDate(
        `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
          target.getDate()
        ).padStart(2, '0')}`
      );
      setScheduledTime(
        `${String(target.getHours()).padStart(2, '0')}:${String(target.getMinutes()).padStart(2, '0')}`
      );
    } else if (preset === 'tonight') {
      setScheduledDate(getTodayIsoDate());
      setScheduledTime('19:00');
    } else {
      const tmr = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setScheduledDate(
        `${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(
          tmr.getDate()
        ).padStart(2, '0')}`
      );
      setScheduledTime('10:00');
    }
  };

  const computedScheduledFor: string | null = useMemo(() => {
    if (scheduleMode === 'now') return null;
    if (!scheduledDate || !scheduledTime) return null;
    return `${scheduledDate}T${scheduledTime}`;
  }, [scheduleMode, scheduledDate, scheduledTime]);

  const formattedScheduledArabic = useMemo(() => {
    if (!computedScheduledFor) return 'تنفيذ فوري الآن';
    const dt = new Date(computedScheduledFor);
    if (Number.isNaN(dt.getTime())) return computedScheduledFor;
    return dt.toLocaleString('ar-EG', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [computedScheduledFor]);

  const selectedStore = useMemo(
    () => stores.find((s) => s.id === selectedStoreId) || stores[0],
    [stores, selectedStoreId]
  );

  const storeProducts = useMemo(
    () => products.filter((p) => p.storeId === selectedStore?.id && p.isAvailable),
    [products, selectedStore]
  );

  const visibleStoreProducts = useMemo(() => {
    if (!showFavoritesOnly) return storeProducts;
    return storeProducts.filter((p) => isFavoriteProduct(p.id));
  }, [storeProducts, showFavoritesOnly, isFavoriteProduct]);

  const pickupLandmark = useMemo(
    () => EL_BAGOUR_LANDMARKS_LIST.find((l) => l.id === pickupLandmarkId) || EL_BAGOUR_LANDMARKS_LIST[0],
    [pickupLandmarkId]
  );

  const rxStore = useMemo(
    () => stores.find((s) => s.id === rxStoreId) || stores[1] || stores[0],
    [stores, rxStoreId]
  );

  const dropoffLandmark = useMemo(
    () =>
      EL_BAGOUR_LANDMARKS_LIST.find(
        (l) =>
          l.id ===
          (serviceCategory === 'ride' ? dropoffLandmarkId : deliveryDropoffId)
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
    if (serviceCategory === 'prescription_list') return rxStore?.distanceKm || 1.5;
    if (pickupLandmarkId === dropoffLandmarkId) return 1.2;
    return pickupLandmark.isRural || dropoffLandmark.isRural ? 4.8 : 2.6;
  }, [serviceCategory, selectedStore, rxStore, pickupLandmarkId, dropoffLandmarkId, pickupLandmark, dropoffLandmark]);

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
    const targetStore = serviceCategory === 'prescription_list' ? rxStore : selectedStore;
    const deliveryFeeEgp = targetStore?.deliveryFeeEgp ?? 15;
    const ruralSurchargeEgp = isRural ? 5 : 0;
    const platformFeeEgp = 2;
    const sub = serviceCategory === 'prescription_list' ? 0 : deliverySubtotalEgp;
    const totalEgp = sub + deliveryFeeEgp + ruralSurchargeEgp + platformFeeEgp;
    return { deliveryFeeEgp, ruralSurchargeEgp, platformFeeEgp, totalEgp, isRural };
  }, [serviceCategory, selectedStore, rxStore, dropoffLandmark, deliverySubtotalEgp]);

  const baseOrderTotalEgp =
    serviceCategory === 'ride' ? rideFareBreakdown.totalEgp : deliveryFareBreakdown.totalEgp;
  const promoDiscountEgp = appliedPromo?.discountEgp || 0;
  const finalTotalEgp = Math.max(
    10,
    baseOrderTotalEgp + Math.max(0, Math.round(driverTipEgp)) - promoDiscountEgp
  );

  const handleUploadPrescriptionImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiErrorMsg(null);
    setRxWarningAr(null);
    setRxCartAddedFeedback(null);

    if (file.size > 4 * 1024 * 1024) {
      setAiErrorMsg('حجم الصورة كبير جداً (الحد الأقصى ٤ ميجابايت).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setRxPreviewUrl(dataUrl);
      const [meta, base64Data] = dataUrl.split(',');
      const mimeType = meta?.match(/data:(.*?);/)?.[1] || file.type || 'image/jpeg';

      setIsParsingAi(true);
      try {
        const resp = await fetch('/api/v1/ai/parse-prescription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType,
            listType: rxStore?.category === 'pharmacy' ? 'pharmacy' : 'grocery',
          }),
        });
        const json = await resp.json();
        if (!resp.ok || !json?.success) {
          setAiErrorMsg(
            json?.errorAr ||
              'لم نتمكن من قراءة الصورة آلياً حالياً، يمكنك كتابة الأصناف يدوياً بالأسفل وسيتم تسعيرها من المتجر.'
          );
          return;
        }
        const parsed = json.data;
        if (Array.isArray(parsed.items) && parsed.items.length > 0) {
          const structured: ExtractedStructuredItem[] = parsed.items
            .map((it: { nameAr?: string; name?: string; quantity?: string; unit?: string; notes?: string; estimatedCategory?: string }) => ({
              nameAr: String(it.nameAr || it.name || '').trim(),
              quantity: it.quantity ? String(it.quantity) : '1',
              unit: it.unit ? String(it.unit) : undefined,
              notes: it.notes ? String(it.notes) : undefined,
              estimatedCategory: it.estimatedCategory ? String(it.estimatedCategory) : undefined,
            }))
            .filter((it: ExtractedStructuredItem) => it.nameAr.length > 0);
          const labels = structured.map((it) =>
            [it.nameAr, it.quantity && it.quantity !== '1' ? `× ${it.quantity}` : '', it.unit, it.notes]
              .filter(Boolean)
              .join(' — ')
          );
          setRxStructuredItems(structured);
          setRxExtractedItems(labels);
        }
        if (parsed.summaryAr) setRxSummary(parsed.summaryAr);
        if (Array.isArray(parsed.warningsAr) && parsed.warningsAr.length > 0) {
          setRxWarningAr(parsed.warningsAr.join(' • '));
        } else if (parsed.requiresPharmacistReview) {
          setRxWarningAr('يُنصح بمراجعة الصيدلي للتأكد من الجرعات والبدائل المتاحة.');
        }
      } catch {
        setAiErrorMsg('تعذر الاتصال بخدمة التحليل الذكي، أضف الأصناف يدوياً أدناه.');
      } finally {
        setIsParsingAi(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleParseVoiceWithAi = async () => {
    const transcript = voiceNoteTranscript.trim();
    if (transcript.length < 3) return;
    setIsParsingAi(true);
    setAiErrorMsg(null);
    try {
      const resp = await fetch('/api/v1/ai/parse-voice-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptText: transcript }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.success) {
        setAiErrorMsg(json?.errorAr || 'تعذر تحليل النص الصوتي تلقائياً.');
        return;
      }
      const parsed = json.data;
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        const structured: ExtractedStructuredItem[] = parsed.items
          .map((it: { nameAr?: string; name?: string; quantity?: string; unit?: string; notes?: string }) => ({
            nameAr: String(it.nameAr || it.name || '').trim(),
            quantity: it.quantity ? String(it.quantity) : '1',
            unit: it.unit ? String(it.unit) : undefined,
            notes: it.notes ? String(it.notes) : undefined,
          }))
          .filter((it: ExtractedStructuredItem) => it.nameAr.length > 0);
        const labels = structured.map((it) =>
          [it.nameAr, it.quantity ? `× ${it.quantity}` : ''].filter(Boolean).join(' ')
        );
        setRxStructuredItems((prev) => [...prev, ...structured]);
        setRxExtractedItems((prev) => Array.from(new Set([...prev, ...labels])));
      }
      if (parsed.summaryAr) setRxSummary(parsed.summaryAr);
      if (typeof parsed.driverTipEgp === 'number' && parsed.driverTipEgp > 0) {
        setDriverTipEgp(Math.round(parsed.driverTipEgp));
        setCustomTipInput(String(Math.round(parsed.driverTipEgp)));
      }
      if ([50, 100, 200].includes(Number(parsed.cashChangeForEgp))) {
        setCashChangeForEgp(Number(parsed.cashChangeForEgp) as CashChangeOptionEgp);
      }
      if (parsed.inferredLandmarkNameAr && !notes.trim()) {
        setNotes(`العلامة المذكورة: ${parsed.inferredLandmarkNameAr}`);
      }
    } catch {
      setAiErrorMsg('تعذر الاتصال بخدمة التحليل الذكي.');
    } finally {
      setIsParsingAi(false);
    }
  };

  const handleApplyPromo = async () => {
    setPromoFeedback(null);
    const res = await applyPromoCode(promoInput, baseOrderTotalEgp);
    if (!res.valid) {
      setAppliedPromo(null);
      setPromoFeedback(res.errorAr || 'كود الخصم غير صالح');
      return;
    }
    setAppliedPromo({ code: res.code, discountEgp: res.discountEgp, titleAr: res.titleAr });
    setPromoFeedback(`تم تطبيق ${res.code} (${res.titleAr}): خصم -${res.discountEgp} ج.م`);
  };

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
    if (isRecordingVoice) {
      stopVoiceRecording();
    }
    if (serviceCategory === 'delivery') {
      if (selectedItemsList.length === 0) {
        setErrorMsg('يرجى اختيار صنف واحد على الأقل من المتجر للمتابعة.');
        return;
      }
    } else if (serviceCategory === 'prescription_list') {
      if (rxExtractedItems.length === 0 && !voiceNoteTranscript.trim() && !notes.trim()) {
        setErrorMsg('ارفع صورة الروشتة/القائمة أو أضف صنفاً واحداً على الأقل للتسعير.');
        return;
      }
    } else {
      if (pickupLandmarkId === dropoffLandmarkId) {
        setErrorMsg('نقطة الانطلاق والوصول متطابقتان. يرجى اختيار وجهة مختلفة.');
        return;
      }
    }
    if (scheduleMode === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      setErrorMsg('يرجى تحديد التاريخ والوقت للطلب المجدول.');
      return;
    }
    setStep(3);
  };

  const handleConfirmOrder = async () => {
    setErrorMsg(null);
    if (
      serviceCategory !== 'prescription_list' &&
      paymentMethod === 'wallet' &&
      customerWalletBalanceEgp < finalTotalEgp
    ) {
      setErrorMsg(`رصيد المحفظة (${customerWalletBalanceEgp} ج.م) غير كافٍ لسداد ${finalTotalEgp} ج.م.`);
      return;
    }

    const cleanTranscript = voiceNoteTranscript.trim().slice(0, 300);
    const hasVoiceNote = cleanTranscript.length > 0 || voiceDurationSec > 0;

    setIsSubmitting(true);
    try {
      if (serviceCategory === 'delivery') {
        if (!selectedStore || selectedItemsList.length === 0) {
          setErrorMsg('يرجى اختيار المتجر والأصناف أولاً.');
          setIsSubmitting(false);
          return;
        }
        submitDirectStoreOrder({
          storeId: selectedStore.id,
          items: selectedItemsList,
          deliveryAddress: dropoffLandmark.nameAr,
          paymentMethod,
          notes: notes.trim() || undefined,
          scheduled_for: computedScheduledFor,
          hasVoiceNote,
          voiceNoteDurationSec: voiceDurationSec,
          voiceNoteTranscript: cleanTranscript || undefined,
          driverTipEgp,
          cashChangeForEgp: paymentMethod === 'cash' ? cashChangeForEgp : 0,
          promoCode: appliedPromo?.code,
          discountEgp: promoDiscountEgp,
        });
      } else if (serviceCategory === 'prescription_list') {
        const finalItems =
          rxExtractedItems.length > 0
            ? rxExtractedItems
            : [voiceNoteTranscript.trim() || notes.trim() || 'روشتة / قائمة أصناف مرسلة'];
        submitPrescriptionOrder({
          storeId: rxStore?.id || 'merchant_amana',
          extractedItems: finalItems,
          prescriptionSummary: rxSummary || `طلب تسعير (${finalItems.length} أصناف)`,
          deliveryAddress: dropoffLandmark.nameAr,
          paymentMethod,
          notes: notes.trim() || undefined,
          scheduled_for: computedScheduledFor,
          voiceNoteTranscript: cleanTranscript || undefined,
          cashChangeForEgp: paymentMethod === 'cash' ? cashChangeForEgp : 0,
          driverTipEgp,
        });
      } else {
        const isPackage = rideVehicle === 'package';
        const vehicleCategory =
          rideVehicle === 'car' ? 'car' : rideVehicle === 'package' ? 'motorcycle' : 'tuktuk';

        submitRideOrPackageOrder({
          serviceType: isPackage ? 'package' : 'ride',
          vehicleCategory,
          pickupAddress: pickupLandmark.nameAr,
          deliveryAddress: dropoffLandmark.nameAr,
          distanceKm: estimatedDistanceKm,
          isRural: rideFareBreakdown.isRural,
          paymentMethod,
          notes: notes.trim() || undefined,
          scheduled_for: computedScheduledFor,
          hasVoiceNote,
          voiceNoteDurationSec: voiceDurationSec,
          voiceNoteTranscript: cleanTranscript || undefined,
          driverTipEgp,
          cashChangeForEgp: paymentMethod === 'cash' ? cashChangeForEgp : 0,
          promoCode: appliedPromo?.code,
          discountEgp: promoDiscountEgp,
          requiresFamilyTrustedDriver: !isPackage && requiresFamilyTrustedDriver,
          itemDescription: isPackage
            ? `توصيل طرد سريع: ${notes.trim() || cleanTranscript || 'أمانة داخل الباجور'}`
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
      }

      onOrderCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared Schedule & Voice-to-Text Section rendered in Step 2 for both Delivery & Ride
  const renderScheduleAndVoiceSection = () => (
    <div className="flex flex-col gap-2.5">
      {/* Date & Time Picker Card */}
      <div
        data-testid="wizard-schedule-picker"
        className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
            <span>جدولة الموعد (اختياري):</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setScheduleMode('now')}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                scheduleMode === 'now'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              الآن فوراً
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('scheduled')}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer ${
                scheduleMode === 'scheduled'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              جدولة موعد
            </button>
          </div>
        </div>

        {scheduleMode === 'scheduled' && (
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500">التاريخ</span>
                <input
                  type="date"
                  data-testid="wizard-schedule-date-input"
                  min={getTodayIsoDate()}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-emerald-700" />
                  <span>الوقت</span>
                </span>
                <input
                  type="time"
                  data-testid="wizard-schedule-time-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="px-2 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-900"
                />
              </label>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => applySchedulePreset('1h')}
                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
              >
                بعد ساعة
              </button>
              <button
                type="button"
                onClick={() => applySchedulePreset('tonight')}
                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
              >
                اليوم ٧:٠٠ م
              </button>
              <button
                type="button"
                onClick={() => applySchedulePreset('tomorrow_am')}
                className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold cursor-pointer"
              >
                غداً ١٠:٠٠ ص
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Voice-to-Text Recording Interface (SpeechRecognition API) */}
      <div
        data-testid="wizard-voice-recorder"
        className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-amber-600" />
            <span>ملاحظة صوتية بالتفريغ النصي (Speech-to-Text):</span>
          </span>
          {voiceDurationSec > 0 && (
            <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
              {voiceDurationSec} ث
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="wizard-voice-toggle-btn"
            onClick={() => {
              if (isRecordingVoice) stopVoiceRecording();
              else startVoiceRecording();
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer ${
              isRecordingVoice
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300'
            }`}
          >
            {isRecordingVoice ? (
              <>
                <MicOff className="w-3.5 h-3.5" />
                <span>إيقاف التسجيل الصوتي ({voiceDurationSec}ث)</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>سجّل تعليمات التوصيل بصوتك</span>
              </>
            )}
          </button>

          {(voiceNoteTranscript || voiceDurationSec > 0) && (
            <button
              type="button"
              onClick={() => {
                stopVoiceRecording();
                setVoiceNoteTranscript('');
                setVoiceDurationSec(0);
                setVoiceStatusNotice(null);
              }}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer"
              title="مسح التفريغ الصوتي"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {voiceStatusNotice && (
          <div className="text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
            {voiceStatusNotice}
          </div>
        )}

        {interimTranscript && (
          <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50/70 px-2.5 py-1 rounded-xl border border-emerald-200">
            جاري الاستماع: {interimTranscript}...
          </div>
        )}

        <textarea
          rows={2}
          maxLength={300}
          data-testid="wizard-voice-transcript-input"
          value={voiceNoteTranscript}
          onChange={(e) => setVoiceNoteTranscript(e.target.value)}
          placeholder="سيظهر نص رسالتك الصوتية هنا تلقائياً عند التحدث، أو يمكنك تعديله يدوياً (مثل: ٢ كيلو بطاطس وعلبة لبن جهينة)..."
          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-[11px] text-slate-900 resize-none focus:outline-hidden focus:border-emerald-600"
        />

        {voiceNoteTranscript.trim().length >= 3 && (
          <button
            type="button"
            disabled={isParsingAi}
            onClick={handleParseVoiceWithAi}
            className="w-full py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isParsingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 text-emerald-700" />}
            <span>استخراج قائمة الأصناف من الصوت بالذكاء الاصطناعي</span>
          </button>
        )}
      </div>
    </div>
  );

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

          <div
            onClick={() => setServiceCategory('delivery')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
              serviceCategory === 'delivery'
                ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-black text-sm text-slate-900">توصيل متاجر ومطاعم (Delivery)</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {stores.length} متاجر
                  </span>
                  <button
                    type="button"
                    aria-label="تفضيل خدمة التوصيل"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteService('delivery');
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFavoriteService('delivery')
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                اطلب من مطاعم وصيدليات وسوبر ماركت الباجور مباشرة لباب بيتك.
              </p>
            </div>
          </div>

          <div
            onClick={() => setServiceCategory('ride')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
              serviceCategory === 'ride'
                ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <Car className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-black text-sm text-slate-900">حجز مشوار (توكتوك / سيارة)</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    من ١٥ ج.م
                  </span>
                  <button
                    type="button"
                    aria-label="تفضيل خدمة المشاوير"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavoriteService('ride');
                    }}
                    className="p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFavoriteService('ride')
                          ? 'fill-rose-500 text-rose-500'
                          : 'text-slate-400'
                      }`}
                    />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                تنقل فوري بتوكتوك موثق أو سيارة ملاكي أو أرسل طرداً سريعاً بسعر واضح مسبقاً.
              </p>
            </div>
          </div>

          <div
            onClick={() => setServiceCategory('prescription_list')}
            className={`p-3.5 rounded-2xl border text-right transition-all flex items-center gap-3 cursor-pointer ${
              serviceCategory === 'prescription_list'
                ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="font-black text-sm text-slate-900">روشتة أو ورقة مقاضي بالذكاء الاصطناعي</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 shrink-0">
                  حصري بالباجور
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                صوّر الروشتة الطبية أو قائمة البيت، والذكاء الاصطناعي يستخرجها ويصلك السعر قبل التوصيل.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full min-h-[44px] py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 mt-1 cursor-pointer"
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
                    className={`shrink-0 px-3 py-2 rounded-xl border text-right transition-all cursor-pointer ${
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

          {/* Product Picker with Heart Favorites */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-slate-800">
                ٢. أصناف {selectedStore?.nameAr}:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFavoritesOnly((prev) => !prev)}
                  className={`px-2 py-0.5 rounded-lg border text-[10px] font-extrabold flex items-center gap-1 cursor-pointer ${
                    showFavoritesOnly
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Heart className={`w-3 h-3 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : ''}`} />
                  <span>المفضلة ({favoriteProductIds.length})</span>
                </button>
                <span className="text-[11px] font-black text-emerald-700">
                  {deliverySubtotalEgp} ج.م
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {visibleStoreProducts.length === 0 ? (
                <div className="text-[11px] text-slate-500 text-center py-4">
                  لا توجد أصناف مفضلة في هذا المتجر حالياً. اضغط على القلب لإضافة أصناف للمفضلة.
                </div>
              ) : (
                visibleStoreProducts.map((prod) => {
                  const qty = itemQtyMap[prod.id] || 0;
                  const isFav = isFavoriteProduct(prod.id);
                  return (
                    <div
                      key={prod.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        aria-label={`تفضيل ${prod.nameAr}`}
                        onClick={() => toggleFavoriteProduct(prod.id)}
                        className="p-1 rounded-lg hover:bg-rose-50 shrink-0 cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 transition ${
                            isFav ? 'fill-rose-500 text-rose-500 scale-110' : 'text-slate-400'
                          }`}
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-slate-900 truncate">{prod.nameAr}</div>
                        <div className="text-[10px] text-emerald-800 font-bold">{prod.priceEgp} ج.م</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQty(prod.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-black">{qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(prod.id, 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
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
              placeholder="ملاحظات نصية إضافية للمتجر أو الكابتن (اختياري)..."
              className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px]"
            />
          </div>

          {renderScheduleAndVoiceSection()}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-3 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
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
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
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
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
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
                className={`p-2.5 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
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
                className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
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

            {rideVehicle !== 'package' && (
              <div className="mt-1 pt-2 border-t border-slate-100 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setRequiresFamilyTrustedDriver((prev) => !prev)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-2 text-right transition cursor-pointer ${
                    requiresFamilyTrustedDriver
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className={`w-4 h-4 ${requiresFamilyTrustedDriver ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-[11px] font-extrabold">خيار كباتن العائلات الموثوقين</div>
                      <div className="text-[9px] text-slate-500">توجيه الطلب فقط لكباتن الباجور المعتمدين للعائلات</div>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${requiresFamilyTrustedDriver ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {requiresFamilyTrustedDriver ? 'مفعّل' : 'اختياري'}
                  </span>
                </button>
                <div className="text-[10px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>يتم تأمين كل رحلة بكود PIN من ٤ أرقام تُعطيه للكابتن عند الركوب.</span>
                </div>
              </div>
            )}
          </div>

          {renderScheduleAndVoiceSection()}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-3 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="flex-1 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>مراجعة الأجرة ({rideFareBreakdown.totalEgp} ج.م)</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && serviceCategory === 'prescription_list' && (
        <div className="flex flex-col gap-3">
          {/* Target Pharmacy or Supermarket */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2">
            <span className="text-[11px] font-extrabold text-slate-800">١. اختر الصيدلية أو السوبرماركت للتسعير:</span>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {stores.map((store) => {
                const active = store.id === rxStore?.id;
                return (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => setRxStoreId(store.id)}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-right transition-all cursor-pointer ${
                      active
                        ? 'border-amber-600 bg-amber-50 text-amber-950 font-extrabold'
                        : 'border-slate-200 bg-slate-50 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">{store.nameAr}</div>
                    <div className="text-[10px] text-slate-500">{store.categoryAr}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Photo Prescription / Grocery List AI Upload */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>٢. تصوير الروشتة أو ورقة المقاضي:</span>
              </span>
              {isParsingAi && (
                <span className="text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>جاري القراءة بالذكاء الاصطناعي...</span>
                </span>
              )}
            </div>

            <label className="w-full min-h-[48px] p-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 flex flex-col items-center justify-center gap-1 cursor-pointer text-center">
              <Camera className="w-5 h-5 text-amber-700" />
              <span className="text-xs font-extrabold text-amber-950">
                اضغط لتصوير أو رفع صورة الروشتة / الورقة
              </span>
              <span className="text-[10px] text-slate-500">
                يستخرج الذكاء الاصطناعي الأصناف تلقائياً وترسل للصيدلي أو التاجر للتسعير
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleUploadPrescriptionImage}
                className="hidden"
              />
            </label>

            {rxPreviewUrl && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-50 flex items-center justify-center">
                <img src={rxPreviewUrl} alt="معاينة الصورة المرفوعة" className="max-h-36 object-contain" />
              </div>
            )}

            {aiErrorMsg && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-[10px] font-bold">
                {aiErrorMsg}
              </div>
            )}

            {rxWarningAr && (
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{rxWarningAr}</span>
              </div>
            )}

            {rxSummary && (
              <div className="text-[11px] font-bold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                {rxSummary}
              </div>
            )}

            {/* Extracted & Manual Editable Items List */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-extrabold text-slate-600">
                الأصناف المطلوبة ({rxExtractedItems.length}):
              </span>
              {rxExtractedItems.map((it, idx) => (
                <div
                  key={`${it}-${idx}`}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900"
                >
                  <span className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                    <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">{it}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRxExtractedItems((prev) => prev.filter((_, i) => i !== idx));
                      setRxStructuredItems((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="text"
                  value={rxManualInput}
                  onChange={(e) => setRxManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && rxManualInput.trim()) {
                      e.preventDefault();
                      const val = rxManualInput.trim();
                      setRxExtractedItems((prev) => [...prev, val]);
                      setRxStructuredItems((prev) => [...prev, { nameAr: val, quantity: '1' }]);
                      setRxManualInput('');
                    }
                  }}
                  placeholder="أضف دواء أو صنف مقاضي يدوياً (مثل: بنادول أزرق × ١)..."
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!rxManualInput.trim()) return;
                    const val = rxManualInput.trim();
                    setRxExtractedItems((prev) => [...prev, val]);
                    setRxStructuredItems((prev) => [...prev, { nameAr: val, quantity: '1' }]);
                    setRxManualInput('');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  + إضافة
                </button>
              </div>

              {rxExtractedItems.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const itemsForCart =
                        rxStructuredItems.length > 0
                          ? rxStructuredItems
                          : rxExtractedItems.map((label) => ({ nameAr: label, quantity: '1' }));
                      const res = addExtractedItemsToCart(rxStore?.id || 'merchant_amana', itemsForCart);
                      if (res.limitReached) {
                        setAiErrorMsg('السلة المجمعة وصلت للحد الأقصى (٤ متاجر).');
                      } else if (res.addedCount > 0) {
                        setRxCartAddedFeedback(
                          `تم تحويل ${res.addedCount} أصناف إلى السلة المجمعة من ${rxStore?.nameAr || 'المتجر'}`
                        );
                        onOpenCartAfterAdd?.();
                      }
                    }}
                    className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>تحويل وإضافة الأصناف للسلة المجمعة الآن ({rxExtractedItems.length})</span>
                  </button>
                  {rxCartAddedFeedback && (
                    <div className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 text-center">
                      {rxCartAddedFeedback}
                    </div>
                  )}
                </div>
              )}
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
          </div>

          {renderScheduleAndVoiceSection()}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-3.5 py-3 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>
            <button
              type="button"
              onClick={handleNextFromStep2}
              className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>متابعة للتأكيد والتسعير ({rxExtractedItems.length} أصناف)</span>
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
                    : serviceCategory === 'prescription_list'
                    ? `طلب تسعير من ${rxStore?.nameAr}`
                    : rideVehicle === 'car'
                    ? 'مشوار سيارة ملاكي'
                    : rideVehicle === 'package'
                    ? 'توصيل طرد سريع'
                    : 'مشوار توكتوك الباجور'}
                </span>
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-800 font-bold tabular-nums">
                {estimatedDistanceKm} كم
              </span>
            </div>

            <div className="text-[11px] text-slate-300 flex flex-col gap-1">
              <div>
                <strong className="text-white">من:</strong>{' '}
                {serviceCategory === 'delivery'
                  ? selectedStore?.address
                  : serviceCategory === 'prescription_list'
                  ? rxStore?.address
                  : pickupLandmark.nameAr}
              </div>
              <div>
                <strong className="text-white">إلى:</strong> {dropoffLandmark.nameAr}
              </div>
              <div>
                <strong className="text-white">الموعد:</strong> {formattedScheduledArabic}
              </div>
              {serviceCategory === 'delivery' && (
                <div>
                  <strong className="text-white">الأصناف:</strong>{' '}
                  {selectedItemsList.map((i) => `${i.quantity}× ${i.product.nameAr}`).join('، ')}
                </div>
              )}
              {serviceCategory === 'prescription_list' && (
                <div>
                  <strong className="text-white">الأصناف للتسعير:</strong>{' '}
                  {(rxExtractedItems.length > 0 ? rxExtractedItems : [voiceNoteTranscript || notes]).filter(Boolean).join('، ')}
                </div>
              )}
              {serviceCategory === 'ride' && rideVehicle !== 'package' && requiresFamilyTrustedDriver && (
                <div className="text-emerald-300 font-bold">
                  ✓ موجه حصرياً لكباتن العائلات الموثوقين + كود أمان ٤ أرقام
                </div>
              )}
              {voiceNoteTranscript.trim() && (
                <div className="mt-1 p-2 rounded-xl bg-slate-800 border border-slate-700 text-amber-200 text-[10px]">
                  <strong className="text-amber-400 block mb-0.5">
                    ملاحظة صوتية مفرغة{voiceDurationSec ? ` (${voiceDurationSec} ث)` : ''}:
                  </strong>
                  “{voiceNoteTranscript.trim()}”
                </div>
              )}
            </div>

            {driverTipEgp > 0 && (
              <div className="border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[11px] text-amber-300 font-bold">
                <span>إكرامية الكابتن (١٠٠٪ للكابتن)</span>
                <span className="tabular-nums">+{driverTipEgp}.00 ج.م</span>
              </div>
            )}

            {promoDiscountEgp > 0 && appliedPromo && (
              <div className="border-t border-slate-800/80 pt-1.5 flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span>خصم كوبون ({appliedPromo.code})</span>
                <span className="tabular-nums">-{promoDiscountEgp}.00 ج.م</span>
              </div>
            )}

            <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold">
                {serviceCategory === 'prescription_list'
                  ? 'رسوم التوصيل المبدئية (+ قيمة الأصناف بعد التسعير)'
                  : 'الإجمالي النهائي المستحق'}
              </span>
              <span className="text-lg font-black text-emerald-400 tabular-nums">{finalTotalEgp}.00 ج.م</span>
            </div>
          </div>

          {/* Promo Coupon Box */}
          {serviceCategory !== 'prescription_list' && (
            <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-2">
              <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-emerald-700" />
                <span>كوبون خصم (مثال: BAGOUR10 أو STUDENT15):</span>
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="أدخل كود الخصم..."
                  className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono uppercase text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[11px] font-extrabold cursor-pointer"
                >
                  تطبيق
                </button>
              </div>
              {promoFeedback && (
                <div
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                    appliedPromo
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {promoFeedback}
                </div>
              )}
            </div>
          )}

          {/* Driver Tip Selection Card */}
          <div
            data-testid="wizard-driver-tip-card"
            className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-700" />
                <span>إكرامية الكابتن (Driver Tip):</span>
              </span>
              <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                {driverTipEgp > 0 ? `+${driverTipEgp} ج.م` : 'بدون إكرامية'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              {[0, 5, 10, 20].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  data-testid={`wizard-tip-preset-${amt}`}
                  onClick={() => {
                    setDriverTipEgp(amt);
                    setCustomTipInput(amt > 0 ? String(amt) : '');
                  }}
                  className={`py-1.5 rounded-xl border font-extrabold transition cursor-pointer ${
                    driverTipEgp === amt
                      ? 'border-emerald-600 bg-emerald-700 text-white shadow-2xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50'
                  }`}
                >
                  {amt === 0 ? 'بدون' : `${amt} ج.م`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={500}
                step={1}
                data-testid="wizard-custom-tip-input"
                value={customTipInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomTipInput(val);
                  const parsed = Math.max(0, Math.min(500, Math.round(Number(val) || 0)));
                  setDriverTipEgp(parsed);
                }}
                placeholder="أو أدخل مبلغ إكرامية مخصص بالجنيه..."
                className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
              {driverTipEgp > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setDriverTipEgp(0);
                    setCustomTipInput('');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Payment Method + Exact Change Helper */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-2.5">
            <div>
              <span className="text-[11px] font-extrabold text-slate-800 block mb-1.5">وسيلة الدفع:</span>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 rounded-xl border font-bold cursor-pointer ${
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
                  className={`p-2 rounded-xl border font-bold cursor-pointer ${
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
                  className={`p-2 rounded-xl border font-bold cursor-pointer ${
                    paymentMethod === 'instapay'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  ⚡ إنستاباي
                </button>
              </div>
            </div>

            {paymentMethod === 'cash' && (
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-700" />
                  <span>معاك فكة كام؟ (لتجهيز الفكة مع الكابتن)</span>
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                  {(
                    [
                      { val: 0, label: 'معي مظبوط' },
                      { val: 50, label: '٥٠ ج.م' },
                      { val: 100, label: '١٠٠ ج.م' },
                      { val: 200, label: '٢٠٠ ج.م' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setCashChangeForEgp(opt.val)}
                      className={`py-1.5 px-1 rounded-xl border font-extrabold cursor-pointer ${
                        cashChangeForEgp === opt.val
                          ? 'border-emerald-600 bg-emerald-700 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-3.5 py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
              <span>تعديل</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmOrder}
              className="flex-1 min-h-[44px] py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-extrabold text-xs shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Navigation className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري تأكيد وإرسال الطلب...'
                  : serviceCategory === 'prescription_list'
                  ? 'إرسال للتسعير الآن'
                  : computedScheduledFor
                  ? `تأكيد الطلب المجدول (${finalTotalEgp} ج.م)`
                  : `تأكيد الطلب الآن (${finalTotalEgp} ج.م)`}
              </span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>السعر شامل كافة الرسوم • متابعة فورية لحظياً</span>
          </div>
        </div>
      )}
    </div>
  );
};
