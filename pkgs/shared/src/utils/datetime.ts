/**
 * Convert ISO 8601 datetime to natural Japanese expression (FR-03 display)
 *
 * Conversion rules:
 * - Same day: "今日 HH:mm"
 * - Next day: "明日 HH:mm"
 * - 2+ days later: "M月D日 HH:mm"
 * - null: "締切なし"
 *
 * All datetimes converted to JST (UTC+9)
 *
 * @example
 * formatDeadline('2026-05-18T14:00:00Z') // → '明日 23:00' (JST conversion)
 * formatDeadline(null) // → '締切なし'
 *
 * @param isoDate ISO 8601 datetime string or null
 * @returns Japanese natural expression string
 */
export function formatDeadline(isoDate: string | null): string {
  if (!isoDate) return "締切なし";

  const timeStr = new Date(isoDate).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });

  // Get date-only in JST for day diff calculation
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
 * Return remaining minutes from current time to specified datetime
 *
 * @param isoDate Target ISO 8601 datetime
 * @returns Positive: future (remaining minutes), Negative: past (overdue minutes)
 */
export function minutesUntil(isoDate: string): number {
  return Math.floor((new Date(isoDate).getTime() - Date.now()) / (1000 * 60));
}

/**
 * Check if deadline has passed
 *
 * @param isoDate Target ISO 8601 datetime
 * @returns true if overdue
 */
export function isOverdue(isoDate: string): boolean {
  return minutesUntil(isoDate) < 0;
}

/**
 * Return current time as ISO 8601 string
 *
 * @param date Date object (default: current time)
 * @returns ISO 8601 datetime string
 */
export function toIsoString(date: Date = new Date()): string {
  return date.toISOString();
}
