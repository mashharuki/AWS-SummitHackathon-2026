/**
 * 本音記録ルート
 *
 * POST /tasks/:taskId/honne — ユーザーの本音リアクションを記録する (US-10 / FR-05)
 *
 * サボり提案に対するユーザーの感情的反応を保存する。
 * このデータは将来の「ユーザーマニュアル」生成の素材として使われる
 * (「人をダメにするサービス」— ユーザーのサボりパターンから学習)。
 */

import { zValidator } from "@hono/zod-validator";
import { CreateHonneSchema, toIsoString } from "@saboru/shared";
import { Hono } from "hono";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoHonneRepository } from "../repositories/DynamoHonneRepository.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import {
  getFreeTextReply,
  getQuickReplyMessage,
} from "../services/honne-reply.js";
import type { AppEnv } from "../types.js";

export function createHonneRoute(
  taskRepository: DynamoTaskRepository,
  honneRepository: DynamoHonneRepository,
  proposalRepository: DynamoProposalRepository,
): Hono<AppEnv> {
  const honne = new Hono<AppEnv>();

  honne.use("*", authMiddleware);

  /**
   * POST /tasks/:taskId/honne
   *
   * リクエストボディ (判別ユニオン):
   * - { type: "quick_reply", content: QuickReplyType }
   * - { type: "free_text", content: string (1ー500 文字) }
   *
   * サボるの共感的な返信メッセージを返す。
   */
  honne.post(
    "/:taskId/honne",
    zValidator("json", CreateHonneSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid honne data",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      const userId = c.get("userId");
      const taskId = c.req.param("taskId");
      const body = c.req.valid("json");

      // タスクの所有者確認
      const task = await taskRepository.findById(userId, taskId);
      if (!task) throw new NotFoundError(`Task ${taskId} not found`);

      // コンテキスト保全のため素の提案バーディクトを取得 (FR-05)
      const latestProposal =
        await proposalRepository.findLatestByTaskId(taskId);
      const proposalVerdict = latestProposal?.verdict ?? "borderline";

      // 本音データを保存
      await honneRepository.save({
        userId,
        taskId,
        type: body.type,
        content: body.content,
        proposalVerdict,
        createdAt: toIsoString(new Date()),
      });

      // サボるの共感的な返信を生成
      const replyMessage =
        body.type === "quick_reply"
          ? getQuickReplyMessage(body.content)
          : getFreeTextReply(body.content);

      return c.json(
        {
          message: replyMessage,
          recorded: true,
        },
        201,
      );
    },
  );

  return honne;
}
