import { describe, expect, it } from "vitest";
import {
  RECOVERY_CHECK_DEMO_FALLBACK_MS,
  RECOVERY_CHECK_OFFSET_MINUTES,
  computeRecoveryCheckWhen,
  formatRecoveryCheckTime,
} from "./recoveryCheck";

describe("recoveryCheck scheduling", () => {
  it("タスク開始+5分の時刻を返す", () => {
    const now = new Date("2026-06-24T10:00:00").getTime();
    expect(
      computeRecoveryCheckWhen("19:30", RECOVERY_CHECK_OFFSET_MINUTES, now),
    ).toBe(new Date("2026-06-24T19:35:00").getTime());
  });

  it("時刻を過ぎていたらデモ用にすぐ近い未来へフォールバックする", () => {
    const now = new Date("2026-06-24T20:00:00").getTime();
    expect(
      computeRecoveryCheckWhen("19:30", RECOVERY_CHECK_OFFSET_MINUTES, now),
    ).toBe(now + RECOVERY_CHECK_DEMO_FALLBACK_MS);
  });

  it("表示用ラベルを HH:mm で整形する", () => {
    const when = new Date("2026-06-24T19:35:00").getTime();
    expect(formatRecoveryCheckTime(when)).toBe("19:35");
  });
});
