/**
 * 構造化 JSON ロガー (DP-07)
 *
 * 目的: 外部依存なしに CloudWatch クエリ可能な JSON ログを出力する。
 * PII ポリシー: メッセージ本文・依頼者名・ Slack ユーザー ID は絶対にログしない。
 *
 * CloudWatch Insights クエリ例:
 *   fields @timestamp, level, action, sourceRef
 *   | filter unit = "task-extractor" and level = "ERROR"
 *   | sort @timestamp desc
 */

type LogLevel = "INFO" | "WARN" | "ERROR";

export function log(level: LogLevel, data: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level,
      unit: "task-extractor",
      timestamp: new Date().toISOString(),
      ...data,
    }),
  );
}

export function logInfo(data: Record<string, unknown>): void {
  log("INFO", data);
}

export function logWarn(data: Record<string, unknown>): void {
  log("WARN", data);
}

export function logError(data: Record<string, unknown>): void {
  log("ERROR", data);
}
