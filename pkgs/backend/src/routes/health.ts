/**
 * ヘルスチェックルート — GET /health
 *
 * 認証不要。API Gateway ヘルスチェックおよび
 * 稼働監視に使用する。ビルド情報を含む 200 を返す。
 */

import { Hono } from "hono";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "saborou-api",
    timestamp: new Date().toISOString(),
  });
});
