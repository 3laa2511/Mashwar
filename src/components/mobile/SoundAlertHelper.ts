export type DispatchChimeRole = 'captain' | 'merchant' | 'customer';
export type CaptainAlertSoundType =
  | 'radar_pulse'
  | 'bagour_chime'
  | 'urgent_dispatch'
  | 'soft_bell';

export interface CaptainSoundProfileMeta {
  id: CaptainAlertSoundType;
  labelAr: string;
  descriptionAr: string;
}

export const CAPTAIN_SOUND_PROFILES: CaptainSoundProfileMeta[] = [
  {
    id: 'radar_pulse',
    labelAr: 'نغمة رادار الباجور',
    descriptionAr: 'نبضات متصاعدة سريعة لاقتناص الطلبات الفورية',
  },
  {
    id: 'bagour_chime',
    labelAr: 'جرس مشوار الكلاسيكي',
    descriptionAr: 'رنة واضحة ومتوازنة مناسبة للقيادة النهارية',
  },
  {
    id: 'urgent_dispatch',
    labelAr: 'تنبيه طوارئ عالي الوضوح',
    descriptionAr: 'نغمة مزدوجة بارزة للزحام والطرق السريعة',
  },
  {
    id: 'soft_bell',
    labelAr: 'رنة هادئة مريحة',
    descriptionAr: 'تنبيه لطيف ومنخفض التوتر في ساعات المساء',
  },
];

const SOUND_MUTED_STORAGE_KEY = 'mashwar_dispatch_sound_muted_v1';
const CAPTAIN_CUSTOM_SOUND_STORAGE_KEY = 'mashwar_captain_custom_sound_v1';

export function isDispatchSoundMuted(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SOUND_MUTED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDispatchSoundMuted(muted: boolean): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SOUND_MUTED_STORAGE_KEY, muted ? 'true' : 'false');
    }
  } catch {
    // Ignore storage error
  }
}

export function getCaptainCustomSound(): CaptainAlertSoundType {
  try {
    if (typeof window === 'undefined') return 'radar_pulse';
    const raw = window.localStorage.getItem(CAPTAIN_CUSTOM_SOUND_STORAGE_KEY);
    if (
      raw === 'radar_pulse' ||
      raw === 'bagour_chime' ||
      raw === 'urgent_dispatch' ||
      raw === 'soft_bell'
    ) {
      return raw;
    }
    return 'radar_pulse';
  } catch {
    return 'radar_pulse';
  }
}

export function setCaptainCustomSound(sound: CaptainAlertSoundType): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTAIN_CUSTOM_SOUND_STORAGE_KEY, sound);
    }
  } catch {
    // Ignore storage error
  }
}

export function triggerOrderCreatedVibration(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 60, 140]);
    }
  } catch {
    // Ignore unsupported vibration API
  }
}

function getCaptainTonePattern(profile: CaptainAlertSoundType): {
  freqs: number[];
  stepSec: number;
  durationSec: number;
  wave: OscillatorType;
  peakGain: number;
} {
  switch (profile) {
    case 'bagour_chime':
      return {
        freqs: [587.33, 739.99, 880.0, 1174.66],
        stepSec: 0.11,
        durationSec: 0.28,
        wave: 'sine',
        peakGain: 0.095,
      };
    case 'urgent_dispatch':
      return {
        freqs: [880.0, 1108.73, 880.0, 1108.73],
        stepSec: 0.12,
        durationSec: 0.22,
        wave: 'sawtooth',
        peakGain: 0.065,
      };
    case 'soft_bell':
      return {
        freqs: [523.25, 659.25],
        stepSec: 0.15,
        durationSec: 0.36,
        wave: 'sine',
        peakGain: 0.075,
      };
    case 'radar_pulse':
    default:
      return {
        freqs: [659.25, 880.0, 1046.5],
        stepSec: 0.095,
        durationSec: 0.25,
        wave: 'triangle',
        peakGain: 0.09,
      };
  }
}

function playSynthSequence(params: {
  freqs: number[];
  stepSec: number;
  durationSec: number;
  wave: OscillatorType;
  peakGain: number;
}): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    params.freqs.forEach((freq, idx) => {
      const startOffset = idx * params.stepSec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = params.wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(params.peakGain, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + params.durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + params.durationSec + 0.02);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 950);
    return true;
  } catch {
    return false;
  }
}

export function previewCaptainAlertSound(profile: CaptainAlertSoundType): boolean {
  const pattern = getCaptainTonePattern(profile);
  triggerOrderCreatedVibration();
  return playSynthSequence(pattern);
}

export function playDispatchChime(
  role: DispatchChimeRole = 'captain',
  overrideProfile?: CaptainAlertSoundType
): boolean {
  if (isDispatchSoundMuted()) return false;
  if (role === 'captain') {
    const profile = overrideProfile ?? getCaptainCustomSound();
    triggerOrderCreatedVibration();
    return playSynthSequence(getCaptainTonePattern(profile));
  }
  const freqs = role === 'merchant' ? [523.25, 659.25, 783.99] : [587.33, 880.0];
  return playSynthSequence({
    freqs,
    stepSec: 0.095,
    durationSec: 0.25,
    wave: 'sine',
    peakGain: 0.085,
  });
}
