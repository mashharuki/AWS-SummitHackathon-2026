/**
 * soundManager — Web Audio API 音響設計
 *
 * SABOROUの効果音をWeb Audio APIで合成する。
 * 音声ファイル不要。ユーザーインタラクション後のみ動作。
 *
 * Octalysis:
 *   3（創造・フィードバック）: 多感覚フィードバック
 *   7（予測不能）: A+ファンファーレの驚き
 */

export type SoundType =
  | "tap"
  | "scoreUp"
  | "jackpot"
  | "titleUnlock"
  | "comboUp"
  | "streakLoss"
  | "honneSend";

export interface SoundManagerConfig {
  enabled: boolean;
  volume: number; // 0.0 - 1.0
}

export const SOUND_STORAGE_KEY = "saborou_sound_config";

const DEFAULT_CONFIG: SoundManagerConfig = {
  enabled: true,
  volume: 0.5,
};

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function loadSoundConfig(): SoundManagerConfig {
  try {
    const stored = localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored) {
      return {
        ...DEFAULT_CONFIG,
        ...(JSON.parse(stored) as Partial<SoundManagerConfig>),
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_CONFIG };
}

export function saveSoundConfig(config: SoundManagerConfig): void {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function isSoundEnabled(): boolean {
  return loadSoundConfig().enabled;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playSound(type: SoundType, volumeOverride?: number): void {
  const config = loadSoundConfig();
  if (!config.enabled) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const vol = (volumeOverride ?? config.volume) * 0.3;
  const now = ctx.currentTime;

  switch (type) {
    case "tap":
      playTone(ctx, 800, now, 0.05, vol, "sine");
      playTone(ctx, 400, now + 0.03, 0.05, vol * 0.5, "sine");
      break;

    case "scoreUp":
      playTone(ctx, 523, now, 0.1, vol, "sine");
      playTone(ctx, 659, now + 0.1, 0.1, vol, "sine");
      playTone(ctx, 784, now + 0.2, 0.15, vol, "sine");
      break;

    case "jackpot": {
      const notes = [262, 330, 392, 523, 659];
      notes.forEach((freq, i) => {
        playTone(ctx, freq, now + i * 0.12, 0.2, vol, "square");
      });
      break;
    }

    case "titleUnlock":
      playTone(ctx, 440, now, 0.2, vol, "sine");
      playTone(ctx, 880, now + 0.2, 0.4, vol * 1.2, "sine");
      break;

    case "comboUp":
      playTone(ctx, 660, now, 0.1, vol, "sine");
      playTone(ctx, 880, now + 0.1, 0.15, vol, "sine");
      break;

    case "streakLoss":
      playTone(ctx, 440, now, 0.15, vol, "sine");
      playTone(ctx, 220, now + 0.15, 0.15, vol * 0.8, "sine");
      playTone(ctx, 110, now + 0.3, 0.2, vol * 0.6, "sine");
      break;

    case "honneSend":
      playTone(ctx, 392, now, 0.15, vol * 0.7, "sine");
      break;

    default:
      break;
  }
}
