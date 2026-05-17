/**
 * Webhook Lambda entry point
 *
 * Separate Lambda function for Slack Webhook reception.
 * Handler name: webhook.handler (configured in CDK WebhookStack)
 *
 * Isolation rationale:
 * - Needs SLACK_SIGNING_SECRET_ARN env var (not needed by main API)
 * - Separate execution role with minimal permissions
 * - EventBridge PutEvents permission only
 *
 * Environment variables:
 * - SLACK_SIGNING_SECRET_ARN: Secrets Manager ARN for Slack signing secret
 * - EVENT_BUS_NAME: EventBridge event bus name
 *
 * Note: This file is a Lambda entrypoint adapter only.
 * All business logic resides in routes/webhooks.ts.
 * Coverage is excluded because it cannot be exercised outside the Lambda runtime.
 */
/* istanbul ignore file */
import { handle } from "hono/aws-lambda";
import { Hono } from "hono";
import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { webhooksRoute } from "./routes/webhooks.js";

const webhookApp = new Hono();

// Middleware
webhookApp.use("*", requestLogger);

// Only the webhook route
webhookApp.route("/webhooks", webhooksRoute);

// Error handler
webhookApp.onError(errorHandler);

/* istanbul ignore next */
export const handler = handle(webhookApp);
