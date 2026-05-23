/**
 * ユーザールート — GET /api/users/me
 *
 * 認証済みユーザーのプロフィールを返す。
 * DynamoDB に未登録の場合は初回ログイン扱いで upsert してから返す。
 */

import { zValidator } from "@hono/zod-validator";
import { isValidPersonaId } from "@saboru/shared";
import { Hono } from "hono";
import { z } from "zod";
import { NotFoundError } from "../errors.js";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createUsersRoute(userRepository: DynamoUserRepository) {
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
      // 自己修復: 過去に access_token 経由で name/email が空（または UUID）保存された
      // ユーザーを、id_token のクレームで補完する。
      // - name が UUID 形式（フォールバック保存済み）でより良い名前が取れた
      // - または email が空でクレームから補完できる
      const claimEmail = claims.email ?? "";
      const needsNameFix =
        UUID_PATTERN.test(existing.name) &&
        resolvedName !== "" &&
        resolvedName !== userId;
      const needsEmailFix = existing.email === "" && claimEmail !== "";

      if (needsNameFix || needsEmailFix) {
        const updated = await userRepository.upsert({
          cognitoSub: existing.cognitoSub,
          email: existing.email || claimEmail,
          name: needsNameFix ? resolvedName : existing.name,
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

  /**
   * PUT /me/persona — 好みの AI ペルソナを更新する（D: ペルソナ切替）
   * body: { personaId }
   */
  users.put(
    "/me/persona",
    authMiddleware,
    zValidator(
      "json",
      z.object({ personaId: z.string().min(1) }),
      (result, c) => {
        if (!result.success) {
          return c.json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Invalid request body",
                details: result.error.flatten(),
              },
            },
            400,
          );
        }
      },
    ),
    async (c) => {
      const userId = c.get("userId");
      const { personaId } = c.req.valid("json");

      if (!isValidPersonaId(personaId)) {
        return c.json(
          {
            error: {
              code: "INVALID_PERSONA",
              message: `Unknown personaId: ${personaId}`,
            },
          },
          400,
        );
      }

      const existing = await userRepository.findById(userId);
      if (!existing) throw new NotFoundError("User profile not found");

      const updated = await userRepository.upsert({
        cognitoSub: existing.cognitoSub,
        email: existing.email,
        name: existing.name,
        ...(existing.slackUserId ? { slackUserId: existing.slackUserId } : {}),
        ...(existing.slackTeamId ? { slackTeamId: existing.slackTeamId } : {}),
        preferredPersonaId: personaId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      });

      return c.json(updated);
    },
  );

  return users;
}
