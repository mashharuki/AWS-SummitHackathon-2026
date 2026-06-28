import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { BedrockTimeoutError } from "@saboru/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import { SaborouChatAgent } from "../SaborouChatAgent.js";
import { SABOROU_CHAT_TOOL_NAME } from "../saborouChatTool.js";

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
              name: SABOROU_CHAT_TOOL_NAME,
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 50, outputTokens: 40, totalTokens: 90 },
    metrics: { latencyMs: 100 },
  };
}

describe("SaborouChatAgent", () => {
  let client: MockBedrockClient;
  let agent: SaborouChatAgent;

  beforeEach(() => {
    client = new MockBedrockClient(
      makeToolResponse({ reply: "ここはサボっていいよ。", action: "none" }),
    );
    agent = new SaborouChatAgent(client);
  });

  it("tool 出力を検証して返す", async () => {
    const out = await agent.chat({
      messages: [{ role: "user", text: "やっとサボれる" }],
    });
    expect(out.reply).toBe("ここはサボっていいよ。");
    expect(out.action).toBe("none");
  });

  it("toolChoice を saborou_chat に強制する", async () => {
    await agent.chat({ messages: [{ role: "user", text: "つかれた" }] });
    expect(client.lastInput?.toolConfig?.toolChoice).toEqual({
      tool: { name: SABOROU_CHAT_TOOL_NAME },
    });
  });

  it("会話履歴を user 発話から始まる Message[] に変換する", async () => {
    await agent.chat({
      messages: [
        { role: "saborou", text: "おつかれ" }, // 先頭の assistant は除去される
        { role: "user", text: "うん" },
        { role: "saborou", text: "ゆっくりしよ" },
        { role: "user", text: "そうする" },
      ],
    });
    const msgs = client.lastInput?.messages ?? [];
    expect(msgs[0]?.role).toBe("user");
    expect(msgs.at(-1)?.role).toBe("user");
  });

  it("タスク文脈・文体サンプルを system プロンプトにタグで埋め込む", async () => {
    await agent.chat({
      messages: [{ role: "user", text: "サボりたい" }],
      taskContext: "次の予定は19:30",
      styleSamples: "了解です〜",
      userName: "たろ",
    });
    const sys = client.lastInput?.system?.[0]?.text ?? "";
    expect(sys).toContain("<task_context>");
    expect(sys).toContain("次の予定は19:30");
    expect(sys).toContain("<style_samples>");
    expect(sys).toContain("<user_name>");
  });

  it("tool use が無ければ BedrockTimeoutError", async () => {
    client.setResponse({
      $metadata: {},
      output: { message: { role: "assistant", content: [{ text: "なし" }] } },
      stopReason: "end_turn",
    });
    await expect(
      agent.chat({ messages: [{ role: "user", text: "x" }] }),
    ).rejects.toBeInstanceOf(BedrockTimeoutError);
  });

  it("スキーマ違反（reply 空）は検証エラー", async () => {
    client.setResponse(makeToolResponse({ reply: "" }));
    await expect(
      agent.chat({ messages: [{ role: "user", text: "x" }] }),
    ).rejects.toThrow(/schema validation/);
  });
});
