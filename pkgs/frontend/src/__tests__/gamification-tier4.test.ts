/**
 * ゲーミフィケーション Tier 4 テスト
 *
 * 施策C: GuildMockCard・PvPMockCard（ソーシャルUIモック）
 * 施策D: SoundManager（音響設計）
 * 施策E: WeeklyChallengeCard・SeasonBanner（週次サイクル・シーズン）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ===== localStorage モック =====
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ============================================================
// 施策E: WeeklyChallengeCard ユーティリティテスト
// ============================================================

import {
  WEEKLY_CHALLENGES,
  type WeeklyChallengeProgress,
  getCurrentWeekChallenge,
  getTimeRemainingText,
  incrementChallengeProgress,
  loadChallengeProgress,
  saveChallengeProgress,
} from "../components/ui/WeeklyChallengeCard";

describe("WEEKLY_CHALLENGES", () => {
  it("5つのチャレンジが定義されている", () => {
    expect(WEEKLY_CHALLENGES).toHaveLength(5);
  });

  it("全チャレンジにid・title・target・emojiが存在する", () => {
    for (const c of WEEKLY_CHALLENGES) {
      expect(c.id).toBeTruthy();
      expect(c.title).toBeTruthy();
      expect(c.target).toBeGreaterThan(0);
      expect(c.emoji).toBeTruthy();
    }
  });

  it("各チャレンジのtargetが正の整数", () => {
    for (const c of WEEKLY_CHALLENGES) {
      expect(c.target).toBeGreaterThanOrEqual(1);
      expect(Number.isInteger(c.target)).toBe(true);
    }
  });
});

describe("getCurrentWeekChallenge", () => {
  it("WeeklyChallengeを返す（id・weekStartDateあり）", () => {
    const challenge = getCurrentWeekChallenge();
    expect(challenge.id).toBeTruthy();
    expect(challenge.weekStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(challenge.target).toBeGreaterThan(0);
  });

  it("WEEKLY_CHALLENGESのいずれかに一致するidを返す", () => {
    const challenge = getCurrentWeekChallenge();
    const ids = WEEKLY_CHALLENGES.map((c) => c.id);
    expect(ids).toContain(challenge.id);
  });
});

describe("loadChallengeProgress / saveChallengeProgress", () => {
  it("未保存のときdefault値を返す（current=0, completed=false）", () => {
    const progress = loadChallengeProgress();
    expect(progress.current).toBe(0);
    expect(progress.completed).toBe(false);
  });

  it("保存した値を正しく読み込む", () => {
    const challenge = getCurrentWeekChallenge();
    const progress: WeeklyChallengeProgress = {
      challengeId: challenge.id,
      current: 3,
      completed: false,
    };
    saveChallengeProgress(progress);
    const loaded = loadChallengeProgress();
    expect(loaded.current).toBe(3);
    expect(loaded.completed).toBe(false);
  });

  it("異なるchallenge IDの場合はリセットされる", () => {
    const progress: WeeklyChallengeProgress = {
      challengeId: "old_challenge_id_that_does_not_match",
      current: 5,
      completed: true,
    };
    saveChallengeProgress(progress);
    // 現在週のchallenge IDと違うのでリセット
    const loaded = loadChallengeProgress();
    expect(loaded.current).toBe(0);
  });
});

describe("incrementChallengeProgress", () => {
  it("進捗が1増加する", () => {
    const challenge = getCurrentWeekChallenge();
    const initial: WeeklyChallengeProgress = {
      challengeId: challenge.id,
      current: 0,
      completed: false,
    };
    saveChallengeProgress(initial);
    const result = incrementChallengeProgress();
    expect(result.current).toBe(1);
  });

  it("completed=trueのときは変化しない", () => {
    const challenge = getCurrentWeekChallenge();
    const completed: WeeklyChallengeProgress = {
      challengeId: challenge.id,
      current: challenge.target,
      completed: true,
    };
    saveChallengeProgress(completed);
    const result = incrementChallengeProgress();
    expect(result.current).toBe(challenge.target);
    expect(result.completed).toBe(true);
  });

  it("targetに達するとcompleted=trueになる", () => {
    const challenge = getCurrentWeekChallenge();
    const almostDone: WeeklyChallengeProgress = {
      challengeId: challenge.id,
      current: challenge.target - 1,
      completed: false,
    };
    saveChallengeProgress(almostDone);
    const result = incrementChallengeProgress();
    expect(result.completed).toBe(true);
    expect(result.current).toBe(challenge.target);
  });
});

describe("getTimeRemainingText", () => {
  it("文字列を返す", () => {
    const challenge = getCurrentWeekChallenge();
    const text = getTimeRemainingText(challenge);
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
  });

  it("「日曜日まであと」か「本日まで」か「明日まで」を含む", () => {
    const challenge = getCurrentWeekChallenge();
    const text = getTimeRemainingText(challenge);
    const isValid =
      text.includes("日曜日まであと") ||
      text === "本日まで" ||
      text === "明日まで";
    expect(isValid).toBe(true);
  });
});

// ============================================================
// 施策E: SeasonBanner ユーティリティテスト
// ============================================================

import {
  SEASONS,
  getCurrentSeason,
  getSeasonLimitedTitle,
} from "../components/ui/SeasonBanner";

describe("SEASONS", () => {
  it("12ヶ月分のシーズンが定義されている", () => {
    expect(SEASONS).toHaveLength(12);
  });

  it("全シーズンに必須フィールドが揃っている", () => {
    for (const s of SEASONS) {
      expect(s.month).toBeGreaterThanOrEqual(1);
      expect(s.month).toBeLessThanOrEqual(12);
      expect(s.name).toBeTruthy();
      expect(s.emoji).toBeTruthy();
      expect(s.tagline).toBeTruthy();
      expect(s.limitedTitle).toBeTruthy();
      expect(s.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(s.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("月番号が1〜12で重複なし", () => {
    const months = SEASONS.map((s) => s.month);
    const unique = new Set(months);
    expect(unique.size).toBe(12);
  });

  it("5月は「五月病シーズン」", () => {
    const may = SEASONS.find((s) => s.month === 5);
    expect(may?.name).toBe("五月病シーズン");
    expect(may?.limitedTitle).toBe("五月病チャンピオン");
  });
});

describe("getCurrentSeason", () => {
  it("現在月のシーズンを返す", () => {
    const season = getCurrentSeason();
    const currentMonth = new Date().getMonth() + 1;
    expect(season.month).toBe(currentMonth);
  });

  it("必須フィールドが揃っている", () => {
    const season = getCurrentSeason();
    expect(season.name).toBeTruthy();
    expect(season.emoji).toBeTruthy();
  });
});

describe("getSeasonLimitedTitle", () => {
  it("「限定称号: 」で始まる文字列を返す", () => {
    const season = getCurrentSeason();
    const title = getSeasonLimitedTitle(season);
    expect(title.startsWith("限定称号: ")).toBe(true);
    expect(title).toContain(season.limitedTitle);
  });

  it("全シーズンでgetSeasonLimitedTitleが動作する", () => {
    for (const season of SEASONS) {
      const title = getSeasonLimitedTitle(season);
      expect(title).toContain("限定称号: ");
      expect(title).toContain(season.limitedTitle);
    }
  });
});

// ============================================================
// 施策D: SoundManager テスト
// ============================================================

import {
  SOUND_STORAGE_KEY,
  isSoundEnabled,
  loadSoundConfig,
  playSound,
  saveSoundConfig,
} from "../lib/soundManager";

describe("loadSoundConfig / saveSoundConfig", () => {
  it("未保存のときデフォルト設定を返す（enabled=true, volume=0.5）", () => {
    const config = loadSoundConfig();
    expect(config.enabled).toBe(true);
    expect(config.volume).toBe(0.5);
  });

  it("保存した設定を正しく読み込む", () => {
    saveSoundConfig({ enabled: false, volume: 0.3 });
    const config = loadSoundConfig();
    expect(config.enabled).toBe(false);
    expect(config.volume).toBe(0.3);
  });

  it("部分的な設定でもデフォルトとマージされる", () => {
    localStorageMock.setItem(
      SOUND_STORAGE_KEY,
      JSON.stringify({ enabled: false }),
    );
    const config = loadSoundConfig();
    expect(config.enabled).toBe(false);
    expect(config.volume).toBe(0.5); // デフォルト値
  });
});

describe("isSoundEnabled", () => {
  it("デフォルトではtrueを返す", () => {
    expect(isSoundEnabled()).toBe(true);
  });

  it("OFFに設定するとfalseを返す", () => {
    saveSoundConfig({ enabled: false, volume: 0.5 });
    expect(isSoundEnabled()).toBe(false);
  });

  it("ONに設定するとtrueを返す", () => {
    saveSoundConfig({ enabled: true, volume: 0.8 });
    expect(isSoundEnabled()).toBe(true);
  });
});

describe("playSound - AudioContextなし環境でno-op", () => {
  it("AudioContextが未定義でもエラーにならない", () => {
    // テスト環境ではAudioContextが存在しないのでno-op
    expect(() => playSound("tap")).not.toThrow();
    expect(() => playSound("jackpot")).not.toThrow();
    expect(() => playSound("scoreUp")).not.toThrow();
    expect(() => playSound("titleUnlock")).not.toThrow();
    expect(() => playSound("comboUp")).not.toThrow();
    expect(() => playSound("streakLoss")).not.toThrow();
    expect(() => playSound("honneSend")).not.toThrow();
  });

  it("enabled=falseのときはno-op（エラーなし）", () => {
    saveSoundConfig({ enabled: false, volume: 0.5 });
    expect(() => playSound("jackpot")).not.toThrow();
  });

  it("volumeOverrideを渡してもエラーにならない", () => {
    expect(() => playSound("tap", 1.0)).not.toThrow();
    expect(() => playSound("tap", 0.0)).not.toThrow();
  });
});

// ============================================================
// Tier 4 統合チェック
// ============================================================

describe("Tier 4 統合チェック", () => {
  it("WeeklyChallenge + Season が同時に機能する", () => {
    const challenge = getCurrentWeekChallenge();
    const season = getCurrentSeason();

    expect(challenge.id).toBeTruthy();
    expect(season.month).toBeGreaterThanOrEqual(1);
    expect(season.month).toBeLessThanOrEqual(12);
  });

  it("challengeProgressが達成後でも安全にloadできる", () => {
    const challenge = getCurrentWeekChallenge();
    const completed: WeeklyChallengeProgress = {
      challengeId: challenge.id,
      current: challenge.target,
      completed: true,
    };
    saveChallengeProgress(completed);

    const loaded = loadChallengeProgress();
    expect(loaded.completed).toBe(true);
    expect(loaded.current).toBe(challenge.target);
  });

  it("SoundManagerのデフォルト設定が正しい", () => {
    const config = loadSoundConfig();
    expect(config.enabled).toBe(true);
    expect(config.volume).toBeGreaterThan(0);
    expect(config.volume).toBeLessThanOrEqual(1);
  });
});
