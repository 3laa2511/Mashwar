import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  Calendar,
  Mic,
  Zap,
  XCircle,
} from 'lucide-react';
import {
  useMarketplace,
  ORDER_TRACKING_STAGES,
  type OrderTrackingStageKey,
} from '../../store/marketplaceStore';
import { auth, subscribeToOrderStatusInFirestore } from '../../lib/firebase';

interface OrderTrackingStatusCardProps {
  compact?: boolean;
}

const STAGE_ICONS: Record<OrderTrackingStageKey, React.ComponentType<{ className?: string }>> = {
  received: Clock,
  preparing: ChefHat,
  out_for_delivery: Bike,
  delivered: PackageCheck,
};

function formatScheduledLabel(scheduledFor?: string | null): string | null {
  if (!scheduledFor || scheduledFor === 'now') return null;
  const parsed = new Date(scheduledFor);
  if (Number.isNaN(parsed.getTime())) return scheduledFor;
  return parsed.toLocaleString('ar-EG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const OrderTrackingStatusCard: React.FC<OrderTrackingStatusCardProps> = ({
  compact = false,
}) => {
  const { activeOrderTrackingCard, advanceOrderTrackingStage } = useMarketplace();
  const [cloudStatusLabel, setCloudStatusLabel] = useState<string | null>(null);

  const trackedOrderId = activeOrderTrackingCard?.order.id || '';

  useEffect(() => {
    if (!trackedOrderId || !auth.currentUser) {
      setCloudStatusLabel(null);
      return;
    }
    try {
      const unsub = subscribeToOrderStatusInFirestore(trackedOrderId, (status) => {
        setCloudStatusLabel(status);
      });
      return () => unsub();
    } catch {
      return undefined;
    }
  }, [trackedOrderId]);

  if (!activeOrderTrackingCard) return null;

  const { order, stageIndex, labelAr, labelEn, progressPercent, isCancelled } =
    activeOrderTrackingCard;

  const scheduledText = formatScheduledLabel(order.scheduled_for);
  const voiceTranscript = order.voiceNoteTranscript?.trim();

  const progressWidthClass = isCancelled
    ? 'w-0'
    : progressPercent >= 100
    ? 'w-full'
    : progressPercent >= 70
    ? 'w-3/4'
    : progressPercent >= 40
    ? 'w-2/5'
    : 'w-1/5';

  return (
    <div
      data-testid="realtime-order-tracking-status-card"
      className={`rounded-2xl border bg-white shadow-sm flex flex-col gap-2.5 ${
        isCancelled
          ? 'border-rose-200 bg-rose-50/40'
          : 'border-emerald-200/90 bg-gradient-to-b from-emerald-50/50 to-white'
      } ${compact ? 'p-2.5' : 'p-3'}`}
      dir="rtl"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCancelled ? (
            <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
            </span>
          )}
          <div className="min-w-0">
            <div className="text-[11px] font-black text-slate-900 truncate">
              متابعة الطلب الفورية • {order.orderNumber}
            </div>
            <div className="text-[10px] font-bold text-emerald-800 truncate">
              {labelAr} ({labelEn})
              {cloudStatusLabel ? ` • مزامن سحابياً` : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isCancelled && stageIndex < 3 && (
            <button
              type="button"
              data-testid="tracking-card-advance-btn"
              onClick={() => advanceOrderTrackingStage(order.id)}
              className="px-2 py-1 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-2xs transition cursor-pointer active:scale-95"
              title="تحديث المرحلة التالية"
            >
              <Zap className="w-3 h-3 text-amber-300" />
              <span>المرحلة التالية</span>
            </button>
          )}
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
              isCancelled
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : stageIndex === 3
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}
          >
            {isCancelled ? 'ملغي' : `${progressPercent}%`}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isCancelled ? 'bg-rose-500' : 'bg-emerald-600'
          } ${progressWidthClass}`}
        />
      </div>

      {/* 4 Canonical Stages Stepper: Received -> Preparing -> Out for Delivery -> Delivered */}
      <div className="grid grid-cols-4 gap-1.5">
        {ORDER_TRACKING_STAGES.map((stage) => {
          const IconComp = STAGE_ICONS[stage.key];
          const isCompleted = !isCancelled && stage.index < stageIndex;
          const isCurrent = !isCancelled && stage.index === stageIndex;

          return (
            <div
              key={stage.key}
              data-testid={`tracking-stage-${stage.key}`}
              data-stage-active={isCurrent ? 'true' : 'false'}
              className={`rounded-xl p-1.5 border text-center flex flex-col items-center justify-center gap-0.5 transition-all ${
                isCurrent
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : isCompleted
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-center">
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <IconComp
                    className={`w-3.5 h-3.5 ${
                      isCurrent ? 'text-amber-300 animate-pulse' : 'text-slate-400'
                    }`}
                  />
                )}
              </div>
              <span className="text-[9px] font-black leading-tight">{stage.labelAr}</span>
              <span
                className={`text-[8px] leading-tight ${
                  isCurrent ? 'text-emerald-100' : 'text-slate-400'
                }`}
              >
                {stage.labelEn}
              </span>
            </div>
          );
        })}
      </div>

      {/* Optional Scheduled Timestamp & Voice-Note Transcript Strip */}
      {(scheduledText || voiceTranscript) && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
          {scheduledText && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-900 bg-indigo-50 border border-indigo-200/80 rounded-xl px-2.5 py-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">موعد مجدول: {scheduledText}</span>
            </div>
          )}
          {voiceTranscript && (
            <div className="flex items-start gap-1.5 text-[10px] font-bold text-amber-950 bg-amber-50 border border-amber-200/80 rounded-xl px-2.5 py-1.5">
              <Mic className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="text-[9px] text-amber-700 block">
                  ملاحظة صوتية مفرغة نصياً
                  {order.voiceNoteDurationSec ? ` (${order.voiceNoteDurationSec} ث)` : ''}:
                </span>
                <p className="text-[10px] font-extrabold text-slate-900 leading-snug break-words">
                  “{voiceTranscript}”
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
