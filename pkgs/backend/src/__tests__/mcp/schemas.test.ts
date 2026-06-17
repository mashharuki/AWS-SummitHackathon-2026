import { describe, expect, it } from "vitest";
import { parseMcpToolArgs } from "../../mcp/schemas.js";

describe("MCP tool schemas", () => {
  it("accepts read-only list task filters", () => {
    expect(
      parseMcpToolArgs("saborou_list_tasks", { status: "active" }),
    ).toEqual({ status: "active" });
  });

  it("rejects unknown fields for strict read schemas", () => {
    expect(() =>
      parseMcpToolArgs("saborou_list_tasks", { admin: true }),
    ).toThrow();
  });

  it("rejects invalid task ids", () => {
    expect(() =>
      parseMcpToolArgs("saborou_get_task", { taskId: "<script>" }),
    ).toThrow();
  });

  it("accepts approved Slack reply shape", () => {
    expect(
      parseMcpToolArgs("saborou_send_slack_reply", {
        taskId: "task-1",
        replyText: "承知しました。確認して戻します。",
        channelId: "C12345678",
        threadTs: "1718600000.123456",
      }),
    ).toMatchObject({
      taskId: "task-1",
      replyText: "承知しました。確認して戻します。",
      channelId: "C12345678",
    });
  });

  it("bounds external fetch inputs", () => {
    expect(() =>
      parseMcpToolArgs("saborou_fetch_gmail", { maxResults: 1000 }),
    ).toThrow();
  });

  it("accepts Claude delegation args with an explicit channel", () => {
    expect(
      parseMcpToolArgs("saborou_delegate_to_claude", {
        taskId: "task-1",
        channelId: "C12345678",
        threadTs: "1718600000.123456",
        instruction: "初稿をお願いします",
      }),
    ).toMatchObject({
      taskId: "task-1",
      channelId: "C12345678",
      instruction: "初稿をお願いします",
    });
  });

  it("rejects Claude delegation args without a channel", () => {
    expect(() =>
      parseMcpToolArgs("saborou_delegate_to_claude", {
        taskId: "task-1",
        instruction: "初稿をお願いします",
      }),
    ).toThrow();
  });
});
