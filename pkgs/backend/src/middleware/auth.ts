/**
 * Auth middleware — JWT claim extraction via API Gateway HTTP API v2 context
 *
 * API Gateway HTTP API + JWT Authorizer injects validated claims into
 * event.requestContext.authorizer.jwt.claims before Lambda invocation.
 * hono/aws-lambda exposes the raw Lambda event as c.env (LambdaEvent type).
 *
 * NFR-S1: userId is propagated as Hono Variable (type-safe, no direct env access in routes)
 */

import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types.js";
import { UnauthorizedError } from "../errors.js";

/**
 * Shape of the Lambda event as exposed by hono/aws-lambda via c.env
 * Only the fields relevant to JWT claims are typed here.
 */
type LambdaEvent = {
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: {
          sub?: string;
        };
      };
    };
  };
};

/**
 * authMiddleware
 *
 * Extracts Cognito `sub` (userId) from the JWT authorizer context and sets it
 * as `c.Variables.userId` for downstream handlers.
 *
 * Throws UnauthorizedError (401) if the claim is absent.
 */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const lambdaEvent = (c.env as unknown as LambdaEvent | undefined) ?? {};
  const sub = (lambdaEvent as LambdaEvent).requestContext?.authorizer?.jwt
    ?.claims?.sub;

  if (!sub) {
    throw new UnauthorizedError("Missing userId claim in JWT");
  }

  c.set("userId", sub);
  await next();
});
