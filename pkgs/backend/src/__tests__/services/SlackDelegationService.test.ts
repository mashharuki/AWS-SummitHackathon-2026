import { SlackApiError } from "@saboru/agent";
import type { Task } from "@saboru/shared";
import { describe, expect, it, vi } from "vitest";
import {
  buildClaudeDelegationMessage,
  SlackDelegationService,
  type SlackDelegationAuditEvent,
} from "../../services/SlackDelegationService.js";

const task: Task = {
  PK: "USER#user-123",
  SK: "TASK#task-1",
  taskId: "task-1",
  userId: "user-123",
  status: "approved",
  title: "決勝デモの台本作成",
  deadline: "2026-06-26T09:00:00+09:00",
  requester: "PM",
  description: "AWS Summit Japan 2026 決勝デモ用の説明台本を準備する",
  sourceType: "slack",
  plannedSteps: [
    {
      stepId: "s1",
      stepLabel: "構成を作る",
      durationMinutes: 30,
      bandType: "work",
    },
  ],
  approvedAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
};

describe("buildClaudeDelegationMessage", () => {
  it("includes Claude mention, task context, deliverable, constraints, and attribution", () => {
    const message = buildClaudeDelegationMessage(task, "初稿を短くまとめて");

    expect(message.text).toContain("@Claude");
    expect(message.text).toContain("決勝デモの台本作成");
    expect(message.text).toContain("Expected deliverable");
    expect(message.text).toContain("Constraints");
    expect(message.text).toContain("初稿を短くまとめて");
    expect(message.text).toContain("explicit user approval");
    expect(message.preview.length).toBeLessThanOrEqual(180);
  });
});

describe("SlackDelegationService", () => {
  it("rejects missing approval before task lookup or Slack token lookup", async () => {
    const findById = vi.fn();
    const getToken = vi.fn();
    const postMessage = vi.fn();
    const service = new SlackDelegationService(
      { findById },
      {
        getToken,
        createSlackClient: () => ({ postMessage }),
      },
    );

    await expect(
      service.delegateToClaude({
        userId: "user-123",
        taskId: "task-1",
        channelId: "C12345",
        approved: false,
        requestId: "req-1",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(findById).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("rejects missing or wrong-owner tasks before Slack post", async () => {
    const findById = vi.fn().mockResolvedValue(null);
    const getToken = vi.fn();
    const postMessage = vi.fn();
    const service = new SlackDelegationService(
      { findById },
      {
        getToken,
        createSlackClient: () => ({ postMessage }),
      },
    );

    await expect(
      service.delegateToClaude({
        userId: "user-123",
        taskId: "missing",
        channelId: "C12345",
        approved: true,
        requestId: "req-1",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(findById).toHaveBeenCalledWith("user-123", "missing");
    expect(getToken).not.toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  it("posts a safe Claude delegation message and returns a bounded result", async () => {
    const findById = vi.fn().mockResolvedValue(task);
    const getToken = vi.fn().mockResolvedValue("xoxb-secret");
    const postMessage = vi.fn().mockResolvedValue({ ts: "1718600000.123456" });
    const events: SlackDelegationAuditEvent[] = [];
    const service = new SlackDelegationService(
      { findById },
      {
        getToken,
        createSlackClient: () => ({ postMessage }),
        auditWriter: (event) => events.push(event),
        now: () => 1000,
      },
    );

    const result = await service.delegateToClaude({
      userId: "user-123",
      taskId: "task-1",
      channelId: "C12345",
      threadTs: "1718600000.000001",
      instruction: "制約も添えて",
      approved: true,
      requestId: "req-1",
    });

    expect(result).toMatchObject({
      ok: true,
      taskId: "task-1",
      channelId: "C12345",
      ts: "1718600000.123456",
    });
    expect(result.delegatedTextPreview).toContain("@Claude");
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "C12345",
        thread_ts: "1718600000.000001",
      }),
    );
    expect(postMessage.mock.calls[0][0].text).toContain("@Claude");
    expect(JSON.stringify(events[0])).not.toContain("xoxb-secret");
    expect(JSON.stringify(events[0])).not.toContain(task.description);
  });

  it("maps Slack API failures to safe errors", async () => {
    const service = new SlackDelegationService(
      { findById: vi.fn().mockResolvedValue(task) },
      {
        getToken: vi.fn().mockResolvedValue("xoxb-secret"),
        createSlackClient: () => ({
          postMessage: vi
            .fn()
            .mockRejectedValue(
              new SlackApiError("channel_not_found", "chat.postMessage"),
            ),
        }),
      },
    );

    await expect(
      service.delegateToClaude({
        userId: "user-123",
        taskId: "task-1",
        channelId: "C404",
        approved: true,
        requestId: "req-1",
      }),
    ).rejects.toMatchObject({
      code: "SLACK_API_ERROR",
      message: "SlackへのClaude委譲投稿に失敗しました",
    });
  });
});
