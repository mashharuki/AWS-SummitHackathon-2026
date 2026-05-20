/**
 * ユーザールート — GET /api/users/me
 *
 * 認証済みユーザーのプロフィールを返す。
 * DynamoDB に未登録の場合は初回ログイン扱いで upsert してから返す。
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoUserRepository } from "../repositories/DynamoUserRepository.js";
import type { AppEnv } from "../types.js";

type CognitoLambdaEvent = {
  requestContext?: {
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
};

export function createUsersRoute(userRepository: DynamoUserRepository) {
  const users = new Hono<AppEnv>();

  users.get("/me", authMiddleware, async (c) => {
    const userId = c.get("userId");

    const existing = await userRepository.findById(userId);
    if (existing) {
      return c.json(existing);
    }

    // 初回ログイン: Cognito JWT クレームからプロフィールを生成して保存
    const lambdaEvent = (c.env as unknown as CognitoLambdaEvent) ?? {};
    const claims =
      lambdaEvent?.requestContext?.authorizer?.jwt?.claims ?? {};

    const user = await userRepository.upsert({
      cognitoSub: userId,
      email: claims["email"] ?? "",
      name:
        claims["name"] ??
        claims["cognito:username"] ??
        claims["email"] ??
        userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return c.json(user, 201);
  });

  return users;
}
