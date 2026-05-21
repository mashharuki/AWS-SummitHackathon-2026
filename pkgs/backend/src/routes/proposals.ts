/**
 * 提案ルート — SSE ストリーミングによるサボり提案生成
 *
 * GET /tasks/:taskId/proposal?stream=true  — SSE ストリーム (US-09)
 * GET /tasks/:taskId/proposal              — 同期 (キャッシュまたは生成)
 *
 * NFR-P2: streamSSE による Lambda Response Streaming
 * パターン 5 (NFR 設計): streamSSE + SaboriProposerAgent 非同期イテレータ
 */

import type { SaboriProposerAgent, TaskContext } from "@saboru/agent";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { AppEnv } from "../types.js";

export function createProposalsRoute(
  taskRepository: DynamoTaskRepository,
  proposalRepository: DynamoProposalRepository,
  agent: SaboriProposerAgent,
): Hono<AppEnv> {
  const proposals = new Hono<AppEnv>();

  proposals.use("*", authMiddleware);

  /**
   * GET /tasks/:taskId/proposal
   *
   * クエリパラメータ:
   * - stream=true: SSE ストリームを返す (text/event-stream)
   * - (デフォルト): JSON を同期的に返す
   *
   * キャッシュロジック: 最新の proposal.nextCheckAt > 現在時刻の場合、キャッシュを返す。
   * それ以外は SaboriProposerAgent 経由で生成する。
   */
  proposals.get("/:taskId/proposal", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");
    const isStream = c.req.query("stream") === "true";

    // 所有者確認
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    // キャッシュ確認
    const cached = await proposalRepository.findLatestByTaskId(taskId);
    const isCacheValid = cached && new Date(cached.nextCheckAt) > new Date();

    if (isCacheValid) {
      if (!isStream) {
        return c.json(cached);
      }
      // キャッシュ有効時でも stream=true の場合は SSE で配信
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: "verdict",
          data: JSON.stringify({
            type: "verdict",
            verdict: cached.verdict,
            summaryText: cached.summaryText,
          }),
        });
        await stream.writeSSE({
          event: "chat",
          data: JSON.stringify({
            type: "chat",
            chatMessage: cached.chatMessage,
          }),
        });
        await stream.writeSSE({
          event: "done",
          data: JSON.stringify({
            type: "done",
            proposalId: cached.SK,
            cached: true,
          }),
        });
      });
    }

    // TaskContext を構築
    const context: TaskContext = { task };

    if (!isStream) {
      // 同期生成
      const proposal = await agent.propose(taskId, context);
      return c.json(proposal);
    }

    // ストリーミング生成
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => {
        console.warn("[SSE] Client disconnected before completion", { taskId });
      });

      try {
        for await (const delta of agent.proposeStream(taskId, context)) {
          await stream.writeSSE({
            event: delta.type,
            data: JSON.stringify(delta),
          });
          if (delta.type === "complete") break;
        }
      } catch (err) {
        console.error("[SSE] Stream error", { taskId, error: String(err) });
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            message: "Proposal generation failed",
          }),
        });
      }
    });
  });

  return proposals;
}
