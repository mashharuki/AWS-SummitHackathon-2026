/**
 * API Lambda エントリーポイント
 *
 * Lambda 呼び出しのために Hono アプリを hono/aws-lambda でラップする。
 * ハンドラー名: index.handler (CDK ApiStack で設定)
 *
 * SSE エンドポイント向け Lambda Response Streaming をサポート。
 *
 * 注: このファイルは Lambda エントリーポイントアダプターのみ。
 * 全ビジネスロジックは index.ts/routes/*.ts に存在する。
 * Lambda ランタイム外では動作できないためカバレッジは除外する。
 */
/* istanbul ignore file */
import { handle } from "hono/aws-lambda";
import app from "./index.js";

// Hono アプリを Lambda ハンドラーとしてラップする
/* istanbul ignore next */
export const handler = handle(app);
