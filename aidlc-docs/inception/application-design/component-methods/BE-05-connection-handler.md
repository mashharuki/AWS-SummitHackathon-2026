# BE-05: ConnectionHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-05

> **v1.0.0 スコープ**: 外部サービス連携は Slack のみ。
> v1.1.0 以降で Google OAuth（Gmail / Calendar スコープ）を追加予定。

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

// 連携解除
DELETE /api/connections/:service
Response: { disconnected: true }
```

## ServiceConnection 型

```typescript
interface ServiceConnection {
  userId: string
  service: 'slack'  // v1.0.0 は Slack のみ
  status: 'connected' | 'disconnected' | 'error'
  connectedAt?: string
}
```

## 依存サービス

- **DynamoDB ServiceConnections テーブル** — 連携状態の管理
- **AWS Secrets Manager** — OAuth アクセストークン・リフレッシュトークンの安全な保管
- **Slack OAuth 2.0 API** — Slack 連携フロー

> **将来拡張（v1.1.0 以降）**: Google OAuth 2.0 API（Gmail / Google Calendar スコープ）を追加予定。
> `POST /api/connections/google/callback` エンドポイントは v1.1.0 で実装する。

## 関連要件

- FR-07: 外部サービス連携設定（Slack — v1.0.0 MVP）
- NFR-03: セキュリティ（OAuth token をコードに直接保存しない）

## シーケンス参照

`application-design.md` § 7.6（外部サービス OAuth 連携設定フロー）
