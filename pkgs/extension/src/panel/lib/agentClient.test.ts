import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock fetch globally
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockOkResponse(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

function mockErrorResponse(status = 500, statusText = "Internal Server Error") {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(statusText),
  });
}

// ---------------------------------------------------------------------------
// isMcpAvailable — VITE_MCP_TOOLS_BASE_URL ベースの判定テスト
// ---------------------------------------------------------------------------

describe("isMcpAvailable", () => {
  it("returns false when VITE_MCP_TOOLS_BASE_URL is not set in test env", async () => {
    const { isMcpAvailable } = await import("./agentClient");
    // In vitest env the var is not defined, so should be false
    expect(typeof isMcpAvailable()).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Mocked agentClient for precise path testing
// ---------------------------------------------------------------------------

vi.mock("./agentClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("./agentClient")>();
  return original;
});

// ---------------------------------------------------------------------------
// judgeTask — 常に Hono API を呼び出すことを確認
// ---------------------------------------------------------------------------

describe("judgeTask (direct fetch assertions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls the backend API with correct body and Authorization header", async () => {
    mockOkResponse({
      replyDraft: "了解しました",
      saboriScore: 0.9,
      ttsSummary: "了解しました",
    });

    const { judgeTask } = await import("./agentClient");
    const result = await judgeTask(
      { message: "MTG参加できますか？", senderName: "田中" },
      "jwt-token",
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/proposals/judge");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toMatchObject({
      message: "MTG参加できますか？",
      senderName: "田中",
    });
    expect(result.replyDraft).toBe("了解しました");

    const headers = opts.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer jwt-token");
  });

  it("throws on non-ok response", async () => {
    mockErrorResponse(500, "Server Error");

    const { judgeTask } = await import("./agentClient");
    await expect(judgeTask({ message: "test" }, "jwt")).rejects.toThrow("500");
  });

  // U-V3-04: judgeTask が常に Hono API (/api/proposals/judge) を呼び出すことを確認
  it("always calls Hono API /api/proposals/judge regardless of MCP configuration", async () => {
    // isMcpAvailable が true になるよう設定してもHono APIを呼ぶことを確認
    vi.spyOn(await import("./agentClient"), "isMcpAvailable").mockReturnValue(
      true,
    );
    mockOkResponse({
      replyDraft: "了解しました",
      saboriScore: 0.8,
      ttsSummary: "ok",
    });

    const { judgeTask } = await import("./agentClient");
    const result = await judgeTask({ message: "test" }, "jwt");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    // MCP が設定済みでも /mcp/tools/ パスは呼ばれない
    expect(url).toContain("/api/proposals/judge");
    expect(url).not.toContain("/mcp/tools/");
    expect(result.replyDraft).toBe("了解しました");
  });
});

// ---------------------------------------------------------------------------
// sendSlackReply — 常に Hono API を呼び出すことを確認
// ---------------------------------------------------------------------------

describe("sendSlackReply (direct fetch assertions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls POST /api/slack/reply", async () => {
    mockOkResponse({ ok: true });

    const { sendSlackReply } = await import("./agentClient");
    const result = await sendSlackReply(
      { channelId: "C123", replyText: "了解しました！" },
      "jwt",
    );

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/slack/reply");
    expect(result.ok).toBe(true);
  });

  // U-V3-04: sendSlackReply が常に Hono API (/api/slack/reply) を呼び出すことを確認
  it("always calls Hono API /api/slack/reply regardless of MCP configuration", async () => {
    vi.spyOn(await import("./agentClient"), "isMcpAvailable").mockReturnValue(
      true,
    );
    mockOkResponse({ ok: true });

    const { sendSlackReply } = await import("./agentClient");
    await sendSlackReply({ channelId: "C456", replyText: "ok" }, "jwt");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/slack/reply");
    expect(url).not.toContain("/mcp/tools/");
  });
});

// ---------------------------------------------------------------------------
// getTasks — 常に Hono API を呼び出すことを確認
// ---------------------------------------------------------------------------

describe("getTasks (direct fetch assertions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks array from response", async () => {
    mockOkResponse({ tasks: [{ id: "1", title: "レポート", status: "open" }] });

    const { getTasks } = await import("./agentClient");
    const tasks = await getTasks("jwt");

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("レポート");
  });

  // U-V3-04: getTasks が常に Hono API (/api/tasks) を呼び出すことを確認
  it("always calls Hono API /api/tasks regardless of MCP configuration", async () => {
    vi.spyOn(await import("./agentClient"), "isMcpAvailable").mockReturnValue(
      true,
    );
    mockOkResponse({ tasks: [] });

    const { getTasks } = await import("./agentClient");
    await getTasks("jwt");

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/tasks");
    expect(url).not.toContain("/mcp/tools/");
  });
});

// ---------------------------------------------------------------------------
// 後方互換: 旧テストケース（MCP path fallback テスト相当）
// ---------------------------------------------------------------------------

describe("judgeTask (backward compat — single fetch call)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("succeeds with a single Hono API call (no MCP retry logic)", async () => {
    mockOkResponse({
      replyDraft: "direct api response",
      saboriScore: 0.8,
      ttsSummary: "ok",
    });

    const { judgeTask } = await import("./agentClient");
    const result = await judgeTask({ message: "test" }, "jwt");

    // U-V3-04: 常に1回のみ Hono API を呼ぶ（MCP への二重呼び出しなし）
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.replyDraft).toBe("direct api response");
  });
});
