import { serve } from "@hono/node-server";
import { swaggerUI } from "@hono/swagger-ui";
import { Hono } from "hono";
import { openApiDoc } from "./config/openapi";

// Honoインスタンスを作成
const app = new Hono();

// Sample Endpoint
app.get("/health", (c) => {
  return c.text("ok");
});

// Serve the OpenAPI document
app.get("/doc", (c) => c.json(openApiDoc));

// Use the middleware to serve Swagger UI at /ui
app.get("/ui", swaggerUI({ url: "/doc" }));

serve({
  fetch: app.fetch,
  port: 3000,
});

export default app;
