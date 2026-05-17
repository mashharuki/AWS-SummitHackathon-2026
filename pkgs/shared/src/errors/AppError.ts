/**
 * アプリケーション固有のエラーコード
 * Hono エラーハンドラーがコードを読み取り、適切な HTTP レスポンスに変換する
 */
export type ErrorCode =
  | "TASK_NOT_FOUND" // 404: タスクが存在しない
  | "CANDIDATE_NOT_FOUND" // 404: タスク候補が存在しない
  | "UNAUTHORIZED" // 401: JWT 未認証
  | "TOKEN_EXPIRED" // 401: JWT 期限切れ (Cognito)
  | "EXTERNAL_API_FAILED" // 502: Slack API エラー
  | "BEDROCK_TIMEOUT" // 504: Bedrock レスポンスタイムアウト (5秒)
  | "BEDROCK_COST_EXCEEDED" // 429: Bedrock コスト制限ガード
  | "DYNAMO_WRITE_FAILED" // 500: DynamoDB 書き込みエラー
  | "INVALID_INPUT" // 400: 入力バリデーションエラー (Zod)
  | "PERSONA_NOT_FOUND" // 404: ペルソナが存在しない
  | "CONNECTION_NOT_FOUND"; // 404: サービス接続が存在しない

/**
 * シリアライズされたエラーレスポンス構造
 */
export interface SerializedError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  stack?: string | undefined;
}

/**
 * 基底エラークラス (Q6 回答)
 * サービス固有のエラーはすべてこのクラスを継承する。
 * HTTP レスポンスへの内部スタックトレース漏洩を防ぐ設計 (NFR-03)。
 */
export class AppError extends Error {
  /** アプリケーション固有のエラーコード */
  readonly code: ErrorCode;
  /** HTTP ステータスコード */
  readonly statusCode: number;
  /** 追加エラー詳細 */
  readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode ?? 500;
    this.details = details;
    // V8 環境でスタックトレースを正しく Error に付与する
    const errorConstructor = Error as typeof Error & {
      captureStackTrace?: (target: Error, constructor: unknown) => void;
    };
    if (errorConstructor.captureStackTrace) {
      errorConstructor.captureStackTrace(this, AppError);
    }
  }

  /**
   * HTTP レスポンス用にエラーをシリアライズする
   * 開発環境: 詳細メッセージ・詳細・スタックトレースを含む
   * 本番環境: 汎用メッセージのみ返す (セキュリティ, NFR-S5)
   *
   * サーバーサイドのログ (CloudWatch) は独立して動作し、常に詳細を記録する
   */
  serialize(): SerializedError {
    if (process.env["NODE_ENV"] === "production") {
      return {
        code: this.code,
        message: "An unexpected error occurred.",
      };
    }

    const result: SerializedError = {
      code: this.code,
      message: this.message,
    };
    if (this.details !== undefined) {
      result.details = this.details;
    }
    if (this.stack !== undefined) {
      result.stack = this.stack;
    }
    return result;
  }
}
