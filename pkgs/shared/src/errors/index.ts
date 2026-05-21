import { AppError } from "./AppError";

/**
 * Bedrock converse API タイムアウト (NFR-01: 5秒制限)
 * タイムアウト時、ユーザーに "再試行" トースト通知を表示する
 */
export class BedrockTimeoutError extends AppError {
  constructor(message = "Bedrock API response timed out (5s limit)") {
    super("BEDROCK_TIMEOUT", message, 504);
    this.name = "BedrockTimeoutError";
  }
}

/**
 * Bedrock トークンコスト上限超過 (NFR-06: $50/月制限)
 * guardTokenLimit() のプリフライトチェックで事前に防止する
 * 上限超過時: グレースフルデグラデーション (提案なしでタスクを表示)
 */
export class BedrockCostExceededError extends AppError {
  constructor(message = "Bedrock token cost limit exceeded") {
    super("BEDROCK_COST_EXCEEDED", message, 429);
    this.name = "BedrockCostExceededError";
  }
}

/**
 * Cognito JWT 期限切れ
 * フロントエンドは 401 受信時に自動リフレッシュを試みる
 */
export class TokenExpiredError extends AppError {
  constructor(message = "Cognito JWT token expired") {
    super("TOKEN_EXPIRED", message, 401);
    this.name = "TokenExpiredError";
  }
}

/**
 * DynamoDB 書き込み失敗
 * TransactWriteItems の ConditionalCheckFailedException 等をラップする
 */
export class DynamoWriteFailedError extends AppError {
  constructor(message = "DynamoDB write operation failed", details?: unknown) {
    super("DYNAMO_WRITE_FAILED", message, 500, details);
    this.name = "DynamoWriteFailedError";
  }
}

/**
 * 型ガード: unknown 型を AppError に安全に絞り込む
 *
 * @example
 * try {
 *   await repo.save(data);
 * } catch (e) {
 *   if (isAppError(e)) {
 *     logger.error({ code: e.code, details: e.details });
 *     return res.status(e.statusCode).json(e.serialize());
 *   }
 *   throw e; // 未知のエラーは上位に伝播させる
 * }
 */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// Re-exports
export type { ErrorCode, SerializedError } from "./AppError";
export { AppError };
