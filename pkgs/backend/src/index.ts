/**
 * Hono app factory — U-04 API entrypoint
 *
 * Registers all routes and middleware on a single Hono instance.
 * This module is imported by:
 * - handler.ts (Lambda entrypoint via hono/aws-lambda)
 * - Local dev: direct execution with tsx
 *
 * Route layout:
 * GET    /health                         — no auth
 * GET    /auth/slack                     — Slack OAuth initiation (auth required)
 * GET    /auth/slack/callback            — Slack OAuth callback
 * GET    /tasks                          — Approved task list
 * POST   /tasks                          — Manual task create
 * GET    /tasks/candidates               — Pending candidates
 * POST   /tasks/candidates/:id/approve   — Approve candidate
 * DELETE /tasks/candidates/:id           — Reject candidate
 * GET    /tasks/:id                      — Single task
 * PATCH  /tasks/:id                      — Inline edit
 * DELETE /tasks/:id                      — Soft delete
 * GET    /tasks/:taskId/proposal         — Sabori proposal (SSE / sync)
 * POST   /tasks/:taskId/honne            — Honne recording
 * GET    /connections                    — Service connections
 * DELETE /connections/:service           — Disconnect service
 */

import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BedrockClientAdapter,
  SaboriProposerAgent,
  PersonaRenderer,
} from "@saboru/agent";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRoute } from "./routes/health.js";
import { createAuthRoute } from "./routes/auth.js";
import { createTasksRoute } from "./routes/tasks.js";
import { createProposalsRoute } from "./routes/proposals.js";
import { createHonneRoute } from "./routes/honne.js";
import { createConnectionsRoute } from "./routes/connections.js";
import { DynamoUserRepository } from "./repositories/DynamoUserRepository.js";
import { DynamoServiceConnectionRepository } from "./repositories/DynamoServiceConnectionRepository.js";
import { DynamoTaskCandidateRepository } from "./repositories/DynamoTaskCandidateRepository.js";
import { DynamoTaskRepository } from "./repositories/DynamoTaskRepository.js";
import { DynamoProposalRepository } from "./repositories/DynamoProposalRepository.js";
import { DynamoHonneRepository } from "./repositories/DynamoHonneRepository.js";
import { env } from "./config/env.js";
import { openApiDoc } from "./config/openapi.js";

// Initialize DynamoDB client (shared across all repositories)
const dynamoClient = new DynamoDBClient({ region: "ap-northeast-1" });

// Initialize repositories
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

// Initialize SaboriProposerAgent (U-03b dependency)
const bedrockClient = new BedrockClientAdapter();
const personaRenderer = new PersonaRenderer(bedrockClient);
const saboriProposerAgent = new SaboriProposerAgent(
  bedrockClient,
  proposalRepository,
  personaRenderer,
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
  app.route("/auth", createAuthRoute(connectionRepository));
  app.route("/tasks", createTasksRoute(taskRepository, candidateRepository));
  // Proposal and honne share the /tasks prefix for :taskId param
  app.route(
    "/tasks",
    createProposalsRoute(
      taskRepository,
      proposalRepository,
      saboriProposerAgent,
    ),
  );
  app.route(
    "/tasks",
    createHonneRoute(taskRepository, honneRepository, proposalRepository),
  );
  app.route("/connections", createConnectionsRoute(connectionRepository));

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
