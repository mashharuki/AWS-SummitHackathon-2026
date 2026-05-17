# Infrastructure Design — U-03b: sabori-proposer

**Unit**: U-03b: sabori-proposer
**ステージ**: CONSTRUCTION / Infrastructure Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. インフラ概要

U-03b の `SaboriProposerAgent` は Lambda 関数（`saborou-sabori-proposer-{env}`）として動作する。
API Gateway（U-04で実装）から呼び出され、Bedrock converse API でサボり判定を行い、
DynamoDB Proposals テーブルに結果を保存する。

**U-02 AgentStack に `saboriProposerFn` は既に定義済み。ただし `handler` とコードパスが旧仕様のため、U-03b の Code Generation で修正が必要。**

---

## 2. 使用 AWS リソース

### 2.1 既存リソース（U-02 設定済み）

| リソース | 名称 | スタック | U-03b での使用 |
|---------|------|---------|-------------|
| Lambda Function | `saborou-sabori-proposer-{env}` | AgentStack | コアランタイム |
| SQS DLQ | `saborou-sabori-proposer-dlq-{env}` | AgentStack | 失敗時の Dead Letter |
| CloudWatch LogGroup | `/aws/lambda/saborou-sabori-proposer-{env}` | AgentStack | 構造化ログ出力 |
| DynamoDB Table | `saborou-proposals-{env}` | DataStack | Proposal 書き込み・読み取り |
| DynamoDB GSI | `GSI-TaskLatest` | DataStack | taskId での最新提案取得 |
| DynamoDB Table | `saborou-tasks-{env}` | DataStack | Task 読み取り（判定対象） |
| DynamoDB Table | `saborou-personas-{env}` | DataStack | Persona 読み取り（将来拡張用） |
| Secrets Manager | `saborou-slack-client-secret-{env}` | DataStack | Slack OAuth トークン取得 |
| Bedrock IAM Policy | （AgentStack 内 inline） | AgentStack | Bedrock InvokeModel 権限 |

### 2.2 U-03b で追加・変更するリソース

| 変更種別 | リソース | 内容 |
|---------|---------|------|
| 変更 | saboriProposerFn handler | `saboriProposer.handler` → `sabori-proposer/SaboriProposerLambdaHandler.handler` |
| 変更 | saboriProposerFn code パス | `pkgs/backend/dist` → `pkgs/agent/dist` |
| 変更 | saboriProposerFn 環境変数 | `SLACK_CLIENT_SECRET_ARN` → `SLACK_TOKEN_SECRET_NAME` に変更 |
| 変更 | saboriProposerFn 環境変数 | `DYNAMODB_TABLE_PERSONAS` 削除（MVP では未使用） |
| 変更 | saboriProposerFn Bedrock IAM | Claude Haiku 3.5 モデル ARN を bedrockPolicy に追加 |
| 変更 | saboriProposerFn timeout | 60 秒 → 90 秒（Phase 2 + Phase 3 の 2 回 Bedrock 呼び出し） |
| 変更 | saboriProposerFn memorySize | 512 MB → 1024 MB（ストリーミング処理でメモリ増加） |

---

## 3. Lambda 設定詳細（修正後）

| 設定項目 | 現状（旧仕様） | 修正後 | 備考 |
|---------|-------------|--------|------|
| handler | `saboriProposer.handler` | `sabori-proposer/SaboriProposerLambdaHandler.handler` | tsup ビルド出力パス |
| code | `pkgs/backend/dist` | `pkgs/agent/dist` | U-03a と同じパッケージ |
| timeout | 60 秒 | 90 秒 | Phase 2（Sonnet）+ Phase 3（Haiku）の直列呼び出し |
| memorySize | 512 MB | 1024 MB | SSE ストリーミングバッファ考慮 |

### 3.1 環境変数（修正後）

| 変数名 | 値 | 変更内容 |
|-------|-----|---------|
| `ENVIRONMENT` | `dev` / `prod` | 変更なし |
| `DYNAMODB_TABLE_PROPOSALS` | テーブル名 | 変更なし |
| `DYNAMODB_TABLE_TASKS` | テーブル名 | 変更なし |
| `BEDROCK_REGION` | `ap-northeast-1` | 変更なし |
| `SLACK_TOKEN_SECRET_NAME` | `saborou-slack-client-secret-{env}` | `SLACK_CLIENT_SECRET_ARN` から変更（ContextCollector が secretName を使用する） |
| `DYNAMODB_TABLE_PERSONAS` | — | **削除**（MVP では未使用） |

### 3.2 IAM 権限（追加）

現在の `bedrockPolicy` は Sonnet のみ許可。Haiku を追加する必要がある。

```typescript
// 追加: Claude Haiku 3.5 の ARN
`arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-3-5-20241022-v1:0`
// または us. プレフィックス付き（cross-region inference）
`arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`
```

**注意**: agentStack の `bedrockPolicy` は `taskExtractorFn` と `saboriProposerFn` で**共有**されている。
Haiku ARN を bedrockPolicy に追加すると `taskExtractorFn` にも適用されるが、セキュリティ上問題なし
（最小権限原則: どちらも Bedrock モデル呼び出し権限のみ）。

---

## 4. Bedrock モデル設定

| フェーズ | モデル ID | maxTokens | temperature | 用途 |
|---------|----------|-----------|-------------|------|
| Phase 2（判定） | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | 1024 | 0 | サボり判定（Tool Use） |
| Phase 3（口調変換） | `anthropic.claude-haiku-3-5-20241022-v1:0` | 256 | 0.3 | PersonaRenderer（Tool Use） |

**IAM ARN の注意**:
- cross-region inference profile（`us.anthropic.*`）は `us.` なしの base model ID で IAM 許可が通る（AWS 仕様）
- Haiku は cross-region inference を使わない場合は `anthropic.claude-haiku-3-5-20241022-v1:0` を直接指定

---

## 5. DynamoDB アクセスパターン

| 操作 | テーブル | アクセスパターン | Repository メソッド |
|------|---------|--------------|------------------|
| 提案保存 | Proposals | `PutItem PK=TASK#<taskId> SK=PROPOSAL#<ISO8601>` | `save()` |
| 最新提案取得 | Proposals (GSI) | `Query GSI-TaskLatest PK=taskId ScanIndexForward=false LIMIT=1` | `findLatestByTaskId()` |
| タスク読み取り | Tasks | `GetItem PK=USER#<userId> SK=TASK#<taskId>` | （U-04 で実装、lambdaハンドラがイベントで受け取る） |

---

## 6. AgentStack 修正サマリ（Code Generation で実施）

```typescript
// 変更前（旧仕様）
const saboriProposerFn = new lambda.Function(this, 'SaboriProposerFn', {
  handler: 'saboriProposer.handler',
  code: lambda.Code.fromAsset('../../pkgs/backend/dist'),
  timeout: cdk.Duration.seconds(60),
  memorySize: 512,
  environment: {
    ENVIRONMENT: environment,
    DYNAMODB_TABLE_PROPOSALS: props.data.tables.proposals.tableName,
    DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
    DYNAMODB_TABLE_PERSONAS: props.data.tables.personas.tableName,
    SLACK_CLIENT_SECRET_ARN: props.data.secrets.slackClientSecret.secretArn,
    BEDROCK_REGION: 'ap-northeast-1',
  },
})

// 変更後（U-03b 実装後）
const saboriProposerFn = new lambda.Function(this, 'SaboriProposerFn', {
  handler: 'sabori-proposer/SaboriProposerLambdaHandler.handler',
  code: lambda.Code.fromAsset('../../pkgs/agent/dist'),
  timeout: cdk.Duration.seconds(90),  // Phase 2 + Phase 3 の 2 回 Bedrock 呼び出し
  memorySize: 1024,                   // SSE ストリーミングバッファ考慮
  environment: {
    ENVIRONMENT: environment,
    DYNAMODB_TABLE_PROPOSALS: props.data.tables.proposals.tableName,
    DYNAMODB_TABLE_TASKS: props.data.tables.tasks.tableName,
    BEDROCK_REGION: 'ap-northeast-1',
    SLACK_TOKEN_SECRET_NAME: props.data.secrets.slackClientSecret.secretName,  // secretArn → secretName
    // DYNAMODB_TABLE_PERSONAS: 削除（MVP 未使用）
  },
})
```

**bedrockPolicy への Haiku ARN 追加**:
```typescript
const bedrockPolicy = new iam.PolicyStatement({
  effect: iam.Effect.ALLOW,
  actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
  resources: [
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-haiku-3-5-20241022-v1:0`, // 追加
    `arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,   // 追加
  ],
})
```

---

## 7. tsup.config.ts エントリポイント追加

U-03b の Lambda ハンドラを tsup のビルドエントリポイントに追加する。

```typescript
// pkgs/agent/tsup.config.ts（追加）
entry: {
  'task-extractor/TaskExtractorLambdaHandler': 'src/task-extractor/TaskExtractorLambdaHandler.ts',
  'sabori-proposer/SaboriProposerLambdaHandler': 'src/sabori-proposer/SaboriProposerLambdaHandler.ts', // 追加
},
```

---

## 8. Well-Architected 6本柱 準拠確認

| 柱 | 評価 | 対応状況 |
|----|------|---------|
| 運用上の卓越性 | OK | CloudWatch 構造化ログ・X-Ray トレース設定済み（U-02）。tokenCount 記録でコスト追跡（NFR-C2） |
| セキュリティ | OK | 最小権限 IAM（grantRead/grantReadWriteData）・Secrets Manager（secretName）・生データ非保存（NFR-S1〜S4） |
| 信頼性 | OK | DLQ・adaptive retry (maxAttempts=5)・Slack タイムアウト処理・PersonaRenderer フォールバック（NFR-R1〜R4） |
| パフォーマンス効率 | OK | ARM64・Sonnet/Haiku 使い分け・maxTokens 固定・timeout=90s（Phase 2+Phase 3 考慮）（NFR-P1〜P4） |
| コスト最適化 | OK | PAY_PER_REQUEST DynamoDB（U-02）・Haiku で口調変換コスト削減・tokenCount 記録（NFR-C1〜C2） |
| 持続可能性 | OK | ARM64（Graviton2、U-02設定済み）・不要データ非保存・環境変数整理（PERSONAS 削除） |
