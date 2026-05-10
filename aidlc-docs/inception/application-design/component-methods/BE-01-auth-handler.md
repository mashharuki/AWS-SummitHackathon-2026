# BE-01: AuthHandler — コンポーネントメソッド定義

**レイヤー**: バックエンド API（apps/api）  
**インデックス**: [component-methods/README.md](./README.md)  
**関連コンポーネント定義**: [components.md](../components.md) § BE-01

---

## メソッド定義

```typescript
// Hono ミドルウェア: JWT 検証
authMiddleware(c: Context, next: Next): Promise<void>
// Returns: userId を c.set('userId', userId) で注入

// トークン交換（Cognito code → JWT）
POST /api/auth/exchange-token
Request:  { code: string, redirectUri: string }
Response: { accessToken: string, idToken: string, expiresIn: number }
```

## 依存サービス

- **Amazon Cognito** — JWT 検証 / Google IdP 経由の認証
- **aws-jwt-verify** — トークン署名検証ライブラリ

## 関連要件

- FR-07: ユーザー認証（Google OAuth 2.0 / Cognito）
- NFR-03: セキュリティ（JWT 有効期限管理）

## シーケンス参照

`application-design.md` § 7.5（認証フロー）/ § 7.6（外部サービス OAuth 連携）
