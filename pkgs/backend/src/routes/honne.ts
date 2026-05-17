/**
 * Honne (true feeling) recording route
 *
 * POST /tasks/:taskId/honne — Record user's true reaction (US-10 / FR-05)
 *
 * Stores the user's emotional response to a sabori proposal.
 * This data is used as raw material for future "user manual" generation
 * (「人をダメにするサービス」— learning from the user's slacking patterns).
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError } from "../errors.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { DynamoHonneRepository } from "../repositories/DynamoHonneRepository.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import { CreateHonneSchema, toIsoString } from "@saboru/shared";
import {
  getQuickReplyMessage,
  getFreeTextReply,
} from "../services/honne-reply.js";

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
   * Body (discriminated union):
   * - { type: "quick_reply", content: QuickReplyType }
   * - { type: "free_text", content: string (1-500 chars) }
   *
   * Returns Saboru's empathetic reply message.
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

      // Verify task ownership
      const task = await taskRepository.findById(userId, taskId);
      if (!task) throw new NotFoundError(`Task ${taskId} not found`);

      // Get current proposal verdict for context preservation (FR-05)
      const latestProposal =
        await proposalRepository.findLatestByTaskId(taskId);
      const proposalVerdict = latestProposal?.verdict ?? "borderline";

      // Save honne data
      await honneRepository.save({
        userId,
        taskId,
        type: body.type,
        content: body.content,
        proposalVerdict,
        createdAt: toIsoString(new Date()),
      });

      // Generate Saboru's empathetic reply
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
