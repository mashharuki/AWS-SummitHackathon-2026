/**
 * 認証ミドルウェア — API Gateway HTTP API v2 コンテキストからの JWT クレーム抽出
 *
 * API Gateway HTTP API + JWT オーソライザーは Lambda 呼び出し前に
 * event.requestContext.authorizer.jwt.claims に検証済みクレームを注入する。
 * hono/aws-lambda は生の Lambda イベントを c.env (LambdaEvent 型) として公開する。
 *
 * NFR-S1: userId は Hono Variable として伝郎される (型安全、ルートで直接 env アクセスなし)
 */

import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "../errors.js";
import type { AppEnv } from "../types.js";

/**
 * hono/aws-lambda が c.env で公開する Lambda イベントの形式
 * JWT クレームに関連するフィールドのみを型付けする。
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
 * JWT オーソライザーコンテキストから Cognito `sub` (userId) を抽出し、
 * 下流ハンドラー向けに `c.Variables.userId` として設定する。
 *
 * クレームがない場合は UnauthorizedError (401) をスローする。
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
