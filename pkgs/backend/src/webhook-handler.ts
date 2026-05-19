import { Hono } from "hono";
/**
 * Webhook Lambda エントリーポイント
 *
 * Slack Webhook 受信用の別途 Lambda 関数。
 * ハンドラー名: webhook.handler (CDK WebhookStack で設定)
 *
 * 分離の理由:
 * - SLACK_SIGNING_SECRET_ARN 環境変数が必要 (メイン API では不要)
 * - 最小権限の別途実行ロール
 * - EventBridge PutEvents 権限のみ
 *
 * 環境変数:
 * - SLACK_SIGNING_SECRET_ARN: Slack 署名シークレットの Secrets Manager ARN
 * - EVENT_BUS_NAME: EventBridge イベントバス名
 *
 * 注: このファイルは Lambda エントリーポイントアダプターのみ。
 * 全ビジネスロジックは routes/webhooks.ts に存在する。
 * Lambda ランタイム外では動作できないためカバレッジは除外する。
 */
/* istanbul ignore file */
import { handle } from "hono/aws-lambda";
import { errorHandler } from "./middleware/error-handler.js";
import { requestLogger } from "./middleware/logger.js";
import { webhooksRoute } from "./routes/webhooks.js";

const webhookApp = new Hono();

// ミドルウェア
webhookApp.use("*", requestLogger);

// Webhook ルートのみ許可する
webhookApp.route("/webhooks", webhooksRoute);

// エラーハンドラー
webhookApp.onError(errorHandler);

/* istanbul ignore next */
export const handler = handle(webhookApp);
