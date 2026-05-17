# Functional Design — U-03a: task-extractor

**Unit**: U-03a: task-extractor
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**深度**: Comprehensive（Bedrock Tool Use + 新規パッケージ）

---

## 1. ユニット概要

`pkgs/agent` パッケージ内に `TaskExtractorAgent`（AG-01）と補助モジュール（ContextCollector 一部）を実装する。
Slack Webhook 由来の EventBridge イベントを受け取り、Amazon Bedrock converse API + Tool Use で
タスク属性（title / deadline / requester / description）を抽出し、DynamoDB `TaskCandidates` テーブルに保存する。

**実装対象コンポーネント**:
- AG-01: TaskExtractorAgent（コア）
- AG-04: ContextCollector の Slack 文脈収集ロジック（U-03b との共有ユーティリティとして切り出す）
- `IBedrockClient` インタフェース（テスト容易性のための抽象化）
- DynamoDB TaskCandidateRepository 実装（`ITaskCandidateRepository` の具体実装）

---

## 2. データモデル

### 2.1 入力: ExternalEvent（EventBridge ペイロード）

```typescript
// EventBridge から Lambda が受け取る構造
interface SlackEventPayload {
  source: 'slack';
  userId: string;           // Cognito Sub（DynamoDB PK に使用）
  message: SlackMessage;
}

interface SlackMessage {
  text: string;             // Slack メッセージ本文（処理後メモリ上から削除）
  channelId: string;        // Slack チャンネル ID
  threadTs?: string;        // スレッドの親タイムスタンプ（あれば）
  messageTs: string;        // このメッセージのタイムスタンプ
  teamId: string;           // Slack ワークスペース ID
  userId: string;           // Slack のメッセージ送信者 ID（依頼者特定に使用）
}
```

### 2.2 出力: TaskCandidate（保存後）

`@saboru/shared` の `TaskCandidate` 型をそのまま使用する（新規型定義なし）。

```typescript
// pkgs/shared/src/types/task-candidate.ts 参照
interface TaskCandidate {
  PK: string;               // USER#<cognitoSub>
  SK: string;               // TASK_CAND#<ulid>
  candidateId: string;      // ULID
  title: string;            // Bedrock 抽出
  deadline: string | null;  // ISO 8601 / null
  requester: string;        // pseudonymize() で SHA-256 ハッシュ化
  description: string;      // Bedrock 抽出
  sourceType: SourceType;   // 'slack'
  sourceRef: string;        // Slack messageTs（生データの代わりに参照IDのみ保存）
  status: TaskCandidateStatus; // 'pending'
  createdAt: string;        // ISO 8601
  ttl: number;              // createdAt + 30日（Unix timestamp）
}
```

### 2.3 Bedrock Tool Use スキーマ: extract_task_attributes

Bedrock に構造化出力を強制するツール定義：

```typescript
const EXTRACT_TASK_TOOL: Tool = {
  toolSpec: {
    name: "extract_task_attributes",
    description:
      "Slack メッセージからタスク属性を抽出する。必ず 1 回だけ呼び出すこと。",
    inputSchema: {
      json: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "タスクの端的な名称（日本語、50文字以内）。動詞句で表現する。例: '資料レビュー', 'バグ修正対応'",
          },
          deadline: {
            type: "string",
            description:
              "締切日時（ISO 8601 形式、例: '2026-05-30T18:00:00+09:00'）。" +
              "明示的な日時が存在しない場合は null を設定すること。",
            nullable: true,
          },
          requester: {
            type: "string",
            description:
              "依頼者名または Slack ユーザー名。不明な場合は 'unknown' を設定。",
          },
          description: {
            type: "string",
            description:
              "タスクの内容概要（100文字以内）。何をすべきかを簡潔に記述する。",
          },
          is_task: {
            type: "boolean",
            description:
              "このメッセージがタスク依頼かどうか。雑談・確認・返答のみのメッセージは false。",
          },
        },
        required: ["title", "deadline", "requester", "description", "is_task"],
      },
    },
  },
};
```

---

## 3. ビジネスロジック

### 3.1 ブランチロジック: is_task = false の場合

Bedrock の抽出結果で `is_task = false` の場合、候補を作成せずに正常終了する（DynamoDB 書き込みなし）。

```
extractTask() →
  Bedrock Tool Use 呼び出し →
    is_task = false: return { skipped: true, reason: 'not_a_task' }
    is_task = true:  DynamoDB PutItem → return TaskCandidate
```

### 3.2 プライバシー設計（NFR-07 準拠）

| データ | 保存方法 | 理由 |
|--------|---------|------|
| Slack message.text | メモリ上でのみ処理、保存しない | 生データ非保存（NFR-07） |
| 依頼者名 | pseudonymize()（SHA-256）でハッシュ化して保存 | PII 保護 |
| Slack messageTs | sourceRef として保存（参照IDのみ） | 生データ代替 |

### 3.3 トークンガード（NFR-08 準拠）

Bedrock 呼び出し前に `guardTokenLimit()` を実行する。
Slack メッセージ本文が `DEFAULT_MAX_TOKEN_LIMIT`（8,000 トークン）を超える場合は、
先頭 8,000 トークン相当の文字列に切り詰めてから Bedrock に渡す。

### 3.4 TTL 計算（BR-13 準拠）

```typescript
const ttl = Math.floor(Date.now() / 1000) + TASK_CANDIDATE_TTL_DAYS * 86400;
```

---

## 4. 処理フロー

```
EventBridge Lambda Handler
  ↓
TaskExtractorAgent.extractTask(event)
  ↓
1. Slack messageText をトークンガード（guardTokenLimit）
2. Bedrock converse API 呼び出し（Tool Use: extract_task_attributes）
   - system: タスク抽出専門アシスタント指示
   - user: Slack メッセージ本文
   - toolConfig: { tools: [EXTRACT_TASK_TOOL], toolChoice: { tool: { name: 'extract_task_attributes' } } }
   - inferenceConfig: { maxTokens: 512 }
3. stopReason === 'tool_use' を検証
4. is_task === false → 早期リターン（SKIP）
5. Zod スキーマで Bedrock 出力をバリデーション
6. requester を pseudonymize() でハッシュ化
7. TaskCandidateRepository.create() で DynamoDB に書き込み
8. 生データ（messageText）を変数から除去
```

---

## 5. IBedrockClient インタフェース（テスト容易性）

```typescript
interface IBedrockClient {
  converse(params: ConverseInput): Promise<ConverseOutput>;
}

// 本番実装
class BedrockClientAdapter implements IBedrockClient {
  private client: BedrockRuntimeClient;
  // ...
}

// テスト用モック
class MockBedrockClient implements IBedrockClient {
  // ツールレスポンスを固定値で返す
}
```

---

## 6. エラーハンドリング

| エラー状況 | 対応 |
|----------|------|
| stopReason !== 'tool_use' | BedrockTimeoutError をスロー（Lambda DLQ に送信） |
| Zod バリデーション失敗 | AppError(INVALID_INPUT) をスロー |
| DynamoDB PutItem 失敗 | DynamoWriteFailedError をスロー |
| Bedrock ThrottlingException | BedrockRuntimeClient の adaptive retry（最大5回）で自動リトライ |
| Slack message.text が空 | is_task=false と同等扱いで SKIP |

---

## 7. パッケージ構成

```
pkgs/agent/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── tsup.config.ts
├── src/
│   ├── index.ts                        # パッケージエントリーポイント
│   ├── bedrock/
│   │   ├── IBedrockClient.ts           # インタフェース定義
│   │   └── BedrockClientAdapter.ts     # 本番実装
│   ├── task-extractor/
│   │   ├── TaskExtractorAgent.ts       # AG-01 本体
│   │   ├── extractTaskTool.ts          # Tool Use スキーマ定義
│   │   ├── TaskExtractorLambdaHandler.ts # Lambda ハンドラ
│   │   └── __tests__/
│   │       ├── TaskExtractorAgent.test.ts
│   │       └── TaskExtractorLambdaHandler.test.ts
│   ├── context-collector/
│   │   ├── ContextCollector.ts         # AG-04（Slack 文脈収集、U-03b と共用）
│   │   └── __tests__/
│   │       └── ContextCollector.test.ts
│   └── repositories/
│       ├── DynamoTaskCandidateRepository.ts  # ITaskCandidateRepository 実装
│       └── __tests__/
│           └── DynamoTaskCandidateRepository.test.ts
└── src/types/
    └── events.ts                       # SlackEventPayload / SlackMessage 型
```

---

## 8. 依存関係

| 依存パッケージ | 用途 |
|--------------|------|
| `@saboru/shared` | TaskCandidate 型・エラークラス・リポジトリインタフェース・ユーティリティ |
| `@aws-sdk/client-bedrock-runtime` | Bedrock converse API |
| `@aws-sdk/client-dynamodb` | DynamoDB クライアント |
| `@aws-sdk/lib-dynamodb` | DocumentClient（型安全 DynamoDB 操作） |
| `@slack/web-api` | ContextCollector の Slack API 呼び出し |
| `zod` | Bedrock 出力バリデーション |
| `vitest` (dev) | テストフレームワーク |
| `@vitest/coverage-v8` (dev) | カバレッジ計測 |
| `tsup` (dev) | ビルドツール |

---

## 9. ビジネスルール参照

| ルール | 内容 | 実装箇所 |
|--------|------|---------|
| BR-04 | タスク ID は ULID で生成 | `generateUlid()` in Repository |
| BR-05 | 依頼者名は pseudonymize() でハッシュ化 | `extractTask()` Step 6 |
| BR-13 | TaskCandidate は 30 日後に TTL で自動削除 | Repository.create() |
| NFR-07 | Slack 生データはメモリ上でのみ処理 | extractTask() 完了後に解放 |
| NFR-08 | Bedrock トークン 8,000 上限ガード | guardTokenLimit() 事前呼び出し |
