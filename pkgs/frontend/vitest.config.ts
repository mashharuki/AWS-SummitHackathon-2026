import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { resolve } from "path";

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
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/mocks/**",
        "src/main.tsx",
        "src/**/*.test.{ts,tsx}",
        "src/test-setup.ts",
      ],
      // Thresholds apply to covered code (lib/ + hooks/useReducedMotion)
      // React component coverage requires browser test environment;
      // jsdom-based unit tests focus on business logic in lib/ and hooks/
      thresholds: {
        statements: 15,
        branches: 15,
        functions: 15,
        lines: 15,
      },
    },
  },
});
