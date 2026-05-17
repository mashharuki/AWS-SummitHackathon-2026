/**
 * ISO 8601 日時を自然な日本語表現に変換する (FR-03 表示)
 *
 * 変換ルール:
 * - 当日: "今日 HH:mm"
 * - 翌日: "明日 HH:mm"
 * - 2日以降: "M月D日 HH:mm"
 * - null: "締切なし"
 *
 * すべての日時を JST (UTC+9) に変換
 *
 * @example
 * formatDeadline('2026-05-18T14:00:00Z') // → '明日 23:00' (JST 変換)
 * formatDeadline(null) // → '締切なし'
 *
 * @param isoDate ISO 8601 日時文字列または null
 * @returns 日本語の自然表現文字列
 */
export function formatDeadline(isoDate: string | null): string {
  if (!isoDate) return "締切なし";

  const timeStr = new Date(isoDate).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  // 日付差分計算のため JST の日付部分のみ取得
  const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const targetParts = jstFormatter.formatToParts(new Date(isoDate));
  const nowParts = jstFormatter.formatToParts(new Date());

  const targetDate = new Date(
    `${targetParts.find((p) => p.type === "year")?.value}-${targetParts.find((p) => p.type === "month")?.value}-${targetParts.find((p) => p.type === "day")?.value}`,
  );
  const nowDate = new Date(
    `${nowParts.find((p) => p.type === "year")?.value}-${nowParts.find((p) => p.type === "month")?.value}-${nowParts.find((p) => p.type === "day")?.value}`,
  );

  const diffMs = targetDate.getTime() - nowDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return `今日 ${timeStr}`;
  if (diffDays === 1) return `明日 ${timeStr}`;

  const dateStr = new Date(isoDate).toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
  return `${dateStr} ${timeStr}`;
}

/**
 * 現在時刻から指定日時までの残り分数を返す
 *
 * @param isoDate 対象の ISO 8601 日時
 * @returns 正の値: 未来 (残り分数)、負の値: 過去 (超過分数)
 */
export function minutesUntil(isoDate: string): number {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / (1000 * 60));
}

/**
 * 締切が過ぎているか確認する
 *
 * @param isoDate 対象の ISO 8601 日時
 * @returns 期限超過の場合 true
 */
export function isOverdue(isoDate: string): boolean {
  return minutesUntil(isoDate) < 0;
}

/**
 * 現在時刻を ISO 8601 文字列として返す
 *
 * @param date Date オブジェクト (デフォルト: 現在時刻)
 * @returns ISO 8601 日時文字列
 */
export function toIsoString(date: Date = new Date()): string {
  return date.toISOString();
}
