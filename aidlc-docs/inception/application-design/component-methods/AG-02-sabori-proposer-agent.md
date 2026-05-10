# AG-02: SaboriProposerAgent — コンポーネントメソッド定義

**レイヤー**: エージェント（packages/agent）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § AG-02  
**Unit**: U-03b（sabori-proposer）

---

## 判定アーキテクチャ

**LLMフル判定 + Bedrock Structured Output（2フェーズ方式）**

サボり判定は「ルールで切れる部分」と「人間の文脈読解が必要な部分」を分離せず、LLMが文脈全体を一度に読んで判定する。ただし出力の型安全性を担保するため、Bedrock の `converse` API + Tool Use パターンで構造化出力を強制する。

---

## 理論的根拠（心理学フレームワーク）

SABOROU のサボり判定は以下の 5 つの社会心理学・動機づけ理論を設計基盤としている。
「なぜ今サボれるか」を科学的根拠で説明できることが、単なる「締切リマインダー」との本質的差別化となる。

| # | フレームワーク | 出典 | 核心概念 | ContextSignals への対応 |
|---|---|---|---|---|
| 1 | **Collective Effort Model (CEM)** | Karau, S. J., & Williams, K. D. (1993). Social loafing: A meta-analytic review and theoretical integration. *Journal of Personality and Social Psychology, 65*(4), 681–706. https://doi.org/10.1037/0022-3514.65.4.681 | 集合的努力は「自分の貢献が価値ある結果につながる」と信じられるときだけ発揮される。逆に「誰でもできる」「気づかれない」タスクでは努力は自然に低下する（約4,500引用） | `contextCoverage` / 締切の有無 |
| 2 | **Identifiability（識別可能性）** | Williams, K. D., Harkins, S., & Latané, B. (1981). Identifiability as a deterrent to social loafing: Two cheering experiments. *Journal of Personality and Social Psychology, 40*(2), 303–311. https://doi.org/10.1037/0022-3514.40.2.303 | 個人の貢献が依頼者から「識別可能」な状態では社会的手抜きが消える。逆に識別不能（依頼者が offline/away でリマインドなし）＝サボれる根拠 | `requesterActiveStatus` / `hasReminder` |
| 3 | **Sucker Effect（カモ効果）** | Kerr, N. L. (1983). Motivation losses in small groups: A social dilemma analysis. *Journal of Personality and Social Psychology, 45*(4), 819–828. https://doi.org/10.1037/0022-3514.45.4.819 | 周囲（依頼者・ピア）が努力していないと知覚されるとき、「自分だけ損する」を避けるため個人の努力も合理的に低下する | `requesterActiveStatus` (away/offline) |
| 4 | **Self-Determination Theory (SDT)** | Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist, 55*(1), 68–78. https://doi.org/10.1037/0003-066X.55.1.68 | 外発的動機（依頼・締切）のプレッシャーがないとき、タスクへの取り組みを自律的に調整（先延ばし）することが心理的に合理的になる | `reminderCount` / `urgencyLevel` |
| 5 | **Expectancy Theory** | Vroom, V. H. (1964). *Work and Motivation.* New York: Wiley. | 動機づけ＝期待（努力→成果）× 道具性（成果→報酬）× 誘意性。締切が遠い・フィードバックがないタスクは「今努力しても報われない」期待を生み、先延ばしが最適戦略になる | `deadlineMinutes` / `contextCoverage` |

**SABOROU の判定ロジックへのマッピング**:

```
[サボれる条件] = Identifiability が低い（依頼者が見ていない）
              ∧ Sucker Effect が発動（依頼者も動いていない）
              ∧ Expectancy が高い（締切まで余裕がある）
              ∧ SDT 外発的プレッシャーが低い（リマインドなし）
              → CEM によると集合的努力への動機が低下 = サボりが最適解
```

---

## 3フェーズ設計

```
[Phase 1: コンテキストアセンブリ + 判定プロンプト構築]
  ContextCollector が収集した SlackContext / GmailContext / CalendarContext を
  自然言語ナラティブ形式に変換し、LLM への入力コンテキストを組み立てる

        ↓

[Phase 2: Bedrock converse（Tool Use で構造化出力を強制）]
  Claude Sonnet が以下を一括判定:
  ① verdict（3段階）
  ② reasoning（根拠の箇条書き）
  ③ summaryText（1行サマリ）
  ④ nextCheckAt（次回再評価タイミング）
  ⑤ rawChatMessage（口調変換前の判断文）

        ↓

[Phase 3: PersonaRenderer（口調変換 + 絵文字付与）]
  rawChatMessage → おっとりサボロー口調に変換
```

---

## インターフェース定義

```typescript
interface ISaboriProposerAgent {
  propose(taskId: string, context: TaskContext): Promise<Proposal>
  proposeStream(taskId: string, context: TaskContext): AsyncIterator<ProposalDelta>
}

// タスクコンテキスト（ContextCollector から受け取る）
interface TaskContext {
  task: Task
  slackContext?: SlackContext
  gmailContext?: GmailContext
  calendarContext?: CalendarContext
}

// 提案結果（最終出力）
interface Proposal {
  taskId: string
  verdict: Verdict                 // 'can_saboru' | 'caution' | 'danger'
  summaryText: string              // 1行サマリ（タスク一覧カード用）
  reasoning: string[]              // 判断材料の箇条書きリスト（3〜5項目）
  chatMessage: string              // PersonaRenderer 適用済みのチャットメッセージ
  evaluatedAt: string              // ISO 8601
  nextCheckAt: string              // 次回再評価タイミング ISO 8601
  contextSignals: ContextSignals   // デバッグ・監査用のシグナル記録
}

// LLM が structured output として返す中間型（PersonaRenderer 適用前）
interface LLMJudgment {
  verdict: Verdict
  summaryText: string              // 口調変換前（中立的な判断文）
  reasoning: string[]
  rawChatMessage: string           // 口調変換前の解説文
  nextCheckOffsetMinutes: number   // 次回チェックまでの分数（LLMが決定）
  confidenceNote?: string          // LLMが不確実と判断した場合のメモ
}

// シグナル記録（透明性確保・デバッグ用）
interface ContextSignals {
  hasReminder: boolean
  reminderCount: number
  requesterActiveStatus: string
  nearestMeetingMinutes?: number
  hasUrgentKeyword: boolean
  deadlineMinutes?: number         // 締切まで何分か（nullなら締切不明）
  contextCoverage: 'full' | 'partial' | 'minimal'  // コンテキスト充実度

  // 心理学的シグナル（理論的根拠の透明性確保・LLM 判定への入力）
  psychSignals?: {
    // CEM × Identifiability: 依頼者から貢献が「識別可能」かどうか
    // Williams et al. (1981); Karau & Williams (1993)
    taskIdentifiability: 'high' | 'low' | 'unknown'

    // Expectancy Theory: 「今努力して締切に間に合う」期待値 (E→P 期待)
    // Vroom (1964)
    effortOutcomeExpectancy: 'high' | 'low' | 'unknown'

    // Sucker Effect: 「依頼者（ピア）が動いていない」知覚
    // Kerr (1983)
    perceivedPeerEffort: 'high' | 'low' | 'unknown'

    // SDT: 外発的プレッシャーの強さ（高=forced regulation、低=autonomous）
    // Ryan & Deci (2000)
    externalPressureLevel: 'high' | 'low' | 'unknown'
  }
}

type Verdict = 'can_saboru' | 'caution' | 'danger'
```

---

## Bedrock Tool Use スキーマ（Phase 2）

```typescript
const SABORI_JUDGMENT_TOOL = {
  name: 'sabori_judgment',
  description: 'タスクの文脈を分析し、サボり可否を判定して構造化データを返す',
  inputSchema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['can_saboru', 'caution', 'danger'],
        description: [
          'can_saboru: 今すぐサボれる。締切まで余裕があり、依頼者からのプレッシャーも低い',
          'caution: 注意が必要。近日中に着手すべき兆候がある',
          'danger: 危険。今すぐ動かないとまずい状況',
        ].join('\n'),
      },
      summaryText: {
        type: 'string',
        description: '30文字以内の1行判断文。例: 「まだ寝かせてOK。明日14時までに確認だけすれば逃げ切れる。」',
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
          '  caution: 30〜60分（状況変化を監視）',
          '  danger: 10〜20分（緊急監視）',
          '締切までの残り時間も考慮して決定すること',
        ].join('\n'),
      },
      appliedFramework: {
        type: 'array',
        items: { type: 'string' },
        description: [
          '判定に影響した心理学フレームワーク名を列挙（説明責任・審査用）。',
          '例: ["CEM (Karau & Williams 1993)", "Sucker Effect (Kerr 1983)"]',
        ].join('\n'),
      },
    },
    required: ['verdict', 'summaryText', 'reasoning', 'rawChatMessage', 'nextCheckOffsetMinutes'],
  },
}
```

---

## システムプロンプト（Phase 2）

```
あなたは「サボリスト」です。与えられたタスクの文脈情報を読んで、
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

【caution の典型シグナル】
- 締切まで12〜24時間
- リマインドが1回来ている
- 関連会議まで3〜12時間

【danger の典型シグナル】
- 締切まで12時間未満
- リマインドが2回以上
- 依頼者のステータスが online で最近アクティブ

## 心理学的フレームワーク（判定に反映すること）
- Identifiability 低 → can_saboru 方向
- Sucker Effect 発動 → can_saboru 方向
- Expectancy 高 → can_saboru 方向
- SDT 外発的プレッシャー低 → can_saboru 方向
```

---

## 心理学的シグナル導出ロジック

```typescript
function derivePsychSignals(context: TaskContext): ContextSignals['psychSignals'] {
  const slack = context.slackContext
  const task = context.task

  // Identifiability (Williams et al., 1981; CEM: Karau & Williams, 1993)
  const taskIdentifiability: 'high' | 'low' | 'unknown' =
    slack?.requesterStatus === 'online' || (slack?.reminderCount ?? 0) > 0
      ? 'high'
      : slack?.requesterStatus === 'away' || slack?.requesterStatus === 'offline'
      ? 'low'
      : 'unknown'

  // Expectancy Theory (Vroom, 1964)
  const effortOutcomeExpectancy: 'high' | 'low' | 'unknown' =
    task.deadline == null
      ? 'unknown'
      : minutesUntil(task.deadline) > 24 * 60
      ? 'high'
      : minutesUntil(task.deadline) < 4 * 60
      ? 'low'
      : 'unknown'

  // Sucker Effect (Kerr, 1983)
  const perceivedPeerEffort: 'high' | 'low' | 'unknown' =
    slack?.requesterStatus === 'online' ? 'high'
    : slack?.requesterStatus === 'away' || slack?.requesterStatus === 'offline' ? 'low'
    : 'unknown'

  // SDT (Ryan & Deci, 2000)
  const externalPressureLevel: 'high' | 'low' | 'unknown' =
    (slack?.reminderCount ?? 0) >= 2 || slack?.urgencyLevel === 'high' ? 'high'
    : (slack?.reminderCount ?? 0) === 0 && slack?.urgencyLevel === 'low' ? 'low'
    : 'unknown'

  return { taskIdentifiability, effortOutcomeExpectancy, perceivedPeerEffort, externalPressureLevel }
}
```

---

## `propose()` 実装フロー

```typescript
async propose(taskId: string, context: TaskContext): Promise<Proposal> {
  // 1. コンテキストナラティブ組み立て
  const narrative = assembleContextNarrative(context)
  const coverage = determineContextCoverage(context)

  // 2. Bedrock converse（Tool Use で構造化出力を強制）
  const response = await bedrockClient.converse({
    modelId: 'anthropic.claude-sonnet-4-5',
    system: [{ text: SABORI_SYSTEM_PROMPT }],
    messages: [{ role: 'user', content: [{ text: narrative }] }],
    toolConfig: {
      tools: [{ toolSpec: SABORI_JUDGMENT_TOOL }],
      toolChoice: { tool: { name: 'sabori_judgment' } },
    },
  })

  // 3. structured output パース
  const judgment = parseLLMJudgment(response)

  // 4. PersonaRenderer で口調変換
  const rendered = await personaRenderer.render({
    verdict: judgment.verdict,
    reasoning: judgment.reasoning,
    summaryText: judgment.summaryText,
    rawChatMessage: judgment.rawChatMessage,
    personaId: 'saboru_ottori',
  })

  // 5. Proposal 組み立て・DynamoDB 保存
  const evaluatedAt = new Date().toISOString()
  const nextCheckAt = new Date(
    Date.now() + judgment.nextCheckOffsetMinutes * 60 * 1000
  ).toISOString()

  return {
    taskId,
    verdict: judgment.verdict,
    summaryText: rendered.summaryText,
    reasoning: judgment.reasoning,
    chatMessage: rendered.chatMessage,
    evaluatedAt,
    nextCheckAt,
    contextSignals: buildContextSignals(context, coverage),
  }
}
```

---

## 依存コンポーネント

- **[AG-04] ContextCollector** — Slack / Gmail / Calendar からコンテキスト収集
- **Amazon Bedrock（Claude Sonnet 3.5）** — フル判定・Structured Output（Phase 2）
- **[AG-03] PersonaRenderer** — 口調変換（Phase 3）
- **DynamoDB Proposals テーブル** — 提案キャッシュ保存

## 関連要件

- FR-03: サボり提案の生成（リアルタイムストリーミング）
- FR-04: バックグラウンド自動再評価
- NFR-01: レイテンシ 3 秒以内（SSE 初回 chunk）

## シーケンス参照

`application-design.md` § 7.2（サボり提案生成フロー — 最も詳細なシーケンス図）
