# NFR Design — U-03a: task-extractor

**Unit**: U-03a: task-extractor
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 設計パターン一覧

| パターン | 対応 NFR | 実装ファイル |
|---------|---------|------------|
| DP-01: IBedrockClient Adapter | NFR-T1 | `src/bedrock/IBedrockClient.ts` + `BedrockClientAdapter.ts` |
| DP-02: Tool Choice 強制（toolChoice.tool） | NFR-P2 / 出力安定性 | `src/task-extractor/extractTaskTool.ts` |
| DP-03: Zod ダブルバリデーション | NFR-S4 | `src/task-extractor/TaskExtractorAgent.ts` |
| DP-04: sourceRef のみ保存（生データ破棄） | NFR-S2 | `src/task-extractor/TaskExtractorAgent.ts` |
| DP-05: DynamoDB 条件式 PutItem（冪等性） | NFR-R3 | `src/repositories/DynamoTaskCandidateRepository.ts` |
| DP-06: Secrets Manager キャッシュ | NFR-S3 / コスト | `src/context-collector/ContextCollector.ts` |
| DP-07: 構造化ログ（JSON） | NFR-O1 | 全ファイル（Logger ユーティリティ） |
| DP-08: maxTokens 512 固定 | NFR-P2 / NFR-C1 | `src/bedrock/BedrockClientAdapter.ts` |

---

## 2. DP-01: IBedrockClient Adapter パターン

**目的**: Bedrock SDK をテスト時に差し替え可能にする。AWS SDK 直接依存を 1 ファイルに隔離する。

```typescript
// src/bedrock/IBedrockClient.ts
import type {
  ConverseCommandInput,
  ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

export interface IBedrockClient {
  converse(input: ConverseCommandInput): Promise<ConverseCommandOutput>;
}
```

```typescript
// src/bedrock/BedrockClientAdapter.ts
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import type { IBedrockClient } from "./IBedrockClient.js";

export class BedrockClientAdapter implements IBedrockClient {
  private readonly client: BedrockRuntimeClient;

  constructor(region = "ap-northeast-1") {
    this.client = new BedrockRuntimeClient({
      region,
      maxAttempts: 5,
      retryMode: "adaptive",
    });
  }

  async converse(input: ConverseCommandInput): Promise<ConverseCommandOutput> {
    return this.client.send(new ConverseCommand(input));
  }
}
```

---

## 3. DP-02: Tool Choice 強制パターン

**目的**: Bedrock が必ず `extract_task_attributes` ツールを 1 回呼び出すことを保証する。
テキスト応答や他ツール呼び出しを防ぎ、出力の構造を固定する。

```typescript
// toolConfig に toolChoice.tool を指定することで強制
toolConfig: {
  tools: [EXTRACT_TASK_TOOL],
  toolChoice: {
    tool: { name: "extract_task_attributes" },
  },
},
inferenceConfig: {
  maxTokens: 512,  // DP-08: 明示設定
  temperature: 0,  // 決定論的な出力を得る
},
```

**効果**:
- `stopReason === 'tool_use'` が常に保証される（失敗時のみ例外）
- ツール入力が `extract_task_attributes.inputSchema` の JSON Schema に従う

---

## 4. DP-03: Zod ダブルバリデーション

**目的**: EventBridge 入力と Bedrock ツール出力の両方を Zod で検証し、型安全性を保証する。

```typescript
// EventBridge ペイロード検証
const SlackEventPayloadSchema = z.object({
  source: z.literal("slack"),
  userId: z.string().min(1),
  message: z.object({
    text: z.string(),
    channelId: z.string(),
    threadTs: z.string().optional(),
    messageTs: z.string(),
    teamId: z.string(),
    userId: z.string(),
  }),
});

// Bedrock ツール出力検証
const ExtractedTaskSchema = z.object({
  title: z.string().max(50),
  deadline: z.string().nullable(),
  requester: z.string(),
  description: z.string().max(100),
  is_task: z.boolean(),
});
```

---

## 5. DP-04: 生データ破棄パターン

**目的**: NFR-07（プライバシー保護）に従い、Slack メッセージ本文を DynamoDB に保存しない。

```typescript
async extractTask(event: SlackEventPayload): Promise<ExtractionResult> {
  const { text, messageTs, userId: slackUserId } = event.message;

  // [1] Bedrock 呼び出し（messageText を使用）
  const extracted = await this.callBedrock(text);  // text: string

  // [2] extracted.is_task === false → 早期リターン（保存なし）
  if (!extracted.is_task) {
    return { skipped: true };
  }

  // [3] text 変数はこの後参照しない（GC に委ねる）
  // sourceRef に messageTs のみを保存
  const candidate = await this.repository.create({
    candidateId: generateUlid(),
    title: extracted.title,
    deadline: extracted.deadline,
    requester: pseudonymize(extracted.requester),  // SHA-256 ハッシュ化
    description: extracted.description,
    sourceType: SOURCE_TYPE.SLACK,
    sourceRef: messageTs,   // ← messageTs のみ（本文は保存しない）
    status: TASK_CANDIDATE_STATUS.PENDING,
    createdAt: toIsoString(new Date()),
    ttl: Math.floor(Date.now() / 1000) + TASK_CANDIDATE_TTL_DAYS * 86400,
  });

  return { skipped: false, candidate };
}
```

---

## 6. DP-05: DynamoDB 冪等性 PutItem

**目的**: 同一 messageTs の EventBridge 重複配信でも TaskCandidate が二重作成されないようにする。

```typescript
// DynamoTaskCandidateRepository.create() の条件式
await docClient.send(
  new PutCommand({
    TableName: process.env["TASK_CANDIDATES_TABLE"]!,
    Item: candidate,
    ConditionExpression: "attribute_not_exists(SK)",
    // SK = TASK_CAND#<ulid>。ULID はエージェント側で生成するため、
    // 真の冪等性は sourceRef を SK に含めるか、呼び出し元で重複チェックが必要。
    // ここでは同一 ulid の重複書き込みを防ぐ最低限の保護を提供する。
  }),
);
```

**補足**: 真の at-most-once 保証が必要な場合は、sourceRef（messageTs）をユニークキーとして
GSI で存在確認するアプローチが考えられる。MVP では Lambda DLQ による監視で対応する。

---

## 7. DP-06: Secrets Manager 呼び出しキャッシュ

**目的**: Lambda 実行ごとに Secrets Manager を呼び出すコストと遅延を削減する。

```typescript
// ContextCollector.ts 内でモジュールスコープのキャッシュを使用
let cachedSlackToken: string | undefined;

async function getSlackToken(): Promise<string> {
  if (cachedSlackToken) return cachedSlackToken;

  const client = new SecretsManagerClient({ region: "ap-northeast-1" });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: process.env["SLACK_TOKEN_SECRET_NAME"]! })
  );
  cachedSlackToken = response.SecretString!;
  return cachedSlackToken;
}
```

**効果**: Lambda ウォームコンテナ再利用時は Secrets Manager 呼び出しをスキップ。

---

## 8. DP-07: 構造化ログ（JSON）

**目的**: CloudWatch Insights でのクエリを容易にする。PII をログに含めない。

```typescript
// src/utils/logger.ts（軽量実装）
function log(level: "INFO" | "WARN" | "ERROR", data: Record<string, unknown>) {
  console.log(JSON.stringify({
    level,
    unit: "task-extractor",
    timestamp: new Date().toISOString(),
    ...data,
  }));
}

// 使用例（userId はマスク）
log("INFO", {
  action: "extracted",
  isTask: true,
  sourceRef: event.message.messageTs,
  bedrockDurationMs: elapsed,
});
```

---

## 9. Lambda ハンドラ設計

```typescript
// TaskExtractorLambdaHandler.ts
export const handler = async (event: unknown): Promise<void> => {
  // [1] EventBridge ペイロード Zod 検証
  const parsed = SlackEventPayloadSchema.safeParse(event);
  if (!parsed.success) {
    log("ERROR", { action: "invalid_input", errors: parsed.error.issues });
    // ValidationException は DLQ に送らず正常完了（不正イベントを無限リトライしない）
    return;
  }

  // [2] TaskExtractorAgent 呼び出し
  const agent = new TaskExtractorAgent(bedrockClient, repository);
  const result = await agent.extractTask(parsed.data);

  // [3] ログ出力
  if (result.skipped) {
    log("INFO", { action: "skipped", sourceRef: parsed.data.message.messageTs });
  } else {
    log("INFO", {
      action: "extracted",
      candidateId: result.candidate.candidateId,
      sourceRef: parsed.data.message.messageTs,
    });
  }
};
```

---

## 10. 設計決定ログ

| 決定 | 理由 | 代替案 |
|------|------|-------|
| toolChoice.tool で単一ツール強制 | stopReason の分岐を排除し、テスト・運用を単純化 | toolChoice.auto で複数ツール対応（過剰） |
| maxTokens = 512 固定 | タスク属性抽出（title/deadline/requester/description）に十分 | 可変設定（環境変数化）は MVP では不要 |
| Zod でのダブルバリデーション | Bedrock 出力は untrusted input（amazon-bedrock スキル警告に従う） | `as` キャストのみ（型安全性なし） |
| sourceRef = messageTs のみ保存 | NFR-07 プライバシー設計の厳守 | messageText をハッシュ化して保存（NFR-07 非準拠） |
| 構造化ログ（JSON）のみ（外部ライブラリなし） | Lambda サイズ削減・コールドスタート短縮 | Pino / Winston（依存追加コスト） |
