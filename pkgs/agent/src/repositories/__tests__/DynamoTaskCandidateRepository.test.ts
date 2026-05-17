import { describe, expect, it, vi, beforeEach } from "vitest";
import { DDB_PREFIX, TASK_CANDIDATE_STATUS } from "@saboru/shared";

/**
 * DynamoTaskCandidateRepository unit tests
 *
 * Strategy: Mock @aws-sdk/lib-dynamodb and @aws-sdk/client-dynamodb
 * to avoid real DynamoDB calls.
 */

// ─────────────────────────────────────────────
// Module mocks
// ─────────────────────────────────────────────

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
  ConditionalCheckFailedException: class ConditionalCheckFailedException extends Error {
    constructor(opts: { message: string }) {
      super(opts.message);
      this.name = "ConditionalCheckFailedException";
    }
  },
  TransactWriteItemsCommand: vi.fn((input: unknown) => ({ input })),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  PutCommand: vi.fn((input: unknown) => ({ input })),
  GetCommand: vi.fn((input: unknown) => ({ input })),
  QueryCommand: vi.fn((input: unknown) => ({ input })),
  DeleteCommand: vi.fn((input: unknown) => ({ input })),
}));

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────name──────────────────
// ─────────────────────────────────────────────

function makeCandidate(
  overrides: Partial<{
    candidateId: string;
    title: string;
    deadline: string | null;
    requester: string;
    description: string;
    sourceRef: string;
  }> = {},
) {
  return {
    candidateId: "01HX000000000000000000001",
    title: "テストタスク",
    deadline: "2026-06-01",
    requester: "abc123def456",
    description: "テスト内容",
    sourceType: "slack" as const,
    sourceRef: "1234567890.000001",
    status: TASK_CANDIDATE_STATUS.PENDING,
    createdAt: "2026-05-17T10:00:00.000Z",
    ttl: Math.floor(Date.now() / 1000) + 30 * 86400,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe("DynamoTaskCandidateRepository", () => {
  const userId = "cognito-user-xyz";

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["DYNAMODB_TABLE_TASK_CANDIDATES"] =
      "saborou-task-candidates-test";
    process.env["DYNAMODB_TABLE_TASKS"] = "saborou-tasks-test";
  });

  describe("create()", () => {
    it("calls DynamoDB PutCommand and returns TaskCandidate with PK/SK", async () => {
      mockSend.mockResolvedValueOnce({});

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();

      const candidate = makeCandidate();
      const result = await repo.create({
        ...candidate,
        // Internal convention: _userId
        _userId: userId,
      } as Parameters<typeof repo.create>[0]);

      expect(mockSend).toHaveBeenCalledOnce();
      expect(result.PK).toBe(`${DDB_PREFIX.USER}${userId}`);
      expect(result.SK).toBe(`${DDB_PREFIX.TASK_CAND}${candidate.candidateId}`);
      expect(result.title).toBe(candidate.title);
    });

    it("returns existing item when ConditionalCheckFailedException (idempotent)", async () => {
      const { ConditionalCheckFailedException } = await import(
        "@aws-sdk/client-dynamodb"
      );

      const existingItem = {
        PK: `${DDB_PREFIX.USER}${userId}`,
        SK: `${DDB_PREFIX.TASK_CAND}01HX000000000000000000001`,
        ...makeCandidate(),
      };

      // First call: ConditionalCheckFailedException
      mockSend.mockRejectedValueOnce(
        new ConditionalCheckFailedException({ message: "Already exists" }),
      );
      // Second call: GetCommand returns existing item
      mockSend.mockResolvedValueOnce({ Item: existingItem });

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();

      const result = await repo.create({
        ...makeCandidate(),
        _userId: userId,
      } as Parameters<typeof repo.create>[0]);

      expect(result.SK).toBe(existingItem.SK);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("findAllByUserId()", () => {
    it("queries with PK and begins_with prefix", async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();
      const results = await repo.findAllByUserId(userId);

      expect(results).toEqual([]);
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it("returns mapped TaskCandidate array", async () => {
      const item = {
        PK: `${DDB_PREFIX.USER}${userId}`,
        SK: `${DDB_PREFIX.TASK_CAND}01HX000000000000000000001`,
        ...makeCandidate(),
      };
      mockSend.mockResolvedValueOnce({ Items: [item] });

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();
      const results = await repo.findAllByUserId(userId);

      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe("テストタスク");
    });
  });

  describe("findById()", () => {
    it("returns null when item not found", async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();
      const result = await repo.findById(userId, "non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("delete()", () => {
    it("calls DeleteCommand without throwing", async () => {
      mockSend.mockResolvedValueOnce({});

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();
      await expect(
        repo.delete(userId, "01HX000000000000000000001"),
      ).resolves.toBeUndefined();

      expect(mockSend).toHaveBeenCalledOnce();
    });
  });

  describe("createTaskCandidateWithUserId()", () => {
    it("injects _userId and delegates to create()", async () => {
      mockSend.mockResolvedValueOnce({});

      const { DynamoTaskCandidateRepository, createTaskCandidateWithUserId } =
        await import("../DynamoTaskCandidateRepository.js");
      const repo = new DynamoTaskCandidateRepository();

      const candidate = makeCandidate();
      const result = await createTaskCandidateWithUserId(
        repo,
        userId,
        candidate,
      );

      expect(result.PK).toBe(`${DDB_PREFIX.USER}${userId}`);
      expect(result.SK).toBe(`${DDB_PREFIX.TASK_CAND}${candidate.candidateId}`);
    });
  });

  describe("approve()", () => {
    it("throws DynamoWriteFailedError when candidate not found", async () => {
      // findById returns null (item not found)
      mockSend.mockResolvedValueOnce({ Item: undefined });

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();

      await expect(repo.approve(userId, "non-existent")).rejects.toThrow(
        "TaskCandidate not found",
      );
    });

    it("throws DynamoWriteFailedError when TransactWriteItems fails", async () => {
      // findById returns item
      mockSend.mockResolvedValueOnce({
        Item: {
          PK: `${DDB_PREFIX.USER}${userId}`,
          SK: `${DDB_PREFIX.TASK_CAND}01HX000000000000000000001`,
          ...makeCandidate(),
        },
      });
      // TransactWriteItems fails
      mockSend.mockRejectedValueOnce(new Error("TransactionCanceledException"));

      const { DynamoTaskCandidateRepository } = await import(
        "../DynamoTaskCandidateRepository.js"
      );
      const repo = new DynamoTaskCandidateRepository();

      await expect(
        repo.approve(userId, "01HX000000000000000000001"),
      ).rejects.toThrow("Failed to approve TaskCandidate");
    });
  });
});
