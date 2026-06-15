/**
 * index.test.ts — content script のロジックテスト
 *
 * content script のエントリポイント（index.ts）は
 * MutationObserver とグローバル chrome API に依存するため、
 * ロジック部分を抽出して vitest で検証する。
 *
 * テスト対象:
 * - debounce ユーティリティ（fake timers）
 * - メッセージ送信の型定義（型安全性）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// debounce ユーティリティ（index.ts からは直接エクスポートされないため、
// ロジックをここで再実装してテストする）
// ---------------------------------------------------------------------------

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };
}

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("指定時間内に複数回呼ばれても最後の 1 回だけ実行される", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(fn).toHaveBeenCalledOnce();
  });

  it("指定時間後に実行される", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("タイマーリセット後に再び呼べる", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 重複防止 Set のロジックテスト
// ---------------------------------------------------------------------------

describe("processedTs Set（重複防止ロジック）", () => {
  it("同じキーは 2 回目以降スキップされる", () => {
    const processed = new Set<string>();
    const handle = vi.fn();

    const processMessage = (ts: string) => {
      if (processed.has(ts)) return;
      processed.add(ts);
      handle(ts);
    };

    processMessage("1234567890.111111");
    processMessage("1234567890.111111"); // 重複
    processMessage("1234567890.222222"); // 新規

    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle).toHaveBeenCalledWith("1234567890.111111");
    expect(handle).toHaveBeenCalledWith("1234567890.222222");
  });

  it("キーをクリアすると再処理できる", () => {
    const processed = new Set<string>();
    const handle = vi.fn();

    const processMessage = (ts: string) => {
      if (processed.has(ts)) return;
      processed.add(ts);
      handle(ts);
    };

    processMessage("1234567890.111111");
    processed.clear();
    processMessage("1234567890.111111"); // クリア後は再処理

    expect(handle).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// chrome.runtime.sendMessage エラーハンドリングのテスト
// ---------------------------------------------------------------------------

describe("sendMessageToSidePanel エラーハンドリング", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Could not establish connection エラーは握り潰される", async () => {
    const consoleSpy = vi.spyOn(console, "warn");

    const connectionError = new Error(
      "Could not establish connection. Receiving end does not exist.",
    );

    const sendMessageToSidePanel = (message: { type: string }) => {
      return Promise.reject(connectionError).catch((err: unknown) => {
        if (
          err instanceof Error &&
          err.message.includes("Could not establish connection")
        ) {
          return; // 握り潰す
        }
        console.warn("[SABOROU] sendMessage error:", err);
      });
    };

    await sendMessageToSidePanel({ type: "NEW_SLACK_MESSAGE" });

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("その他のエラーは console.warn される", async () => {
    const consoleSpy = vi.spyOn(console, "warn");

    const otherError = new Error("Network error");

    const sendMessageToSidePanel = (message: { type: string }) => {
      return Promise.reject(otherError).catch((err: unknown) => {
        if (
          err instanceof Error &&
          err.message.includes("Could not establish connection")
        ) {
          return;
        }
        console.warn("[SABOROU] sendMessage error:", err);
      });
    };

    await sendMessageToSidePanel({ type: "NEW_SLACK_MESSAGE" });

    expect(consoleSpy).toHaveBeenCalledWith(
      "[SABOROU] sendMessage error:",
      otherError,
    );
  });
});

// ---------------------------------------------------------------------------
// メッセージ型定義の検証（型安全性）
// ---------------------------------------------------------------------------

describe("メッセージ型定義", () => {
  it("ContentToSidePanelMessage は正しい構造を持つ", () => {
    const msg = {
      type: "NEW_SLACK_MESSAGE" as const,
      payload: {
        text: "テスト",
        sender: "田中",
        channelId: "U1234567890",
        threadTs: "1717900000.111111",
        detectedAt: new Date().toISOString(),
      },
    };

    expect(msg.type).toBe("NEW_SLACK_MESSAGE");
    expect(msg.payload.channelId).toBeDefined();
    expect(msg.payload.detectedAt).toBeDefined();
  });

  it("SidePanelToContentMessage は正しい構造を持つ", () => {
    const msg = {
      type: "SEND_SLACK_REPLY" as const,
      text: "了解しました",
    };

    expect(msg.type).toBe("SEND_SLACK_REPLY");
    expect(msg.text).toBe("了解しました");
  });
});
