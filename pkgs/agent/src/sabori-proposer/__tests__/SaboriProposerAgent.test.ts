import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { IProposalRepository, Proposal, Task } from "@saboru/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import { PersonaRenderer } from "../PersonaRenderer.js";
import { SaboriProposerAgent } from "../SaboriProposerAgent.js";
import type {
  RenderInput,
  RenderOutput,
  SlackContext,
  TaskContext,
} from "../types.js";

// ─────────────────────────────────────────────
// MockBedrockClient
// ─────────────────────────────────────────────

class MockBedrockClient implements IBedrockClient {
  private _converseResponse: ConverseCommandOutput;

  constructor(converseResponse: ConverseCommandOutput) {
    this._converseResponse = converseResponse;
  }

  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this._converseResponse;
  }

  async converseStream(
    _input: ConverseStreamCommandInput,
  ): Promise<ConverseStreamCommandOutput> {
    // 最小スタブ — proposeStream テストは別アプローチを使用
    return {
      $metadata: {},
      stream: undefined as unknown as ConverseStreamCommandOutput["stream"],
    };
  }

  setConverseResponse(response: ConverseCommandOutput): void {
    this._converseResponse = response;
  }
}

// ─────────────────────────────────────────────
// MockProposalRepository
// ─────────────────────────────────────────────

class MockProposalRepository implements IProposalRepository {
  public saved: Proposal[] = [];

  async save(proposal: Omit<Proposal, "PK" | "SK">): Promise<Proposal> {
    const item: Proposal = {
      ...proposal,
      PK: `TASK#${proposal.taskId}`,
      SK: `PROPOSAL#${proposal.evaluatedAt}`,
    };
    this.saved.push(item);
    return item;
  }

  async findLatestByTaskId(taskId: string): Promise<Proposal | null> {
    const found = this.saved
      .filter((p) => p.taskId === taskId)
      .sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
    return found[0] ?? null;
  }
}

// ─────────────────────────────────────────────
// MockPersonaRenderer
// ─────────────────────────────────────────────

class MockPersonaRenderer extends PersonaRenderer {
  constructor() {
    // 使用しないモック Bedrock クライアントを渡す
    super({
      async converse() {
        throw new Error("Should not call real bedrock in PersonaRenderer mock");
      },
      async converseStream() {
        throw new Error("Should not call real bedrock in PersonaRenderer mock");
      },
    });
  }

  async render(input: RenderInput): Promise<RenderOutput> {
    return {
      summaryText: `[変換済み] ${input.summaryText}`,
      chatMessage: `[サボロー口調] ${input.rawChatMessage} だよ😴`,
      verdictEmoji:
        input.verdict === "can_saboru"
          ? "😴"
          : input.verdict === "must_do"
            ? "⚡"
            : "🤔",
      verdictLabel:
        input.verdict === "can_saboru"
          ? "今はサボっていいよ"
          : input.verdict === "must_do"
            ? "やった方がいいかな"
            : "グレーゾーンだよ",
      personaId: input.personaId,
    };
  }
}

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

function makeSaboriJudgmentResponse(
  overrides: {
    verdict?: string;
    summaryText?: string;
    reasoning?: string[];
    rawChatMessage?: string;
    nextCheckOffsetMinutes?: number;
    appliedFramework?: string[];
  } = {},
): ConverseCommandOutput {
  const input = {
    verdict: "can_saboru",
    summaryText: "まだ寝かせてOK。明日14時までに確認するだけで逃げ切れる",
    reasoning: [
      "締切まで30時間以上あるため",
      "依頼者からのリマインドが0回のため",
    ],
    rawChatMessage:
      "現状、依頼者からのリマインドはなく、締切まで十分な余裕があります。今はサボっても問題ない状況です。",
    nextCheckOffsetMinutes: 240,
    appliedFramework: [
      "Identifiability (Williams 1981)",
      "SDT (Ryan & Deci 2000)",
    ],
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
              toolUseId: "tool-sabori-001",
              name: "sabori_judgment",
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 300, outputTokens: 150, totalTokens: 450 },
    metrics: { latencyMs: 800 },
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    PK: "USER#test-user",
    SK: "TASK#01HXY",
    taskId: "01HXY",
    userId: "test-user",
    status: "approved",
    title: "週次レポート作成",
    deadline: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
    requester: "abc123hash",
    description: "毎週月曜に提出するレポートを作成する",
    sourceType: "slack",
    approvedAt: "2026-05-17T09:00:00Z",
    updatedAt: "2026-05-17T09:00:00Z",
    ...overrides,
  };
}

const TEST_TASK_CONTEXT: TaskContext = {
  task: makeTask(),
  slackContext: {
    requesterStatus: "away",
    reminderCount: 0,
    urgencyKeywords: [],
    threadActive: false,
    rawSummary: "依頼者はオフライン",
  } satisfies SlackContext,
};

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("SaboriProposerAgent", () => {
  let mockBedrock: MockBedrockClient;
  let mockRepo: MockProposalRepository;
  let mockRenderer: MockPersonaRenderer;
  let agent: SaboriProposerAgent;

  beforeEach(() => {
    mockBedrock = new MockBedrockClient(makeSaboriJudgmentResponse());
    mockRepo = new MockProposalRepository();
    mockRenderer = new MockPersonaRenderer();
    agent = new SaboriProposerAgent(mockBedrock, mockRepo, mockRenderer);
  });

  describe("propose()", () => {
    it("returns a Proposal with correct verdict", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);

      expect(proposal).toBeDefined();
      expect(proposal.verdict).toBe("can_saboru");
      expect(proposal.taskId).toBe("task-001");
      expect(proposal.userId).toBe("test-user");
    });

    it("persists exactly one proposal to repository", async () => {
      await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(mockRepo.saved).toHaveLength(1);
    });

    it("returns Proposal with correct PK/SK format", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.PK).toBe("TASK#task-001");
      expect(proposal.SK).toMatch(/^PROPOSAL#\d{4}-\d{2}-\d{2}T/);
    });

    it("sets evaluatedAt as ISO 8601 string", async () => {
      const before = new Date().toISOString();
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      const after = new Date().toISOString();

      expect(proposal.evaluatedAt >= before).toBe(true);
      expect(proposal.evaluatedAt <= after).toBe(true);
    });

    it("sets nextCheckAt later than evaluatedAt", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.nextCheckAt > proposal.evaluatedAt).toBe(true);
    });

    it("applies PersonaRenderer — chatMessage contains rendered output", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.chatMessage).toContain("[サボロー口調]");
    });

    it("applies PersonaRenderer — summaryText is transformed", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.summaryText).toContain("[変換済み]");
    });

    it("handles borderline verdict correctly", async () => {
      mockBedrock.setConverseResponse(
        makeSaboriJudgmentResponse({
          verdict: "borderline",
          summaryText: "グレーゾーン。状況を監視",
          nextCheckOffsetMinutes: 45,
        }),
      );
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.verdict).toBe("borderline");
    });

    it("handles must_do verdict correctly", async () => {
      mockBedrock.setConverseResponse(
        makeSaboriJudgmentResponse({
          verdict: "must_do",
          summaryText: "危険。すぐやれ",
          nextCheckOffsetMinutes: 15,
        }),
      );
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      expect(proposal.verdict).toBe("must_do");
    });

    it("throws when Bedrock returns no tool use block", async () => {
      mockBedrock.setConverseResponse({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [{ text: "I cannot help with that." }],
          },
        },
        stopReason: "end_turn",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        metrics: { latencyMs: 100 },
      });

      await expect(
        agent.propose("task-001", TEST_TASK_CONTEXT),
      ).rejects.toThrow();
    });

    it("throws when Bedrock tool output fails Zod validation", async () => {
      mockBedrock.setConverseResponse({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [
              {
                toolUse: {
                  toolUseId: "tool-002",
                  name: "sabori_judgment",
                  input: {
                    verdict: "invalid_verdict", // Not a valid enum
                    summaryText: "test",
                    reasoning: ["reason 1"],
                    rawChatMessage: "test message",
                    nextCheckOffsetMinutes: 60,
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

      await expect(
        agent.propose("task-001", TEST_TASK_CONTEXT),
      ).rejects.toThrow(/schema validation/);
    });

    it("works without Slack context (minimal coverage)", async () => {
      const minimalContext: TaskContext = {
        task: makeTask({ deadline: null }),
      };
      const proposal = await agent.propose("task-001", minimalContext);
      expect(proposal).toBeDefined();
      expect(proposal.verdict).toBe("can_saboru");
    });

    it("sets personaId from PersonaRenderer output", async () => {
      const proposal = await agent.propose("task-001", TEST_TASK_CONTEXT);
      // DEFAULT_PERSONA_ID が設定されているべき
      expect(typeof proposal.personaId).toBe("string");
      expect(proposal.personaId.length).toBeGreaterThan(0);
    });
  });

  describe("proposeStream()", () => {
    it("yields verdict event", async () => {
      // 空ストリームを生成するよう converseStream をモック (同期判定にフォールバック)
      const mockBedrockWithStream: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              // 空ストリーム — JSON パースフォールバックが同期 converse に切り替わる
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithStream = new SaboriProposerAgent(
        mockBedrockWithStream,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithStream.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      const verdictEvent = deltas.find((d) => d.type === "verdict");
      expect(verdictEvent).toBeDefined();
      expect(verdictEvent?.payload).toBe("can_saboru");
    });

    it("yields reasoning_item events", async () => {
      const mockBedrockWithStream: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              // 空ストリーム
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithStream = new SaboriProposerAgent(
        mockBedrockWithStream,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithStream.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      const reasoningItems = deltas.filter((d) => d.type === "reasoning_item");
      expect(reasoningItems.length).toBeGreaterThan(0);
    });

    it("yields complete event as last delta", async () => {
      const mockBedrockWithStream: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              // 空ストリーム
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithStream = new SaboriProposerAgent(
        mockBedrockWithStream,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithStream.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      const lastDelta = deltas[deltas.length - 1];
      expect(lastDelta?.type).toBe("complete");
    });

    it("persists proposal when stream completes", async () => {
      const mockBedrockWithStream: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream:
              (async function* () {})() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithStream = new SaboriProposerAgent(
        mockBedrockWithStream,
        mockRepo,
        mockRenderer,
      );

      // 全デルタを消費
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _delta of agentWithStream.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        // 消費
      }

      expect(mockRepo.saved).toHaveLength(1);
    });

    it("throws BedrockTimeoutError when converseStream itself throws (Error instance)", async () => {
      const mockBedrockStreamError: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          throw new Error("Connection timeout");
        },
      };

      const agentWithStreamError = new SaboriProposerAgent(
        mockBedrockStreamError,
        mockRepo,
        mockRenderer,
      );

      const generator = agentWithStreamError.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      );
      await expect(generator.next()).rejects.toThrow(
        "Streaming judgment failed",
      );
    });

    it("throws BedrockTimeoutError when converseStream throws non-Error object", async () => {
      const mockBedrockNonErrorThrow: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error (non-Error object)";
        },
      };

      const agentWithNonErrorThrow = new SaboriProposerAgent(
        mockBedrockNonErrorThrow,
        mockRepo,
        mockRenderer,
      );

      const generator = agentWithNonErrorThrow.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      );
      await expect(generator.next()).rejects.toThrow(
        "Streaming judgment failed",
      );
    });

    it("throws BedrockTimeoutError when async stream iteration throws", async () => {
      const mockBedrockStreamIterError: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              throw new Error("Stream interrupted");
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithIterError = new SaboriProposerAgent(
        mockBedrockStreamIterError,
        mockRepo,
        mockRenderer,
      );

      const generator = agentWithIterError.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      );
      await expect(generator.next()).rejects.toThrow(
        "Streaming judgment failed",
      );
    });

    it("falls back to synchronous judgment when streamed JSON fails Zod validation", async () => {
      // ストリームが無効な JSON を生成 (有効な LLMJudgment ではない)
      const invalidJson = '{"verdict":"invalid_verdict","summaryText":"test"}';
      let chunkIndex = 0;
      const chunks = invalidJson.split("");

      const mockBedrockBadJson: IBedrockClient = {
        async converse() {
          // フォールバック同期呼び出しが有効なレスポンスを返す
          return makeSaboriJudgmentResponse({ verdict: "borderline" });
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              for (const chunk of chunks) {
                yield {
                  contentBlockDelta: {
                    delta: { toolUse: { input: chunk } },
                  },
                };
                chunkIndex++;
              }
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithBadJson = new SaboriProposerAgent(
        mockBedrockBadJson,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithBadJson.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      // 同期判定にフォールバックして verdict を生成しているはず
      const verdictEvent = deltas.find((d) => d.type === "verdict");
      expect(verdictEvent).toBeDefined();
      expect(verdictEvent?.payload).toBe("borderline");
    });

    it("falls back to synchronous judgment when streamed JSON is unparseable", async () => {
      // ストリームが全くパースできない無効な JSON を生成
      const mockBedrockBadJson: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse({ verdict: "must_do" });
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              yield {
                contentBlockDelta: {
                  delta: { toolUse: { input: "not-valid-json{{{" } },
                },
              };
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithBadJson = new SaboriProposerAgent(
        mockBedrockBadJson,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithBadJson.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      const verdictEvent = deltas.find((d) => d.type === "verdict");
      expect(verdictEvent).toBeDefined();
      expect(verdictEvent?.payload).toBe("must_do");
    });

    it("yields chat_message_chunk events when stream has valid chunks", async () => {
      // ストリーミングのハッピーパスをテストするためチャンクで有効なツール使用 JSON を構築
      const validJudgment = {
        verdict: "can_saboru",
        summaryText: "まだ寝かせてOK",
        reasoning: ["理由1"],
        rawChatMessage: "のんびりしてていいよ",
        nextCheckOffsetMinutes: 120,
        appliedFramework: ["SDT"],
      };
      const fullJson = JSON.stringify(validJudgment);
      const chunks = [
        fullJson.slice(0, Math.floor(fullJson.length / 2)),
        fullJson.slice(Math.floor(fullJson.length / 2)),
      ];

      const mockBedrockValidStream: IBedrockClient = {
        async converse() {
          return makeSaboriJudgmentResponse();
        },
        async converseStream() {
          return {
            $metadata: {},
            stream: (async function* () {
              for (const chunk of chunks) {
                yield {
                  contentBlockDelta: {
                    delta: { toolUse: { input: chunk } },
                  },
                };
              }
            })() as unknown as ConverseStreamCommandOutput["stream"],
          };
        },
      };

      const agentWithValidStream = new SaboriProposerAgent(
        mockBedrockValidStream,
        mockRepo,
        mockRenderer,
      );

      const deltas = [];
      for await (const delta of agentWithValidStream.proposeStream(
        "task-001",
        TEST_TASK_CONTEXT,
      )) {
        deltas.push(delta);
      }

      // ストリーミングフェーズからの chat_message_chunk イベントがあるはず
      const chunkEvents = deltas.filter((d) => d.type === "chat_message_chunk");
      expect(chunkEvents.length).toBeGreaterThan(0);

      // 正常に完了するはず
      const completeEvent = deltas.find((d) => d.type === "complete");
      expect(completeEvent).toBeDefined();
    });
  });
});
