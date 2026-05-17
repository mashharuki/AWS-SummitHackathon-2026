import { z } from "zod";
import { BedrockClientAdapter } from "../bedrock/BedrockClientAdapter.js";
import { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import { ContextCollector } from "../context-collector/ContextCollector.js";
import { logError, logInfo } from "../utils/logger.js";
import { PersonaRenderer } from "./PersonaRenderer.js";
import { SaboriProposerAgent } from "./SaboriProposerAgent.js";
import type { SlackContext, TaskContext } from "./types.js";

/**
 * Lambda handler for SaboriProposer (U-03b)
 *
 * Trigger: API Gateway POST /api/tasks/:taskId/propose
 *          (U-04 api will wire this as a direct Lambda invocation)
 *
 * Handler path in CDK: "sabori-proposer/SaboriProposerLambdaHandler.handler"
 * (tsup entry: "sabori-proposer/SaboriProposerLambdaHandler")
 *
 * Request flow:
 * 1. Zod validation of Lambda event payload
 * 2. SlackContext collection (if slackMessageRef provided)
 * 3. SaboriProposerAgent.propose() — 3-phase judgment
 * 4. Return proposal as JSON response
 *
 * Error handling (NFR):
 * - Zod validation failure → 400 (logged, no DLQ — malformed requests)
 * - Bedrock/DynamoDB runtime errors → propagate → Lambda retry → DLQ
 */

/**
 * Lambda event schema for SaboriProposer invocation
 * (API Gateway Proxy or direct Lambda invoke)
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

// Module-level singletons (reused across warm invocations)
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
  // [1] Zod validation
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

  // [2] Collect SlackContext (optional — only if slackMessageRef is provided)
  let slackContext: SlackContext | undefined;
  if (payload.slackMessageRef) {
    try {
      const token = await contextCollector.getSlackToken();
      // SlackContext collection: build minimal context from available data
      // Full Slack API integration is in U-04; for now, build basic context
      slackContext = await collectMinimalSlackContext(
        token,
        payload.slackMessageRef,
      );
    } catch (error) {
      // Non-fatal: continue without Slack context (NFR: Slack timeout → null)
      logError({
        action: "sabori_proposer_slack_context_failed",
        error: error instanceof Error ? error.message : String(error),
        taskId: payload.taskId,
      });
    }
  }

  // [3] Build TaskContext and run propose()
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
