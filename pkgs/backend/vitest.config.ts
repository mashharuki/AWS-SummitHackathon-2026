import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    // Resolve workspace packages to their dist/index.js (actual built output)
    // @saboru/shared and @saboru/agent export ".mjs" in package.json but tsup builds to ".js"
    alias: {
      "@saboru/shared": path.resolve(
        __dirname,
        "../../pkgs/shared/dist/index.js",
      ),
      "@saboru/agent": path.resolve(
        __dirname,
        "../../pkgs/agent/dist/index.js",
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        // OpenAPI spec: generated definition, no logic to test
        "src/config/openapi.ts",
        // Lambda entrypoint adapters: wrap hono/aws-lambda handle(),
        // cannot be exercised outside the Lambda runtime
        "src/handler.ts",
        "src/webhook-handler.ts",
        // index.ts: module-level DI wiring (DynamoDB/Bedrock clients, repositories).
        // createApp() function logic is covered via route-level tests.
        // The module-level initialisation requires live env vars and AWS clients.
        "src/index.ts",
        "src/**/*.test.ts",
        "src/**/__tests__/**",
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
