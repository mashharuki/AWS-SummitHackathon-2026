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

  it("accepts Claude delegation args without a channel", () => {
    expect(
      parseMcpToolArgs("saborou_delegate_to_claude", {
        taskId: "task-1",
        instruction: "初稿をお願いします",
      }),
    ).toMatchObject({
      taskId: "task-1",
      instruction: "初稿をお願いします",
    });
  });

  it("accepts voice-friendly partial trip planning input", () => {
    expect(
      parseMcpToolArgs("saborou_plan_trip", { destination: "Paris" }),
    ).toMatchObject({
      origin: "Tokyo",
      destination: "Paris",
      travelers: 1,
      currency: "JPY",
    });
  });

  it("rejects unknown trip planning fields", () => {
    expect(() =>
      parseMcpToolArgs("saborou_plan_trip", {
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        apiToken: "secret",
      }),
    ).toThrow();
  });

  it("accepts approved trip planning Slack post input", () => {
    expect(
      parseMcpToolArgs("saborou_plan_trip_and_post_to_slack", {
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        channelId: "C12345678",
        threadTs: "1718600000.123456",
        approved: true,
      }),
    ).toMatchObject({
      origin: "Tokyo",
      destination: "Paris",
      channelId: "C12345678",
      approved: true,
    });
  });

  it("rejects unknown trip planning Slack post fields", () => {
    expect(() =>
      parseMcpToolArgs("saborou_plan_trip_and_post_to_slack", {
        destination: "Paris",
        departureDate: "2026-07-10",
        returnDate: "2026-07-15",
        channelId: "C12345678",
        approved: true,
        admin: true,
      }),
    ).toThrow();
  });
});
