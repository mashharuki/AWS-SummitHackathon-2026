import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

type OpenApiOperation = {
  operationId?: string;
  "x-saborou-mcp-tool"?: string;
  "x-saborou-approval-required"?: boolean;
  description?: string;
};

type OpenApiDoc = {
  paths: Record<string, { post?: OpenApiOperation }>;
};

const schemaPath = join(__dirname, "../schemas/saborou-openapi.yaml");
const registryPath = join(__dirname, "../../backend/src/mcp/registry.ts");

const excludedRouteFragments = [
  "/api/auth",
  "/api/webhooks",
  "/api/docs",
  "/api/openapi",
  "/api/health",
  "/api/internal",
];

function loadOpenApi(): OpenApiDoc {
  return parse(readFileSync(schemaPath, "utf8")) as OpenApiDoc;
}

function extractRegistryTools(): Array<{
  name: string;
  approvalRequired: boolean;
  published: boolean;
}> {
  const source = readFileSync(registryPath, "utf8");
  const entries = source.match(/\{\n    name: "saborou_[\s\S]*?\n  \}/g) ?? [];

  return entries.map((entry) => {
    const name = entry.match(/name: "(saborou_[^"]+)"/)?.[1];
    if (!name) {
      throw new Error(`Unable to parse MCP tool name from registry entry`);
    }

    return {
      name,
      approvalRequired: entry.includes("required: true"),
      published: entry.includes("published: true"),
    };
  });
}

describe("AgentCore OpenAPI schema drift gate", () => {
  test("OpenAPI YAML parses successfully", () => {
    expect(loadOpenApi().paths).toBeDefined();
  });

  test("all published registry tools are present as AgentCore operations", () => {
    const openApi = loadOpenApi();
    const operations = Object.values(openApi.paths).flatMap((pathItem) =>
      pathItem.post ? [pathItem.post] : [],
    );
    const operationIds = operations.map((operation) => operation.operationId);
    const publishedToolNames = extractRegistryTools()
      .filter((tool) => tool.published)
      .map((tool) => tool.name);

    expect(operationIds.sort()).toEqual(publishedToolNames.sort());
  });

  test("all schema paths invoke the MCP adapter boundary only", () => {
    const openApi = loadOpenApi();
    const paths = Object.keys(openApi.paths);

    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).toMatch(/^\/api\/mcp\/tools\/saborou_[a-z_]+$/);
      for (const excluded of excludedRouteFragments) {
        expect(path).not.toContain(excluded);
      }
    }
  });

  test("operation ids, extensions, and URL tool names stay aligned", () => {
    const openApi = loadOpenApi();

    for (const [path, pathItem] of Object.entries(openApi.paths)) {
      const operation = pathItem.post;
      expect(operation).toBeDefined();
      const toolName = path.split("/").at(-1);

      expect(operation?.operationId).toBe(toolName);
      expect(operation?.["x-saborou-mcp-tool"]).toBe(toolName);
    }
  });

  test("approval-required registry tools are marked in OpenAPI", () => {
    const openApi = loadOpenApi();
    const operationById = new Map(
      Object.values(openApi.paths).flatMap((pathItem) =>
        pathItem.post?.operationId
          ? [[pathItem.post.operationId, pathItem.post]]
          : [],
      ),
    );

    for (const tool of extractRegistryTools()) {
      const operation = operationById.get(tool.name);
      expect(operation).toBeDefined();
      expect(operation?.["x-saborou-approval-required"]).toBe(
        tool.approvalRequired,
      );

      if (tool.approvalRequired) {
        expect(operation?.description?.toLowerCase()).toContain("approval");
      }
    }
  });
});
