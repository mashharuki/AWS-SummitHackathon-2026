/**
 * Structured JSON logger (DP-07)
 *
 * Purpose: Emit CloudWatch-queryable JSON logs without external dependencies.
 * PII Policy: Never log message text, requester name, or Slack user IDs.
 *
 * CloudWatch Insights query example:
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
