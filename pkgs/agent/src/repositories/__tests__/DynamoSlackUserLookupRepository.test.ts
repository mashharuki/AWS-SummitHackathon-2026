import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DynamoSlackUserLookupRepository ユニットテスト
 *
 * 方針: 実際の DynamoDB 呼び出しを防ぐため
 * @aws-sdk/lib-dynamodb および @aws-sdk/client-dynamodb をモック化する。
 */

const mockSend = vi.fn();

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn(() => ({ send: mockSend })),
}));

vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({ send: mockSend })),
  },
  QueryCommand: vi.fn((input: unknown) => ({ input })),
}));

describe("DynamoSlackUserLookupRepository.findCognitoSubBySlackIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DYNAMODB_TABLE_CONNECTIONS = "connections-test";
  });

  it("queries GSI-SlackLookup with the composite key and returns cognitoSub", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ PK: "USER#cognito-abc", SK: "CONN#slack" }],
    });

    const { DynamoSlackUserLookupRepository } = await import(
      "../DynamoSlackUserLookupRepository.js"
    );
    const repo = new DynamoSlackUserLookupRepository();
    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");

    expect(sub).toBe("cognito-abc");
    // GSI と合成キーが正しく使われる
    const sentCommand = mockSend.mock.calls[0][0] as {
      input: {
        IndexName: string;
        ExpressionAttributeValues: Record<string, string>;
      };
    };
    expect(sentCommand.input.IndexName).toBe("GSI-SlackLookup");
    expect(sentCommand.input.ExpressionAttributeValues[":k"]).toBe("T999#U999");
  });

  it("returns null when no item matches (unlinked Slack user)", async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    const { DynamoSlackUserLookupRepository } = await import(
      "../DynamoSlackUserLookupRepository.js"
    );
    const repo = new DynamoSlackUserLookupRepository();
    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U-unknown");

    expect(sub).toBeNull();
  });

  it("returns null when Items is undefined", async () => {
    mockSend.mockResolvedValueOnce({});

    const { DynamoSlackUserLookupRepository } = await import(
      "../DynamoSlackUserLookupRepository.js"
    );
    const repo = new DynamoSlackUserLookupRepository();
    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");

    expect(sub).toBeNull();
  });

  it("returns null when PK is not in USER# form", async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ PK: "WEIRD#x", SK: "CONN#slack" }],
    });

    const { DynamoSlackUserLookupRepository } = await import(
      "../DynamoSlackUserLookupRepository.js"
    );
    const repo = new DynamoSlackUserLookupRepository();
    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");

    expect(sub).toBeNull();
  });

  it("falls back to default table name when env var is unset", async () => {
    // 環境変数を実際に削除する（= undefined 代入だと文字列 "undefined" になり ?? が効かない）
    // biome-ignore lint/performance/noDelete: env var の真の削除には delete が必要
    delete process.env.DYNAMODB_TABLE_CONNECTIONS;
    mockSend.mockResolvedValueOnce({
      Items: [{ PK: "USER#cognito-abc", SK: "CONN#slack" }],
    });

    const { DynamoSlackUserLookupRepository } = await import(
      "../DynamoSlackUserLookupRepository.js"
    );
    const repo = new DynamoSlackUserLookupRepository();
    const sub = await repo.findCognitoSubBySlackIdentity("T999", "U999");

    expect(sub).toBe("cognito-abc");
    const sentCommand = mockSend.mock.calls[0][0] as {
      input: { TableName: string };
    };
    expect(sentCommand.input.TableName).toBe("saborou-service-connections-dev");
  });
});
