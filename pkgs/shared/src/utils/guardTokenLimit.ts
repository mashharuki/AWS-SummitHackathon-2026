/**
 * デフォルトのトークン制限値 (Q8 回答)
 * 環境変数 MAX_TOKEN_LIMIT で上書き可能
 */
export const DEFAULT_MAX_TOKEN_LIMIT = 8000;

/**
 * テキストのおおよそのトークン数を計算する
 *
 * 計算ルール:
 * - 日本語文字 (ひらがな・カタカナ・漢字・全角記号):
 *   1 文字 ≈ 1.5 トークン
 * - その他の文字 (ASCII・数字等):
 *   1 文字 ≈ 0.25 トークン
 *
 * ビジネスルール (BR-12):
 * - Bedrock コストのプリフライトチェックに使用する
 *
 * @param text トークン数を計算するテキスト
 * @returns おおよそのトークン数
 */
export function countTokens(text: string): number {
  // 日本語文字を検出 (ひらがな・カタカナ・漢字・全角記号)
  // Unicode 範囲: CJK 統一漢字、ヒラガナ、カタカナ、全角形式
  const japaneseCharCount = (text.match(/[　-鿿＀-￯]/g) ?? []).length;
  const otherCharCount = text.length - japaneseCharCount;
  return Math.ceil(japaneseCharCount * 1.5 + otherCharCount * 0.25);
}

/**
 * 指定トークン制限内に収まるようテキストをトリミングする
 * Bedrock converse API 呼び出し前のプリフライトガード (NFR-01, NFR-06)
 *
 * 二分探索で効率的にトリミング位置を検索する。
 *
 * ビジネスルール:
 * - SaboriProposerAgent / TaskExtractorAgent は Bedrock 呼び出し前に
 *   必ず guardTokenLimit() を実行する (BR-07)
 * - MAX_TOKEN_LIMIT 環境変数未設定時は DEFAULT_MAX_TOKEN_LIMIT = 8000 を使用 (BR-12)
 * - 制限超過時に BedrockCostExceededError をスローするかは呼び出し元 (Agent 側) が決定する
 *
 * @param prompt Bedrock に送信するプロンプト
 * @param limit トークン制限値 (デフォルト: DEFAULT_MAX_TOKEN_LIMIT または環境変数)
 * @returns トークン制限内に収まるようトリミングされたプロンプト
 */
export function guardTokenLimit(prompt: string, limit?: number): string {
  const effectiveLimit =
    limit ??
    (process.env["MAX_TOKEN_LIMIT"]
      ? Number.parseInt(process.env["MAX_TOKEN_LIMIT"], 10)
      : DEFAULT_MAX_TOKEN_LIMIT);

  if (countTokens(prompt) <= effectiveLimit) {
    return prompt;
  }

  // 二分探索でトリミング位置を検索
  let low = 0;
  let high = prompt.length;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (countTokens(prompt.slice(0, mid)) <= effectiveLimit) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return prompt.slice(0, low);
}
