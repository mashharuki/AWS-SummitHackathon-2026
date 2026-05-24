import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["**/node_modules/**", "**/tests/**", "**/*.spec.ts"],
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/three/**",
        "src/lib/soundManager.ts",
        "src/lib/i18n.ts",
        "src/**/*.test.ts",
      ],
      // Thresholds apply to covered code (lib/ + hooks/useReducedMotion)
      // React component coverage requires browser test environment;
      // jsdom-based unit tests focus on business logic in lib/ and hooks/
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
