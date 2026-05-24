/**
 * gamificationUtils — ゲーミフィケーション計算ユーティリティ ユニットテスト
 */
import { describe, expect, it } from "vitest";
import {
  calcSaboriGrade,
  getComboLabel,
  getComboMultiplier,
  getTitleInfo,
  getTitleProgress,
  isTitleChanged,
} from "../lib/gamificationUtils";

// ===== getTitleInfo =====

describe("getTitleInfo", () => {
  it("スコア0はAI見習いを返す", () => {
    const info = getTitleInfo(0);
    expect(info.titleKey).toBe("beginner");
    expect(info.title).toBe("AI見習い");
    expect(info.phase).toBe(1);
  });

  it("スコア20はAI見習いを返す（上限）", () => {
    const info = getTitleInfo(20);
    expect(info.titleKey).toBe("beginner");
  });

  it("スコア21はサボり常習者を返す", () => {
    const info = getTitleInfo(21);
    expect(info.titleKey).toBe("habitual");
    expect(info.phase).toBe(2);
  });

  it("スコア50は依存気味を返す", () => {
    const info = getTitleInfo(50);
    expect(info.titleKey).toBe("dependent");
    expect(info.phase).toBe(3);
  });

  it("スコア70はAI奴隷を返す", () => {
    const info = getTitleInfo(70);
    expect(info.titleKey).toBe("slave");
    expect(info.phase).toBe(4);
  });

  it("スコア100は存在する怠惰を返す", () => {
    const info = getTitleInfo(100);
    expect(info.titleKey).toBe("ultimate");
    expect(info.title).toBe("存在する怠惰");
  });

  it("スコアをクランプする（負の数は0として処理）", () => {
    const info = getTitleInfo(-10);
    expect(info.titleKey).toBe("beginner");
  });

  it("スコアをクランプする（100超は100として処理）", () => {
    const info = getTitleInfo(150);
    expect(info.titleKey).toBe("ultimate");
  });
});

// ===== getTitleProgress =====

describe("getTitleProgress", () => {
  it("スコア0のとき0を返す", () => {
    const progress = getTitleProgress(0);
    expect(progress).toBeCloseTo(0);
  });

  it("スコアが範囲の中間のとき0.5を返す", () => {
    // beginner: 0〜20 → スコア10で50%
    const progress = getTitleProgress(10);
    expect(progress).toBeCloseTo(0.5);
  });

  it("スコアが範囲の最大のとき1を返す", () => {
    const progress = getTitleProgress(20);
    expect(progress).toBeCloseTo(1);
  });
});

// ===== isTitleChanged =====

describe("isTitleChanged", () => {
  it("同じ称号の範囲内ではfalseを返す", () => {
    expect(isTitleChanged(5, 10)).toBe(false);
    expect(isTitleChanged(25, 35)).toBe(false);
  });

  it("称号が変わるときtrueを返す", () => {
    expect(isTitleChanged(20, 21)).toBe(true); // beginner→habitual
    expect(isTitleChanged(40, 41)).toBe(true); // habitual→dependent
    expect(isTitleChanged(60, 61)).toBe(true); // dependent→slave
    expect(isTitleChanged(80, 81)).toBe(true); // slave→ultimate
  });
});

// ===== calcSaboriGrade =====

describe("calcSaboriGrade", () => {
  it("must_doはEを返す", () => {
    expect(calcSaboriGrade({ verdict: "must_do" })).toBe("E");
  });

  it("borderlineはDを返す", () => {
    expect(calcSaboriGrade({ verdict: "borderline" })).toBe("D");
  });

  it("can_saboru + シグナル3以上はA以上を返す", () => {
    const grade = calcSaboriGrade({ verdict: "can_saboru", signalCount: 3 });
    expect(["A+", "A"].includes(grade)).toBe(true);
  });

  it("can_saboru + シグナル2はBを返す", () => {
    expect(calcSaboriGrade({ verdict: "can_saboru", signalCount: 2 })).toBe(
      "B",
    );
  });

  it("can_saboru + シグナル1はCを返す", () => {
    expect(calcSaboriGrade({ verdict: "can_saboru", signalCount: 1 })).toBe(
      "C",
    );
  });

  it("can_saboru + シグナル未指定はBを返す（デフォルト）", () => {
    expect(calcSaboriGrade({ verdict: "can_saboru" })).toBe("B");
  });
});

// ===== getComboMultiplier =====

describe("getComboMultiplier", () => {
  it("コンボ1は乗数1.0を返す", () => {
    expect(getComboMultiplier(1)).toBe(1.0);
  });

  it("コンボ2は乗数1.2を返す", () => {
    expect(getComboMultiplier(2)).toBe(1.2);
  });

  it("コンボ3は乗数1.5を返す", () => {
    expect(getComboMultiplier(3)).toBe(1.5);
  });

  it("コンボ5以上は乗数2.0を返す", () => {
    expect(getComboMultiplier(5)).toBe(2.0);
    expect(getComboMultiplier(10)).toBe(2.0);
  });
});

// ===== getComboLabel =====

describe("getComboLabel", () => {
  it("コンボ1はnullを返す", () => {
    expect(getComboLabel(1)).toBeNull();
  });

  it("コンボ2は'コンボ継続中！'を返す", () => {
    expect(getComboLabel(2)).toBe("コンボ継続中！");
  });

  it("コンボ3は'サボり三冠王！'を返す", () => {
    expect(getComboLabel(3)).toBe("サボり三冠王！");
  });

  it("コンボ5は'先延ばし無敵モード！'を返す", () => {
    expect(getComboLabel(5)).toBe("先延ばし無敵モード！");
  });
});
