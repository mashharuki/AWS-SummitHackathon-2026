/**
 * リクエストロガーミドルウェア
 *
 * CloudWatch Logs Insights クエリに対応した構造化 JSON ログを出力する。
 * ログフォーマット:
 * { "level": "INFO", "action": "request", "method": "GET", "path": "/health", "status": 200, "durationMs": 5 }
 */

import { createMiddleware } from "hono/factory";

export const requestLogger = createMiddleware(async (c, next) => {
  const startMs = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  await next();

  const status = c.res.status;
  const durationMs = Date.now() - startMs;

  console.log(
    JSON.stringify({
      level: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
      action: "request",
      method,
      path,
      status,
      durationMs,
    }),
  );
});
