import { z } from "zod";
import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { ContextCollector } from "../context-collector/ContextCollector.js";
import { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import { logError, logInfo } from "../utils/logger.js";
import { PersonaRenderer } from "./PersonaRenderer.js";
import { SaboriProposerAgent } from "./SaboriProposerAgent.js";
import type { SlackContext, TaskContext } from "./types.js";

/**
 * SaboriProposer の Lambda ハンドラー (U-03b)
 *
 * トリガー: API Gateway POST /api/tasks/:taskId/propose
 *           (U-04 api がこれを直接 Lambda 呼び出しとして接続する)
 *
 * CDK でのハンドラーパス: "sabori-proposer/SaboriProposerLambdaHandler.handler"
 * (tsup エントリー: "sabori-proposer/SaboriProposerLambdaHandler")
 *
 * リクエストフロー:
 * 1. Lambda イベントペイロードの Zod バリデーション
 * 2. SlackContext 収集 (slackMessageRef が指定されている場合)
 * 3. SaboriProposerAgent.propose() — 3 フェーズ判定
 * 4. 提案を JSON レスポンスとして返す
 *
 * エラーハンドリング (NFR):
 * - Zod バリデーション失敗 → 400 (ログ記録、DLQ なし — 不正リクエスト)
 * - Bedrock/DynamoDB ランタイムエラー → 伝播 → Lambda リトライ → DLQ
 */

/**
 * SaboriProposer 呼び出し用 Lambda イベントスキーマ
 * (API Gateway プロキシまたは直接 Lambda 呼び出し)
 */
const ProposalLambdaEventSchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
  task: z.object({
    PK: z.string(),
    SK: z.string(),
    taskId: z.string(),
    userId: z.string(),
    status: z.string(),
    title: z.string(),
    deadline: z.string().nullable(),
    requester: z.string(),
    description: z.string(),
    sourceType: z.string(),
    approvedAt: z.string(),
    updatedAt: z.string(),
  }),
  slackMessageRef: z.string().optional(),
});

type ProposalLambdaEvent = z.infer<typeof ProposalLambdaEventSchema>;

interface LambdaResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

// モジュールレベルシングルトン (ウォーム呼び出し間で再利用)
const bedrockClient = new BedrockClientAdapter(
  process.env["BEDROCK_REGION"] ?? "ap-northeast-1",
);
const proposalRepository = new DynamoProposalRepository();
const personaRenderer = new PersonaRenderer(bedrockClient);
const agent = new SaboriProposerAgent(
  bedrockClient,
  proposalRepository,
  personaRenderer,
);
const contextCollector = new ContextCollector();

export const handler = async (event: unknown): Promise<LambdaResponse> => {
  // [1] Zod バリデーション
  const parsed = ProposalLambdaEventSchema.safeParse(event);
  if (!parsed.success) {
    logError({
      action: "sabori_proposer_invalid_input",
      errors: parsed.error.issues,
    });
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Invalid request",
        details: parsed.error.issues,
      }),
    };
  }

  const payload: ProposalLambdaEvent = parsed.data;

  // [2] SlackContext 収集 (省略可 — slackMessageRef が指定されている場合のみ)
  let slackContext: SlackContext | undefined;
  if (payload.slackMessageRef) {
    try {
      const token = await contextCollector.getSlackToken();
      // SlackContext 収集: 利用可能データから最小限のコンテキストを構築
      // 完全な Slack API 連携は U-04 で実装; ここでは基本コンテキストを構築
      slackContext = await collectMinimalSlackContext(
        token,
        payload.slackMessageRef,
      );
    } catch (error) {
      // 非致命的: Slack コンテキストなしで続行 (NFR: Slack タイムアウト → null)
      logError({
        action: "sabori_proposer_slack_context_failed",
        error: error instanceof Error ? error.message : String(error),
        taskId: payload.taskId,
      });
    }
  }

  // [3] TaskContext を構築して propose() を実行
  const taskContext: TaskContext = {
    task: payload.task as import("@saboru/shared").Task,
    slackContext,
  };

  const proposal = await agent.propose(payload.taskId, taskContext);

  logInfo({
    action: "sabori_proposer_complete",
    taskId: payload.taskId,
    verdict: proposal.verdict,
    userId: payload.userId,
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proposal),
  };
};

/**
 * Build minimal SlackContext from slackMessageRef.
 * Full Slack API integration is implemented in U-04.
 * This minimal version returns a default context for U-03b testing.
 *
 * In production (U-04), this will call Slack API to get:
 * - requesterStatus (users.getPresence)
 * - Thread messages (conversations.replies)
 * - etc.
 */
async function collectMinimalSlackContext(
  _token: string,
  _slackMessageRef: string,
): Promise<SlackContext> {
  // MVP stub: returns minimal context without Slack API call.
  // U-04 will replace this with real Slack API integration.
  return {
    requesterStatus: "unknown",
    reminderCount: 0,
    urgencyKeywords: [],
    threadActive: false,
    rawSummary: "",
  };
}
