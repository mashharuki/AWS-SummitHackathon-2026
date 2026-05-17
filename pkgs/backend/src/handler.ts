/**
 * API Lambda entry point
 *
 * Wraps the Hono app with hono/aws-lambda for Lambda invocation.
 * Handler name: index.handler (configured in CDK ApiStack)
 *
 * Supports Lambda Response Streaming for SSE endpoints (streamSSE).
 *
 * Note: This file is a Lambda entrypoint adapter only.
 * All business logic resides in index.ts/routes/*.ts.
 * Coverage is excluded because it cannot be exercised outside the Lambda runtime.
 */
/* istanbul ignore file */
import { handle } from "hono/aws-lambda";
import app from "./index.js";

// Wrap Hono app as Lambda handler
/* istanbul ignore next */
export const handler = handle(app);
