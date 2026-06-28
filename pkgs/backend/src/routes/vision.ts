import { zValidator } from "@hono/zod-validator";
import type { ScreenAnalysisAgent } from "@saboru/agent";
import type { ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";

/**
 * vision.ts — 画面スクリーンショット判定エンドポイント（POST /api/vision/analyze-screen）
 *
 * 余白タブの復帰チェックで、background が撮ったアクティブタブのスクリーンショット
 * （base64 JPEG）を受け取り、ScreenAnalysisAgent（Bedrock Vision）で「次タスクの
 * 作業画面か」を判定して返す。
 *
 * 拡張側は失敗時にタイトル文字列マッチへフォールバックするため、ここでの 503 は
 * 致命的ではない（2段フォールバックの1段目）。
 */

const ALLOWED_FORMATS = ["jpeg", "png", "gif", "webp"] as const;

const AnalyzeScreenSchema = z.object({
  /** スクリーンショットの base64（data URL プレフィックスは含まない） */
  imageBase64: z.string().min(1).max(8_000_000),
  /** 画像フォーマット */
  format: z.enum(ALLOWED_FORMATS).default("jpeg"),
  /** 次タスクの期待タイトル */
  expectedTitle: z.string().min(1).max(500),
  /** タブの title / URL など補足（任意） */
  pageHint: z.string().max(1000).optional(),
  /** 対象タスクID（任意・ログ用） */
  taskId: z.string().optional(),
});

export function createVisionRoute(
  screenAnalysisAgent: ScreenAnalysisAgent,
): Hono<AppEnv> {
  const vision = new Hono<AppEnv>();
  vision.use("*", authMiddleware);

  /**
   * POST /vision/analyze-screen — スクリーンショットが次タスク画面か判定する
   *
   * Errors:
   * - 400 VALIDATION_ERROR: リクエスト不正
   * - 503 VISION_ANALYSIS_FAILED: Bedrock 呼び出し失敗（拡張側はタイトル一致へフォールバック）
   */
  vision.post(
    "/analyze-screen",
    zValidator("json", AnalyzeScreenSchema, (result, c) => {
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
      const body = c.req.valid("json");

      let imageBytes: Uint8Array;
      try {
        // data URL プレフィックスが付いていても剥がす
        const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        imageBytes = Uint8Array.from(Buffer.from(base64, "base64"));
      } catch {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "imageBase64 をデコードできませんでした",
            },
          },
          400,
        );
      }

      try {
        const result = await screenAnalysisAgent.analyzeScreenshot({
          imageBytes,
          format: body.format as ImageFormat,
          expectedTitle: body.expectedTitle,
          pageHint: body.pageHint,
        });
        return c.json({
          matched: result.matched,
          observedActivity: result.observedActivity,
          confidence: result.confidence,
        });
      } catch (err) {
        console.log(
          JSON.stringify({
            level: "ERROR",
            action: "vision_analyze_screen_failed",
            taskId: body.taskId,
            error: String(err),
          }),
        );
        return c.json(
          {
            error: {
              code: "VISION_ANALYSIS_FAILED",
              message: "画面判定に失敗しました",
            },
          },
          503,
        );
      }
    },
  );

  return vision;
}
