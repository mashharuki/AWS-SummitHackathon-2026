/**
 * Hono 向けグローバルエラーハンドラーミドルウェア
 *
 * NFR-R1: 集中エラーハンドリング — ルートは型付きエラーをスローし、
 * このハンドラーが構造化 JSON レスポンスにマッピングする。
 *
 * エラーレスポンスの形式:
 * { "error": { "code": "ERROR_CODE", "message": "human-readable" } }
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../errors.js";

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    return c.json(
      { error: { code: err.code, message: err.message } },
      err.statusCode as ContentfulStatusCode,
    );
  }

  // Hono 組み込み HTTPException
  if ("status" in err && "message" in err) {
    const httpErr = err as { status: number; message: string };
    return c.json(
      { error: { code: "HTTP_ERROR", message: httpErr.message } },
      (httpErr.status ?? 500) as ContentfulStatusCode,
    );
  }

  console.error("[UNHANDLED_ERROR]", {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  return c.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } },
    500,
  );
};
