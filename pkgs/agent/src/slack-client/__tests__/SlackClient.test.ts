import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlackApiError, SlackClient } from "../SlackClient.js";

/**
 * SlackClient ユニットテスト
 * fetch をモックして Slack Web API 呼び出しを検証する。
 */

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function okResponse(payload: Record<string, unknown>) {
  return {
    ok: true, // HTTP ok
    json: async () => ({ ok: true, ...payload }),
  };
}

describe("SlackClient.conversationsHistory", () => {
  it("returns messages on success", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        messages: [
          { type: "message", user: "U1", text: "hello", ts: "1.1" },
          { type: "message", user: "U2", text: "world", ts: "2.2" },
        ],
      }),
    );

    const client = new SlackClient("xoxb-test");
    const msgs = await client.conversationsHistory({ channel: "C1" });

    expect(msgs).toHaveLength(2);
    expect(msgs[0].text).toBe("hello");
    // 正しい API エンドポイント・認証ヘッダ
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/conversations.history");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer xoxb-test",
    );
  });

  it("passes oldest and limit params", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ messages: [] }));

    const client = new SlackClient("xoxb-test");
    await client.conversationsHistory({
      channel: "C1",
      oldest: "1700000000.000",
      limit: 50,
    });

    const body = (mockFetch.mock.calls[0][1].body as string) ?? "";
    expect(body).toContain("oldest=1700000000.000");
    expect(body).toContain("limit=50");
  });

  it("returns empty array when messages is absent", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));

    const client = new SlackClient("xoxb-test");
    const msgs = await client.conversationsHistory({ channel: "C1" });
    expect(msgs).toEqual([]);
  });

  it("throws SlackApiError on ok:false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "channel_not_found" }),
    });

    const client = new SlackClient("xoxb-test");
    await expect(
      client.conversationsHistory({ channel: "C-bad" }),
    ).rejects.toThrow(SlackApiError);
  });

  it("throws SlackApiError on HTTP error status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    const client = new SlackClient("xoxb-test");
    await expect(
      client.conversationsHistory({ channel: "C1" }),
    ).rejects.toThrow("http_429");
  });

  it("falls back to unknown_error when ok:false has no error field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false }), // error フィールドなし
    });

    const client = new SlackClient("xoxb-test");
    await expect(
      client.conversationsHistory({ channel: "C1" }),
    ).rejects.toThrow("unknown_error");
  });
});

describe("SlackClient.postMessage", () => {
  it("posts a message and returns ts", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ts: "9.9" }));

    const client = new SlackClient("xoxb-test");
    const result = await client.postMessage({ channel: "C1", text: "hi" });

    expect(result.ts).toBe("9.9");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
  });

  it("includes thread_ts for threaded replies", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ ts: "9.9" }));

    const client = new SlackClient("xoxb-test");
    await client.postMessage({
      channel: "C1",
      text: "reply",
      thread_ts: "1.1",
    });

    const body = (mockFetch.mock.calls[0][1].body as string) ?? "";
    expect(body).toContain("thread_ts=1.1");
  });

  it("throws SlackApiError on ok:false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "not_in_channel" }),
    });

    const client = new SlackClient("xoxb-test");
    await expect(
      client.postMessage({ channel: "C1", text: "x" }),
    ).rejects.toThrow("not_in_channel");
  });
});

describe("SlackClient timeout", () => {
  it("aborts the request after the timeout", async () => {
    // fetch が AbortSignal で reject される挙動を模擬
    mockFetch.mockImplementationOnce((_url, init: { signal: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const client = new SlackClient("xoxb-test", 10); // 10ms タイムアウト
    await expect(
      client.conversationsHistory({ channel: "C1" }),
    ).rejects.toThrow();
  });
});

describe("SlackClient.usersInfo", () => {
  it("prefers profile.display_name", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        user: {
          id: "U1",
          name: "handle",
          real_name: "Real Name",
          profile: { display_name: "ニックネーム", real_name: "Profile Real" },
        },
      }),
    );

    const client = new SlackClient("xoxb-test");
    const name = await client.usersInfo("U1");

    expect(name).toBe("ニックネーム");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/users.info");
    expect((init.body as string) ?? "").toContain("user=U1");
  });

  it("falls back to real_name when display_name is empty", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        user: {
          id: "U1",
          name: "handle",
          real_name: "山田太郎",
          profile: { display_name: "   " },
        },
      }),
    );

    const client = new SlackClient("xoxb-test");
    expect(await client.usersInfo("U1")).toBe("山田太郎");
  });

  it("falls back to profile.real_name then name", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        user: { id: "U1", name: "handle", profile: { real_name: "P Real" } },
      }),
    );
    const client = new SlackClient("xoxb-test");
    expect(await client.usersInfo("U1")).toBe("P Real");

    mockFetch.mockResolvedValueOnce(
      okResponse({ user: { id: "U2", name: "handle-only" } }),
    );
    expect(await client.usersInfo("U2")).toBe("handle-only");
  });

  it("returns null when no usable name is present", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ user: { id: "U1", profile: {} } }),
    );
    const client = new SlackClient("xoxb-test");
    expect(await client.usersInfo("U1")).toBeNull();
  });

  it("returns null when user object is absent", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const client = new SlackClient("xoxb-test");
    expect(await client.usersInfo("U1")).toBeNull();
  });

  it("throws SlackApiError on ok:false (caller must catch)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "user_not_found" }),
    });
    const client = new SlackClient("xoxb-test");
    await expect(client.usersInfo("U-bad")).rejects.toThrow("user_not_found");
  });
});

describe("SlackClient.conversationsList", () => {
  it("returns channels on success", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        channels: [
          { id: "C1", name: "all-saborou", is_channel: true },
          { id: "C2", name: "dev", is_channel: true },
        ],
      }),
    );

    const client = new SlackClient("xoxb-test");
    const channels = await client.conversationsList();

    expect(channels).toHaveLength(2);
    expect(channels[0].name).toBe("all-saborou");
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://slack.com/api/users.conversations");
  });

  it("returns empty array when channels is absent", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({}));
    const client = new SlackClient("xoxb-test");
    expect(await client.conversationsList()).toEqual([]);
  });

  it("throws SlackApiError on ok:false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "missing_scope" }),
    });
    const client = new SlackClient("xoxb-test");
    await expect(client.conversationsList()).rejects.toThrow("missing_scope");
  });
});
