import { createHash } from "node:crypto";
import { SlackApiError, SlackClient, getSlackToken } from "@saboru/agent";
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
  createSlackClient?: (token: string) => SlackPostClient;
  auditWriter?: (event: SlackDelegationAuditEvent) => void;
  now?: () => number;
};

const MAX_SECTION_LENGTH = 500;
const MAX_MESSAGE_LENGTH = 3000;
const MAX_PREVIEW_LENGTH = 180;

export class SlackDelegationService {
  private readonly getToken: (userId: string) => Promise<string>;
  private readonly createSlackClient: (token: string) => SlackPostClient;
  private readonly auditWriter?: (event: SlackDelegationAuditEvent) => void;
  private readonly now: () => number;

  constructor(
    private readonly taskRepository: Pick<DynamoTaskRepository, "findById">,
    options: SlackDelegationServiceOptions = {},
  ) {
    this.getToken = options.getToken ?? getSlackToken;
    this.createSlackClient =
      options.createSlackClient ?? ((token) => new SlackClient(token));
    this.auditWriter = options.auditWriter;
    this.now = options.now ?? Date.now;
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

      const message = buildClaudeDelegationMessage(task, input.instruction);
      const token = await this.getToken(input.userId);
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
          channelId: input.channelId,
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
        error.code === "SLACK_API_ERROR"
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
): SlackDelegationMessage {
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
      "@Claude Please help with this SABOROU task.",
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
