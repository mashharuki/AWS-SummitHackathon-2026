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
});
