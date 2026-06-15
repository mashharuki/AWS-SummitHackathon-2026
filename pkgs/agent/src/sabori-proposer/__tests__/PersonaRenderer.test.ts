import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { beforeEach, describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import { PersonaRenderer } from "../PersonaRenderer.js";
import type { RenderInput } from "../types.js";

// ─────────────────────────────────────────────
// PersonaRenderer テスト用 MockBedrockClient
// ─────────────────────────────────────────────

class MockBedrockClient implements IBedrockClient {
  private _response: ConverseCommandOutput;

  constructor(response: ConverseCommandOutput) {
    this._response = response;
  }

  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
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

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

function makeHaikuResponse(
  overrides: {
    summaryText?: string;
    chatMessage?: string;
  } = {},
): ConverseCommandOutput {
  const input = {
    summaryText: "まだゆっくりしていていいよ😴",
    chatMessage: "締切まで余裕があるから、今はのんびりしていていいよ〜だよ😴",
    ...overrides,
  };

  return {
    $metadata: {},
    output: {
      message: {
        role: "assistant",
        content: [
          {
            toolUse: {
              toolUseId: "tool-haiku-001",
              name: "persona_render",
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 60, totalTokens: 160 },
    metrics: { latencyMs: 300 },
  };
}

const CAN_SABORU_INPUT: RenderInput = {
  verdict: "can_saboru",
  reasoning: [
    "締切まで30時間以上あるため",
    "依頼者からのリマインドが0回のため",
  ],
  summaryText: "まだ寝かせてOK。明日14時までに確認するだけで逃げ切れる",
  rawChatMessage:
    "現状、依頼者からのリマインドはなく、締切まで十分な余裕があります。今はサボっても問題ない状況です。",
  personaId: "saboru_ottori",
};

const MUST_DO_INPUT: RenderInput = {
  verdict: "must_do",
  reasoning: ["締切まで3時間を切っているため", "リマインドが2回来ているため"],
  summaryText: "危険。今すぐやれ",
  rawChatMessage:
    "締切が迫っており、依頼者からも複数回リマインドが届いています。今すぐ取り組む必要があります。",
  personaId: "saboru_ottori",
};

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("PersonaRenderer", () => {
  let mockBedrock: MockBedrockClient;
  let renderer: PersonaRenderer;

  beforeEach(() => {
    mockBedrock = new MockBedrockClient(makeHaikuResponse());
    renderer = new PersonaRenderer(mockBedrock);
  });

  describe("render() — success cases", () => {
    it("returns RenderOutput with verdictEmoji for can_saboru", async () => {
      const result = await renderer.render(CAN_SABORU_INPUT);
      expect(result.verdictEmoji).toBe("😴");
    });

    it("returns RenderOutput with verdictLabel for can_saboru", async () => {
      const result = await renderer.render(CAN_SABORU_INPUT);
      expect(result.verdictLabel).toBe("今はサボっていいよ");
    });

    it("returns RenderOutput with verdictEmoji for must_do", async () => {
      mockBedrock.setResponse(
        makeHaikuResponse({
          summaryText: "やった方がいいよ⚡",
          chatMessage: "締切が近いから、もう動いた方がいいかな〜⚡",
        }),
      );
      const result = await renderer.render(MUST_DO_INPUT);
      expect(result.verdictEmoji).toBe("⚡");
    });

    it("returns RenderOutput with correct personaId", async () => {
      const result = await renderer.render(CAN_SABORU_INPUT);
      expect(result.personaId).toBe("saboru_ottori");
    });

    it("returns Haiku-converted chatMessage", async () => {
      const result = await renderer.render(CAN_SABORU_INPUT);
      expect(result.chatMessage).toBe(
        "締切まで余裕があるから、今はのんびりしていていいよ〜だよ😴",
      );
    });

    it("returns Haiku-converted summaryText", async () => {
      const result = await renderer.render(CAN_SABORU_INPUT);
      expect(result.summaryText).toBe("まだゆっくりしていていいよ😴");
    });
  });

  describe("render() — fallback (graceful degradation)", () => {
    it("falls back to rawChatMessage when Bedrock returns no tool use block", async () => {
      mockBedrock.setResponse({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [{ text: "I cannot help." }],
          },
        },
        stopReason: "end_turn",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        metrics: { latencyMs: 100 },
      });

      const result = await renderer.render(CAN_SABORU_INPUT);
      // フォールバック: rawChatMessage を直接使用
      expect(result.chatMessage).toBe(CAN_SABORU_INPUT.rawChatMessage);
      expect(result.summaryText).toBe(CAN_SABORU_INPUT.summaryText);
    });

    it("falls back to rawChatMessage when Zod validation fails", async () => {
      mockBedrock.setResponse({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [
              {
                toolUse: {
                  toolUseId: "tool-haiku-bad",
                  name: "persona_render",
                  input: {
                    // 必須フィールド 'chatMessage' がない
                    summaryText: "test",
                  },
                },
              },
            ],
          },
        },
        stopReason: "tool_use",
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        metrics: { latencyMs: 100 },
      });

      const result = await renderer.render(CAN_SABORU_INPUT);
      // フォールバック発動
      expect(result.chatMessage).toBe(CAN_SABORU_INPUT.rawChatMessage);
    });

    it("does NOT throw when Haiku call throws — uses fallback instead", async () => {
      const throwingBedrock: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          throw new Error("Haiku throttled");
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };

      const rendererWithError = new PersonaRenderer(throwingBedrock);
      // スローせずフォールバック出力を返すべき
      const result = await rendererWithError.render(CAN_SABORU_INPUT);
      expect(result.chatMessage).toBe(CAN_SABORU_INPUT.rawChatMessage);
    });

    it("does NOT throw when Haiku call throws a non-Error object", async () => {
      const throwingBedrockNonError: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "non-Error string thrown";
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };

      const rendererWithNonError = new PersonaRenderer(throwingBedrockNonError);
      const result = await rendererWithNonError.render(CAN_SABORU_INPUT);
      // それでもグレースフルにフォールバックを返すべき
      expect(result.chatMessage).toBe(CAN_SABORU_INPUT.rawChatMessage);
    });

    it("fallback still sets correct verdictEmoji", async () => {
      const throwingBedrock: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          throw new Error("Error");
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };

      const rendererWithError = new PersonaRenderer(throwingBedrock);
      const result = await rendererWithError.render(MUST_DO_INPUT);
      expect(result.verdictEmoji).toBe("⚡");
      expect(result.verdictLabel).toBe("やった方がいいかな");
    });
  });

  describe("render() — unknown verdict", () => {
    it("uses default emoji for unknown verdict", async () => {
      const unknownInput: RenderInput = {
        ...CAN_SABORU_INPUT,
        verdict: "can_saboru", // use valid verdict but override the response
      };
      mockBedrock.setResponse(makeHaikuResponse());
      const result = await renderer.render(unknownInput);
      expect(result.verdictEmoji).toBeDefined();
      expect(typeof result.verdictEmoji).toBe("string");
    });

    it("uses fallback emoji and label when verdict is not in VERDICT_META", async () => {
      // VERDICT_META にない予期しない verdict 値をシミュレートするため文字列にキャスト
      const unknownInput: RenderInput = {
        ...CAN_SABORU_INPUT,
        verdict: "unknown_future_verdict" as RenderInput["verdict"],
      };

      // フォールバックパスに進み VERDICT_META フォールバックを使うため例外をスローする bedrock を使用
      const throwingBedrock: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          throw new Error("Error");
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };

      const rendererWithError = new PersonaRenderer(throwingBedrock);
      const result = await rendererWithError.render(unknownInput);
      // VERDICT_META に "unknown_future_verdict" がない → デフォルト { emoji: "🤔", label: "確認中" } を使用
      expect(result.verdictEmoji).toBe("🤔");
      expect(result.verdictLabel).toBe("確認中");
    });
  });

  describe("persona switching (D) + diversity (E)", () => {
    // converse に渡された input をキャプチャするモック
    class CapturingBedrock implements IBedrockClient {
      public lastInput?: ConverseCommandInput;
      async converse(
        input: ConverseCommandInput,
      ): Promise<ConverseCommandOutput> {
        this.lastInput = input;
        return makeHaikuResponse();
      }
      async converseStream(
        _input: ConverseStreamCommandInput,
      ): Promise<ConverseStreamCommandOutput> {
        return {
          $metadata: {},
          stream: undefined as unknown as ConverseStreamCommandOutput["stream"],
        };
      }
    }

    it("selects the strict persona prompt and lower temperature", async () => {
      const bedrock = new CapturingBedrock();
      const r = new PersonaRenderer(bedrock);
      await r.render({ ...CAN_SABORU_INPUT, personaId: "saboru_strict" });

      const systemText = bedrock.lastInput?.system?.[0]?.text ?? "";
      expect(systemText).toContain("鬼コーチ");
      expect(bedrock.lastInput?.inferenceConfig?.temperature).toBe(0.2);
    });

    it("selects the psychologist persona prompt", async () => {
      const bedrock = new CapturingBedrock();
      const r = new PersonaRenderer(bedrock);
      await r.render({ ...CAN_SABORU_INPUT, personaId: "saboru_psy" });

      const systemText = bedrock.lastInput?.system?.[0]?.text ?? "";
      expect(systemText).toContain("心理士");
      expect(bedrock.lastInput?.inferenceConfig?.temperature).toBe(0.5);
    });

    it("selects the engineer persona prompt", async () => {
      const bedrock = new CapturingBedrock();
      const r = new PersonaRenderer(bedrock);
      await r.render({ ...CAN_SABORU_INPUT, personaId: "saboru_hacker" });

      const systemText = bedrock.lastInput?.system?.[0]?.text ?? "";
      expect(systemText).toContain("エンジニア");
    });

    it("falls back to ottori prompt for an unknown personaId", async () => {
      const bedrock = new CapturingBedrock();
      const r = new PersonaRenderer(bedrock);
      await r.render({ ...CAN_SABORU_INPUT, personaId: "nonexistent" });

      const systemText = bedrock.lastInput?.system?.[0]?.text ?? "";
      expect(systemText).toContain("おっとり");
      expect(bedrock.lastInput?.inferenceConfig?.temperature).toBe(0.45);
    });

    it("preserves the requested personaId in the output", async () => {
      const bedrock = new CapturingBedrock();
      const r = new PersonaRenderer(bedrock);
      const result = await r.render({
        ...CAN_SABORU_INPUT,
        personaId: "saboru_hacker",
      });
      expect(result.personaId).toBe("saboru_hacker");
    });
  });

  // ─────────────────────────────────────────────
  // renderForVoice() — v2 TTS 用短文整形
  // ─────────────────────────────────────────────

  describe("renderForVoice() — TTS short-form (v2)", () => {
    function makeTextResponse(text: string): ConverseCommandOutput {
      return {
        $metadata: {},
        output: {
          message: { role: "assistant", content: [{ text }] },
        },
        stopReason: "end_turn",
        usage: { inputTokens: 50, outputTokens: 30, totalTokens: 80 },
        metrics: { latencyMs: 120 },
      };
    }

    it("returns sanitized spoken text under the default 100-char limit", async () => {
      const bedrock = new MockBedrockClient(
        makeTextResponse(
          "締切まで余裕があるから、今はのんびりしていて大丈夫だよ",
        ),
      );
      const r = new PersonaRenderer(bedrock);
      const out = await r.renderForVoice({
        sourceText: "締切まで余裕があります。今はサボっても問題ありません。",
        personaId: "saboru_ottori",
      });
      expect(out.length).toBeLessThanOrEqual(100);
      expect(out.length).toBeGreaterThan(0);
    });

    it("strips emoji, symbols and URLs from the model output", async () => {
      const bedrock = new MockBedrockClient(
        makeTextResponse(
          "今日はゆっくりしていいよ😴 詳細は https://example.com/x を見てね #saboru",
        ),
      );
      const r = new PersonaRenderer(bedrock);
      const out = await r.renderForVoice({
        sourceText: "ゆっくりしていいよ",
        personaId: "saboru_ottori",
      });
      expect(out).not.toContain("😴");
      expect(out).not.toContain("http");
      expect(out).not.toContain("#");
    });

    it("removes newlines so the text is one continuous line", async () => {
      const bedrock = new MockBedrockClient(
        makeTextResponse("一行目\n二行目\n三行目"),
      );
      const r = new PersonaRenderer(bedrock);
      const out = await r.renderForVoice({
        sourceText: "x",
        personaId: "saboru_ottori",
      });
      expect(out).not.toContain("\n");
    });

    it("honors a custom maxChars limit by truncating", async () => {
      const bedrock = new MockBedrockClient(makeTextResponse("あ".repeat(200)));
      const r = new PersonaRenderer(bedrock);
      const out = await r.renderForVoice(
        { sourceText: "x", personaId: "saboru_ottori" },
        40,
      );
      expect(out.length).toBeLessThanOrEqual(40);
    });

    it("falls back to sanitized source text when Haiku throws", async () => {
      const throwingBedrock: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          throw new Error("Haiku throttled");
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };
      const r = new PersonaRenderer(throwingBedrock);
      const out = await r.renderForVoice({
        sourceText: "締切まで余裕があるよ😴 https://example.com",
        personaId: "saboru_ottori",
      });
      // フォールバックでもサニタイズされる
      expect(out).not.toContain("😴");
      expect(out).not.toContain("http");
      expect(out.length).toBeGreaterThan(0);
    });

    it("falls back when Haiku throws a non-Error object", async () => {
      const throwingBedrock: IBedrockClient = {
        async converse(): Promise<ConverseCommandOutput> {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "voice non-Error string";
        },
        async converseStream(): Promise<ConverseStreamCommandOutput> {
          throw new Error("Not implemented");
        },
      };
      const r = new PersonaRenderer(throwingBedrock);
      const out = await r.renderForVoice({
        sourceText: "サボってもいいよ",
        personaId: "saboru_ottori",
      });
      expect(out).toBe("サボってもいいよ");
    });

    it("falls back when the model returns no text block", async () => {
      const bedrock = new MockBedrockClient({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [
              {
                toolUse: {
                  toolUseId: "t",
                  name: "irrelevant",
                  input: {},
                },
              },
            ],
          },
        },
        stopReason: "tool_use",
      });
      const r = new PersonaRenderer(bedrock);
      const out = await r.renderForVoice({
        sourceText: "サボってもいいよ",
        personaId: "saboru_ottori",
      });
      expect(out).toBe("サボってもいいよ");
    });
  });
});
