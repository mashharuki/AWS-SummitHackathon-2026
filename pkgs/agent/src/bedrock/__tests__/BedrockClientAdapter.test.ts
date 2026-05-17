import { describe, expect, it } from "vitest";
import { BedrockClientAdapter } from "../BedrockClientAdapter.js";

/**
 * BedrockClientAdapter unit tests
 *
 * Note: We do NOT make real Bedrock API calls in unit tests.
 * This test verifies the adapter can be instantiated with custom region
 * and that the public API surface matches IBedrockClient.
 */
describe("BedrockClientAdapter", () => {
  it("can be instantiated with default region", () => {
    const adapter = new BedrockClientAdapter();
    expect(adapter).toBeDefined();
    expect(typeof adapter.converse).toBe("function");
  });

  it("can be instantiated with custom region", () => {
    const adapter = new BedrockClientAdapter("us-east-1");
    expect(adapter).toBeDefined();
    expect(typeof adapter.converse).toBe("function");
  });

  it("implements IBedrockClient interface (duck typing)", () => {
    const adapter = new BedrockClientAdapter();
    // IBedrockClient requires a converse method that accepts ConverseCommandInput
    expect(adapter.converse).toBeTypeOf("function");
    // The method is async (returns a Promise)
    // We don't call it to avoid real AWS SDK calls
  });
});
