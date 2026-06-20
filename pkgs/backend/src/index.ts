/**
 * Hono アプリファクトリー — U-04 API エントリーポイント
 *
 * 全ルートとミドルウェアを単一の Hono インスタンスに登録する。
 * このモジュールのインポーター:
 * - handler.ts (hono/aws-lambda 経由の Lambda エントリーポイント)
 * - ローカル開発: tsx で直接実行
 *
 * ルートレイアウト:
 * GET    /health                         — 認証なし
 * GET    /api/auth/slack                 — Slack OAuth 開始 (認証必要)
 * GET    /api/auth/slack/callback        — Slack OAuth コールバック
 * GET    /api/auth/google                — Google OAuth 開始 (認証必要)
 * GET    /api/auth/google/callback       — Google OAuth コールバック
 * DELETE /api/auth/google                — Google 連携解除
 * POST   /api/google/calendar/fetch      — Google Calendar 手動取り込み (認証必要)
 * GET    /api/google/calendar/status     — Calendar キャッシュ状態確認 (認証必要)
 * POST   /api/google/gmail/fetch         — Gmail 手動取り込み (認証必要)
 * GET    /tasks                          — 承認済みタスク一覧
 * POST   /tasks                          — タスク手動作成
 * GET    /tasks/candidates               — 保留中の候補
 * POST   /tasks/candidates/:id/approve   — 候補を承認
 * DELETE /tasks/candidates/:id           — 候補を却下
 * GET    /tasks/:id                      — 単一タスク
 * PATCH  /tasks/:id                      — インライン編集
 * DELETE /tasks/:id                      — 論理削除
 * GET    /tasks/:taskId/proposal         — サボり提案 (SSE / 同期)
 * POST   /api/proposals/judge            — 返信文ドラフト生成 (Chrome 拡張向け)
 * GET    /tasks/:taskId/schedule         — スケジュール (3バンドガント) 生成
 * POST   /tasks/:taskId/honne            — 本音記録
 * GET    /connections                    — サービス接続
 * DELETE /connections/:service           — サービスの接続解除
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import {
  BedrockClientAdapter,
  PersonaRenderer,
  SaboriProposerAgent,
  SaboriProposerAgentV2,
  SchedulePlannerAgent,
  TaskExtractorAgent,
} from "@saboru/agent";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { openApiDoc } from "./config/openapi.js";
import { getGoogleClientSecret } from "./config/secrets.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/logger.js";
import { DynamoGoogleCalendarCacheRepository } from "./repositories/DynamoGoogleCalendarCacheRepository.js";
import { DynamoHonneRepository } from "./repositories/DynamoHonneRepository.js";
import { DynamoProposalRepository } from "./repositories/DynamoProposalRepository.js";
import { DynamoServiceConnectionRepository } from "./repositories/DynamoServiceConnectionRepository.js";
import { DynamoTaskCandidateRepository } from "./repositories/DynamoTaskCandidateRepository.js";
import { DynamoTaskRepository } from "./repositories/DynamoTaskRepository.js";
import { DynamoUserRepository } from "./repositories/DynamoUserRepository.js";
import { createAuthRoute } from "./routes/auth.js";
import { createConnectionsRoute } from "./routes/connections.js";
import { createGoogleAuthRoute } from "./routes/google-auth.js";
import { createGoogleRoute } from "./routes/google.js";
import { healthRoute } from "./routes/health.js";
import { createHonneRoute } from "./routes/honne.js";
import { createMcpJsonRpcRoute } from "./routes/mcp-jsonrpc.js";
import { createMcpRoute } from "./routes/mcp.js";
import { createProposalsRoute } from "./routes/proposals.js";
import { createScheduleRoute } from "./routes/schedule.js";
import { createSlackRoute } from "./routes/slack.js";
import { createTasksRoute } from "./routes/tasks.js";
import { createTravelRoute } from "./routes/travel.js";
import { createUsersRoute } from "./routes/users.js";
import { GoogleTokenService } from "./services/GoogleTokenService.js";
import { SlackDelegationService } from "./services/SlackDelegationService.js";
import { TravelPlanSlackPostService } from "./travel/TravelPlanSlackPostService.js";
import { TravelPlanningService } from "./travel/TravelPlanningService.js";
import { TravelpayoutsClient } from "./travel/TravelpayoutsClient.js";

// DynamoDB クライアントを初期化 (全リポジトリで共有)
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

// リポジトリを初期化
const userRepository = new DynamoUserRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_USERS,
);
const connectionRepository = new DynamoServiceConnectionRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_CONNECTIONS,
);
const candidateRepository = new DynamoTaskCandidateRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_TASK_CANDIDATES,
  env.DYNAMODB_TABLE_TASKS,
);
const taskRepository = new DynamoTaskRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_TASKS,
);
const proposalRepository = new DynamoProposalRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_PROPOSALS,
);
const honneRepository = new DynamoHonneRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_HONNE_DATA,
);
const googleCalendarCacheRepository = new DynamoGoogleCalendarCacheRepository(
  dynamoClient,
  env.DYNAMODB_TABLE_GOOGLE_CALENDAR_CACHE,
);
const slackDelegationService = new SlackDelegationService(taskRepository);

// Initialize SaboriProposerAgent (U-03b dependency)
const bedrockClient = new BedrockClientAdapter();
const personaRenderer = new PersonaRenderer(bedrockClient);
const saboriProposerAgent = new SaboriProposerAgent(
  bedrockClient,
  proposalRepository,
  personaRenderer,
);

// Initialize TaskExtractorAgent (Gmail 取り込みで使用)
const taskExtractorAgent = new TaskExtractorAgent(
  bedrockClient,
  candidateRepository,
);

// Initialize SchedulePlannerAgent (3バンドガント生成で使用 / U-G04)
const schedulePlannerAgent = new SchedulePlannerAgent(bedrockClient);

// Initialize SaboriProposerAgentV2 (進捗報告文生成で使用 / U-V2-07)
const saboriProposerAgentV2 = new SaboriProposerAgentV2(bedrockClient);
const travelpayoutsClient = env.TRAVELPAYOUTS_CREDENTIALS_SECRET_ARN
  ? new TravelpayoutsClient({
      credentialsSecretArn: env.TRAVELPAYOUTS_CREDENTIALS_SECRET_ARN,
    })
  : undefined;
const travelPlanningService = new TravelPlanningService({
  travelpayoutsClient,
  bedrockClient,
});
const travelPlanSlackPostService = new TravelPlanSlackPostService(
  travelPlanningService,
);

/**
 * Google アクセストークン取得のデフォルト実装（U-G04 schedule ルート用）。
 * google.ts と同じ手順: clientSecret ARN → JSON parse → GoogleTokenService.getValidAccessToken。
 */
async function getGoogleAccessToken(userId: string): Promise<string> {
  const clientSecretJson = await getGoogleClientSecret(
    env.GOOGLE_CLIENT_SECRET_ARN,
  );
  const { clientId, clientSecret } = JSON.parse(clientSecretJson) as {
    clientId: string;
    clientSecret: string;
  };
  const tokenService = new GoogleTokenService();
  const secretName = GoogleTokenService.buildSecretName(userId);
  return tokenService.getValidAccessToken(
    userId,
    secretName,
    clientId,
    clientSecret,
  );
}

/**
 * createApp — Hono app factory (exported for testing)
 * Accepts optional overrides for dependency injection in tests.
 */
export function createApp() {
  const app = new Hono();

  // Global middleware
  app.use("*", requestLogger);

  // Routes
  app.route("/health", healthRoute);

  // /api/* — フロントエンドの apiClient が期待するプレフィックス
  app.route("/api/users", createUsersRoute(userRepository, honneRepository));
  app.route("/api/auth", createAuthRoute(connectionRepository, userRepository));
  app.route("/api/auth", createGoogleAuthRoute(connectionRepository));
  app.route(
    "/api/tasks",
    createTasksRoute(
      taskRepository,
      candidateRepository,
      schedulePlannerAgent,
      saboriProposerAgentV2,
    ),
  );
  // Proposal and honne share the /api/tasks prefix for :taskId param
  app.route(
    "/api/tasks",
    createProposalsRoute(
      taskRepository,
      proposalRepository,
      saboriProposerAgent,
      userRepository,
      googleCalendarCacheRepository,
      saboriProposerAgentV2,
    ),
  );
  // Chrome 拡張（agentClient.judgeTask）が呼ぶ POST /api/proposals/judge を提供する。
  // 同一ルートを /api/proposals にもマウントし、/judge ハンドラーを公開する。
  app.route(
    "/api/proposals",
    createProposalsRoute(
      taskRepository,
      proposalRepository,
      saboriProposerAgent,
      userRepository,
      googleCalendarCacheRepository,
      saboriProposerAgentV2,
    ),
  );
  app.route(
    "/api/tasks",
    createHonneRoute(taskRepository, honneRepository, proposalRepository),
  );
  // Schedule (3バンドガント) も /api/tasks プレフィックスに相乗り（U-G04）
  app.route(
    "/api/tasks",
    createScheduleRoute(
      taskRepository,
      connectionRepository,
      schedulePlannerAgent,
      getGoogleAccessToken,
    ),
  );
  app.route("/api/connections", createConnectionsRoute(connectionRepository));
  app.route("/api/slack", createSlackRoute(taskRepository, proposalRepository));
  app.route(
    "/api/travel",
    createTravelRoute({
      plan: (input) => travelPlanningService.plan(input),
      planAndPostToSlack: (input) =>
        travelPlanSlackPostService.planAndPostToSlack(input),
    }),
  );
  const internalCaller = async (
    path: string,
    init: RequestInit,
  ): Promise<Response> => app.fetch(new Request(`http://internal${path}`, init));
  // MCP REST adapter: POST /api/mcp/tools/:toolName (Chrome 拡張・AgentCore 向け)
  app.route(
    "/api/mcp",
    createMcpRoute({
      delegationService: slackDelegationService,
      travelPlanningService,
      caller: internalCaller,
    }),
  );

  // MCP JSON-RPC 2.0 (streamable_http): POST /api/mcp  (ElevenLabs 向け)
  // internalCaller は app を遅延参照するクロージャ — app 初期化後に呼ばれるため安全
  app.route(
    "/api/mcp",
    createMcpJsonRpcRoute({
      caller: internalCaller,
      delegationService: slackDelegationService,
    }),
  );
  // Google Calendar/Gmail 取り込みルート（U-07b）
  app.route(
    "/api/google",
    createGoogleRoute(
      connectionRepository,
      googleCalendarCacheRepository,
      candidateRepository,
      taskExtractorAgent,
    ),
  );

  // OpenAPI / Swagger UI
  app.get("/doc", (c) => c.json(openApiDoc));
  app.get("/ui", swaggerUI({ url: "/doc" }));

  // Global error handler (must be registered last)
  app.onError(errorHandler);

  return app;
}

const app = createApp();

// Local dev server (runs when executed directly with tsx / NODE_ENV != test)
/* istanbul ignore next */
if (process.env.NODE_ENV !== "test" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  /* istanbul ignore next */
  serve({
    fetch: app.fetch,
    port: 3000,
  });
  /* istanbul ignore next */
  console.log("Saborou API server running at http://localhost:3000");
}

export { app };
export default app;
