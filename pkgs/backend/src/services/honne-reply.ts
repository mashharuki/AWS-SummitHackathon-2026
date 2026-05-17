/**
 * 本音 (本当の気持ち) 返信テキスト生成器
 *
 * ユーザーの本音リアクションタイプに応じて、サボるの共感的な返信メッセージを生成する。
 * 「パーソナリティ」ロジックをルートハンドラーから分離する。
 *
 * FR-05: ユーザーの本音を記録し、サボるは「サボり OK」の気持ちを強化する
 * ように応答する (「人をダメにするサービス」テーマ)。
 */

import type { QuickReplyType } from "@saboru/shared";

const QUICK_REPLY_MESSAGES: Record<QuickReplyType, string> = {
  truly_tired:
    "そうだよね、ほんとに疲れてるもんね。今日はもう少し休もう。サボっていいよ。",
  actually_important:
    "なるほど、それは大事なタスクかもしれないね。でも、まず深呼吸して。焦りは禁物だよ。",
  agree_with_ai:
    "15分だけやってみようか。でも15分経ったら、またサボっていいからね。",
  disagree_with_ai:
    "そっか、全部無視したいよね。それでいいと思うよ。サボリ魂、大事にして。",
};

/**
 * quick_reply 本音リアクションに対するサボるの返信を取得する
 */
export function getQuickReplyMessage(content: QuickReplyType): string {
  return (
    QUICK_REPLY_MESSAGES[content] ??
    "うんうん、気持ちわかるよ。ゆっくりしてね。"
  );
}

/**
 * free_text 本音リアクションに対するサボるの返信を取得する
 *
 * フリーテキストの場合、サボるは判断せず気持ちを受け入れる。
 */
export function getFreeTextReply(content: string): string {
  const len = content.length;
  if (len < 20) {
    return "そっか。それだけで十分だよ。";
  }
  return "ちゃんと気持ちを言葉にできたね。えらい。今日はもうサボっていい。";
}
