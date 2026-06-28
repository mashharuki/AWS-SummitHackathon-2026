import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockTimeoutError } from "@saboru/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import { ScreenAnalysisAgent } from "../ScreenAnalysisAgent.js";
import { SCREEN_MATCH_TOOL_NAME } from "../screenAnalysisTool.js";

class MockBedrockClient implements IBedrockClient {
  public lastInput?: ConverseCommandInput;
  private _response: ConverseCommandOutput;

  constructor(response: ConverseCommandOutput) {
    this._response = response;
  }

  async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    this.lastInput = input;
    return this._response;
  }

  async converseStream(
    _input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    return {
      $metadata: {},
      stream: undefined as unknown as ConverseStreamCommandOutput["stream"],
    };
  }

  setResponse(response: ConverseCommandOutput): void {
    this._response = response;
  }
}

function makeToolResponse(
  input: Record<string, unknown>,
): ConverseCommandOutput {
  return {
    $metadata: {},
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: {
              toolUseId: "t-1",
              name: SCREEN_MATCH_TOOL_NAME,
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 800, outputTokens: 30, totalTokens: 830 },
    metrics: { latencyMs: 300 },
  };
}

const sampleInput = {
  imageBytes: new Uint8Array([1, 2, 3, 4]),
  format: "jpeg" as const,
  expectedTitle: "議事録をまとめる",
};

describe("ScreenAnalysisAgent", () => {
  let client: MockBedrockClient;
  let agent: ScreenAnalysisAgent;

  beforeEach(() => {
    client = new MockBedrockClient(
      makeToolResponse({
        matched: true,
        observedActivity: "議事録ドキュメントを編集中",
        confidence: 0.9,
      }),
    );
    agent = new ScreenAnalysisAgent(client);
  });

  it("判定結果（matched / observedActivity / confidence）を返す", async () => {
    const out = await agent.analyzeScreenshot(sampleInput);
    expect(out.matched).toBe(true);
    expect(out.observedActivity).toContain("議事録");
    expect(out.confidence).toBeCloseTo(0.9);
  });

  it("画像ブロックとテキストを content に含めて送る", async () => {
    await agent.analyzeScreenshot(sampleInput);
    const content = client.lastInput?.messages?.[0]?.content ?? [];
    const imageBlock = content.find((b) => "image" in b);
    expect(imageBlock).toBeDefined();
    // @ts-expect-error narrow at runtime
    expect(imageBlock?.image?.format).toBe("jpeg");
    const textBlock = content.find((b) => "text" in b);
    // @ts-expect-error narrow at runtime
    expect(textBlock?.text).toContain("議事録をまとめる");
  });

  it("toolChoice を screen_match に強制する", async () => {
    await agent.analyzeScreenshot(sampleInput);
    expect(client.lastInput?.toolConfig?.toolChoice).toEqual({
      tool: { name: SCREEN_MATCH_TOOL_NAME },
    });
  });

  it("tool use が無ければ BedrockTimeoutError", async () => {
    client.setResponse({
      $metadata: {},
      output: { message: { role: "assistant", content: [{ text: "x" }] } },
      stopReason: "end_turn",
    });
    await expect(agent.analyzeScreenshot(sampleInput)).rejects.toBeInstanceOf(
      BedrockTimeoutError,
    );
  });

  it("confidence が範囲外なら検証エラー", async () => {
    client.setResponse(
      makeToolResponse({
        matched: true,
        observedActivity: "x",
        confidence: 1.5,
      }),
    );
    await expect(agent.analyzeScreenshot(sampleInput)).rejects.toThrow(
      /schema validation/,
    );
  });
});
