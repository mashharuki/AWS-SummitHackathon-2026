# Code Generation サマリ — U-03a: task-extractor

**Unit**: U-03a: task-extractor
**ステージ**: CONSTRUCTION / Code Generation
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 生成ファイル一覧

### 新規パッケージ: `pkgs/agent/`

#### パッケージ設定

| ファイル | 説明 |
|---------|------|
| `package.json` | `@saboru/agent` パッケージ定義（ESM、workspace依存） |
| `tsconfig.json` | TypeScript設定（ES2022、strict、bundler解決） |
| `tsup.config.ts` | バンドル設定（CJS+ESM、Lambda用noExternal） |
| `vitest.config.ts` | テスト設定（v8カバレッジ、@saboru/sharedエイリアス） |

#### ソースコード

| ファイル | 実装パターン | 備考 |
|---------|-----------|------|
| `src/bedrock/IBedrockClient.ts` | DP-01: Adapter インタフェース | Bedrock SDK 依存を隔離 |
| `src/bedrock/BedrockClientAdapter.ts` | DP-01: Adapter 実装 | adaptive retry, maxAttempts=5 |
| `src/utils/logger.ts` | DP-07: 構造化ログ | PII非記録、CloudWatch Insights対応 |
| `src/types/events.ts` | DP-03: Zod スキーマ（入力側） | SlackEventPayload バリデーション |
| `src/task-extractor/extractTaskTool.ts` | DP-02: Tool Choice 強制 | toolChoice.tool = extract_task_attributes |
| `src/task-extractor/TaskExtractorAgent.ts` | DP-03/04/02 | Bedrock converse + 生データ破棄 |
| `src/task-extractor/TaskExtractorLambdaHandler.ts` | Lambda ハンドラ | EventBridge受信 + DLQ設計 |
| `src/context-collector/ContextCollector.ts` | DP-06: Secrets Manager キャッシュ | U-03b共用設計 |
| `src/repositories/DynamoTaskCandidateRepository.ts` | DP-05: 冪等性PutItem | ITaskCandidateRepository実装 |
| `src/index.ts` | パブリックAPI | クラス・型のre-export |

#### テストファイル（5ファイル）

| ファイル | テスト数 | カバレッジ貢献 |
|---------|---------|-------------|
| `src/bedrock/__tests__/BedrockClientAdapter.test.ts` | 3 | BedrockClientAdapter 85.7% |
| `src/context-collector/__tests__/ContextCollector.test.ts` | 5 | ContextCollector 100% |
| `src/task-extractor/__tests__/TaskExtractorAgent.test.ts` | 10 | TaskExtractorAgent 100% |
| `src/task-extractor/__tests__/TaskExtractorLambdaHandler.test.ts` | 5 | LambdaHandler 100% |
| `src/repositories/__tests__/DynamoTaskCandidateRepository.test.ts` | 9 | Repository 98.2% |

### 修正ファイル

| ファイル | 変更内容 |
|---------|---------|
| `pkgs/cdk/lib/stacks/agent-stack.ts` | codeパス変更、SLACK_TOKEN_SECRET_NAME追加、grantRead追加 |

---

## 2. CDK 変更詳細

```typescript
// 変更前
code: lambda.Code.fromAsset('../../pkgs/backend/dist'),
handler: 'taskExtractor.handler',
environment: {
  ENVIRONMENT: environment,
  DYNAMODB_TABLE_TASK_CANDIDATES: ...,
  DYNAMODB_TABLE_TASKS: ...,
  BEDROCK_REGION: 'ap-northeast-1',
},

// 変更後
code: lambda.Code.fromAsset('../../pkgs/agent/dist'),
handler: 'task-extractor/TaskExtractorLambdaHandler.handler',
environment: {
  ENVIRONMENT: environment,
  DYNAMODB_TABLE_TASK_CANDIDATES: ...,
  DYNAMODB_TABLE_TASKS: ...,
  BEDROCK_REGION: 'ap-northeast-1',
  SLACK_TOKEN_SECRET_NAME: props.data.secrets.slackClientSecret.secretName,  // ← 追加
},
// + props.data.secrets.slackClientSecret.grantRead(taskExtractorFn)  追加
```

---

## 3. ビルド・テスト結果

### `pkgs/agent` ビルド
- CJS: 1.25 MB（`dist/index.cjs`, `dist/task-extractor/TaskExtractorLambdaHandler.cjs`）
- ESM: 1.24 MB（`dist/index.js`, `dist/task-extractor/TaskExtractorLambdaHandler.js`）
- DTS: 型定義ファイル生成済み
- ステータス: **SUCCESS**

### `pkgs/agent` テスト（vitest --coverage）
- テストファイル: 5 passed
- テスト数: **32 passed**
- カバレッジ（全体）:
  - Statements: **98.36%**
  - Branches: **84.21%**
  - Functions: **90.9%**
  - Lines: **98.36%**
- ステータス: **SUCCESS（閾値クリア）**

### `pkgs/cdk` テスト（jest）
- テストスイート: 6 passed
- テスト数: **33 passed（既存テスト全継続パス）**
- ステータス: **SUCCESS**

---

## 4. NFR Design 準拠確認

| NFRデザインパターン | 実装状況 |
|------------------|---------|
| DP-01: IBedrockClient Adapter | `src/bedrock/IBedrockClient.ts` + `BedrockClientAdapter.ts` ✅ |
| DP-02: Tool Choice 強制 | `extractTaskTool.ts` + `TaskExtractorAgent.ts` ✅ |
| DP-03: Zod ダブルバリデーション | EventBridge入力 + Bedrock出力 両方で実施 ✅ |
| DP-04: 生データ破棄 | messageTs のみ保存、message.text は保存なし ✅ |
| DP-05: DynamoDB 冪等性 PutItem | `attribute_not_exists(SK)` + ConditionalCheckFailed処理 ✅ |
| DP-06: Secrets Manager キャッシュ | モジュールスコープキャッシュ実装 ✅ |
| DP-07: 構造化ログ | JSON形式、PII非記録 ✅ |
| DP-08: maxTokens 512 固定 | `inferenceConfig.maxTokens: 512` ✅ |

---

## 5. Well-Architected / aws-constraints.md 準拠

- Lambda ARM_64（Graviton2）+ 512MB memory ✅
- adaptive retry（maxAttempts=5）✅
- Secrets Manager（シークレット非ハードコード）✅
- 最小権限 IAM（grantRead/grantReadWriteData）✅
- CloudWatch 構造化ログ ✅
- DLQ 設定済み（U-02 AgentStack）✅
