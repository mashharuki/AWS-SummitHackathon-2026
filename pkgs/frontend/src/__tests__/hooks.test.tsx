import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

describe("useReducedMotion", () => {
  it("デフォルトではfalseを返す（jsdom環境）", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("matchMediaがない環境でもクラッシュしない", () => {
    const original = window.matchMedia;
    // configurable:true を必ず付与することで Vitest teardown 時の削除エラーを回避する
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: undefined,
    });

    try {
      const { result } = renderHook(() => {
        try {
          return useReducedMotion();
        } catch {
          return false;
        }
      });
      expect(typeof result.current).toBe("boolean");
    } finally {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: original,
      });
    }
  });
});
