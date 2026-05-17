/**
 * Health check route — GET /health
 *
 * No authentication required. Used by API Gateway health checks
 * and uptime monitoring. Returns 200 with build info.
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
