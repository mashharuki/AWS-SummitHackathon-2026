import { Hono } from "hono";
import { getMcpToolDefinition, getPublishedMcpTools } from "../mcp/registry.js";
import {
  resolveMcpIdentity,
  type McpIdentityResolverOptions,
} from "../mcp/identity.js";
import type { McpToolDefinition } from "../mcp/types.js";
import type { SlackDelegationService } from "../services/SlackDelegationService.js";
import { normalizeForTts } from "../utils/ttsNormalizer.js";

const PROTOCOL_VERSION = "2024-11-05";

type JsonRpcId = number | string | null;
interface JsonRpcRequest {
  jsonrpc: string;
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

type InternalCaller = (path: string, init: RequestInit) => Promise<Response>;

export type McpJsonRpcRouteOptions = McpIdentityResolverOptions & {
  caller: InternalCaller;
  delegationService?: Pick<SlackDelegationService, "delegateToClaude">;
};

export function createMcpJsonRpcRoute(options: McpJsonRpcRouteOptions) {
  const mcp = new Hono();

  mcp.post("/", async (c) => {
    let body: JsonRpcRequest;
    try {
      body = (await c.req.json()) as JsonRpcRequest;
    } catch {
      return c.json(rpcError(null, -32700, "Parse error"), 400);
    }

    if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
      return c.json(rpcError(body.id ?? null, -32600, "Invalid Request"), 400);
    }

    const id = body.id ?? null;
    const authHeader = c.req.header("authorization") ?? null;

    // Notification (no id) — just acknowledge
    if (body.id === undefined && body.method === "notifications/initialized") {
      return c.body(null, 204);
    }

    switch (body.method) {
      case "initialize":
        return c.json(
          rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "SABOROU", version: "3.0.0" },
          }),
        );

      case "tools/list": {
        try {
          await resolveMcpIdentity(authHeader, options);
        } catch {
          return c.json(
            rpcError(id, -32001, "Unauthorized: Bearer token required"),
            401,
          );
        }
        const tools = getPublishedMcpTools().map(toMcpSchema);
        return c.json(rpcResult(id, { tools }));
      }

      case "tools/call": {
        const params = body.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        if (!params?.name) {
          return c.json(
            rpcError(id, -32602, "Invalid params: name is required"),
            400,
          );
        }

        let identity: Awaited<ReturnType<typeof resolveMcpIdentity>>;
        try {
          identity = await resolveMcpIdentity(authHeader, options);
        } catch {
          return c.json(
            rpcError(id, -32001, "Unauthorized: Bearer token required"),
            401,
          );
        }

        try {
          const result = await invokeTool(
            params.name,
            params.arguments ?? {},
            authHeader ?? "",
            identity,
            options,
          );
          return c.json(
            rpcResult(id, {
              content: [
                { type: "text", text: normalizeForTts(JSON.stringify(result, null, 2)) },
              ],
            }),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return c.json(
            rpcError(id, -32603, `Tool execution failed: ${msg}`),
            500,
          );
        }
      }

      default:
        return c.json(
          rpcError(id, -32601, `Method not found: ${body.method}`),
          404,
        );
    }
  });

  return mcp;
}

// ---- JSON-RPC helpers ----

function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: JsonRpcId, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ---- MCP tool schema ----

function toMcpSchema(tool: McpToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: jsonSchemaFor(tool.name),
  };
}

function jsonSchemaFor(toolName: string): Record<string, unknown> {
  switch (toolName) {
    case "saborou_list_tasks":
      return {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "completed", "pending"],
            description:
              "絞り込むタスクのステータス。active=進行中のタスクのみ、completed=完了済みのタスクのみ、pending=保留中のタスクのみ。省略すると全ステータスのタスクを返す。",
          },
        },
      };
    case "saborou_get_task":
      return {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "取得するタスクのID（ULIDまたは英数字の文字列）。saborou_list_tasks で取得したタスクのIDを使用する。",
          },
        },
        required: ["taskId"],
      };
    case "saborou_list_candidates":
      return { type: "object", properties: {} };
    case "saborou_generate_reply_draft":
      return {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "返信案を生成するタスクのID。saborou_list_tasks で取得したIDを使用する。",
          },
          mode: {
            type: "string",
            enum: ["sabori_judgment", "reply_draft", "decline_draft"],
            description:
              "生成する返信案のタイプ。sabori_judgment=サボれるか判定して最適な返信案を選ぶ（デフォルト推奨）、reply_draft=引き受ける前提の承諾返信案、decline_draft=丁寧にお断りする返信案。省略すると sabori_judgment が使われる。",
          },
        },
        required: ["taskId"],
      };
    case "saborou_judge_sabori":
      return {
        type: "object",
        properties: {
          message: {
            type: "string",
            minLength: 1,
            maxLength: 4000,
            description:
              "判定対象のSlackメッセージ本文。ユーザーが読み上げた内容または入力したテキストをそのまま渡す。",
          },
          senderName: {
            type: "string",
            maxLength: 120,
            description:
              "メッセージ送信者の名前（省略可）。あると返信文の宛名に使われ、より自然な文章になる。例:「田中さん」「部長」。",
          },
        },
        required: ["message"],
      };
    case "saborou_fetch_google_calendar":
      return { type: "object", properties: {} };
    case "saborou_fetch_gmail":
      return {
        type: "object",
        properties: {
          maxResults: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description:
              "取得するメールの最大件数（1〜20件）。省略すると10件。多いほど処理時間がかかる。",
          },
        },
      };
    case "saborou_send_slack_reply":
      return {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "この返信に関連するSABOROUタスクのID（省略可）。ログ追跡のために設定を推奨。",
          },
          replyText: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            description:
              "実際にSlackに投稿するメッセージ本文（必須）。送信前にユーザーへ内容を読み上げて確認を取ること。",
          },
          channelId: {
            type: "string",
            description:
              "投稿先のSlackチャンネルID（必須）。「C」で始まる英数字の文字列（例: C01234567）。DM（ダイレクトメッセージ）には使用不可。",
          },
          threadTs: {
            type: "string",
            description:
              "スレッドに返信する場合の親メッセージのタイムスタンプ（省略可）。「1234567890.123456」形式。省略するとチャンネルへの新規投稿になる。",
          },
        },
        required: ["replyText", "channelId"],
      };
    case "saborou_schedule_report":
      return {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "進捗報告を作成するタスクのID（必須）。saborou_list_tasks で取得したIDを使用する。",
          },
          tone: {
            type: "string",
            enum: ["formal", "polite", "casual"],
            description:
              "報告文の文体（省略可）。formal=硬いビジネス文体（役員・外部向け）、polite=丁寧語のデフォルト（上司向け、省略時はこれ）、casual=カジュアル（同僚・チーム内向け）。",
          },
        },
        required: ["taskId"],
      };
    case "saborou_find_task":
      return {
        type: "object",
        properties: {
          keyword: {
            type: "string",
            minLength: 1,
            maxLength: 200,
            description:
              "検索キーワード（必須）。タスクのタイトル・説明文・依頼者名のいずれかに含まれる文字列。例:「資料作成」「田中さん」「プレゼン」「来週の」。部分一致で検索されるため短いキーワードでOK。",
          },
        },
        required: ["keyword"],
      };
    case "saborou_delegate_to_claude":
      return {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description:
              "Claudeに委譲するタスクのID（必須）。saborou_list_tasks で取得したIDを使用する。",
          },
          channelId: {
            type: "string",
            description:
              "Claudeの返信を投稿するSlackチャンネルID（省略可）。Slackから作成されたタスクは自動設定されるため通常は省略してよい。手動で指定する場合は「C」で始まる英数字の文字列（例: C01234567）。",
          },
          threadTs: {
            type: "string",
            description:
              "Claudeが返信するスレッドの親メッセージのタイムスタンプ（省略可）。「1234567890.123456」形式。省略するとチャンネルへの新規投稿になる。",
          },
          instruction: {
            type: "string",
            minLength: 1,
            maxLength: 2000,
            description:
              "Claudeへの具体的な指示・依頼内容（必須）。日本語で記述する。例:「このタスクへの返信案を丁寧語で作成してください」「締め切りを確認して対応案を出してください」。",
          },
        },
        required: ["taskId", "instruction"],
      };
    default:
      return { type: "object" };
  }
}

// ---- Tool invocation ----

async function invokeTool(
  toolName: string,
  args: Record<string, unknown>,
  authorization: string,
  identity: { userId: string },
  options: McpJsonRpcRouteOptions,
): Promise<unknown> {
  const tool = getMcpToolDefinition(toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // saborou_delegate_to_claude: call the delegation service directly
  if (toolName === "saborou_delegate_to_claude" && options.delegationService) {
    return options.delegationService.delegateToClaude({
      userId: identity.userId,
      taskId: String(args.taskId),
      ...(typeof args.channelId === "string" && args.channelId
        ? { channelId: args.channelId }
        : {}),
      ...(typeof args.threadTs === "string" ? { threadTs: args.threadTs } : {}),
      ...(typeof args.instruction === "string"
        ? { instruction: args.instruction }
        : {}),
      approved: true,
      requestId: crypto.randomUUID(),
    });
  }

  // All other tools: call the Hono app internally via the injected caller
  let apiPath = tool.http.path;
  const usedPathKeys = new Set<string>();

  // Substitute path params ({taskId} etc.)
  for (const [key, val] of Object.entries(args)) {
    const placeholder = `{${key}}`;
    if (apiPath.includes(placeholder)) {
      apiPath = apiPath.replace(placeholder, encodeURIComponent(String(val)));
      usedPathKeys.add(key);
    }
  }

  const remainingArgs = Object.fromEntries(
    Object.entries(args).filter(([k]) => !usedPathKeys.has(k)),
  );

  const headers: Record<string, string> = {
    Authorization: authorization,
    "Content-Type": "application/json",
    // authMiddleware fallback: inject verified userId for internal Lambda calls
    "x-internal-sub": identity.userId,
  };

  let finalPath = apiPath;
  let body: string | undefined;

  if (tool.http.method === "GET") {
    const qs = new URLSearchParams(
      Object.entries(remainingArgs)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    );
    if (qs.toString()) finalPath += `?${qs.toString()}`;
  } else {
    body = JSON.stringify(remainingArgs);
  }

  const response = await options.caller(finalPath, {
    method: tool.http.method,
    headers,
    body,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText}`);
  }

  return response.json() as Promise<unknown>;
}
