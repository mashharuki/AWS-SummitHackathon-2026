# BE-05: ConnectionHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-05

---

## メソッド定義

```typescript
// 連携状態一覧
GET /api/connections
Response: ServiceConnection[]

// Slack OAuth コールバック処理
POST /api/connections/slack/callback
Request:  { code: string, state: string }
Response: ServiceConnection

// Google OAuth コールバック処理（Gmail + Calendar スコープ）
POST /api/connections/google/callback
Request:  { code: string, state: string, scopes: string[] }
Response: ServiceConnection

// 連携解除
DELETE /api/connections/:service
Response: { disconnected: true }
```

## ServiceConnection 型

```typescript
interface ServiceConnection {
  userId: string
  service: 'slack' | 'gmail' | 'calendar'
  status: 'connected' | 'disconnected' | 'error'
  connectedAt?: string
  scopes?: string[]
}
```

## 依存サービス

- **DynamoDB ServiceConnections テーブル** — 連携状態の管理
- **AWS Secrets Manager** — OAuth アクセストークン・リフレッシュトークンの安全な保管
- **Slack OAuth 2.0 API** — Slack 連携フロー
- **Google OAuth 2.0 API** — Gmail / Google Calendar 連携フロー

## 関連要件

- FR-07: 外部サービス連携設定（Slack / Gmail / Google Calendar）
- NFR-03: セキュリティ（OAuth token をコードに直接保存しない）

## シーケンス参照

`application-design.md` § 7.6（外部サービス OAuth 連携設定フロー）
