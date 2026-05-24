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
  TaskExtractorAgent,
} from "@saboru/agent";
import { Hono } from "hono";
import { env } from "./config/env.js";
import { openApiDoc } from "./config/openapi.js";
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
import { createProposalsRoute } from "./routes/proposals.js";
import { createSlackRoute } from "./routes/slack.js";
import { createTasksRoute } from "./routes/tasks.js";
import { createUsersRoute } from "./routes/users.js";

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
    createTasksRoute(taskRepository, candidateRepository),
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
    ),
  );
  app.route(
    "/api/tasks",
    createHonneRoute(taskRepository, honneRepository, proposalRepository),
  );
  app.route("/api/connections", createConnectionsRoute(connectionRepository));
  app.route("/api/slack", createSlackRoute(taskRepository, proposalRepository));
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
