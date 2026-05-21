import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ContextCollector ユニットテスト (DP-06: Secrets Manager キャッシュ)
 *
 * 実障の Secrets Manager 呼び出しを防ぐため AWS SDK をモック化する。
 */

// ─────────────────────────────────────────────
// モジュールモック
// ─────────────────────────────────────────────

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(() => ({ send: mockSend })),
  GetSecretValueCommand: vi.fn((input: unknown) => ({ input })),
}));

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("ContextCollector (getSlackToken)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // テスト間でモジュールキャッシュをリセット
    vi.resetModules();
    process.env["SLACK_TOKEN_SECRET_NAME"] = "saborou-slack-client-secret-test";
  });

  afterEach(() => {
    delete process.env["SLACK_TOKEN_SECRET_NAME"];
  });

  it("returns token from Secrets Manager on first call", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-test-token" });

    const { getSlackToken } = await import("../ContextCollector.js");
    const token = await getSlackToken();

    expect(token).toBe("xoxb-test-token");
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("returns cached token on second call (DP-06 cache hit)", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-test-token-cached" });

    const { getSlackToken } = await import("../ContextCollector.js");
    const first = await getSlackToken();
    const second = await getSlackToken();

    expect(first).toBe("xoxb-test-token-cached");
    expect(second).toBe("xoxb-test-token-cached");
    // getSlackToken() を 2 回呼び出しても Secrets Manager は 1 回のみ呼ばれる
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("throws when SLACK_TOKEN_SECRET_NAME is not set", async () => {
    delete process.env["SLACK_TOKEN_SECRET_NAME"];

    // 前のテストのキャッシュトークンをクリアするためモジュールをリセット
    const { getSlackToken, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    await expect(getSlackToken()).rejects.toThrow("SLACK_TOKEN_SECRET_NAME");
  });

  it("throws when SecretString is empty", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: undefined });

    const { getSlackToken, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    await expect(getSlackToken()).rejects.toThrow("no SecretString");
  });

  it("ContextCollector class delegates to getSlackToken()", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-class-token" });

    const { ContextCollector, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    const collector = new ContextCollector();
    const token = await collector.getSlackToken();

    expect(token).toBe("xoxb-class-token");
  });
});
