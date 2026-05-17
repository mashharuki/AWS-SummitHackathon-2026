/**
 * Proposal routes — Sabori proposal generation with SSE streaming
 *
 * GET /tasks/:taskId/proposal?stream=true  — SSE stream (US-09)
 * GET /tasks/:taskId/proposal              — Synchronous (cached or generate)
 *
 * NFR-P2: Lambda Response Streaming via streamSSE
 * Pattern 5 from NFR Design: streamSSE + SaboriProposerAgent async iterator
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../types.js";
import { authMiddleware } from "../middleware/auth.js";
import { NotFoundError } from "../errors.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import type { SaboriProposerAgent } from "@saboru/agent";
import type { TaskContext } from "@saboru/agent";

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
   * Query params:
   * - stream=true: Returns SSE stream (text/event-stream)
   * - (default): Returns JSON synchronously
   *
   * Cache logic: if latest proposal.nextCheckAt > now, return cached.
   * Otherwise generate via SaboriProposerAgent.
   */
  proposals.get("/:taskId/proposal", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");
    const isStream = c.req.query("stream") === "true";

    // Ownership verification
    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    // Cache check
    const cached = await proposalRepository.findLatestByTaskId(taskId);
    const isCacheValid = cached && new Date(cached.nextCheckAt) > new Date();

    if (isCacheValid) {
      if (!isStream) {
        return c.json(cached);
      }
      // Even for cached, deliver as SSE if stream=true
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

    // Build TaskContext
    const context: TaskContext = { task };

    if (!isStream) {
      // Synchronous generation
      const proposal = await agent.propose(taskId, context);
      return c.json(proposal);
    }

    // Streaming generation
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
