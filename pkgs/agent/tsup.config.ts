import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "task-extractor/TaskExtractorLambdaHandler":
      "src/task-extractor/TaskExtractorLambdaHandler.ts",
    "sabori-proposer/SaboriProposerLambdaHandler":
      "src/sabori-proposer/SaboriProposerLambdaHandler.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  // Bundle all dependencies for Lambda deployment (exclude nothing)
  // @saboru/shared is a workspace package — include it via its dist
  noExternal: [/^(?!@saboru\/shared$).*/],
  // Target Node.js 22 (Lambda runtime)
  target: "node22",
  platform: "node",
  // CJS → .js (Lambda handler resolution), ESM → .mjs
  // "type": "module" in package.json causes tsup to emit ESM as .js by default,
  // which Lambda treats as CommonJS and fails. This swaps the extensions.
  outExtension({ format }) {
    return { js: format === "cjs" ? ".js" : ".mjs" };
  },
});
