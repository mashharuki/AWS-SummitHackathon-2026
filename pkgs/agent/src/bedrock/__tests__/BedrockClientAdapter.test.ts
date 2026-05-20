import { beforeEach, describe, expect, it, vi } from "vitest";
import { BedrockClientAdapter } from "../BedrockClientAdapter.js";

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  ConverseCommand: vi.fn().mockImplementation((input: unknown) => ({
    input,
    kind: "ConverseCommand",
  })),
  ConverseStreamCommand: vi.fn().mockImplementation((input: unknown) => ({
    input,
    kind: "ConverseStreamCommand",
  })),
}));

describe("BedrockClientAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    // IBedrockClient は ConverseCommandInput を受け取る converse メソッドが必要
    expect(adapter.converse).toBeTypeOf("function");
    // このメソッドは非同期 (Promise を返す)
  });

  it("calls BedrockRuntimeClient.send via converse()", async () => {
    const adapter = new BedrockClientAdapter();
    mockSend.mockResolvedValueOnce({ $metadata: {}, output: {} });

    const result = await adapter.converse({
      modelId: "test-model",
      messages: [],
    });

    expect(result).toEqual({ $metadata: {}, output: {} });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("calls BedrockRuntimeClient.send via converseStream()", async () => {
    const adapter = new BedrockClientAdapter();
    mockSend.mockResolvedValueOnce({ $metadata: {}, stream: undefined });

    const result = await adapter.converseStream({
      modelId: "test-model",
      messages: [],
    });

    expect(result).toEqual({ $metadata: {}, stream: undefined });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
