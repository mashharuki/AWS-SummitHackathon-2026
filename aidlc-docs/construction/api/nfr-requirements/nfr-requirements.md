# NFR 要件定義 — U-04: api

**Unit**: U-04: api
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. パフォーマンス要件

### NFR-P1: 非ストリーミングエンドポイントの応答時間

| 指標 | 目標値 | 備考 |
|------|--------|------|
| p50 レイテンシ | 200ms 以内 | DynamoDB ウォームアップ後 |
| p99 レイテンシ | 500ms 以内 | DynamoDB + Secrets Manager |
| コールドスタート | 3秒 以内 | ARM64 + esbuild bundle |

**対象エンドポイント**: GET /api/tasks, POST /api/tasks, PATCH/DELETE, GET /api/connections 等

### NFR-P2: SSE ストリーミングの初回 chunk レイテンシ

| 指標 | 目標値 | 備考 |
|------|--------|------|
| SSE 初回 chunk | 3秒 以内（ウォーム）| Bedrock Sonnet 初回トークン |
| SSE 初回 chunk | 10秒 以内（コールド）| Lambda コールドスタート含む |
| 全体完了 | 30秒 以内 | API Gateway タイムアウト 29秒 |

**SSE ストリーミングは SaboriProposerAgent に委譲するため、エージェント側の NFR-P1 制約も継承する**

### NFR-P3: Webhook 処理レイテンシ

| 指標 | 目標値 | 備考 |
|------|--------|------|
| POST /webhooks/slack 応答 | 3秒 以内 | Slack の 3秒タイムアウト遵守 |
| EventBridge 転送 | 非同期（fire-and-forget）| waitUntil で非同期実行 |

---

## 2. セキュリティ要件

### NFR-S1: JWT 認証

- Cognito JWT Authorizer（API Gateway レベル）で署名検証済み
- Lambda ミドルウェアは `sub` クレーム（userId）の存在確認のみ実施
- トークン有効期限は Cognito デフォルト（1時間）を使用

### NFR-S2: Slack 署名検証

- HMAC-SHA256（`X-Slack-Signature` + `X-Slack-Request-Timestamp`）で検証
- タイムスタンプ 5分超のリクエストを拒否（リプレイ攻撃防止）
- `SLACK_SIGNING_SECRET` は Secrets Manager から取得し、Lambda 環境変数にはコードを直接保存しない

### NFR-S3: シークレット管理

- `SLACK_SIGNING_SECRET_ARN`（環境変数）で Secrets Manager から起動時に取得
- DynamoDB アクセスは IAM ロールの `grant*` メソッドによる最小権限

### NFR-S4: 入力検証

- 全リクエストボディ・クエリパラメータを Zod スキーマで検証
- バリデーション失敗は 400 + エラー詳細（ただし内部スタックトレースは隠蔽）
- XSS・インジェクション対策: DynamoDB へのアクセスはパラメータ化された SDK メソッド使用

### NFR-S5: CORS 設定

- 既存 CDK ApiStack の CORS preflight 設定に準拠（開発: localhost:5173、本番: CloudFront ドメイン）
- 実装上は API Gateway が CORS を処理するため Hono 側の追加設定不要

---

## 3. 信頼性要件

### NFR-R1: エラーハンドリング

- 全ハンドラは try-catch でラップし、グローバルエラーハンドラに委譲
- DynamoDB `ConditionalCheckFailedException` → 409 CONFLICT
- DynamoDB `ResourceNotFoundException` → 503 SERVICE_UNAVAILABLE
- Bedrock スロットリング → 503 + Retry-After ヘッダー（SSE ストリームの場合は error SSE イベント送信後クローズ）

### NFR-R2: 冪等性

- `POST /api/tasks/candidates/:id/approve` は TransactWriteItems の ConditionalCheck で重複承認を防止
- `POST /api/tasks` の手動追加は新規 ULID を生成するため常に新規レコード

### NFR-R3: タイムアウト設計

- Lambda タイムアウト: 29秒（API Gateway のハードリミットに合わせる）
- SSE ストリーミングは 25秒を超えたら強制的に done イベントを送信してクローズ

---

## 4. コスト要件

### NFR-C1: Lambda メモリとコスト

- `saborou-api-{env}`: 256MB（CDK 既定値を維持）
- ARM64 アーキテクチャで x86 比 20% コスト削減
- esbuild で単一ファイルバンドル → コールドスタート時間短縮

### NFR-C2: DynamoDB アクセス最適化

- 候補一覧取得は GSI を使用し Full Scan を回避
- SSE キャッシュヒット時は Bedrock 呼び出しをスキップしコストゼロ

---

## 5. テスト容易性

### NFR-T1: ユニットテストカバレッジ目標

| 対象 | 目標 |
|------|------|
| Statements | 90%+ |
| Branches | 85%+ |
| Functions | 95%+ |

### NFR-T2: テスト戦略

- `app.request()` を使用したルートハンドラのユニットテスト（HTTP サーバー起動不要）
- リポジトリはインタフェースでモック（`vi.fn()`）
- SSE ストリームは `ReadableStreamDefaultReader` でテスト
- Slack 署名検証は正常・異常ケースを網羅

---

## 6. 可観測性要件

### NFR-O1: 構造化ログ

```typescript
// ログフォーマット（CloudWatch Logs Insights 対応）
{
  "timestamp": "2026-05-17T00:00:00.000Z",
  "requestId": "<lambda-request-id>",
  "level": "INFO" | "WARN" | "ERROR",
  "method": "GET",
  "path": "/api/tasks",
  "userId": "<sub>",
  "statusCode": 200,
  "duration_ms": 45
}
```

### NFR-O2: X-Ray トレーシング

- Lambda トレーシング: Active（CDK 既定値）
- DynamoDB SDK コールはセグメントに自動追加

### NFR-O3: エラーアラート

- 5xx エラーが 5%超で CloudWatch Alarm（U-02 MonitoringConstruct で設定済み）

---

## 7. 技術スタック決定

| 項目 | 選定技術 | 理由 |
|------|---------|------|
| フレームワーク | Hono 4.x | 既存 pkgs/backend で採用済み。軽量・Lambda 最適化 |
| バリデーション | Zod 3.x | pkgs/shared と同一ライブラリで型共有可能 |
| HTTP アダプター | hono/aws-lambda | Lambda event/context を Hono Request に変換 |
| SSE | hono/streaming の streamSSE | Hono ネイティブ SSE サポート |
| テスト | Vitest | pkgs/backend に既存設定あり |
| ビルド | esbuild（既存 package.json のビルドスクリプト） | 高速バンドル・Lambda 最適 |
| Slack 検証 | 自前実装（@slack/web-api は不要）| crypto.createHmac で軽量実装 |
| ULID 生成 | pkgs/shared の generateUlid() | 共有ユーティリティを再利用 |
| DynamoDB SDK | @aws-sdk/client-dynamodb + @aws-sdk/lib-dynamodb | pkgs/agent と同一バージョン |
| EventBridge | @aws-sdk/client-eventbridge | Webhook 転送用 |
