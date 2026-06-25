import { createHash } from "node:crypto";
import {
  SlackApiError,
  SlackClient,
  getSlackToken,
  getSlackUserToken,
} from "@saboru/agent";
import type { Task } from "@saboru/shared";
import { AppError, ForbiddenError, NotFoundError } from "../errors.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import { hashUserId } from "../mcp/audit.js";

export type SlackDelegationStatus =
  | "success"
  | "forbidden"
  | "task_not_found"
  | "slack_api_error"
  | "tool_error";

export type SlackDelegationAuditEvent = {
  action: "slack_claude_delegation";
  requestId: string;
  toolName: "saborou_delegate_to_claude";
  userIdHash: string;
  taskIdHash?: string;
  channelId?: string;
  status: SlackDelegationStatus;
  durationMs: number;
};

export type SlackDelegationInput = {
  userId: string;
  taskId: string;
  /** Slack channel ID. Falls back to task.slackChannelId when omitted. */
  channelId?: string;
  threadTs?: string;
  instruction?: string;
  approved: boolean;
  requestId: string;
};

export type SlackDelegationResult = {
  ok: true;
  taskId: string;
  channelId: string;
  ts: string;
  delegatedTextPreview: string;
};

export type SlackDelegationMessage = {
  text: string;
  preview: string;
};

type SlackPostClient = {
  postMessage(input: {
    channel: string;
    text: string;
    thread_ts?: string;
  }): Promise<{ ts?: string }>;
};

export type SlackDelegationServiceOptions = {
  getToken?: (userId: string) => Promise<string>;
  getUserToken?: (userId: string) => Promise<string | null>;
  createSlackClient?: (token: string) => SlackPostClient;
  auditWriter?: (event: SlackDelegationAuditEvent) => void;
  now?: () => number;
  /** Claude の Slack メンバー ID（例: U08XXXXXXXXX）。未設定時は @Claude プレーンテキスト */
  claudeUserId?: string;
};

const MAX_SECTION_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_PREVIEW_LENGTH = 180;

export class SlackDelegationService {
  private readonly getToken: (userId: string) => Promise<string>;
  private readonly getUserToken: (userId: string) => Promise<string | null>;
  private readonly createSlackClient: (token: string) => SlackPostClient;
  private readonly auditWriter?: (event: SlackDelegationAuditEvent) => void;
  private readonly now: () => number;
  private readonly claudeUserId: string | undefined;

  constructor(
    private readonly taskRepository: Pick<DynamoTaskRepository, "findById">,
    options: SlackDelegationServiceOptions = {},
  ) {
    this.getToken = options.getToken ?? getSlackToken;
    this.getUserToken = options.getUserToken ?? getSlackUserToken;
    this.createSlackClient =
      options.createSlackClient ?? ((token) => new SlackClient(token));
    this.auditWriter = options.auditWriter;
    this.now = options.now ?? Date.now;
    this.claudeUserId =
      options.claudeUserId ?? process.env.SLACK_CLAUDE_USER_ID;
  }

  async delegateToClaude(
    input: SlackDelegationInput,
  ): Promise<SlackDelegationResult> {
    const startedAt = this.now();
    let status: SlackDelegationStatus = "tool_error";

    try {
      assertApproved(input.approved);

      const task = await this.taskRepository.findById(
        input.userId,
        input.taskId,
      );
      if (!task) {
        status = "task_not_found";
        throw new NotFoundError("Task not found");
      }

      const resolvedChannelId =
        input.channelId ?? (task as { slackChannelId?: string }).slackChannelId;
      if (!resolvedChannelId) {
        throw new AppError(
          400,
          "MISSING_CHANNEL",
          "Slack channelId is required but was not provided and is not stored on the task",
        );
      }

      const message = buildClaudeDelegationMessage(
        task,
        input.instruction,
        this.claudeUserId,
      );
      // User Token (xoxp-) を優先して使用。未設定の場合は Bot Token にフォールバック。
      const userToken = await this.getUserToken(input.userId);
      let token: string;
      try {
        token = userToken ?? (await this.getToken(input.userId));
      } catch {
        status = "slack_api_error";
        throw new AppError(
          424,
          "SLACK_NOT_CONNECTED",
          "Slack が未連携です。先に Slack 連携を完了してください。",
        );
      }
      const client = this.createSlackClient(token);

      try {
        const result = await client.postMessage({
          channel: resolvedChannelId,
          text: message.text,
          ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
        });

        status = "success";
        return {
          ok: true,
          taskId: input.taskId,
          channelId: resolvedChannelId,
          ts: result.ts ?? "",
          delegatedTextPreview: message.preview,
        };
      } catch (error) {
        if (error instanceof SlackApiError) {
          status = "slack_api_error";
          throw new AppError(
            502,
            "SLACK_API_ERROR",
            "SlackへのClaude委譲投稿に失敗しました",
          );
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof ForbiddenError) {
        status = "forbidden";
      } else if (error instanceof NotFoundError) {
        status = "task_not_found";
      } else if (
        error instanceof AppError &&
        (error.code === "SLACK_API_ERROR" ||
          error.code === "SLACK_NOT_CONNECTED")
      ) {
        status = "slack_api_error";
      }

      if (error instanceof AppError) {
        throw error;
      }

      status = "tool_error";
      throw new AppError(500, "TOOL_ERROR", "Claude delegation failed");
    } finally {
      this.auditWriter?.({
        action: "slack_claude_delegation",
        requestId: input.requestId,
        toolName: "saborou_delegate_to_claude",
        userIdHash: hashUserId(input.userId),
        taskIdHash: hashStable(input.taskId),
        channelId: input.channelId,
        status,
        durationMs: this.now() - startedAt,
      });
    }
  }
}

export function assertApproved(approved: boolean): void {
  if (approved !== true) {
    throw new ForbiddenError("Delegation requires explicit approval");
  }
}

export function buildClaudeDelegationMessage(
  task: Pick<
    Task,
    "title" | "description" | "deadline" | "requester" | "plannedSteps"
  >,
  instruction?: string,
  claudeUserId?: string,
): SlackDelegationMessage {
  // Slack メンション: ユーザー ID が設定されていれば <@UXXXXXXXXX>、なければ @Claude
  const mention = claudeUserId ? `<@${claudeUserId}>` : "@Claude";

  const background =
    bounded(task.description) ||
    bounded(task.requester ? `Requester: ${task.requester}` : "") ||
    "No additional background was provided.";
  const constraints = [
    task.deadline ? `Deadline: ${task.deadline}` : "Deadline: not specified",
    summarizePlannedSteps(task.plannedSteps),
    bounded(instruction ? `User instruction: ${instruction}` : ""),
  ].filter(Boolean);

  const text = truncate(
    [
      `${mention} Please help with this SABOROU task.`,
      "",
      `Task: ${bounded(task.title)}`,
      `Background: ${background}`,
      "Expected deliverable: Please produce a concrete, reviewable result for this task.",
      `Constraints: ${constraints.join(" / ")}`,
      "",
      "Delegated by SABOROU after explicit user approval.",
    ].join("\n"),
    MAX_MESSAGE_LENGTH,
  );

  return {
    text,
    preview: truncate(text.replace(/\s+/g, " "), MAX_PREVIEW_LENGTH),
  };
}

function summarizePlannedSteps(steps: Task["plannedSteps"]): string {
  if (!steps || steps.length === 0) {
    return "";
  }

  const labels = steps
    .slice(0, 3)
    .map((step) => bounded(step.stepLabel ?? step.stepId ?? "step"))
    .filter(Boolean);
  return labels.length > 0 ? `Planned steps: ${labels.join(", ")}` : "";
}

function bounded(value: string): string {
  return truncate(value.trim(), MAX_SECTION_LENGTH);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function hashStable(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}
