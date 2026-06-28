import { zValidator } from "@hono/zod-validator";
import type { SaborouChatAgent } from "@saboru/agent";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import type { DynamoHonneRepository } from "../repositories/DynamoHonneRepository.js";
import type { DynamoUserRepository } from "../repositories/DynamoUserRepository.js";
import type { AppEnv } from "../types.js";

/**
 * chat.ts — 余白タブのサボロー対話エンドポイント（POST /api/chat）
 *
 * 余白タブのチャットは「サボロー本人」がユーザーに語りかける内向きの対話。
 * 会話履歴はステートレス（拡張側が直近数往復を送る）で受け取り、
 * SaborouChatAgent（Bedrock）で構造化された返答（reply / action / tone）を返す。
 *
 * 文体サンプルとして honneRepository の過去 free_text を、呼び名として
 * userRepository の表示名を system プロンプトに注入する。
 */

const ChatMessageSchema = z.object({
  role: z.enum(["user", "saborou"]),
  text: z.string().min(1).max(2000),
});

const ChatRequestSchema = z.object({
  /** 直近の会話履歴（古い順、最後はユーザー発話） */
  messages: z.array(ChatMessageSchema).min(1).max(20),
  /** 対象タスクID（任意。文脈組み立てには context を優先） */
  taskId: z.string().optional(),
  /** タスク・スケジュール等の文脈（拡張側で組み立て済み） */
  context: z.string().max(2000).optional(),
});

/** 文体サンプルに使う free_text honne の最大件数 */
const MAX_STYLE_SAMPLES = 5;

export function createChatRoute(
  chatAgent: SaborouChatAgent,
  honneRepository: DynamoHonneRepository,
  userRepository: DynamoUserRepository,
): Hono<AppEnv> {
  const chat = new Hono<AppEnv>();
  chat.use("*", authMiddleware);

  /**
   * POST /chat — サボローと1ターン対話する
   *
   * Errors:
   * - 400 VALIDATION_ERROR: リクエスト不正
   * - 503 CHAT_GENERATION_FAILED: Bedrock 呼び出し失敗
   */
  chat.post(
    "/",
    zValidator("json", ChatRequestSchema, (result, c) => {
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
    }),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");

      // 文体サンプル（過去の free_text 本音）と呼び名を引く。失敗しても会話は続行。
      const [styleSamples, userName] = await Promise.all([
        loadStyleSamples(honneRepository, userId),
        loadUserName(userRepository, userId),
      ]);

      try {
        const out = await chatAgent.chat({
          messages: body.messages.map((m) => ({ role: m.role, text: m.text })),
          taskContext: body.context,
          styleSamples,
          userName,
        });
        return c.json({
          reply: out.reply,
          ...(out.action ? { action: out.action } : {}),
          ...(out.tone ? { tone: out.tone } : {}),
        });
      } catch (err) {
        console.log(
          JSON.stringify({
            level: "ERROR",
            action: "saborou_chat_failed",
            error: String(err),
          }),
        );
        return c.json(
          {
            error: {
              code: "CHAT_GENERATION_FAILED",
              message: "サボローの応答生成に失敗しました",
            },
          },
          503,
        );
      }
    },
  );

  return chat;
}

/** 過去の free_text 本音を文体サンプル文字列に整形する（失敗時は undefined） */
async function loadStyleSamples(
  honneRepository: DynamoHonneRepository,
  userId: string,
): Promise<string | undefined> {
  try {
    const all = await honneRepository.findAllByUserId(userId);
    const samples = all
      .filter((h) => h.type === "free_text" && typeof h.content === "string")
      .slice(0, MAX_STYLE_SAMPLES)
      .map((h) => `- ${h.content}`);
    return samples.length > 0 ? samples.join("\n") : undefined;
  } catch {
    return undefined;
  }
}

/** ユーザーの表示名を引く（失敗時は undefined） */
async function loadUserName(
  userRepository: DynamoUserRepository,
  userId: string,
): Promise<string | undefined> {
  try {
    const user = await userRepository.findById(userId);
    return user?.name || undefined;
  } catch {
    return undefined;
  }
}
