import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * タスク属性抽出の Bedrock Tool 定義 (DP-02)
 *
 * ツール名: "extract_task_attributes"
 * toolChoice: { tool: { name: "extract_task_attributes" } } と併用して
 * Bedrock 呼び出しごとにツール呼び出しを 1 回強制する。
 *
 * これにより以下を処理する必要がなくなる:
 * - テキストレスポンス (stopReason === "end_turn")
 * - 複数のツール呼び出し
 * - ツール呼び出しなし
 */
export const EXTRACT_TASK_TOOL_NAME = "extract_task_attributes";

export const EXTRACT_TASK_TOOL: Tool = {
  toolSpec: {
    name: EXTRACT_TASK_TOOL_NAME,
    description:
      "Extract task attributes from a Slack message. " +
      "If the message does not contain a task request, set is_task to false.",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          is_task: {
            type: "boolean",
            description:
              "True if the message contains a task request directed at the user. " +
              "False for greetings, FYI messages, or casual conversation.",
          },
          title: {
            type: "string",
            maxLength: 50,
            description:
              "Short task title (max 50 chars). Empty string if is_task is false.",
          },
          deadline: {
            type: ["string", "null"],
            description:
              "Deadline in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss). " +
              "Null if not mentioned.",
          },
          requester: {
            type: "string",
            description:
              "Name or identifier of the person making the request. " +
              "Use the Slack user ID if no name is available.",
          },
          description: {
            type: "string",
            maxLength: 100,
            description:
              "Brief summary of the task content (max 100 chars). " +
              "Empty string if is_task is false.",
          },
        },
        required: ["is_task", "title", "deadline", "requester", "description"],
      },
    },
  },
};

/**
 * Zod schema for validating Bedrock tool output (DP-03: output-side validation)
 *
 * Bedrock output is treated as untrusted input and MUST be validated
 * before use. This prevents type confusion from unexpected model responses.
 */
export const ExtractedTaskSchema = z.object({
  is_task: z.boolean(),
  title: z.string().max(50),
  deadline: z.string().nullable(),
  requester: z.string(),
  description: z.string().max(100),
});

export type ExtractedTask = z.infer<typeof ExtractedTaskSchema>;
