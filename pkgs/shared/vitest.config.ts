import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        // Type-only files (interfaces/types emit no runtime code)
        "src/types/**",
        "src/repositories/**",
        // Re-export barrel files
        "src/index.ts",
        "src/utils/index.ts",
        "src/errors/index.ts",
        "src/schemas/index.ts",
        // Constants are tested implicitly via schema/util tests
        "src/constants/**",
      ],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
