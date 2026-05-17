/**
 * Honne (true feeling) reply text generator
 *
 * Generates Saboru's empathetic response message based on the user's
 * honne reaction type. This keeps "personality" logic out of route handlers.
 *
 * FR-05: User's true reaction is recorded, and Saboru responds accordingly
 * to reinforce the "slacking is OK" mentality (「人をダメにするサービス」theme).
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
 * Get Saboru's reply for a quick_reply honne reaction
 */
export function getQuickReplyMessage(content: QuickReplyType): string {
  return (
    QUICK_REPLY_MESSAGES[content] ??
    "うんうん、気持ちわかるよ。ゆっくりしてね。"
  );
}

/**
 * Get Saboru's reply for a free_text honne reaction
 *
 * For free text, Saboru acknowledges the feeling without judgment.
 */
export function getFreeTextReply(content: string): string {
  const len = content.length;
  if (len < 20) {
    return "そっか。それだけで十分だよ。";
  }
  return "ちゃんと気持ちを言葉にできたね。えらい。今日はもうサボっていい。";
}
