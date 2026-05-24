import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ContextCollector ユニットテスト (DP-06: Secrets Manager per-user キャッシュ)
 *
 * 実際の Secrets Manager 呼び出しを防ぐため AWS SDK をモック化する。
 */

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: vi.fn(() => ({ send: mockSend })),
  GetSecretValueCommand: vi.fn((input: unknown) => ({ input })),
}));

describe("ContextCollector (getSlackToken — per-user)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.SLACK_BOT_TOKEN_SECRET_PREFIX = "saborou/slack-bot-token/";
  });

  afterEach(() => {
    // biome-ignore lint/performance/noDelete: env var の真の削除には delete が必要
    delete process.env.SLACK_BOT_TOKEN_SECRET_PREFIX;
  });

  it("resolves the per-user secret name from prefix + userId", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-user-token" });

    const { getSlackToken } = await import("../ContextCollector.js");
    const token = await getSlackToken("cognito-abc");

    expect(token).toBe("xoxb-user-token");
    // GetSecretValueCommand に prefix+userId が渡る
    const command = mockSend.mock.calls[0][0] as {
      input: { SecretId: string };
    };
    expect(command.input.SecretId).toBe("saborou/slack-bot-token/cognito-abc");
  });

  it("falls back to default prefix when env is unset", async () => {
    // biome-ignore lint/performance/noDelete: env var の真の削除には delete が必要
    delete process.env.SLACK_BOT_TOKEN_SECRET_PREFIX;
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-default" });

    const { getSlackToken } = await import("../ContextCollector.js");
    await getSlackToken("cognito-xyz");

    const command = mockSend.mock.calls[0][0] as {
      input: { SecretId: string };
    };
    expect(command.input.SecretId).toBe("saborou/slack-bot-token/cognito-xyz");
  });

  it("returns cached token per user on second call (DP-06 cache hit)", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-cached" });

    const { getSlackToken } = await import("../ContextCollector.js");
    const first = await getSlackToken("user1");
    const second = await getSlackToken("user1");

    expect(first).toBe("xoxb-cached");
    expect(second).toBe("xoxb-cached");
    // 同一ユーザーの2回呼び出しでも Secrets Manager は1回のみ
    expect(mockSend).toHaveBeenCalledOnce();
  });

  it("caches independently per user", async () => {
    mockSend
      .mockResolvedValueOnce({ SecretString: "token-a" })
      .mockResolvedValueOnce({ SecretString: "token-b" });

    const { getSlackToken } = await import("../ContextCollector.js");
    const a = await getSlackToken("userA");
    const b = await getSlackToken("userB");

    expect(a).toBe("token-a");
    expect(b).toBe("token-b");
    // 別ユーザーなので2回呼ばれる
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("throws when userId is empty", async () => {
    const { getSlackToken, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    await expect(getSlackToken("")).rejects.toThrow("userId is required");
  });

  it("throws when SecretString is empty", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: undefined });

    const { getSlackToken, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    await expect(getSlackToken("user-empty")).rejects.toThrow(
      "no SecretString",
    );
  });

  it("ContextCollector class delegates to getSlackToken(userId)", async () => {
    mockSend.mockResolvedValueOnce({ SecretString: "xoxb-class-token" });

    const { ContextCollector, resetSlackTokenCache } = await import(
      "../ContextCollector.js"
    );
    resetSlackTokenCache();

    const collector = new ContextCollector();
    const token = await collector.getSlackToken("user-class");

    expect(token).toBe("xoxb-class-token");
  });
});
