import type {
  ConverseCommandInput,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type {
  ApprovedTask,
  ITaskCandidateRepository,
  TaskCandidate,
} from "@saboru/shared";
import { DDB_PREFIX, TASK_CANDIDATE_STATUS } from "@saboru/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { IBedrockClient } from "../../bedrock/IBedrockClient.js";
import type { SlackEventPayload } from "../../types/events.js";
import { TaskExtractorAgent } from "../TaskExtractorAgent.js";

// ─────────────────────────────────────────────
// MockBedrockClient
// ─────────────────────────────────────────────

class MockBedrockClient implements IBedrockClient {
  private response: ConverseCommandOutput;

  constructor(response: ConverseCommandOutput) {
    this.response = response;
  }

  async converse(_input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this.response;
  }

  setResponse(response: ConverseCommandOutput): void {
    this.response = response;
  }
}

// ─────────────────────────────────────────────
// MockTaskCandidateRepository
// ─────────────────────────────────────────────

class MockTaskCandidateRepository implements ITaskCandidateRepository {
  public created: TaskCandidate[] = [];

  async findAllByUserId(_userId: string): Promise<TaskCandidate[]> {
    return this.created;
  }

  async findById(
    _userId: string,
    candidateId: string,
  ): Promise<TaskCandidate | null> {
    return this.created.find((c) => c.candidateId === candidateId) ?? null;
  }

  async create(
    candidate: Omit<TaskCandidate, "PK" | "SK">,
  ): Promise<TaskCandidate> {
    // 拡張ペイロードから _userId を取り出す (内部規約)
    const extended = candidate as Omit<TaskCandidate, "PK" | "SK"> & {
      _userId?: string;
    };
    const userId = extended._userId ?? "test-user";
    const { _userId: _removed, ...clean } = extended;

    const item: TaskCandidate = {
      ...clean,
      PK: `${DDB_PREFIX.USER}${userId}`,
      SK: `${DDB_PREFIX.TASK_CAND}${candidate.candidateId}`,
    };
    this.created.push(item);
    return item;
  }

  async approve(_userId: string, _candidateId: string): Promise<ApprovedTask> {
    throw new Error("Not implemented in mock");
  }

  async delete(_userId: string, _candidateId: string): Promise<void> {
    // no-op
  }
}

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

function makeTaskBedrockResponse(
  overrides: {
    is_task?: boolean;
    title?: string;
    deadline?: string | null;
    requester?: string;
    description?: string;
  } = {},
): ConverseCommandOutput {
  const input = {
    is_task: true,
    title: "資料作成",
    deadline: "2026-05-20",
    requester: "U12345",
    description: "来週のMTG資料を作成する",
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
              toolUseId: "tool-001",
              name: "extract_task_attributes",
              input,
            },
          },
        ],
      },
    },
    stopReason: "tool_use",
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    metrics: { latencyMs: 500 },
  };
}

const testEvent: SlackEventPayload = {
  source: "slack",
  userId: "cognito-user-abc",
  message: {
    text: "来週月曜までに資料を作っておいてください。",
    channelId: "C12345",
    messageTs: "1234567890.123456",
    teamId: "T12345",
    userId: "U12345",
  },
};

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("TaskExtractorAgent", () => {
  let mockBedrock: MockBedrockClient;
  let mockRepo: MockTaskCandidateRepository;
  let agent: TaskExtractorAgent;

  beforeEach(() => {
    // pseudonymize() に必要な環境変数を設定
    process.env["PSEUDONYMIZE_SALT"] = "test-salt-12345";

    mockBedrock = new MockBedrockClient(makeTaskBedrockResponse());
    mockRepo = new MockTaskCandidateRepository();
    agent = new TaskExtractorAgent(mockBedrock, mockRepo);
  });

  describe("extractTask — task detected", () => {
    it("returns skipped=false and persists TaskCandidate", async () => {
      const result = await agent.extractTask(testEvent);

      expect(result.skipped).toBe(false);
      if (result.skipped) throw new Error("type narrowing");

      expect(result.candidate).toBeDefined();
      expect(result.candidate.title).toBe("資料作成");
      expect(result.candidate.status).toBe(TASK_CANDIDATE_STATUS.PENDING);
      expect(result.candidate.sourceRef).toBe("1234567890.123456");
      expect(result.candidate.sourceType).toBe("slack");
    });

    it("pseudonymizes requester name (does not store raw Slack user ID)", async () => {
      const result = await agent.extractTask(testEvent);
      if (result.skipped) throw new Error("type narrowing");

      // 依頼者は生の "U12345" ではなく SHA-256 ハッシュ (64 文字) であるべき
      expect(result.candidate.requester).not.toBe("U12345");
      expect(result.candidate.requester).toHaveLength(64);
      expect(result.candidate.requester).toMatch(/^[0-9a-f]{64}$/);
    });

    it("stores messageTs as sourceRef (not message body)", async () => {
      const result = await agent.extractTask(testEvent);
      if (result.skipped) throw new Error("type narrowing");

      expect(result.candidate.sourceRef).toBe(testEvent.message.messageTs);
    });

    it("sets TTL 30 days from now", async () => {
      const beforeMs = Math.floor(Date.now() / 1000);
      const result = await agent.extractTask(testEvent);
      const afterMs = Math.floor(Date.now() / 1000);
      if (result.skipped) throw new Error("type narrowing");

      const expectedMin = beforeMs + 30 * 86400;
      const expectedMax = afterMs + 30 * 86400;
      expect(result.candidate.ttl).toBeGreaterThanOrEqual(expectedMin);
      expect(result.candidate.ttl).toBeLessThanOrEqual(expectedMax);
    });

    it("uses null deadline when Bedrock returns null", async () => {
      mockBedrock.setResponse(makeTaskBedrockResponse({ deadline: null }));
      const result = await agent.extractTask(testEvent);
      if (result.skipped) throw new Error("type narrowing");

      expect(result.candidate.deadline).toBeNull();
    });

    it("saves exactly one TaskCandidate to repository", async () => {
      await agent.extractTask(testEvent);
      expect(mockRepo.created).toHaveLength(1);
    });
  });

  describe("extractTask — non-task message", () => {
    it("returns skipped=true and does not persist anything", async () => {
      mockBedrock.setResponse(
        makeTaskBedrockResponse({
          is_task: false,
          title: "",
          requester: "",
          description: "",
          deadline: null,
        }),
      );

      const result = await agent.extractTask(testEvent);

      expect(result.skipped).toBe(true);
      expect(mockRepo.created).toHaveLength(0);
    });
  });

  describe("extractTask — Bedrock error handling", () => {
    it("throws when Bedrock response has no tool use block", async () => {
      mockBedrock.setResponse({
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

      await expect(agent.extractTask(testEvent)).rejects.toThrow(
        /Bedrock did not return tool use block/,
      );
    });

    it("throws when Bedrock tool output fails Zod validation", async () => {
      mockBedrock.setResponse({
        $metadata: {},
        output: {
          message: {
            role: "assistant",
            content: [
              {
                toolUse: {
                  toolUseId: "tool-002",
                  name: "extract_task_attributes",
                  input: {
                    is_task: "yes", // invalid — should be boolean
                    title: "Test",
                    deadline: null,
                    requester: "U12345",
                    description: "Test desc",
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

      await expect(agent.extractTask(testEvent)).rejects.toThrow(
        /schema validation/,
      );
    });
  });

  describe("buildPk (static helper)", () => {
    it("returns USER#<userId>", () => {
      expect(TaskExtractorAgent.buildPk("abc-123")).toBe("USER#abc-123");
    });
  });
});
