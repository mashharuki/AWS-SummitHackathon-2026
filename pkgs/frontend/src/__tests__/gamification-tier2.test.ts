/**
 * ゲーミフィケーション Tier 2 テスト
 *
 * 施策3: SaboriStreakBadge（連続サボり記録）
 * 施策4: ManualProgressCard（本音取扱説明書の完成度ゲージ）
 * 施策5: AchievementSystem（サボり実績・称号システム）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ===== 施策3: ストリークシステム =====
import {
  type StreakState,
  getCurrentMilestone,
  getStreakLossMessage,
  updateStreak,
} from "../components/ui/SaboriStreakBadge";

// ===== 施策4: 取扱説明書ゲージ =====
import {
  MANUAL_STAGES,
  getManualStage,
  incrementManualProgress,
  loadManualProgress,
  saveManualProgress,
} from "../components/ui/ManualProgressCard";

// ===== 施策5: 実績システム =====
import {
  ACHIEVEMENTS,
  RARITY_STYLES,
  checkNewAchievements,
  loadUnlockedAchievements,
  unlockAchievement,
} from "../lib/achievementSystem";

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
// 施策3: SaboriStreakBadge テスト
// ============================================================

describe("getStreakLossMessage", () => {
  it("14日以上のとき14日メッセージを返す", () => {
    expect(getStreakLossMessage(14)).toBe(
      "今日サボらないと14日間の記録が消えます...",
    );
    expect(getStreakLossMessage(20)).toBe(
      "今日サボらないと14日間の記録が消えます...",
    );
  });

  it("7〜13日のとき7日メッセージを返す", () => {
    expect(getStreakLossMessage(7)).toBe(
      "今日サボらないと7日間の記録が消えます...",
    );
    expect(getStreakLossMessage(13)).toBe(
      "今日サボらないと7日間の記録が消えます...",
    );
  });

  it("3〜6日のとき3日メッセージを返す", () => {
    expect(getStreakLossMessage(3)).toBe(
      "今日サボらないと3日間の記録が消えます...",
    );
    expect(getStreakLossMessage(6)).toBe(
      "今日サボらないと3日間の記録が消えます...",
    );
  });

  it("2日以下のときnullを返す", () => {
    expect(getStreakLossMessage(2)).toBeNull();
    expect(getStreakLossMessage(0)).toBeNull();
  });
});

describe("getCurrentMilestone", () => {
  it("0日のときnullを返す（マイルストーン未達）", () => {
    expect(getCurrentMilestone(0)).toBeNull();
  });

  it("2日のときnullを返す（3日未満）", () => {
    expect(getCurrentMilestone(2)).toBeNull();
  });

  it("3日のとき3日マイルストーンを返す", () => {
    const m = getCurrentMilestone(3);
    expect(m).not.toBeNull();
    expect(m?.days).toBe(3);
    expect(m?.label).toBe("先延ばし継続中！");
  });

  it("7日のとき7日マイルストーンを返す（最高達成済み）", () => {
    const m = getCurrentMilestone(7);
    expect(m?.days).toBe(7);
    expect(m?.label).toBe("サボり週間達成！");
  });

  it("14日のとき14日マイルストーンを返す", () => {
    const m = getCurrentMilestone(14);
    expect(m?.days).toBe(14);
    expect(m?.label).toBe("慢性的先延ばし者");
  });

  it("20日のとき14日マイルストーンを返す（最高マイルストーン）", () => {
    const m = getCurrentMilestone(20);
    expect(m?.days).toBe(14);
  });
});

describe("updateStreak", () => {
  it("初回サボりでdays=1になる", () => {
    const initial: StreakState = {
      days: 0,
      lastSaboriDate: null,
      bestStreak: 0,
    };
    const result = updateStreak(initial);
    expect(result.days).toBe(1);
    expect(result.bestStreak).toBe(1);
    expect(result.lastSaboriDate).not.toBeNull();
  });

  it("翌日サボるとストリーク継続", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const initial: StreakState = {
      days: 5,
      lastSaboriDate: yesterday.toISOString().slice(0, 10),
      bestStreak: 5,
    };
    const result = updateStreak(initial);
    expect(result.days).toBe(6);
    expect(result.bestStreak).toBe(6);
  });

  it("同日は変更なし", () => {
    const today = new Date().toISOString().slice(0, 10);
    const initial: StreakState = {
      days: 3,
      lastSaboriDate: today,
      bestStreak: 3,
    };
    const result = updateStreak(initial);
    expect(result.days).toBe(3);
  });

  it("2日以上空いたらリセット（ベスト記録は保持）", () => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const initial: StreakState = {
      days: 10,
      lastSaboriDate: twoDaysAgo.toISOString().slice(0, 10),
      bestStreak: 10,
    };
    const result = updateStreak(initial);
    expect(result.days).toBe(1);
    expect(result.bestStreak).toBe(10); // ベスト記録は維持
  });
});

// ============================================================
// 施策4: ManualProgressCard テスト
// ============================================================

describe("getManualStage", () => {
  it("0%のとき「真っ白」ステージを返す", () => {
    const s = getManualStage(0);
    expect(s.label).toBe("取扱説明書：真っ白");
  });

  it("30%のとき「傾向が見えてきた」ステージを返す", () => {
    const s = getManualStage(30);
    expect(s.threshold).toBe(30);
  });

  it("60%のとき「行動パターンが把握」ステージを返す", () => {
    const s = getManualStage(60);
    expect(s.threshold).toBe(60);
  });

  it("90%のとき「何でも知っています」ステージを返す", () => {
    const s = getManualStage(90);
    expect(s.threshold).toBe(90);
  });

  it("100%のとき「完全なるAI依存完成」ステージを返す", () => {
    const s = getManualStage(100);
    expect(s.threshold).toBe(100);
    expect(s.label).toContain("完全なるAI依存完成");
  });

  it("中間値（45%）は直前のステージを返す", () => {
    const s = getManualStage(45);
    expect(s.threshold).toBe(30);
  });
});

describe("incrementManualProgress", () => {
  it("3%増加する", () => {
    expect(incrementManualProgress(0)).toBe(3);
    expect(incrementManualProgress(50)).toBe(53);
  });

  it("100を超えない", () => {
    expect(incrementManualProgress(99)).toBe(100);
    expect(incrementManualProgress(100)).toBe(100);
  });
});

describe("saveManualProgress / loadManualProgress", () => {
  it("保存した値を正しく読み込む", () => {
    saveManualProgress(42);
    expect(loadManualProgress()).toBe(42);
  });

  it("未保存のとき0を返す", () => {
    expect(loadManualProgress()).toBe(0);
  });

  it("範囲外の値をクランプする", () => {
    saveManualProgress(150);
    expect(loadManualProgress()).toBe(100);
  });
});

describe("MANUAL_STAGES", () => {
  it("5ステージ定義されている", () => {
    expect(MANUAL_STAGES).toHaveLength(5);
  });

  it("閾値が昇順になっている", () => {
    const thresholds = MANUAL_STAGES.map((s) => s.threshold);
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i]).toBeGreaterThan(thresholds[i - 1]);
    }
  });
});

// ============================================================
// 施策5: AchievementSystem テスト
// ============================================================

describe("ACHIEVEMENTS", () => {
  it("9個の実績が定義されている", () => {
    expect(Object.keys(ACHIEVEMENTS)).toHaveLength(9);
  });

  it("全実績にrarity・emoji・titleが存在する", () => {
    for (const ach of Object.values(ACHIEVEMENTS)) {
      expect(ach.rarity).toBeTruthy();
      expect(ach.emoji).toBeTruthy();
      expect(ach.title).toBeTruthy();
    }
  });

  it("LEGENDARY 実績が存在する", () => {
    const legendary = Object.values(ACHIEVEMENTS).filter(
      (a) => a.rarity === "legendary",
    );
    expect(legendary.length).toBeGreaterThan(0);
  });
});

describe("RARITY_STYLES", () => {
  it("4種類のレアリティが定義されている", () => {
    expect(Object.keys(RARITY_STYLES)).toHaveLength(4);
  });
});

describe("checkNewAchievements", () => {
  it("first_saboriはverdict指定時にトリガーされる", () => {
    const ids = checkNewAchievements({ verdict: "can_saboru" });
    expect(ids).toContain("first_sabori");
  });

  it("ai_trustedはcan_saboruでトリガーされる", () => {
    const ids = checkNewAchievements({ verdict: "can_saboru" });
    expect(ids).toContain("ai_trusted");
  });

  it("ai_trustedはmust_doでトリガーされない", () => {
    const ids = checkNewAchievements({ verdict: "must_do" });
    expect(ids).not.toContain("ai_trusted");
  });

  it("streak_3daysは3日以上でトリガーされる", () => {
    const ids = checkNewAchievements({ streakDays: 3 });
    expect(ids).toContain("streak_3days");
  });

  it("streak_3daysは2日以下でトリガーされない", () => {
    const ids = checkNewAchievements({ streakDays: 2 });
    expect(ids).not.toContain("streak_3days");
  });

  it("midnight_saboriは深夜0〜4時 + verdictでトリガーされる", () => {
    const ids = checkNewAchievements({ verdict: "can_saboru", nowHour: 2 });
    expect(ids).toContain("midnight_sabori");
  });

  it("midnight_saboriは昼間はトリガーされない", () => {
    const ids = checkNewAchievements({ verdict: "can_saboru", nowHour: 12 });
    expect(ids).not.toContain("midnight_sabori");
  });

  it("ai_slaveは依存度80以上でトリガーされる", () => {
    const ids = checkNewAchievements({ dependencyScore: 80 });
    expect(ids).toContain("ai_slave");
  });

  it("ai_slaveは79以下でトリガーされない", () => {
    const ids = checkNewAchievements({ dependencyScore: 79 });
    expect(ids).not.toContain("ai_slave");
  });

  it("manual_completeは依存度100でトリガーされる", () => {
    const ids = checkNewAchievements({ dependencyScore: 100 });
    expect(ids).toContain("manual_complete");
  });

  it("honne_masterはmanualProgress100でトリガーされる", () => {
    const ids = checkNewAchievements({ manualProgress: 100 });
    expect(ids).toContain("honne_master");
  });

  it("combo_kingはコンボ5以上でトリガーされる", () => {
    const ids = checkNewAchievements({ comboCount: 5 });
    expect(ids).toContain("combo_king");
  });

  it("jackpotはisJackpot=trueでトリガーされる", () => {
    const ids = checkNewAchievements({ isJackpot: true });
    expect(ids).toContain("jackpot");
  });

  it("verdictなしのとき first_sabori はトリガーされない", () => {
    const ids = checkNewAchievements({ dependencyScore: 50 });
    expect(ids).not.toContain("first_sabori");
  });
});

describe("unlockAchievement", () => {
  it("新規アンロックでisNew=trueを返す", () => {
    const { isNew, next } = unlockAchievement("first_sabori", []);
    expect(isNew).toBe(true);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("first_sabori");
  });

  it("既にアンロック済みのときisNew=falseを返す", () => {
    const existing = [
      { id: "first_sabori" as const, unlockedAt: "2026-05-23T00:00:00Z" },
    ];
    const { isNew, next } = unlockAchievement("first_sabori", existing);
    expect(isNew).toBe(false);
    expect(next).toHaveLength(1); // 増えない
  });

  it("複数の実績を順番にアンロックできる", () => {
    let current: ReturnType<typeof loadUnlockedAchievements> = [];
    const ids = ["first_sabori", "ai_trusted", "streak_3days"] as const;
    for (const id of ids) {
      const { next } = unlockAchievement(id, current);
      current = next;
    }
    expect(current).toHaveLength(3);
  });
});

describe("loadUnlockedAchievements", () => {
  it("未保存のとき空配列を返す", () => {
    expect(loadUnlockedAchievements()).toEqual([]);
  });
});
