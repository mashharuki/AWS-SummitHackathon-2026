# BE-06: WebhookHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-06  
**使用 SDK**: **Vercel Chat SDK（`chat` npm package）** — Slack アダプター

---

## メソッド定義

```typescript
// Slack Events API Webhook 受信
POST /webhooks/slack
Request:  SlackEvent  // Slack Events API payload
Response: { challenge?: string }  // URL Verification 対応
// Side effect: EventBridge にイベントを転送
```

## Vercel Chat SDK の役割

`chat` npm package の Slack アダプターが以下を担当する（Vercel へのデプロイは不要）:

| 機能 | 詳細 |
|------|------|
| 署名検証 | `X-Slack-Signature` ヘッダーと `SLACK_SIGNING_SECRET` を使った HMAC-SHA256 検証 |
| イベント正規化 | Slack Events API の各種ペイロード型（`message` / `app_mention` 等）を型安全に処理 |
| URL Verification | Slack の `url_verification` チャレンジに自動応答 |
| EventBridge 連携 | 正規化済みイベントを EventBridge に転送してタスク抽出パイプラインへ |

## 実装イメージ

```typescript
import { createSlackAdapter } from 'chat/slack'

const slackAdapter = createSlackAdapter({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
})

// Hono ルート
app.post('/webhooks/slack', async (c) => {
  const event = await slackAdapter.parseAndVerify(c.req)
  await eventBridgeClient.putEvents({ event })
  return c.json({ ok: true })
})
```

## 依存サービス

- **Vercel Chat SDK（`chat` npm package）** — Slack Webhook 受信・署名検証・メッセージパース
- **Amazon EventBridge** — タスク抽出イベントの非同期転送
- **AWS Secrets Manager** — `SLACK_SIGNING_SECRET` の安全な参照

## 関連要件

- FR-01: Slack からのタスク自動抽出（Webhook 起点）
- NFR-03: セキュリティ（Slack Signing Secret による改ざん検証）

## シーケンス参照

`application-design.md` § 7.1（タスク自動抽出フロー）— Webhook 受信部分
