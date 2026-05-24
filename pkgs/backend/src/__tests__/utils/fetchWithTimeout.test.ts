/**
 * fetchWithTimeout ユーティリティのテスト
 *
 * テスト内容:
 * - 正常系: レスポンスをそのまま返す
 * - タイムアウト: AbortError をスローする
 * - カスタムタイムアウト: 指定した時間でタイムアウトする
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout.js";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("正常系: fetch が成功した場合はレスポンスをそのまま返す", async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse),
    );

    const result = await fetchWithTimeout("https://example.com/api");
    expect(result).toBe(mockResponse);
  });

  it("オプション付き fetch: headers 等を正しく渡す", async () => {
    const mockResponse = { ok: true, status: 200 } as Response;
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", mockFetch);

    await fetchWithTimeout(
      "https://example.com/api",
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("タイムアウト: 時間内に完了しない fetch は AbortError をスローする", async () => {
    vi.useFakeTimers();
    const mockFetch = vi.fn().mockImplementation(
      (_input: unknown, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          const signal = (init as RequestInit)?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const fetchPromise = fetchWithTimeout("https://example.com/slow", {}, 100);
    vi.advanceTimersByTime(150);

    await expect(fetchPromise).rejects.toMatchObject({ name: "AbortError" });
  });
});
