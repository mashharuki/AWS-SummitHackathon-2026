# AG-04: ContextCollector — コンポーネントメソッド定義

**レイヤー**: エージェント（packages/agent）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § AG-04

---

## インターフェース定義

```typescript
interface IContextCollector {
  collectAll(params: CollectAllParams): Promise<TaskContext>
}

interface CollectAllParams {
  taskId: string
  userId: string
  services: ('slack' | 'gmail' | 'calendar')[]  // 連携済みサービスのみ実行
}
```

---

## 収集コンテキスト型定義

```typescript
// Slack コンテキスト
interface SlackContext {
  requesterStatus: 'online' | 'away' | 'offline' | 'unknown'
  hasReminder: boolean
  reminderCount: number                    // Slackリマインドが来た回数
  urgencyLevel: 'high' | 'medium' | 'low' // 緊急キーワード有無など
  mentionCount?: number                    // 自分へのメンション回数
}

// Gmail コンテキスト
interface GmailContext {
  unreadCount: number                      // 関連スレッドの未読数
  hasFollowUp: boolean                     // フォローアップメールが来ているか
  latestEmailAgo?: number                  // 最新メールから何分経過したか
}

// Google Calendar コンテキスト
interface CalendarContext {
  nearestMeetingMinutes?: number           // 関連会議まで何分か
  hasDeadlineConflict: boolean             // 締切と会議が重なっているか
  todayEvents: CalendarEvent[]             // 今日の残り予定
}
```

---

## `collectSlackContext()` 実装

```typescript
async function collectSlackContext(
  task: Task,
  userId: string,
  accessToken: string,
): Promise<SlackContext> {
  // 1. Slack API: 依頼者のプレゼンスを取得
  const presence = await slackClient.users.getPresence({
    user: task.requesterId,
    token: accessToken,
  })

  // 2. リマインド回数カウント（Slack API: conversations.history）
  const history = await slackClient.conversations.history({
    channel: task.sourceChannelId,
    limit: 50,
    token: accessToken,
  })
  const reminderCount = history.messages.filter(
    (m) => m.type === 'reminder_add' && m.user === task.requesterId
  ).length

  // 3. 緊急キーワード判定（規則ベース）
  const URGENT_KEYWORDS = ['至急', 'ASAP', '今すぐ', '緊急', 'urgent', '急いで']
  const hasUrgentKeyword = URGENT_KEYWORDS.some(
    (kw) => task.title.includes(kw) || task.description?.includes(kw)
  )

  return {
    requesterStatus: presence.online ? 'online' : 'away',
    hasReminder: reminderCount > 0,
    reminderCount,
    urgencyLevel: hasUrgentKeyword ? 'high' : reminderCount >= 2 ? 'medium' : 'low',
  }
}
```

---

## `assembleContextNarrative()` — LLM 入力ナラティブ変換

各サービスのコンテキストを自然言語のナラティブ形式に変換し、AG-02 の Phase 1 入力として渡す。

```typescript
function assembleContextNarrative(context: TaskContext): string {
  const { task, slackContext, gmailContext, calendarContext } = context
  const lines: string[] = []

  lines.push(`## タスク情報`)
  lines.push(`- タイトル: ${task.title}`)
  lines.push(`- 締切: ${task.deadline ? formatDeadline(task.deadline) : '未設定'}`)
  if (task.deadline) {
    const minutes = minutesUntil(task.deadline)
    lines.push(`- 締切まで: ${minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60}分` : `${minutes}分`}`)
  }

  if (slackContext) {
    lines.push(`\n## Slack の状況`)
    lines.push(`- 依頼者のステータス: ${slackContext.requesterStatus}`)
    lines.push(`- リマインドが来た回数: ${slackContext.reminderCount}回`)
    lines.push(`- 緊急度: ${slackContext.urgencyLevel}`)
    if (!slackContext.hasReminder) {
      lines.push('  → リマインドなし。依頼者はまだ焦っていない可能性が高い')
    }
  }

  if (gmailContext) {
    lines.push(`\n## Gmail の状況`)
    lines.push(`- 関連スレッド未読: ${gmailContext.unreadCount}件`)
    lines.push(`- フォローアップメール: ${gmailContext.hasFollowUp ? 'あり' : 'なし'}`)
  }

  if (calendarContext) {
    lines.push(`\n## カレンダーの状況`)
    if (calendarContext.nearestMeetingMinutes != null) {
      lines.push(`- 関連会議まで: ${calendarContext.nearestMeetingMinutes}分`)
    }
    lines.push(`- 今日の残り予定: ${calendarContext.todayEvents.length}件`)
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
- **Gmail API** — スレッド未読数・フォローアップ確認
- **Google Calendar API** — 会議スケジュール・締切重複確認
- **AWS Secrets Manager** — OAuth トークン取得（各サービス）

## 関連要件

- FR-01: 外部サービスとの連携（コンテキスト収集）
- NFR-02: 外部 API タイムアウト対応（3 秒超で null 返却）

## シーケンス参照

`application-design.md` § 7.2（サボり提案生成フロー — Phase 1 コンテキスト収集部分）
