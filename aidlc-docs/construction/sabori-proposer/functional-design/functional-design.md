# Functional Design — U-03b: sabori-proposer

**Unit**: U-03b: sabori-proposer
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. コンポーネント概要

U-03b は SABOROU サービスの**中核判定エンジン**。タスクの Slack 文脈を読み解き、
「今サボれるかどうか」を心理学 5 理論に基づいて判定し、サボロー口調で提案を生成する。

### 実装対象コンポーネント

| コンポーネント | 設計書参照 | 責務 |
|--------------|-----------|------|
| `SaboriProposerAgent` | AG-02 | 3フェーズ判定フロー司令塔 |
| `PersonaRenderer` | AG-03 | rawChatMessage → サボロー口調変換 |
| `DynamoProposalRepository` | IProposalRepository | Proposals テーブルへの書き込み・読み取り |
| `SaboriProposerLambdaHandler` | — | Lambda エントリポイント（API Gateway イベント受信） |
| `ProposeStreamLambdaHandler` | — | Lambda Response Streaming エントリポイント（SSE） |

---

## 2. データモデル

### 2.1 入出力型定義

`@saboru/shared` に定義済みの型をそのまま使用する。

```typescript
// pkgs/shared/src/types/proposal.ts（定義済み）
interface Proposal {
  PK: string;                  // TASK#<taskId>
  SK: string;                  // PROPOSAL#<ISO8601>
  taskId: string;
  userId: string;
  verdict: Verdict;            // 'can_saboru' | 'borderline' | 'must_do'
  summaryText: string;
  reasoning: string[];
  chatMessage: string;
  personaId: string;
  evaluatedAt: string;         // ISO 8601
  nextCheckAt: string;         // ISO 8601
  tokenCount: number;
}

// pkgs/shared/src/types/enums.ts（定義済み）
type Verdict = 'can_saboru' | 'borderline' | 'must_do';
```

### 2.2 U-03b 固有型（pkgs/agent 内に定義）

```typescript
// src/sabori-proposer/types.ts

/** TaskContext — SaboriProposerAgent への入力 */
interface TaskContext {
  task: Task;
  slackContext?: SlackContext;
}

/** SlackContext — AG-04 ContextCollector が収集する Slack 情報 */
interface SlackContext {
  requesterStatus: 'online' | 'away' | 'offline' | 'unknown';
  lastActivityAt?: string;
  reminderCount: number;
  urgencyKeywords: string[];
  threadActive: boolean;
  rawSummary: string;  // 処理後即削除（NFR-07）
}

/** LLMJudgment — Phase 2 Bedrock Tool Use の構造化出力（中間型） */
interface LLMJudgment {
  verdict: Verdict;
  summaryText: string;
  reasoning: string[];
  rawChatMessage: string;
  nextCheckOffsetMinutes: number;
  appliedFramework?: string[];
}

/** ContextSignals — デバッグ・監査用シグナル記録 */
interface ContextSignals {
  hasReminder: boolean;
  reminderCount: number;
  requesterActiveStatus: string;
  nearestMeetingMinutes?: number;
  hasUrgentKeyword: boolean;
  deadlineMinutes?: number;
  contextCoverage: 'full' | 'partial' | 'minimal';
  psychSignals?: {
    taskIdentifiability: 'high' | 'low' | 'unknown';
    effortOutcomeExpectancy: 'high' | 'low' | 'unknown';
    perceivedPeerEffort: 'high' | 'low' | 'unknown';
    externalPressureLevel: 'high' | 'low' | 'unknown';
  };
}

/** ProposalDelta — SSE ストリーミング差分型 */
interface ProposalDelta {
  type: 'verdict' | 'reasoning_item' | 'chat_message_chunk' | 'complete';
  payload: string | Partial<Proposal>;
}

/** RenderInput / RenderOutput — PersonaRenderer の入出力 */
interface RenderInput {
  verdict: Verdict;
  reasoning: string[];
  summaryText: string;
  rawChatMessage: string;
  personaId: string;
}

interface RenderOutput {
  summaryText: string;
  chatMessage: string;
  verdictEmoji: string;
  verdictLabel: string;
  personaId: string;
}
```

---

## 3. ビジネスロジック

### 3.1 3フェーズ判定フロー（SaboriProposerAgent）

```
Phase 1: コンテキストアセンブリ
  入力: TaskContext（task + slackContext）
  処理:
    - assembleContextNarrative(): 自然言語ナラティブ変換
    - derivePsychSignals(): 心理学的シグナル導出
    - determineContextCoverage(): コンテキスト充実度判定
  出力: narrativeText (string), contextSignals (ContextSignals)

Phase 2: Bedrock converse（sabori_judgment Tool Use）
  入力: narrativeText
  処理:
    - SABORI_SYSTEM_PROMPT + narrativeText を converse API に送信
    - toolChoice: { tool: { name: 'sabori_judgment' } } で構造化出力強制
    - parseLLMJudgment(): ConverseCommandOutput → LLMJudgment パース + Zod 検証
  出力: LLMJudgment

Phase 3: PersonaRenderer（口調変換）
  入力: LLMJudgment（rawChatMessage / summaryText / verdict / reasoning）
  処理:
    - PersonaRenderer.render(): Bedrock Claude Haiku で口調変換
    - verdictEmoji / verdictLabel 付与
  出力: RenderOutput

最終組み立て:
  - nextCheckAt = now + nextCheckOffsetMinutes
  - Proposal 組み立て（tokenCount 計上）
  - DynamoProposalRepository.save()
```

### 3.2 心理学 5 理論 → シグナル導出ロジック

| 理論 | 文献 | シグナル導出 |
|------|------|-----------|
| CEM (Karau & Williams, 1993) | contextCoverage / 締切有無 | full/partial/minimal で判定 |
| Identifiability (Williams et al., 1981) | requesterStatus = online → high / away,offline → low | taskIdentifiability |
| Sucker Effect (Kerr, 1983) | requesterStatus = online → high / away,offline → low | perceivedPeerEffort |
| SDT (Ryan & Deci, 2000) | reminderCount >= 2 or urgency=high → high / count=0 and urgency=low → low | externalPressureLevel |
| Expectancy Theory (Vroom, 1964) | deadline > 24h → high / deadline < 4h → low / null → unknown | effortOutcomeExpectancy |

### 3.3 assembleContextNarrative() 仕様

```typescript
function assembleContextNarrative(context: TaskContext): string {
  const lines: string[] = []

  lines.push('## タスク情報')
  lines.push(`- タイトル: ${context.task.title}`)
  lines.push(`- 締切: ${context.task.deadline ? formatDeadline(context.task.deadline) : '未設定'}`)
  if (context.task.deadline) {
    const minutes = minutesUntil(context.task.deadline)
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    lines.push(`- 締切まで: ${h > 0 ? `${h}時間` : ''}${m}分`)
  }

  if (context.slackContext) {
    const s = context.slackContext
    lines.push('\n## Slack の状況')
    lines.push(`- 依頼者のステータス: ${s.requesterStatus}`)
    lines.push(`- リマインドが来た回数: ${s.reminderCount}回`)
    lines.push(`- 緊急キーワード: ${s.urgencyKeywords.length > 0 ? s.urgencyKeywords.join(', ') : 'なし'}`)
    lines.push(`- スレッドアクティブ（直近1時間）: ${s.threadActive ? 'あり' : 'なし'}`)
    if (s.reminderCount === 0) {
      lines.push('  → リマインドなし。依頼者はまだ焦っていない可能性が高い')
    }
  } else {
    lines.push('\n## Slack の状況')
    lines.push('- Slack コンテキストなし（手動タスク）')
  }

  return lines.join('\n')
}
```

### 3.4 determineContextCoverage() 仕様

```typescript
function determineContextCoverage(context: TaskContext): ContextSignals['contextCoverage'] {
  const hasSlack = context.slackContext != null
  const hasDeadline = context.task.deadline != null

  if (hasSlack && hasDeadline) return 'full'
  if (hasSlack || hasDeadline) return 'partial'
  return 'minimal'
}
```

### 3.5 next_check_at 計算ロジック

```typescript
function calcNextCheckAt(offsetMinutes: number, now: Date = new Date()): string {
  return new Date(now.getTime() + offsetMinutes * 60 * 1000).toISOString()
}
```

LLM が `nextCheckOffsetMinutes` を決定する。ガイドライン:
- `can_saboru`: 120〜360 分（2〜6 時間後）
- `borderline`: 30〜60 分
- `must_do`: 10〜20 分

### 3.6 tokenCount 計上

Bedrock の `ConverseCommandOutput.usage` から取得する。

```typescript
const usage = response.usage
const tokenCount = (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)
```

### 3.7 SSE ストリーミング（proposeStream）

`proposeStream()` は `AsyncIterator<ProposalDelta>` を返す。
**実装方式**: Bedrock `converseStream` API を使用する（`BedrockRuntimeClient.send(ConverseStreamCommand)`）。

フロー:
1. `ConverseStreamCommand` でストリーミング呼び出し
2. `contentBlockDelta` イベントごとに `ProposalDelta` を yield
3. ストリーム完了後に `type: 'complete'` を yield し、Proposal 全体を payload に含める
4. PersonaRenderer はストリーム完了後に一括実行（Haiku 呼び出しは非ストリーミング）

> **注意**: IBedrockClient インタフェースは U-03a で定義済みの `converse()` のみ。
> `converseStream` は `SaboriProposerAgent` が直接 `BedrockRuntimeClient` を受け取るか、
> IBedrockClient を拡張する。設計上は **IBedrockClient に `converseStream()` を追加**する（後述）。

---

## 4. Bedrock Tool Use スキーマ

### 4.1 sabori_judgment ツール（Phase 2 — SaboriProposerAgent）

```typescript
// src/sabori-proposer/saboriJudgmentTool.ts

export const SABORI_JUDGMENT_TOOL_NAME = 'sabori_judgment'

export const SABORI_JUDGMENT_TOOL = {
  toolSpec: {
    name: SABORI_JUDGMENT_TOOL_NAME,
    description: 'タスクの文脈を分析し、サボり可否を判定して構造化データを返す',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          verdict: {
            type: 'string',
            enum: ['can_saboru', 'borderline', 'must_do'],
            description: [
              'can_saboru: 今すぐサボれる。締切まで余裕があり、依頼者からのプレッシャーも低い',
              'borderline: グレーゾーン。近日中に状況確認が必要',
              'must_do: 危険。今すぐ動かないとまずい状況',
            ].join('\n'),
          },
          summaryText: {
            type: 'string',
            description: '60文字以内の1行判断文。例: 「まだ寝かせてOK。明日14時までに確認だけすれば逃げ切れる。」',
            maxLength: 60,
          },
          reasoning: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 5,
            description: '判断の根拠。各項目は「〜だから」「〜のため」で終わる具体的な事実ベースの文章',
          },
          rawChatMessage: {
            type: 'string',
            description: '100〜150文字の解説文。後でサボロー口調に変換するため中立的な口調で書く',
          },
          nextCheckOffsetMinutes: {
            type: 'number',
            description: [
              '次回再評価までの分数。判定に応じた目安:',
              '  can_saboru: 120〜360分（2〜6時間後）',
              '  borderline: 30〜60分（状況変化を監視）',
              '  must_do: 10〜20分（緊急監視）',
              '締切までの残り時間も考慮して決定すること',
            ].join('\n'),
          },
          appliedFramework: {
            type: 'array',
            items: { type: 'string' },
            description: '判定に影響した心理学フレームワーク名を列挙。例: ["CEM (Karau & Williams 1993)", "Sucker Effect (Kerr 1983)"]',
          },
        },
        required: ['verdict', 'summaryText', 'reasoning', 'rawChatMessage', 'nextCheckOffsetMinutes'],
      },
    },
  },
}
```

### 4.2 persona_render ツール（Phase 3 — PersonaRenderer）

```typescript
// src/sabori-proposer/personaRenderTool.ts

export const PERSONA_RENDER_TOOL_NAME = 'persona_render'

export const PERSONA_RENDER_TOOL = {
  toolSpec: {
    name: PERSONA_RENDER_TOOL_NAME,
    description: 'rawChatMessage をサボロー口調に変換し、summaryText も口調を揃えて返す',
    inputSchema: {
      json: {
        type: 'object',
        properties: {
          summaryText: {
            type: 'string',
            description: '口調変換済みの1行サマリ（60文字以内）',
            maxLength: 60,
          },
          chatMessage: {
            type: 'string',
            description: 'サボロー口調に変換済みの150文字以内チャットメッセージ。語尾は〜だよ/〜ね/〜かな。絵文字を1〜2個含む',
            maxLength: 200,
          },
        },
        required: ['summaryText', 'chatMessage'],
      },
    },
  },
}
```

---

## 5. システムプロンプト定義

### 5.1 SABORI_SYSTEM_PROMPT（Phase 2 判定）

```typescript
export const SABORI_SYSTEM_PROMPT = `あなたは「サボリスト」です。与えられたタスクの文脈情報を読んで、
ユーザーが「今サボれるかどうか」を判定する専門家です。

## 判定の思想
- サボることは怠惰ではなく、有限なエネルギーの最適配分である
- 「リマインドが来ていない = 依頼者はまだ焦っていない」という現実を直視する
- 締切・会議・依頼者の行動パターンから「本当の危険ライン」を見極める
- ユーザーが安心してサボれる「根拠」を具体的に提示することが最重要

## 判定基準（ガイドライン）
【can_saboru の典型シグナル】
- 締切まで24時間以上ある
- 依頼者からのリマインドが0回
- 依頼者のステータスが away/offline

【borderline の典型シグナル】
- 締切まで12〜24時間
- リマインドが1回来ている
- 関連会議まで3〜12時間

【must_do の典型シグナル】
- 締切まで12時間未満
- リマインドが2回以上
- 依頼者のステータスが online で最近アクティブ

## 心理学的フレームワーク（判定に反映すること）
- Identifiability 低 → can_saboru 方向
- Sucker Effect 発動 → can_saboru 方向
- Expectancy 高 → can_saboru 方向
- SDT 外発的プレッシャー低 → can_saboru 方向`
```

### 5.2 SABORU_OTTORI_PERSONA のシステムプロンプト（Phase 3 口調変換）

```typescript
export const SABORU_OTTORI_SYSTEM_PROMPT = `あなたはサボローです。おっとりした口調で、ユーザーが罪悪感なくサボれるよう優しく背中を押します。
以下のルールを守ってください:
- 語尾は「〜だよ」「〜ね」「〜かな」を使う
- 絵文字を自然に1〜2個使う
- chatMessage は150文字以内に収める
- 判定根拠を1〜2文で優しく説明する
- 「can_saboru」なら背中を押す。「must_do」なら優しく現実を伝える`
```

---

## 6. IBedrockClient 拡張（converseStream 追加）

SSE ストリーミング対応のため、`IBedrockClient` インタフェースを拡張する。

```typescript
// src/bedrock/IBedrockClient.ts（拡張）
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

`BedrockClientAdapter` に `converseStream()` を追加:

```typescript
// src/bedrock/BedrockClientAdapter.ts（追加メソッド）
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

---

## 7. SaboriProposerLambdaHandler 設計

U-03b は API Gateway から呼び出される（U-04: api の `ProposalHandler` が Lambda を直接 invoke するか、
API Gateway Lambda 統合で呼び出す）。

```typescript
// Lambda イベント（API Gateway Proxy）
interface ProposalLambdaEvent {
  taskId: string
  userId: string
  task: Task
  slackMessageRef?: string  // sourceRef から取得
}

// ハンドラ処理フロー
export const handler = async (event: unknown): Promise<LambdaResponse> => {
  // 1. Zod バリデーション
  const parsed = ProposalLambdaEventSchema.safeParse(event)
  if (!parsed.success) { /* 400 */ }

  // 2. SlackContext 収集（sourceType=slack の場合のみ）
  let slackContext: SlackContext | undefined
  if (parsed.data.slackMessageRef) {
    const collector = new ContextCollector()
    const token = await collector.getSlackToken()
    slackContext = await collectSlackContext({
      taskId: parsed.data.taskId,
      userId: parsed.data.userId,
      slackMessageRef: parsed.data.slackMessageRef,
      token,
    })
  }

  // 3. SaboriProposerAgent.propose() 呼び出し
  const agent = new SaboriProposerAgent(bedrockClient, proposalRepository, personaRenderer)
  const proposal = await agent.propose(parsed.data.taskId, {
    task: parsed.data.task,
    slackContext,
  })

  return { statusCode: 200, body: JSON.stringify(proposal) }
}
```

---

## 8. DynamoProposalRepository 設計

```typescript
// src/repositories/DynamoProposalRepository.ts

export class DynamoProposalRepository implements IProposalRepository {
  constructor(private readonly tableName: string) {}

  async save(proposal: Omit<Proposal, 'PK' | 'SK'>): Promise<Proposal> {
    const item: Proposal = {
      ...proposal,
      PK: `TASK#${proposal.taskId}`,
      SK: `PROPOSAL#${proposal.evaluatedAt}`,
    }
    await docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      // 同一 SK（同一 evaluatedAt）の重複書き込みを防ぐ
      ConditionExpression: 'attribute_not_exists(SK)',
    }))
    return item
  }

  async findLatestByTaskId(taskId: string): Promise<Proposal | null> {
    const result = await docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'GSI-TaskLatest',
      KeyConditionExpression: 'taskId = :taskId',
      ExpressionAttributeValues: { ':taskId': taskId },
      ScanIndexForward: false,  // 降順（最新が先頭）
      Limit: 1,
    }))
    return (result.Items?.[0] as Proposal) ?? null
  }
}
```

---

## 9. エラーハンドリング方針

| エラー種別 | 処理方針 |
|-----------|---------|
| Bedrock ThrottlingException | adaptive retry（maxAttempts=5）で自動リトライ。全リトライ消費 → BedrockTimeoutError をスロー |
| Bedrock Tool Use パース失敗 | Zod ValidationError をスロー → Lambda DLQ に転送 |
| Slack API タイムアウト（>10s） | null 返却（slackContext なしで続行） |
| DynamoDB ConditionalCheckFailed | ログ警告のみ（冪等性 = 既存レコードが優先） |
| PersonaRenderer 失敗 | rawChatMessage をそのまま使用（fallback） |

---

## 10. ファイル構成（新規・変更）

```
pkgs/agent/src/
├── bedrock/
│   ├── IBedrockClient.ts             [変更] converseStream() 追加
│   └── BedrockClientAdapter.ts       [変更] converseStream() 追加
│
├── sabori-proposer/
│   ├── SaboriProposerAgent.ts        [新規] propose() / proposeStream()
│   ├── PersonaRenderer.ts            [新規] render()
│   ├── saboriJudgmentTool.ts         [新規] SABORI_JUDGMENT_TOOL
│   ├── personaRenderTool.ts          [新規] PERSONA_RENDER_TOOL
│   ├── contextUtils.ts               [新規] assembleContextNarrative / derivePsychSignals / determineContextCoverage
│   ├── types.ts                      [新規] TaskContext / SlackContext / LLMJudgment / ContextSignals / ProposalDelta
│   ├── SaboriProposerLambdaHandler.ts [新規] Lambda エントリポイント
│   └── __tests__/
│       ├── SaboriProposerAgent.test.ts
│       ├── PersonaRenderer.test.ts
│       └── contextUtils.test.ts
│
├── repositories/
│   └── DynamoProposalRepository.ts  [新規] save() / findLatestByTaskId()
│       └── __tests__/
│           └── DynamoProposalRepository.test.ts
│
└── index.ts                          [変更] 新規エクスポート追加
```
