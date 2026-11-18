export type DispatchChimeRole = 'captain' | 'merchant' | 'customer';

const SOUND_MUTED_STORAGE_KEY = 'mashwar_dispatch_sound_muted_v1';

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

export function playDispatchChime(role: DispatchChimeRole = 'captain'): boolean {
  if (isDispatchSoundMuted()) return false;
  try {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const freqs =
      role === 'captain'
        ? [659.25, 880.0, 1046.5] // E5 -> A5 -> C6 energetic radar chime
        : role === 'merchant'
        ? [523.25, 659.25, 783.99] // C5 -> E5 -> G5 pleasant merchant order bell
        : [587.33, 880.0]; // D5 -> A5 customer update chime

    freqs.forEach((freq, idx) => {
      const startOffset = idx * 0.095;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = role === 'captain' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.085, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + 0.25);
    });

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
    return true;
  } catch {
    return false;
  }
}
