/**
 * ゲーミフィケーション Tier 5 テスト
 *
 * 施策F: OnboardingModal サボり適性クイズ
 * Tier 4 統合: WeeklyChallenge + Season + SoundManager
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
// 施策F: OnboardingModal サボり適性クイズ
// ============================================================

import {
  QUIZ_QUESTIONS,
  calcSaboriAptitude,
  getAptitudeComparisonText,
} from "../components/OnboardingModal";

describe("QUIZ_QUESTIONS", () => {
  it("5問定義されている", () => {
    expect(QUIZ_QUESTIONS).toHaveLength(5);
  });

  it("全問に question と options が存在する", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.question).toBeTruthy();
      expect(q.options).toHaveLength(3);
    }
  });

  it("全選択肢に label と point が存在する", () => {
    for (const q of QUIZ_QUESTIONS) {
      for (const opt of q.options) {
        expect(opt.label).toBeTruthy();
        expect(opt.point).toBeGreaterThanOrEqual(1);
        expect(opt.point).toBeLessThanOrEqual(3);
      }
    }
  });

  it("各問の選択肢のポイントが1,2,3の組み合わせになっている", () => {
    for (const q of QUIZ_QUESTIONS) {
      const points = q.options.map((o) => o.point).sort();
      expect(points).toEqual([1, 2, 3]);
    }
  });
});

describe("calcSaboriAptitude", () => {
  it("全A（3点）回答で高いスコアになる", () => {
    const allA = Array(QUIZ_QUESTIONS.length).fill(3);
    const score = calcSaboriAptitude(allA);
    expect(score).toBe(100);
  });

  it("全C（1点）回答で低いスコアになる", () => {
    const allC = Array(QUIZ_QUESTIONS.length).fill(1);
    const score = calcSaboriAptitude(allC);
    expect(score).toBe(Math.round((5 / 15) * 100));
  });

  it("混合回答でスコアが正しく計算される", () => {
    // [3, 2, 3, 1, 2] = 11点 / 15点 = 73%
    const mixed = [3, 2, 3, 1, 2];
    const score = calcSaboriAptitude(mixed);
    expect(score).toBe(Math.round((11 / 15) * 100));
  });

  it("0〜100の範囲に収まる", () => {
    const allMax = Array(QUIZ_QUESTIONS.length).fill(3);
    const allMin = Array(QUIZ_QUESTIONS.length).fill(1);
    expect(calcSaboriAptitude(allMax)).toBeLessThanOrEqual(100);
    expect(calcSaboriAptitude(allMin)).toBeGreaterThanOrEqual(0);
  });

  it("整数を返す", () => {
    const answers = [3, 2, 1, 3, 2];
    const score = calcSaboriAptitude(answers);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe("getAptitudeComparisonText", () => {
  it("80%以上で「大幅に高い」テキストを返す", () => {
    const text = getAptitudeComparisonText(80);
    expect(text).toContain("大幅に高い");
  });

  it("80%超で「大幅に高い」テキストを返す", () => {
    const text = getAptitudeComparisonText(95);
    expect(text).toContain("大幅に高い");
  });

  it("65〜79%で「より高い」テキストを返す", () => {
    const text = getAptitudeComparisonText(70);
    expect(text).toContain("より高い");
  });

  it("55〜64%で「同じくらい」テキストを返す", () => {
    const text = getAptitudeComparisonText(60);
    expect(text).toContain("同じくらい");
  });

  it("54%以下で「より低め」テキストを返す", () => {
    const text = getAptitudeComparisonText(40);
    expect(text).toContain("より低め");
  });

  it("全ての境界値でテキストが返る", () => {
    const scores = [0, 33, 54, 55, 64, 65, 79, 80, 100];
    for (const score of scores) {
      const text = getAptitudeComparisonText(score);
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Tier 4 + Tier 5 統合テスト
// ============================================================

import {
  getCurrentSeason,
  SEASONS,
  getSeasonLimitedTitle,
} from "../components/ui/SeasonBanner";

import {
  getCurrentWeekChallenge,
  incrementChallengeProgress,
  saveChallengeProgress,
} from "../components/ui/WeeklyChallengeCard";

import {
  isSoundEnabled,
  loadSoundConfig,
  saveSoundConfig,
} from "../lib/soundManager";

describe("シーズン網羅テスト", () => {
  it("1〜12月全てのシーズンが定義されている", () => {
    const months = SEASONS.map((s) => s.month);
    for (let m = 1; m <= 12; m++) {
      expect(months).toContain(m);
    }
  });

  it("全シーズンの必須フィールドが揃っている", () => {
    for (const season of SEASONS) {
      expect(season.name).toBeTruthy();
      expect(season.emoji).toBeTruthy();
      expect(season.tagline).toBeTruthy();
      expect(season.limitedTitle).toBeTruthy();
      expect(season.color).toBeTruthy();
      expect(season.bg).toBeTruthy();
    }
  });

  it("各月に対してgetCurrentSeasonが動作する（モック不要、現在月での動作確認）", () => {
    const season = getCurrentSeason();
    const currentMonth = new Date().getMonth() + 1;
    expect(season.month).toBe(currentMonth);
    expect(season.name).toBeTruthy();
  });

  it("getSeasonLimitedTitleが12ヶ月全てで動作する", () => {
    for (const season of SEASONS) {
      const title = getSeasonLimitedTitle(season);
      expect(title.startsWith("限定称号: ")).toBe(true);
    }
  });
});

describe("SoundManager 設定の永続化", () => {
  it("設定をOFFにすると保存される", () => {
    saveSoundConfig({ enabled: false, volume: 0.5 });
    expect(isSoundEnabled()).toBe(false);
  });

  it("設定をONにすると保存される", () => {
    saveSoundConfig({ enabled: true, volume: 0.8 });
    expect(isSoundEnabled()).toBe(true);
  });

  it("volume設定が保存される", () => {
    saveSoundConfig({ enabled: true, volume: 0.3 });
    const config = loadSoundConfig();
    expect(config.volume).toBe(0.3);
  });

  it("enabled設定が保存される", () => {
    saveSoundConfig({ enabled: false, volume: 0.5 });
    const config = loadSoundConfig();
    expect(config.enabled).toBe(false);
  });
});

describe("WeeklyChallenge + Season 同時動作", () => {
  it("getCurrentWeekChallengeとgetCurrentSeasonが同時に動作する", () => {
    const challenge = getCurrentWeekChallenge();
    const season = getCurrentSeason();

    expect(challenge.id).toBeTruthy();
    expect(season.name).toBeTruthy();
    expect(typeof challenge.target).toBe("number");
    expect(typeof season.month).toBe("number");
  });

  it("challengeProgressが100%以上で達成済みになる", () => {
    const challenge = getCurrentWeekChallenge();
    // target - 1 まで進捗を設定
    saveChallengeProgress({
      challengeId: challenge.id,
      current: challenge.target - 1,
      completed: false,
    });
    const result = incrementChallengeProgress();
    expect(result.completed).toBe(true);
  });
});

describe("OnboardingModal クイズ + ゲーミフィケーション連携確認", () => {
  it("クイズ最大スコア（全A=100%）はAI依存度最高と対応する", () => {
    const maxScore = calcSaboriAptitude(Array(QUIZ_QUESTIONS.length).fill(3));
    expect(maxScore).toBe(100);
    // AI依存度100% = 「存在する怠惰」称号と対応
  });

  it("クイズ最小スコア（全C）でもゲームは始められる", () => {
    const minScore = calcSaboriAptitude(Array(QUIZ_QUESTIONS.length).fill(1));
    expect(minScore).toBeGreaterThanOrEqual(0);
    expect(minScore).toBeLessThanOrEqual(100);
  });

  it("クイズスコアが整数で計算されている", () => {
    const testCases = [
      [3, 3, 3, 3, 3],
      [1, 1, 1, 1, 1],
      [2, 2, 2, 2, 2],
      [3, 2, 1, 3, 2],
    ];
    for (const answers of testCases) {
      expect(Number.isInteger(calcSaboriAptitude(answers))).toBe(true);
    }
  });
});
