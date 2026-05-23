/**
 * ユーザールート — GET /api/users/me
 *
 * 認証済みユーザーのプロフィールを返す。
 * DynamoDB に未登録の場合は初回ログイン扱いで upsert してから返す。
 */

import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoHonneRepository } from "../repositories/DynamoHonneRepository.js";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createUsersRoute(
  userRepository: DynamoUserRepository,
  honneRepository: DynamoHonneRepository,
) {
  const users = new Hono<AppEnv>();

  users.get("/me", authMiddleware, async (c) => {
    const userId = c.get("userId");

    // Cognito JWT クレームを先に取得（既存ユーザー名の修復にも使う）
    const lambdaEvent = (c.env as unknown as CognitoLambdaEvent) ?? {};
    const claims = lambdaEvent?.requestContext?.authorizer?.jwt?.claims ?? {};
    const resolvedName =
      // cognito:username は Cognito 内部生成の UUID なのでフォールバックに使わない
      claims.name ?? claims.email ?? "";

    const existing = await userRepository.findById(userId);
    if (existing) {
      // 名前が UUID 形式（フォールバック保存済み）かつより良い名前が取れた場合は自動修復
      if (
        UUID_PATTERN.test(existing.name) &&
        resolvedName &&
        resolvedName !== userId
      ) {
        const updated = await userRepository.upsert({
          cognitoSub: existing.cognitoSub,
          email: existing.email || (claims.email ?? ""),
          name: resolvedName,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
        return c.json(updated);
      }
      return c.json(existing);
    }

    // 初回ログイン: Cognito JWT クレームからプロフィールを生成して保存
    const user = await userRepository.upsert({
      cognitoSub: userId,
      email: claims.email ?? "",
      name: resolvedName || userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return c.json(user, 201);
  });

  // GET /api/users/me/dependency-score — 現在のAI依存度スコアを返す
  users.get("/me/dependency-score", authMiddleware, async (c) => {
    const userId = c.get("userId");
    const score = await userRepository.getDependencyScore(userId);
    return c.json({ score });
  });

  // POST /api/users/me/dependency-score/decrement — スコアを減少させる
  users.post("/me/dependency-score/decrement", authMiddleware, async (c) => {
    const userId = c.get("userId");
    let rawDelta = 1;
    try {
      const body = await c.req.json<{ delta?: number }>();
      rawDelta = body.delta ?? 1;
    } catch {
      // body が空の場合はデフォルト値を使用
    }
    const delta = Math.min(Math.max(1, rawDelta), 10);
    const score = await userRepository.decrementDependencyScore(userId, delta);
    return c.json({ score });
  });

  // GET /api/users/me/honne/summary — 本音データの集計サマリーを返す
  users.get("/me/honne/summary", authMiddleware, async (c) => {
    const userId = c.get("userId");
    const honneList = await honneRepository.findAllByUserId(userId);

    const breakdown = {
      agree_with_ai: 0,
      truly_tired: 0,
      disagree_with_ai: 0,
      actually_important: 0,
    };

    const recentFreeTexts: string[] = [];

    for (const h of honneList) {
      if (h.type === "quick_reply") {
        const key = h.content as keyof typeof breakdown;
        if (key in breakdown) breakdown[key]++;
      } else if (h.type === "free_text" && typeof h.content === "string") {
        recentFreeTexts.push(h.content);
      }
    }

    return c.json({
      count: honneList.length,
      quickReplyBreakdown: breakdown,
      recentFreeTexts: recentFreeTexts.slice(0, 5),
    });
  });

  return users;
}
