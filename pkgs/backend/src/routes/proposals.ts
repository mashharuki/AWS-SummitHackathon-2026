/**
 * 提案ルート — SSE ストリーミングによるサボり提案生成
 *
 * GET /tasks/:taskId/proposal?stream=true  — SSE ストリーム (US-09)
 * GET /tasks/:taskId/proposal              — 同期 (キャッシュまたは生成)
 *
 * NFR-P2: streamSSE による Lambda Response Streaming
 * パターン 5 (NFR 設計): streamSSE + SaboriProposerAgent 非同期イテレータ
 */

import { zValidator } from "@hono/zod-validator";
import type {
  CalendarContext,
  SaboriProposerAgent,
  SaboriProposerAgentV2,
  TaskContext,
} from "@saboru/agent";
import { DEFAULT_PERSONA_ID } from "@saboru/shared";
import { Hono } from "hono";
import { stream, streamSSE } from "hono/streaming";
import { z } from "zod";
import { NotFoundError } from "../errors.js";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoGoogleCalendarCacheRepository } from "../repositories/DynamoGoogleCalendarCacheRepository.js";
import type { DynamoProposalRepository } from "../repositories/DynamoProposalRepository.js";
import type { DynamoTaskRepository } from "../repositories/DynamoTaskRepository.js";
import type { DynamoUserRepository } from "../repositories/DynamoUserRepository.js";
import type { AppEnv } from "../types.js";

/**
 * POST /judge リクエストボディの Zod スキーマ（Chrome 拡張 agentClient の契約に準拠）
 * message: Slack から受信したメッセージ本文（必須）
 * senderName: 送信者名（任意・文脈ヒントに使用）
 */
const JudgeSaboriSchema = z.object({
  message: z.string().min(1),
  senderName: z.string().optional(),
});

export function createProposalsRoute(
  taskRepository: DynamoTaskRepository,
  proposalRepository: DynamoProposalRepository,
  agent: SaboriProposerAgent,
  userRepository: DynamoUserRepository,
  calendarCacheRepository?: DynamoGoogleCalendarCacheRepository,
  // 末尾オプショナル引数として追加（既存呼び出し・テストの後方互換を維持）
  saboriProposerAgentV2?: SaboriProposerAgentV2,
): Hono<AppEnv> {
  const proposals = new Hono<AppEnv>();

  proposals.use("*", authMiddleware);

  /** ユーザーの好みペルソナを取得（未設定はデフォルト） */
  async function resolvePersonaId(userId: string): Promise<string> {
    const user = await userRepository.findById(userId);
    return user?.preferredPersonaId ?? DEFAULT_PERSONA_ID;
  }

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

    // TaskContext を構築（calendarContext を注入: BR-G-05）
    let calendarContext: CalendarContext | undefined;
    if (calendarCacheRepository) {
      const cache = await calendarCacheRepository.findByUserId(userId);
      if (cache) {
        const fetchedAtMs = new Date(cache.fetchedAt).getTime();
        const isValid = Date.now() - fetchedAtMs < 24 * 60 * 60 * 1000;
        if (isValid) {
          calendarContext = {
            upcomingEventCount: cache.upcomingEventCount,
            nextEventStartsInMinutes: cache.nextEventStartsInMinutes,
            freeSlotMinutesToday: cache.freeSlotMinutesToday,
            busyScore: cache.busyScore,
            fetchedAt: cache.fetchedAt,
          };
        }
      }
    }

    const context: TaskContext = { task, calendarContext };

    const personaId = await resolvePersonaId(userId);

    if (!isStream) {
      // 同期生成
      const proposal = await agent.propose(taskId, context, personaId);
      return c.json(proposal);
    }

    // ストリーミング生成
    return streamSSE(c, async (stream) => {
      stream.onAbort(() => {
        console.warn("[SSE] Client disconnected before completion", { taskId });
      });

      try {
        for await (const delta of agent.proposeStream(
          taskId,
          context,
          personaId,
        )) {
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

  /**
   * POST /tasks/:taskId/proposal
   *
   * Vercel AI SDK useChat (streamProtocol: "text") 向けエンドポイント。
   * agent.propose() を実行し、chatMessage をプレーンテキストストリームで返す。
   */
  proposals.post("/:taskId/proposal", async (c) => {
    const userId = c.get("userId");
    const taskId = c.req.param("taskId");

    const task = await taskRepository.findById(userId, taskId);
    if (!task) throw new NotFoundError(`Task ${taskId} not found`);

    // Calendar コンテキスト注入（BR-G-05）
    let calendarContextPost: CalendarContext | undefined;
    if (calendarCacheRepository) {
      const cache = await calendarCacheRepository.findByUserId(userId);
      if (cache) {
        const fetchedAtMs = new Date(cache.fetchedAt).getTime();
        if (Date.now() - fetchedAtMs < 24 * 60 * 60 * 1000) {
          calendarContextPost = {
            upcomingEventCount: cache.upcomingEventCount,
            nextEventStartsInMinutes: cache.nextEventStartsInMinutes,
            freeSlotMinutesToday: cache.freeSlotMinutesToday,
            busyScore: cache.busyScore,
            fetchedAt: cache.fetchedAt,
          };
        }
      }
    }

    const context: TaskContext = { task, calendarContext: calendarContextPost };
    const personaId = await resolvePersonaId(userId);

    return stream(c, async (s) => {
      try {
        const proposal = await agent.propose(taskId, context, personaId);
        await s.write(proposal.chatMessage);
      } catch (err) {
        console.error("[Stream] POST proposal error", {
          taskId,
          error: String(err),
        });
      }
    });
  });

  /**
   * POST /judge
   *
   * Chrome 拡張（agentClient.judgeTask）向けエンドポイント。
   * Slack で受信したメッセージ本文から返信文ドラフト・サボってよい度・TTS 要約を返す。
   *
   * このルートは index.ts で /api/proposals にマウントされるため、
   * 最終的なパスは POST /api/proposals/judge となる。
   *
   * リクエスト: { message: string, senderName?: string }
   * レスポンス: { replyDraft: string, saboriScore: number, ttsSummary: string }
   */
  proposals.post(
    "/judge",
    zValidator("json", JudgeSaboriSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid judge request",
              details: result.error.flatten(),
            },
          },
          400,
        );
      }
    }),
    async (c) => {
      if (!saboriProposerAgentV2) {
        // V2 エージェント未注入時は機能未提供として 503 を返す
        return c.json(
          {
            error: {
              code: "SERVICE_UNAVAILABLE",
              message: "Sabori judge agent is not configured",
            },
          },
          503,
        );
      }

      const { message, senderName } = c.req.valid("json");

      const draft = await saboriProposerAgentV2.draftReply({
        incomingMessage: message,
        contextHint: senderName ? `送信者: ${senderName}` : undefined,
      });

      // ttsSummary: 返信文ドラフトを TTS 向けに短縮（先頭 100 字程度）
      const ttsSummary =
        draft.replyText.length > 100
          ? `${draft.replyText.slice(0, 100)}…`
          : draft.replyText;

      // TODO(v2): saboriScore（サボってよい度 0-1）を専用 judge ロジックで算出する。
      // 現状 draftReply は本値を返さないため、デモ表示用に固定値 0.5 を返す。
      const saboriScore = 0.5;

      return c.json({
        replyDraft: draft.replyText,
        saboriScore,
        ttsSummary,
      });
    },
  );

  return proposals;
}
