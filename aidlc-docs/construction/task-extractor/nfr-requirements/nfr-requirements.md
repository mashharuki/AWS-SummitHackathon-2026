# NFR Requirements — U-03a: task-extractor

**Unit**: U-03a: task-extractor
**ステージ**: CONSTRUCTION / NFR Requirements
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. パフォーマンス要件

### NFR-P1: Bedrock レスポンスタイム

| 項目 | 目標値 | 測定点 |
|------|--------|-------|
| Bedrock converse API 平均応答 | 3 秒以内 | Lambda 計測（X-Ray） |
| タスク抽出全体（Bedrock + DynamoDB 書き込み） | 5 秒以内（ウォーム） | Lambda Duration |
| Lambda コールドスタート | 15 秒以内 | CloudWatch |

**根拠**: NFR-01a（レイテンシ要件）に基づく。EventBridge 経由の非同期処理のため UX への直接影響は低いが、
Lambda タイムアウト（60 秒）内に完了する必要がある。

### NFR-P2: maxTokens 明示設定

- **必須**: Bedrock 呼び出し時に `inferenceConfig.maxTokens = 512` を明示設定する
- **根拠**: amazon-bedrock スキル Critical Warning — 未設定時は最大値（64K）を予約し、ThrottlingException の原因となる

---

## 2. セキュリティ要件

### NFR-S1: 最小権限 IAM

Lambda 実行ロールに付与する権限：

```
bedrock:InvokeModel (claude-3-5-sonnet-20241022 のみ)
dynamodb:PutItem (TaskCandidates テーブルのみ)
dynamodb:GetItem (TaskCandidates テーブルのみ)
dynamodb:Query  (TaskCandidates テーブルのみ)
dynamodb:DeleteItem (TaskCandidates テーブルのみ)
secretsmanager:GetSecretValue (SlackToken シークレットのみ)
logs:CreateLogGroup / PutLogEvents (CloudWatch)
```

**ワイルドカード（`*`）は使用しない。**

### NFR-S2: 生データ非保存（NFR-07）

- Slack `message.text` は Lambda メモリ上でのみ処理する
- DynamoDB への書き込みには `sourceRef`（messageTs）のみを保存する
- `requester`（Slack userId）は `pseudonymize()`（SHA-256 + プロジェクト固有 salt）でハッシュ化後に保存する

### NFR-S3: シークレット管理

- Slack OAuth トークンは `@saboru/slack-token`（AWS Secrets Manager）から取得する
- Lambda 環境変数にトークンをハードコードしない

### NFR-S4: 入力バリデーション

- EventBridge ペイロードは Zod スキーマ（`SlackEventPayloadSchema`）で検証する
- Bedrock ツール出力も Zod スキーマ（`ExtractedTaskSchema`）で検証する（モデル出力は untrusted input）

---

## 3. 信頼性・可用性要件

### NFR-R1: Bedrock adaptive retry

- `BedrockRuntimeClient` に `maxAttempts: 5, retryMode: 'adaptive'` を設定する
- リトライ対象: ThrottlingException / ModelTimeoutException / ServiceUnavailableException / InternalServerException
- リトライ非対象: ValidationException / AccessDeniedException

### NFR-R2: Lambda DLQ

- Bedrock 失敗・DynamoDB 書き込み失敗時は Lambda がエラーをスローし、
  EventBridge / Lambda の DeadLetterQueue（SQS）に送信される
- DLQ は U-02: infra の `AgentStack` で設定済み

### NFR-R3: is_task = false の冪等性

- タスクではないと判定されたメッセージは DynamoDB に書き込まず、Lambda は正常終了する
- 同一 messageTs の重複実行でも TaskCandidate が二重作成されないよう、
  DynamoDB PutItem 条件式（`attribute_not_exists(SK)`）を使用する

---

## 4. コスト最適化要件

### NFR-C1: maxTokens の最小化

- `inferenceConfig.maxTokens = 512`（タスク属性抽出に必要な最小値）
- タスク抽出プロンプトは簡潔に保ち、入力トークン数を最小化する（目標: 2,000 トークン以内）

### NFR-C2: ARM64 アーキテクチャ

- Lambda ランタイム: `arm64`（graviton2）— コスト約 20% 削減
- U-02: infra の AgentStack で設定済み（Lambda Architecture: arm64）

### NFR-C3: DynamoDB PAY_PER_REQUEST

- TaskCandidates テーブルはオンデマンドモード
- U-02: infra の DataStack で設定済み

---

## 5. テスト容易性要件

### NFR-T1: IBedrockClient 抽象化

- `IBedrockClient` インタフェースを通じて Bedrock を呼び出す
- テスト時は `MockBedrockClient` で固定レスポンスを注入する
- AWS SDK への直接依存を `BedrockClientAdapter` に隔離する

### NFR-T2: ITaskCandidateRepository 抽象化

- `DynamoTaskCandidateRepository` は `ITaskCandidateRepository` を実装する
- テスト時は `InMemoryTaskCandidateRepository` を使用する

### NFR-T3: カバレッジ目標

| 対象ファイル | 目標カバレッジ |
|------------|-------------|
| TaskExtractorAgent.ts | 90%+ |
| TaskExtractorLambdaHandler.ts | 85%+ |
| DynamoTaskCandidateRepository.ts | 80%+ |
| ContextCollector.ts | 80%+ |

---

## 6. 可観測性要件

### NFR-O1: 構造化ログ

Lambda はすべてのログを JSON 形式で CloudWatch に出力する。

```json
{
  "level": "INFO",
  "unit": "task-extractor",
  "userId": "masked",
  "sourceRef": "1748000000.123456",
  "bedrockDurationMs": 2400,
  "isTask": true,
  "action": "extracted"
}
```

**注意**: `userId` は本番環境でマスクする（NFR-S2 準拠）。

### NFR-O2: CloudWatch Metrics（U-02 MonitoringConstruct）

U-02 の MonitoringConstruct が以下を自動収集する（追加実装不要）：
- Lambda Duration / Error / Throttle
- Lambda DLQ メッセージ数アラーム

---

## 7. 技術スタック決定

| 項目 | 決定 | 理由 |
|------|------|------|
| 言語 | TypeScript（ESM） | モノレポ統一 |
| Bedrock クライアント | `@aws-sdk/client-bedrock-runtime` v3 | converse API 対応 |
| DynamoDB クライアント | `@aws-sdk/lib-dynamodb` (DocumentClient) | 型安全な操作 |
| テスト | Vitest | shared/cdk と統一 |
| ビルド | tsup | shared と統一 |
| Linter | Biome | モノレポ統一 |
| Bedrock モデル ID | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | 東京リージョン cross-region inference |
