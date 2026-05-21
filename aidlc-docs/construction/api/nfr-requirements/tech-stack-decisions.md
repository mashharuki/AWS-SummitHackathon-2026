# 技術スタック決定 — U-04: api

**Unit**: U-04: api
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 採用技術と選定理由

| 技術 | バージョン | 選定理由 | 却下した代替案 |
|------|-----------|---------|--------------|
| Hono | 4.x | Lambda 最適化・軽量・pkgs/backend に既存設定 | Express.js（重い・Lambda 非最適）|
| hono/aws-lambda | Hono 同梱 | API Gateway HTTP API との統合が最も簡潔 | aws-serverless-express（廃止間近）|
| hono/streaming | Hono 同梱 | streamSSE で SSE を宣言的に実装 | 手動レスポンスストリーム |
| Zod | 3.x | pkgs/shared と型共有・@hono/zod-validator との親和性 | Yup（TypeScript 型推論が弱い）|
| @hono/zod-validator | 最新 | Zod + Hono の公式連携ミドルウェア | 手動 parse |
| Vitest | 4.x | pkgs/backend に既存設定・app.request() との相性 | Jest（ESM 対応が複雑）|
| esbuild | 0.21.x | 既存ビルドスクリプトを活用 | webpack（設定複雑）|
| @aws-sdk/client-dynamodb v3 | pkgs/agent と同一 | モジュール分割・ツリーシェイキング対応 | AWS SDK v2（廃止予定）|
| @aws-sdk/client-eventbridge | v3 | Webhook→EventBridge 転送 | SNS（EventBridge の方が後段ルーティング柔軟）|
| crypto（Node.js 組み込み） | Node.js 22 | Slack HMAC 検証のみで十分 | @slack/web-api（重い・不要機能多い）|

## パッケージ追加方針

既存 pkgs/backend の `package.json` に以下を追加する（pnpm workspace 経由）:

```json
{
  "dependencies": {
    "@hono/zod-validator": "^0.4.x",
    "zod": "^3.x",
    "@aws-sdk/client-dynamodb": "^3.x",
    "@aws-sdk/lib-dynamodb": "^3.x",
    "@aws-sdk/client-eventbridge": "^3.x",
    "@aws-sdk/client-secrets-manager": "^3.x",
    "ulid": "^2.x"
  }
}
```

**注意**: `pkgs/shared` と `pkgs/agent` への workspace 参照は pnpm workspace protocol を使用:
```json
{
  "dependencies": {
    "@saboru/shared": "workspace:*",
    "@saboru/agent": "workspace:*"
  }
}
```
