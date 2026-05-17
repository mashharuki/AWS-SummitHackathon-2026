/**
 * Global error handler middleware for Hono
 *
 * NFR-R1: Centralised error handling — routes throw typed errors,
 * this handler maps them to structured JSON responses.
 *
 * Error response shape:
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

  // Hono built-in HTTPException
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
