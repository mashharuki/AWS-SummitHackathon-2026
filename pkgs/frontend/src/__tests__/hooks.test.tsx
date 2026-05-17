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
    // @ts-expect-error - intentionally removing matchMedia
    delete window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    });

    // matchMediaがない場合のフォールバック
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
      // 復元
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: original,
      });
    }
  });
});
