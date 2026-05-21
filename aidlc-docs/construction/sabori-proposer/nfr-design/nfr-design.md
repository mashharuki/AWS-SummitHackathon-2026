# NFR Design — U-03b: sabori-proposer

**Unit**: U-03b: sabori-proposer
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 設計パターン一覧

| パターン | 対応 NFR | 実装ファイル |
|---------|---------|------------|
| DP-01: IBedrockClient Adapter 拡張（converseStream 追加） | NFR-T1 / SSE | `src/bedrock/IBedrockClient.ts` + `BedrockClientAdapter.ts` |
| DP-02: Tool Choice 強制（sabori_judgment） | NFR-S4 / 出力安定性 | `src/sabori-proposer/SaboriProposerAgent.ts` |
| DP-03: Zod ダブルバリデーション（Phase 2 + Phase 3） | NFR-S4 | `src/sabori-proposer/SaboriProposerAgent.ts` + `PersonaRenderer.ts` |
| DP-04: rawSummary 生存スコープ制限 | NFR-S1 / NFR-S2 | `src/sabori-proposer/contextUtils.ts` |
| DP-05: DynamoDB 冪等性 PutItem（ConditionExpression） | NFR-R4 | `src/repositories/DynamoProposalRepository.ts` |
| DP-06: Secrets Manager キャッシュ再利用（U-03a 実装済み） | NFR-S3 / コスト | `src/context-collector/ContextCollector.ts` |
| DP-07: 構造化ログ（JSON）— 既存 logger.ts 再利用 | NFR-O1 / NFR-O2 | 全ファイル |
| DP-08: maxTokens 固定（Sonnet=1024 / Haiku=256） | NFR-P2 / NFR-C1 | `SaboriProposerAgent.ts` + `PersonaRenderer.ts` |
| DP-09: PersonaRenderer フォールバック | NFR-R3 | `src/sabori-proposer/SaboriProposerAgent.ts` |
| DP-10: Slack API タイムアウト（Promise.race） | NFR-R2 | `src/sabori-proposer/contextUtils.ts` |

---

## 2. DP-01: IBedrockClient Adapter 拡張

**目的**: U-03a で定義済みの `IBedrockClient` に `converseStream()` を追加し、SSE ストリーミングを可能にする。
既存の `BedrockClientAdapter` を変更するだけでよい。

```typescript
// src/bedrock/IBedrockClient.ts（変更）
import type {
  ConverseCommandInput,
  ConverseCommandOutput,
  ConverseStreamCommandInput,
  ConverseStreamCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'

export interface IBedrockClient {
  converse(input: ConverseCommandInput): Promise<ConverseCommandOutput>
  converseStream(input: ConverseStreamCommandInput): Promise<ConverseStreamCommandOutput>
}
```

```typescript
// src/bedrock/BedrockClientAdapter.ts（converseStream 追加）
import {
  ConverseStreamCommand,
  type ConverseStreamCommandInput,
  type ConverseStreamCommandOutput,
} from '@aws-sdk/client-bedrock-runtime'

async converseStream(
  input: ConverseStreamCommandInput,
): Promise<ConverseStreamCommandOutput> {
  return this.client.send(new ConverseStreamCommand(input))
}
```

**テスト影響**: U-03a の `MockBedrockClient` は `converseStream` が未実装のため追加が必要。
既存 U-03a テストは `converse()` しか呼ばないため、**既存テストへの影響なし**。

---

## 3. DP-02: Tool Choice 強制（sabori_judgment）

**目的**: Bedrock が必ず `sabori_judgment` ツールを 1 回呼び出すことを保証する。
U-03a の `extract_task_attributes` と同パターン。

```typescript
// SaboriProposerAgent.ts
const response = await this.bedrock.converse({
  modelId: SONNET_MODEL_ID,
  system: [{ text: SABORI_SYSTEM_PROMPT }],
  messages: [{ role: 'user', content: [{ text: narrative }] }],
  toolConfig: {
    tools: [SABORI_JUDGMENT_TOOL],
    toolChoice: { tool: { name: SABORI_JUDGMENT_TOOL_NAME } },
  },
  inferenceConfig: {
    maxTokens: 1024,  // DP-08
    temperature: 0,   // 決定論的出力
  },
})
```

**効果**:
- `stopReason === 'tool_use'` が常に保証
- ツール入力が `sabori_judgment.inputSchema` に従う

---

## 4. DP-03: Zod ダブルバリデーション

**目的**: Bedrock の出力と Lambda イベントの両方を Zod で検証。

```typescript
// src/sabori-proposer/saboriJudgmentTool.ts
import { z } from 'zod'

export const LLMJudgmentSchema = z.object({
  verdict: z.enum(['can_saboru', 'borderline', 'must_do']),
  summaryText: z.string().max(60),
  reasoning: z.array(z.string()).min(2).max(5),
  rawChatMessage: z.string().min(1),
  nextCheckOffsetMinutes: z.number().int().positive(),
  appliedFramework: z.array(z.string()).optional(),
})

export type LLMJudgment = z.infer<typeof LLMJudgmentSchema>

// PersonaRenderer 出力検証
export const RenderOutputSchema = z.object({
  summaryText: z.string().max(60),
  chatMessage: z.string().max(200),
})

// Lambda イベント検証
export const ProposalLambdaEventSchema = z.object({
  taskId: z.string().min(1),
  userId: z.string().min(1),
  task: z.object({
    taskId: z.string(),
    title: z.string(),
    deadline: z.string().nullable(),
    requester: z.string(),
    description: z.string(),
    sourceType: z.enum(['slack', 'manual']),
    approvedAt: z.string(),
    updatedAt: z.string(),
    status: z.enum(['approved', 'deleted']),
    PK: z.string(),
    SK: z.string(),
    userId: z.string(),
  }),
  slackMessageRef: z.string().optional(),
})
```

---

## 5. DP-04: rawSummary 生存スコープ制限

**目的**: NFR-S1（Slack 生データをメモリに残さない）を実現する。

```typescript
// src/sabori-proposer/contextUtils.ts
export async function collectAndAssemble(params: {
  task: Task
  slackContext?: SlackContext
}): Promise<{ narrative: string; contextSignals: ContextSignals }> {
  const { task, slackContext } = params

  // narrative を組み立て後、slackContext.rawSummary は narrative に埋め込まれず参照されない
  const narrative = assembleContextNarrative({ task, slackContext })
  const coverage = determineContextCoverage({ task, slackContext })
  const psychSignals = slackContext ? derivePsychSignals({ task, slackContext }) : undefined

  const contextSignals: ContextSignals = {
    hasReminder: (slackContext?.reminderCount ?? 0) > 0,
    reminderCount: slackContext?.reminderCount ?? 0,
    requesterActiveStatus: slackContext?.requesterStatus ?? 'unknown',
    hasUrgentKeyword: (slackContext?.urgencyKeywords.length ?? 0) > 0,
    deadlineMinutes: task.deadline ? minutesUntil(task.deadline) : undefined,
    contextCoverage: coverage,
    psychSignals,
  }

  // slackContext は以降参照されない → GC 対象
  return { narrative, contextSignals }
}
```

---

## 6. DP-05: DynamoDB 冪等性 PutItem

**目的**: 同一 `taskId` + `evaluatedAt` の重複保存を防ぐ。

```typescript
// DynamoProposalRepository.ts
await docClient.send(new PutCommand({
  TableName: this.tableName,
  Item: item,
  ConditionExpression: 'attribute_not_exists(SK)',
  // SK = PROPOSAL#<evaluatedAt>。同一評価時刻の重複書き込みを防ぐ。
  // 実用上、ミリ秒精度の ISO 8601 が一致することは通常ない。
}))
```

**エラーハンドリング**:
```typescript
} catch (err) {
  if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
    logWarn({ action: 'proposal_already_exists', taskId, evaluatedAt })
    // 冪等性 = 既存レコードが優先。エラーを隠蔽。
    return item  // 既存と同一と見なして返却
  }
  throw err  // その他の DynamoDB エラーは上位に伝播
}
```

---

## 7. DP-08: maxTokens 固定（2 段階）

**目的**: Bedrock コストと出力長の上限を固定し、コスト予測可能性を確保する。

```typescript
// Phase 2（Sonnet）— SaboriProposerAgent
inferenceConfig: {
  maxTokens: 1024,  // reasoning 5件 + rawChatMessage 150文字 + JSON overhead
  temperature: 0,
}

// Phase 3（Haiku）— PersonaRenderer
inferenceConfig: {
  maxTokens: 256,   // summaryText 60文字 + chatMessage 150文字のみ
  temperature: 0.3, // 少し創造性を持たせる（おっとり口調）
}
```

**コスト試算（参考）**:
- Sonnet 1回: 入力〜200トークン + 出力〜400トークン ≈ $0.0006
- Haiku 1回: 入力〜150トークン + 出力〜100トークン ≈ $0.00003
- 1提案あたり合計: 〜$0.0006（MVP スケールでは無視可能）

---

## 8. DP-09: PersonaRenderer フォールバック

**目的**: PersonaRenderer（Haiku 呼び出し）が失敗した場合でも Proposal を正常に返す。

```typescript
// SaboriProposerAgent.propose()
let chatMessage: string
let summaryText: string

try {
  const rendered = await this.personaRenderer.render({
    verdict: judgment.verdict,
    reasoning: judgment.reasoning,
    summaryText: judgment.summaryText,
    rawChatMessage: judgment.rawChatMessage,
    personaId: 'saboru_ottori',
  })
  chatMessage = rendered.chatMessage
  summaryText = rendered.summaryText
} catch (err) {
  logWarn({ action: 'persona_render_fallback', unit: 'sabori-proposer' })
  chatMessage = judgment.rawChatMessage  // 中立口調でフォールバック
  summaryText = judgment.summaryText
}
```

---

## 9. DP-10: Slack API タイムアウト（Promise.race）

**目的**: NFR-R2 に従い、Slack API が 10 秒以内に応答しない場合は null を返し処理を続行する。

```typescript
// src/sabori-proposer/contextUtils.ts
const SLACK_TIMEOUT_MS = 10_000

async function collectSlackContextWithTimeout(
  params: CollectSlackContextParams,
): Promise<SlackContext | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), SLACK_TIMEOUT_MS),
  )
  const result = await Promise.race([
    collectSlackContext(params),
    timeout,
  ])
  if (result === null) {
    logWarn({ action: 'slack_context_timeout', taskId: params.taskId })
  }
  return result
}
```

---

## 10. MockBedrockClient 拡張設計

U-03a で実装済みの `MockBedrockClient` に `converseStream` を追加する。

```typescript
// src/bedrock/__tests__/MockBedrockClient.ts（追加メソッド）

private streamResponses: ConverseStreamCommandOutput[] = []

addStreamResponse(response: ConverseStreamCommandOutput): void {
  this.streamResponses.push(response)
}

async converseStream(
  _input: ConverseStreamCommandInput,
): Promise<ConverseStreamCommandOutput> {
  const response = this.streamResponses.shift()
  if (!response) throw new Error('MockBedrockClient: no stream responses queued')
  return response
}

// ヘルパー: sabori_judgment ツール呼び出しレスポンスを生成
static makeSaboriJudgmentResponse(judgment: LLMJudgment): ConverseCommandOutput {
  return {
    stopReason: 'tool_use',
    output: {
      message: {
        role: 'assistant',
        content: [{
          toolUse: {
            toolUseId: 'mock-tool-use-id',
            name: 'sabori_judgment',
            input: judgment,
          },
        }],
      },
    },
    usage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
    metrics: { latencyMs: 1500 },
  }
}
```

---

## 11. 設計決定ログ

| 決定 | 理由 | 代替案 |
|------|------|-------|
| Phase 2 に Sonnet、Phase 3 に Haiku | 判定精度（Sonnet）と口調変換レイテンシ（Haiku）を最適化 | 両フェーズを Sonnet に統一（コスト・時間が倍になる） |
| maxTokens=1024（Phase 2） | reasoning 5件 + rawChatMessage + JSON overhead に十分 | 512（U-03a と同様）では reasoning が truncate される恐れ |
| PersonaRenderer フォールバック | Haiku 障害時にも Proposal を返せる。UX 優先 | エラー全体を上位に伝播（UX 損傷リスクあり） |
| IBedrockClient 拡張（converseStream 追加） | インタフェースの一貫性とテスト容易性を維持 | SaboriProposerAgent が直接 BedrockRuntimeClient を受け取る（テスト困難） |
| Slack タイムアウトを 10 秒に設定 | NFR-02 要件準拠。ウォーム Lambda の全体タイムアウト（60s）の 1/6 以内 | 5 秒（厳しすぎて Slack の遅延時に誤 null 返却リスク） |
