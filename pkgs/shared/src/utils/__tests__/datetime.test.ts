import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  formatDeadline,
  isOverdue,
  minutesUntil,
  toIsoString,
} from "../datetime";

describe("formatDeadline", () => {
  beforeEach(() => {
    // Fix current time to 2026-05-17T06:00:00Z (15:00 JST)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return '締切なし' for null", () => {
    expect(formatDeadline(null)).toBe("締切なし");
  });

  it("should return '今日 HH:mm' for same day deadline", () => {
    // 2026-05-17T10:00:00Z = 19:00 JST (same day)
    const result = formatDeadline("2026-05-17T10:00:00Z");
    expect(result).toMatch(/^今日 \d{2}:\d{2}$/);
    expect(result).toContain("今日");
  });

  it("should return '明日 HH:mm' for next day deadline", () => {
    // 2026-05-18T10:00:00Z = 19:00 JST next day
    const result = formatDeadline("2026-05-18T10:00:00Z");
    expect(result).toMatch(/^明日 \d{2}:\d{2}$/);
    expect(result).toContain("明日");
  });

  it("should return 'M月D日 HH:mm' for 2+ days later", () => {
    // 2026-05-20T10:00:00Z = 2+ days later
    const result = formatDeadline("2026-05-20T10:00:00Z");
    expect(result).toMatch(/\d+月\d+日/);
    expect(result).not.toContain("今日");
    expect(result).not.toContain("明日");
  });

  it("should return time in HH:mm format", () => {
    const result = formatDeadline("2026-05-17T10:30:00Z");
    // Should contain time portion
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("minutesUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return positive minutes for future datetime", () => {
    const future = "2026-05-17T07:00:00Z"; // 60 minutes later
    expect(minutesUntil(future)).toBe(60);
  });

  it("should return negative minutes for past datetime", () => {
    const past = "2026-05-17T05:00:00Z"; // 60 minutes ago
    expect(minutesUntil(past)).toBe(-60);
  });

  it("should return 0 for current time", () => {
    const now = "2026-05-17T06:00:00Z";
    expect(minutesUntil(now)).toBe(0);
  });

  it("should handle fractional minutes by flooring", () => {
    const future = "2026-05-17T06:01:30Z"; // 1.5 minutes later
    expect(minutesUntil(future)).toBe(1); // floored
  });
});

describe("isOverdue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T06:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return false for future deadline", () => {
    expect(isOverdue("2026-05-17T07:00:00Z")).toBe(false);
  });

  it("should return true for past deadline", () => {
    expect(isOverdue("2026-05-17T05:00:00Z")).toBe(true);
  });

  it("should return false for exactly now (minutesUntil returns 0)", () => {
    expect(isOverdue("2026-05-17T06:00:00Z")).toBe(false);
  });
});

describe("toIsoString", () => {
  it("should return ISO 8601 format string", () => {
    const date = new Date("2026-05-17T06:00:00.000Z");
    const result = toIsoString(date);
    expect(result).toBe("2026-05-17T06:00:00.000Z");
  });

  it("should use current time when no date provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T06:00:00.000Z"));
    const result = toIsoString();
    expect(result).toBe("2026-05-17T06:00:00.000Z");
    vi.useRealTimers();
  });

  it("should return a valid ISO 8601 string", () => {
    const result = toIsoString(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});
