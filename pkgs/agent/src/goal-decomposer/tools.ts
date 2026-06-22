import type { Tool } from "@aws-sdk/client-bedrock-runtime";
import { WbsDecomposeOutputSchema } from "./types.js";

export { WbsDecomposeOutputSchema };

export const WBS_DECOMPOSE_TOOL_NAME = "wbs_decompose";

/**
 * wbs_decompose — PMBOK WBS分解ツール定義
 *
 * toolChoice.tool による強制呼び出しで、Claude Sonnet 4.6 から
 * 「ゴール分析 + WBS分解 + 余白提案」の構造化出力を保証する。
 */
export const WBS_DECOMPOSE_TOOL: Tool = {
  toolSpec: {
    name: WBS_DECOMPOSE_TOOL_NAME,
    description: [
      "PMBOK 8th Edition のWBS（Work Breakdown Structure）手法を使ってタスクを分解し、",
      "各サブタスクの種別・所要時間を返す。",
      "また、Slack文脈からユーザーの趣味嗜好を推測し、余白時間の過ごし方を提案する。",
    ].join(""),
    inputSchema: {
      json: {
        type: "object",
        properties: {
          goalSummary: {
            type: "string",
            description: "このタスクのゴールを1文で表現したもの（例: 会議スライドを完成させること）",
          },
          deliverable: {
            type: "string",
            description: "最終成果物の説明（例: 全社会議用の10枚スライド）",
          },
          subtasks: {
            type: "array",
            description: "WBS分解されたサブタスクの配列（3〜6件推奨、最大12件、時系列順）",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  description: "サブタスクID（st1, st2, ... の形式）",
                },
                title: {
                  type: "string",
                  description: "サブタスク名（最大120文字、行動動詞で始める。例: 旅程候補を調査する）",
                },
                description: {
                  type: "string",
                  description: "サブタスクの詳細説明（最大600文字）",
                },
                estimatedMinutes: {
                  type: "integer",
                  description: "所要時間（分、5〜480の範囲、15/30/60刻み推奨）",
                },
                saborouType: {
                  type: "string",
                  enum: ["work", "decision", "saboru"],
                  description: [
                    "work=SABOROUが代行できる通常作業",
                    "decision=人間の意思決定が必要",
                    "saboru=AIが完全自動実行できる（旅程調査・情報収集等）",
                  ].join(" / "),
                },
              },
              required: ["id", "title", "description", "estimatedMinutes", "saborouType"],
            },
          },
          freeTimeSuggestion: {
            type: "string",
            description: "Slack文脈から推測したユーザーの趣味嗜好に基づく余白時間の最高の使い方（1〜2文）",
          },
        },
        required: ["goalSummary", "deliverable", "subtasks", "freeTimeSuggestion"],
      },
    },
  },
};

/**
 * GOAL_DECOMPOSER_SYSTEM_PROMPT
 *
 * PMBOK 8th Edition WBS + SABOROU哲学を注入したシステムプロンプト
 */
export const GOAL_DECOMPOSER_SYSTEM_PROMPT = `あなたはPMBOK 8th Edition準拠のプロジェクトマネージャーです。
SABOROUというシステムの一部として動作し、ユーザーが「最大限サボりながらタスクを完璧にこなす」ことを支援します。

## PM原則（PMBOK 8th Edition）
1. ホリスティックビュー: タスク全体を把握し、不要な作業を排除する
2. 価値フォーカス: すべてのサブタスクが最終ゴールに直結することを確認
3. デリバリ重視: 具体的な成果物を定義する

## WBS分解ルール
- タスクを3〜6個のサブタスクに分解する（シンプルなタスクは少なく）
- 各サブタスクは単一責任の原則に従い、明確なアウトプットを持つ
- saborouTypeの割り当て:
  * "saboru": AIが完全自動実行できる（旅程調査・ホテル検索・情報収集・文書作成等）→ ユーザーはこれをサボれる
  * "work": SABOROUが補助するが最終確認は人間が必要
  * "decision": 人間の判断・意思決定が絶対に必要（予算承認・方針決定等）
- 可能な限り "saboru" タスクを多くする（それがSABOROUの使命）

## 余白時間の提案ルール
- Slackの文脈（メッセージパターン・トピック）からユーザーの趣味嗜好を推測する
- 推測できない場合は一般的な良質な休息（散歩・読書・カフェ等）を提案
- 提案は具体的で実行可能なものにする（「ゆっくりする」より「近くの公園を20分散歩する」）
- タスクが完了したことへの祝福のトーンを含める`;
