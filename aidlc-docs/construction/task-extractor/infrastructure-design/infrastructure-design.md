# Infrastructure Design — U-03a: task-extractor

**Unit**: U-03a: task-extractor
**ステージ**: CONSTRUCTION / Infrastructure Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. インフラ概要

U-03a の `TaskExtractorAgent` は Lambda 関数（`saborou-task-extractor-{env}`）として動作する。
EventBridge からイベントを受け取り、Bedrock converse API でタスク属性を抽出し、DynamoDB に書き込む。

**既存インフラ（U-02 設定済み）を使用するため、CDK コードの追加変更は最小限。**

---

## 2. 使用 AWS リソース

### 2.1 既存リソース（U-02: infra 設定済み）

| リソース | 名称 | スタック | U-03a での使用 |
|---------|------|---------|-------------|
| Lambda Function | `saborou-task-extractor-{env}` | AgentStack | コアランタイム |
| SQS DLQ | `saborou-task-extractor-dlq-{env}` | AgentStack | 失敗時の Dead Letter |
| CloudWatch LogGroup | `/aws/lambda/saborou-task-extractor-{env}` | AgentStack | 構造化ログ出力 |
| DynamoDB Table | `saborou-task-candidates-{env}` | DataStack | TaskCandidate 書き込み |
| DynamoDB GSI | `GSI-UserCreatedAt` | DataStack | userId でのクエリ |
| Secrets Manager | `saborou-slack-client-secret-{env}` | DataStack | Slack OAuth トークン |
| EventBridge Custom Bus | `saborou-event-bus-{env}` | WebhookStack | Slack イベント受信 |
| EventBridge Rule | SlackMessageRule | WebhookStack | Lambda をトリガー |

### 2.2 U-03a で追加するリソース

**なし。** U-02 の AgentStack が TaskExtractor Lambda を設定済みであり、
U-03a では Lambda のコード（`pkgs/agent/dist`）を作成するのみ。

---

## 3. Lambda 設定詳細

U-02 AgentStack の設定値（参考）：

| 設定項目 | 値 | 備考 |
|---------|-----|------|
| Runtime | `nodejs22.x` | Node.js 22 |
| Architecture | `ARM_64` (Graviton2) | コスト削減 |
| Memory | 512 MB | Bedrock 呼び出し考慮 |
| Timeout | 60 秒 | Bedrock 平均 3-5s + マージン |
| Handler | `taskExtractor.handler` | `pkgs/backend/dist` → **変更が必要** |
| Tracing | `ACTIVE` (X-Ray) | 有効 |
| Dead Letter Queue | `saborou-task-extractor-dlq-{env}` | 設定済み |

### 3.1 Handler パス変更（重要）

現在の AgentStack の `code` 設定:
```
code: lambda.Code.fromAsset('../../pkgs/backend/dist')
handler: 'taskExtractor.handler'
```

U-03a 実装後の正しい設定:
```
code: lambda.Code.fromAsset('../../pkgs/agent/dist')
handler: 'taskExtractor.handler'
```

**→ AgentStack の code パスを `pkgs/backend/dist` から `pkgs/agent/dist` に変更する必要がある。**
これは Code Generation ステージで CDK コードも合わせて修正する。

### 3.2 環境変数

U-02 設定済みの環境変数（AgentStack）:

| 変数名 | 値 | 使用箇所 |
|-------|-----|---------|
| `ENVIRONMENT` | `dev` / `prod` | ログ・条件分岐 |
| `DYNAMODB_TABLE_TASK_CANDIDATES` | テーブル名 | Repository |
| `DYNAMODB_TABLE_TASKS` | テーブル名 | 参照のみ |
| `BEDROCK_REGION` | `ap-northeast-1` | BedrockClientAdapter |

**U-03a で追加が必要な環境変数**:

| 変数名 | 値 | 使用箇所 |
|-------|-----|---------|
| `SLACK_TOKEN_SECRET_NAME` | `saborou-slack-client-secret-{env}` | ContextCollector |

→ AgentStack の TaskExtractor Lambda の `environment` に追加が必要。

### 3.3 IAM 権限

U-02 AgentStack で付与済み:

```
bedrock:InvokeModel
bedrock:InvokeModelWithResponseStream
dynamodb:* (taskCandidates, tasks テーブル)
```

**U-03a で追加が必要な IAM 権限**:

```
secretsmanager:GetSecretValue (slackClientSecret のみ)
```

→ AgentStack に `slackClientSecret.grantRead(taskExtractorFn)` を追加。

---

## 4. Bedrock モデル設定

| 項目 | 値 |
|------|-----|
| Model ID | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` |
| リージョン | `ap-northeast-1`（東京、cross-region inference） |
| maxTokens | `512`（固定） |
| temperature | `0`（決定論的出力） |
| toolChoice | `{ tool: { name: 'extract_task_attributes' } }` |

**補足**: U-02 の Bedrock IAM ポリシーは `anthropic.claude-3-5-sonnet-20241022-v2:0`（`us.` プレフィックスなし）を
許可している。cross-region inference profile には `us.` プレフィックス付き ID を使用するが、
IAM リソース ARN には `us.` プレフィックスなしの base model ID を指定する。
これは AWS の仕様であり、コード側で `us.` プレフィックス付き ID を使用しても IAM で許可される。

---

## 5. DynamoDB アクセスパターン

| 操作 | アクセスパターン | Repository メソッド |
|------|--------------|------------------|
| タスク候補作成 | `PutItem PK=USER#<userId> SK=TASK_CAND#<ulid>` | `create()` |
| タスク候補一覧 | `Query PK=USER#<userId> SK begins_with TASK_CAND#` | `findAllByUserId()` |
| 単一取得 | `GetItem PK=USER#<userId> SK=TASK_CAND#<candidateId>` | `findById()` |
| 承認（atomic） | `TransactWriteItems Delete+PutItem` | `approve()` |
| 削除 | `DeleteItem` | `delete()` |

---

## 6. AgentStack 修正サマリ

U-03a の Code Generation で以下の CDK 変更を実施する：

```typescript
// 変更前
code: lambda.Code.fromAsset('../../pkgs/backend/dist'),
handler: 'taskExtractor.handler',
environment: {
  ENVIRONMENT: environment,
  DYNAMODB_TABLE_TASK_CANDIDATES: props.data.tables.taskCandidates.tableName,
  DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
  BEDROCK_REGION: 'ap-northeast-1',
},

// 変更後
code: lambda.Code.fromAsset('../../pkgs/agent/dist'),
handler: 'task-extractor/TaskExtractorLambdaHandler.handler',
environment: {
  ENVIRONMENT: environment,
  DYNAMODB_TABLE_TASK_CANDIDATES: props.data.tables.taskCandidates.tableName,
  DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
  BEDROCK_REGION: 'ap-northeast-1',
  SLACK_TOKEN_SECRET_NAME: props.data.secrets.slackClientSecret.secretName,
},
```

追加（taskExtractorFn の IAM 権限）:
```typescript
props.data.secrets.slackClientSecret.grantRead(taskExtractorFn);
```

---

## 7. Well-Architected 6本柱 準拠確認

| 柱 | 評価 | 対応状況 |
|----|------|---------|
| 運用上の卓越性 | OK | CloudWatch 構造化ログ・X-Ray トレース設定済み（U-02） |
| セキュリティ | OK | 最小権限 IAM・Secrets Manager・生データ非保存 |
| 信頼性 | OK | DLQ・adaptive retry・Zod バリデーション |
| パフォーマンス効率 | OK | ARM64・maxTokens=512・512MB メモリ |
| コスト最適化 | OK | PAY_PER_REQUEST DynamoDB・ARM64・maxTokens 最小化 |
| 持続可能性 | OK | ARM64 (Graviton2) でエネルギー効率向上 |
