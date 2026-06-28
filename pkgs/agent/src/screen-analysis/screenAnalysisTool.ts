import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { z } from "zod";

/**
 * screen_match Tool — 画面スクリーンショット判定の Bedrock Tool Use スキーマ
 *
 * ユーザーの現在のアクティブタブのスクリーンショット（画像）と、次タスクの
 * 期待タイトルを受け取り、「その画面が次タスクの作業画面か」を判定する。
 * 余白タブの復帰チェック（サボりから次タスクへ切り替えたか）に使う。
 *
 * toolChoice.tool 強制（DP-02）＋ Zod 検証（DP-03）。
 */

export const SCREEN_MATCH_TOOL_NAME = "screen_match";

export const SCREEN_MATCH_TOOL: Tool = {
  toolSpec: {
    name: SCREEN_MATCH_TOOL_NAME,
    description:
      "スクリーンショットを観察し、それが指定された次タスクの作業画面かどうかを判定して構造化データを返す",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          matched: {
            type: "boolean",
            description:
              "画面が次タスクの作業に取りかかっている様子なら true、無関係（SNS・動画・ニュース等のサボり画面や、明らかに別作業）なら false",
          },
          observedActivity: {
            type: "string",
            description:
              "画面から読み取れる作業内容の短い説明（例: 『議事録ドキュメントを編集中』『YouTubeで動画視聴中』）。50文字以内",
            maxLength: 80,
          },
          confidence: {
            type: "number",
            description: "判定の確信度。0.0〜1.0",
            minimum: 0,
            maximum: 1,
          },
        },
        required: ["matched", "observedActivity", "confidence"],
      },
    },
  },
};

/** screen_match ツール出力を検証する Zod スキーマ（DP-03） */
export const ScreenMatchSchema = z.object({
  matched: z.boolean(),
  observedActivity: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
});

export type ScreenMatchOutput = z.infer<typeof ScreenMatchSchema>;

/** screen_match のシステムプロンプト */
export const SCREEN_MATCH_SYSTEM_PROMPT = `あなたは、ユーザーのPC画面を見て「次のタスクに取りかかれているか」を判断するアシスタントです。
与えられたスクリーンショットを観察し、それが指定された次タスクの作業画面かどうかを判定してください。

## 判定の方針
- 次タスクのタイトル・キーワードに関連する作業（ドキュメント編集、該当ツール、関連資料、会議画面など）が見えれば matched=true
- SNS・動画・ニュース・ショッピング・ゲームなど、サボり/気晴らしの画面なら matched=false
- 明らかに別の無関係な作業なら matched=false
- タイトル文字列の一致だけでなく、画面に写っているアプリ・内容から実際の作業状況を読み取る
- 判断に迷う場合は confidence を低めにする

## 出力
- screen_match ツールで matched / observedActivity / confidence を返す
- observedActivity は画面から読み取れる事実のみ。推測しすぎない`;
