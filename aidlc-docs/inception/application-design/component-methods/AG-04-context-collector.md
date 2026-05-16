# AG-04: ContextCollector — コンポーネントメソッド定義

**レイヤー**: エージェント（packages/agent）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § AG-04

> **v1.0.0 スコープ**: 本コンポーネントは Slack 専用実装。
> v1.1.0 以降で Gmail / Google Calendar コンテキスト収集を追加予定。

---

## インターフェース定義

```typescript
interface IContextCollector {
  collectSlackContext(params: CollectSlackParams): Promise<SlackContext>
}

interface CollectSlackParams {
  taskId: string
  userId: string
  slackMessageRef: string  // TaskCandidate.sourceRef に格納されている参照ID
}

interface SlackContext {
  requesterStatus: 'online' | 'away' | 'offline' | 'unknown'
  lastActivityAt?: string
  reminderCount: number
  urgencyKeywords: string[]
  threadActive: boolean
  rawSummary: string  // 処理後即削除（NFR-07 準拠）
}
```

---

## `collectSlackContext()` 実装

```typescript
async function collectSlackContext(
  params: CollectSlackParams,
): Promise<SlackContext> {
  const { taskId, userId, slackMessageRef } = params

  // 1. Slack API: 依頼者のプレゼンス取得
  const presence = await slackClient.users.getPresence({
    user: slackMessageRef,
    token: accessToken,
  })

  // 2. リマインド回数カウント（Slack API: conversations.history）
  const history = await slackClient.conversations.history({
    channel: slackMessageRef,
    limit: 50,
    token: accessToken,
  })
  const reminderCount = history.messages?.filter(
    (m) => m.type === 'reminder_add'
  ).length ?? 0

  // 3. 緊急キーワード検出（規則ベース）
  const URGENT_KEYWORDS = ['至急', 'ASAP', '今すぐ', '緊急', 'urgent', '急いで']
  const messageTexts = history.messages?.map((m) => m.text ?? '').join(' ') ?? ''
  const detectedKeywords = URGENT_KEYWORDS.filter((kw) => messageTexts.includes(kw))

  // 4. スレッドアクティブ判定（直近1時間以内に投稿があるか）
  const ONE_HOUR_AGO = Date.now() / 1000 - 3600
  const threadActive = history.messages?.some(
    (m) => m.ts && parseFloat(m.ts) > ONE_HOUR_AGO
  ) ?? false

  // 5. rawSummary はコンテキスト生成後に即削除（NFR-07 準拠）
  const rawSummary = messageTexts  // ←  AG-02 へ渡した後にメモリから削除

  return {
    requesterStatus: presence.online ? 'online' : 'away',
    reminderCount,
    urgencyKeywords: detectedKeywords,
    threadActive,
    rawSummary,
  }
}
```

---

## `assembleContextNarrative()` — LLM 入力ナラティブ変換

Slack コンテキストを自然言語のナラティブ形式に変換し、AG-02 の Phase 1 入力として渡す。

```typescript
function assembleContextNarrative(context: { task: Task; slackContext: SlackContext }): string {
  const { task, slackContext } = context
  const lines: string[] = []

  lines.push(`## タスク情報`)
  lines.push(`- タイトル: ${task.title}`)
  lines.push(`- 締切: ${task.deadline ? formatDeadline(task.deadline) : '未設定'}`)
  if (task.deadline) {
    const minutes = minutesUntil(task.deadline)
    lines.push(`- 締切まで: ${minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60}分` : `${minutes}分`}`)
  }

  lines.push(`\n## Slack の状況`)
  lines.push(`- 依頼者のステータス: ${slackContext.requesterStatus}`)
  lines.push(`- リマインドが来た回数: ${slackContext.reminderCount}回`)
  lines.push(`- 緊急キーワード: ${slackContext.urgencyKeywords.length > 0 ? slackContext.urgencyKeywords.join(', ') : 'なし'}`)
  lines.push(`- スレッドアクティブ（直近1時間）: ${slackContext.threadActive ? 'あり' : 'なし'}`)
  if (slackContext.reminderCount === 0) {
    lines.push('  → リマインドなし。依頼者はまだ焦っていない可能性が高い')
  }

  return lines.join('\n')
}
```

---

## `derivePsychSignals()` — 心理学的シグナル導出

ContextSignals の `psychSignals` を計算する（AG-02 でも使用）。
**詳細な実装とフレームワーク説明は [AG-02](./AG-02-sabori-proposer-agent.md) § 心理学的シグナル導出ロジック を参照**。

---

## 依存サービス

- **Slack Web API** — 依頼者プレゼンス・チャンネル履歴取得
- **AWS Secrets Manager** — Slack OAuth トークン取得

> **将来拡張（v1.1.0 以降）**: Gmail API・Google Calendar API の追加予定。
> 現時点では依存サービスから除外している。

## 関連要件

- FR-01: 外部サービスとの連携（Slack コンテキスト収集）
- NFR-02: 外部 API タイムアウト対応（10 秒超で null 返却）
- NFR-07: 生データ（rawSummary）は処理後に即削除

## シーケンス参照

`application-design.md` § 7.2（サボり提案生成フロー — Phase 1 コンテキスト収集部分）
