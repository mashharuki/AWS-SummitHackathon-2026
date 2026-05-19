import type { Proposal } from "@saboru/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DynamoProposalRepository } from "../DynamoProposalRepository.js";

/**
 * DynamoProposalRepository ユニットテスト
 *
 * 方針: 実障の DynamoDB 呼び出しを防ぐため vi.mock で AWS SDK モジュールをモック化する。
 * PK/SK 構築、円等性動作、クエリパターンを検証する。
 */

// ─────────────────────────────────────────────
// AWS SDK モック
// ─────────────────────────────────────────────

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
    name = "ConditionalCheckFailedException";
    constructor(message: string) {
      super(message);
    }
  },
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockImplementation(() => ({ send: mockSend })),
  },
  PutCommand: vi
    .fn()
    .mockImplementation((input) => ({ input, type: "PutCommand" })),
  QueryCommand: vi
    .fn()
    .mockImplementation((input) => ({ input, type: "QueryCommand" })),
}));

// ─────────────────────────────────────────────
// ヘルパー
// ─────────────────────────────────────────────

function makeProposalInput(
  overrides: Partial<Omit<Proposal, "PK" | "SK">> = {},
): Omit<Proposal, "PK" | "SK"> {
  return {
    taskId: "task-001",
    userId: "user-abc",
    verdict: "can_saboru",
    summaryText: "まだ寝かせてOK",
    reasoning: ["締切まで余裕があるため", "リマインドなしのため"],
    chatMessage: "のんびりしていていいよ〜だよ😴",
    personaId: "saboru_ottori",
    evaluatedAt: "2026-05-17T10:00:00.000Z",
    nextCheckAt: "2026-05-17T14:00:00.000Z",
    tokenCount: 450,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe("DynamoProposalRepository", () => {
  let repo: DynamoProposalRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["DYNAMODB_TABLE_PROPOSALS"] = "saborou-proposals-test";
    process.env["AWS_REGION"] = "ap-northeast-1";
    repo = new DynamoProposalRepository();
  });

  describe("save()", () => {
    it("builds PK as TASK#<taskId>", async () => {
      mockSend.mockResolvedValueOnce({});

      const proposal = await repo.save(
        makeProposalInput({ taskId: "task-xyz" }),
      );

      expect(proposal.PK).toBe("TASK#task-xyz");
    });

    it("builds SK as PROPOSAL#<evaluatedAt>", async () => {
      mockSend.mockResolvedValueOnce({});

      const proposal = await repo.save(
        makeProposalInput({ evaluatedAt: "2026-05-17T10:00:00.000Z" }),
      );

      expect(proposal.SK).toBe("PROPOSAL#2026-05-17T10:00:00.000Z");
    });

    it("returns Proposal with all fields intact", async () => {
      mockSend.mockResolvedValueOnce({});

      const input = makeProposalInput();
      const result = await repo.save(input);

      expect(result.taskId).toBe(input.taskId);
      expect(result.userId).toBe(input.userId);
      expect(result.verdict).toBe(input.verdict);
      expect(result.summaryText).toBe(input.summaryText);
      expect(result.reasoning).toEqual(input.reasoning);
      expect(result.chatMessage).toBe(input.chatMessage);
      expect(result.personaId).toBe(input.personaId);
      expect(result.tokenCount).toBe(input.tokenCount);
    });

    it("calls DynamoDB PutCommand once", async () => {
      mockSend.mockResolvedValueOnce({});

      await repo.save(makeProposalInput());

      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("handles ConditionalCheckFailedException as idempotent success", async () => {
      // 1 回目の呼び出し: ConditionalCheckFailedException
      const { ConditionalCheckFailedException } = await import(
        "@aws-sdk/client-dynamodb"
      );
      const conditionalError = new ConditionalCheckFailedException(
        "Condition not met",
      );
      mockSend.mockRejectedValueOnce(conditionalError);

      // 2 回目の呼び出し (findByPkSk クエリ): 既存アイテムを返す
      const existingItem: Proposal = {
        PK: "TASK#task-001",
        SK: "PROPOSAL#2026-05-17T10:00:00.000Z",
        taskId: "task-001",
        userId: "user-abc",
        verdict: "can_saboru",
        summaryText: "既存の判定",
        reasoning: ["既存の理由"],
        chatMessage: "既存のチャット",
        personaId: "saboru_ottori",
        evaluatedAt: "2026-05-17T10:00:00.000Z",
        nextCheckAt: "2026-05-17T14:00:00.000Z",
        tokenCount: 300,
      };
      mockSend.mockResolvedValueOnce({ Items: [existingItem] });

      const result = await repo.save(makeProposalInput());

      // 既存アイテムを返す (例外をスローしない)
      expect(result.summaryText).toBe("既存の判定");
    });

    it("returns constructed item when ConditionalCheckFailed and findByPkSk returns null (empty Items)", async () => {
      // 1 回目の呼び出し: ConditionalCheckFailedException
      const { ConditionalCheckFailedException } = await import(
        "@aws-sdk/client-dynamodb"
      );
      const conditionalError = new ConditionalCheckFailedException(
        "Condition not met",
      );
      mockSend.mockRejectedValueOnce(conditionalError);

      // 2 回目の呼び出し (findByPkSk クエリ): アイテムなし (null ケース)
      mockSend.mockResolvedValueOnce({ Items: [] });

      const input = makeProposalInput();
      const result = await repo.save(input);

      // 構築したアイテムを返す (例外をスローしない)
      expect(result.PK).toBe("TASK#task-001");
      expect(result.SK).toBe("PROPOSAL#2026-05-17T10:00:00.000Z");
      expect(result.summaryText).toBe(input.summaryText);
    });

    it("returns constructed item when ConditionalCheckFailed and findByPkSk returns undefined Items", async () => {
      // 1 回目の呼び出し: ConditionalCheckFailedException
      const { ConditionalCheckFailedException } = await import(
        "@aws-sdk/client-dynamodb"
      );
      const conditionalError = new ConditionalCheckFailedException(
        "Condition not met",
      );
      mockSend.mockRejectedValueOnce(conditionalError);

      // 2 回目の呼び出し (findByPkSk クエリ): undefined Items (別パスの null ケース)
      mockSend.mockResolvedValueOnce({});

      const input = makeProposalInput();
      const result = await repo.save(input);

      // 構築したアイテムを返す (例外をスローしない)
      expect(result.PK).toBe("TASK#task-001");
      expect(result.SK).toBe("PROPOSAL#2026-05-17T10:00:00.000Z");
    });

    it("throws DynamoWriteFailedError for other DynamoDB errors", async () => {
      mockSend.mockRejectedValueOnce(new Error("Network error"));

      await expect(repo.save(makeProposalInput())).rejects.toThrow(
        "Failed to save Proposal",
      );
    });
  });

  describe("findLatestByTaskId()", () => {
    it("returns null when no proposals found", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await repo.findLatestByTaskId("task-001");
      expect(result).toBeNull();
    });

    it("returns Proposal when found", async () => {
      const existingProposal: Proposal = {
        PK: "TASK#task-001",
        SK: "PROPOSAL#2026-05-17T10:00:00.000Z",
        taskId: "task-001",
        userId: "user-abc",
        verdict: "borderline",
        summaryText: "グレーゾーン",
        reasoning: ["理由1"],
        chatMessage: "様子を見よう",
        personaId: "saboru_ottori",
        evaluatedAt: "2026-05-17T10:00:00.000Z",
        nextCheckAt: "2026-05-17T11:00:00.000Z",
        tokenCount: 200,
      };

      mockSend.mockResolvedValueOnce({ Items: [existingProposal] });

      const result = await repo.findLatestByTaskId("task-001");

      expect(result).not.toBeNull();
      expect(result?.verdict).toBe("borderline");
      expect(result?.taskId).toBe("task-001");
    });

    it("returns null when Items is undefined", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await repo.findLatestByTaskId("task-001");
      expect(result).toBeNull();
    });

    it("queries GSI-TaskLatest with correct parameters", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await repo.findLatestByTaskId("task-xyz");

      const callArgs = mockSend.mock.calls[0][0];
      // QueryCommand の入力を検証
      expect(callArgs.input.IndexName).toBe("GSI-TaskLatest");
      expect(callArgs.input.KeyConditionExpression).toContain("taskId");
      expect(callArgs.input.ScanIndexForward).toBe(false);
      expect(callArgs.input.Limit).toBe(1);
    });
  });
});
