import { describe, expect, it } from "vitest";
import {
  TOTAL_WORK_MINUTES,
  elapsedWorkMinutes,
  formatDuration,
  formatHm,
  isLunch,
  isWithinWorkHours,
  remainingWorkMinutes,
} from "./workHours";

function at(h: number, m = 0): Date {
  const d = new Date(2026, 5, 20, h, m, 0, 0);
  return d;
}

describe("workHours", () => {
  it("TOTAL_WORK_MINUTES は昼休みを除いた 8 時間 = 480 分", () => {
    expect(TOTAL_WORK_MINUTES).toBe(480);
  });

  it("isLunch: 12:00〜13:00 が昼休み", () => {
    expect(isLunch(at(11, 59))).toBe(false);
    expect(isLunch(at(12, 0))).toBe(true);
    expect(isLunch(at(12, 30))).toBe(true);
    expect(isLunch(at(13, 0))).toBe(false);
  });

  it("isWithinWorkHours: 稼働時間内判定（昼休み除く）", () => {
    expect(isWithinWorkHours(at(7, 30))).toBe(false);
    expect(isWithinWorkHours(at(9, 0))).toBe(true);
    expect(isWithinWorkHours(at(12, 30))).toBe(false); // 昼休み
    expect(isWithinWorkHours(at(16, 59))).toBe(true);
    expect(isWithinWorkHours(at(17, 0))).toBe(false);
  });

  it("remainingWorkMinutes: 始業前は満枠", () => {
    expect(remainingWorkMinutes(at(7, 0))).toBe(TOTAL_WORK_MINUTES);
  });

  it("remainingWorkMinutes: 終業後は 0", () => {
    expect(remainingWorkMinutes(at(18, 0))).toBe(0);
  });

  it("remainingWorkMinutes: 9:00 は昼休み60分を差し引く（8h - 1h経過 - 1h昼 = 6h=360分）", () => {
    // 9:00 → 17:00 まで 8h、うち昼休み 1h を除く = 7h = 420分
    expect(remainingWorkMinutes(at(9, 0))).toBe(420);
  });

  it("remainingWorkMinutes: 14:00（昼休み後）は昼休みを引かない", () => {
    // 14:00 → 17:00 = 3h = 180分（昼休みは既に過ぎている）
    expect(remainingWorkMinutes(at(14, 0))).toBe(180);
  });

  it("remainingWorkMinutes: 12:30（昼休み中）は昼休み残り30分を引く", () => {
    // 12:30 → 17:00 = 4h30m = 270分、昼休み残り 30 分を引く = 240分
    expect(remainingWorkMinutes(at(12, 30))).toBe(240);
  });

  it("elapsedWorkMinutes + remainingWorkMinutes = TOTAL", () => {
    const now = at(15, 0);
    expect(elapsedWorkMinutes(now) + remainingWorkMinutes(now)).toBe(
      TOTAL_WORK_MINUTES,
    );
  });

  it("formatHm: ゼロ埋め HH:MM", () => {
    expect(formatHm(at(9, 5))).toBe("09:05");
    expect(formatHm(at(16, 30))).toBe("16:30");
  });

  it("formatDuration: 分/時間表記", () => {
    expect(formatDuration(45)).toBe("45分");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(160)).toBe("2h40m");
    expect(formatDuration(-5)).toBe("0分");
  });
});
