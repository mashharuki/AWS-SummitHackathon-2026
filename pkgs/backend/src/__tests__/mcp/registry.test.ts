import { describe, expect, it } from "vitest";
import {
  EXCLUDED_MCP_ROUTE_PATTERNS,
  getMcpToolDefinition,
  getPublishedMcpTools,
  isMcpToolName,
  MCP_TOOL_NAMES,
  MCP_TOOL_REGISTRY,
} from "../../mcp/registry.js";

describe("MCP_TOOL_REGISTRY", () => {
  it("has unique allowlisted tool names", () => {
    expect(new Set(MCP_TOOL_NAMES).size).toBe(MCP_TOOL_NAMES.length);
    expect(MCP_TOOL_NAMES).toContain("saborou_list_tasks");
    expect(MCP_TOOL_NAMES).toContain("saborou_send_slack_reply");
    expect(MCP_TOOL_NAMES).toContain("saborou_plan_trip");
  });

  it("resolves only registry tool names", () => {
    expect(isMcpToolName("saborou_judge_sabori")).toBe(true);
    expect(isMcpToolName("sendSlackReply")).toBe(false);
    expect(getMcpToolDefinition("saborou_judge_sabori")?.published).toBe(true);
    expect(getMcpToolDefinition("/api/auth/callback")).toBeUndefined();
  });

  it("marks side-effect tools as approval-required", () => {
    for (const tool of MCP_TOOL_REGISTRY) {
      if (tool.effect === "side_effect") {
        expect(tool.approval.required).toBe(true);
        expect(tool.approval.reason).toEqual(expect.any(String));
      }
    }
  });

  it("publishes only explicit registry tools and excludes unsafe routes", () => {
    const published = getPublishedMcpTools();

    expect(published.length).toBeGreaterThan(0);
    expect(EXCLUDED_MCP_ROUTE_PATTERNS).toEqual(
      expect.arrayContaining([
        "/api/auth/*",
        "/api/webhooks/*",
        "/api/health",
        "/api/mcp/*",
      ]),
    );
    expect(published.map((tool) => tool.http.path)).not.toContain("/api/auth");
    expect(published.map((tool) => tool.http.path)).not.toContain(
      "/api/webhooks/slack",
    );
  });

  it("marks the Claude delegation tool implemented after U-V3-03", () => {
    expect(getMcpToolDefinition("saborou_delegate_to_claude")).toMatchObject({
      implementationStatus: "implemented",
      approval: { required: true },
      published: true,
    });
  });

  it("publishes the Travelpayouts trip planner as a read-only implemented tool", () => {
    expect(getMcpToolDefinition("saborou_plan_trip")).toMatchObject({
      effect: "read",
      http: { method: "POST", path: "/api/travel/plan" },
      implementationStatus: "implemented",
      approval: { required: false },
      outputMode: "safe_summary",
      published: true,
    });
  });
});
