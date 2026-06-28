# ビルド手順書

## 概要

SABOROUモノレポ（pnpm@10.33.0 / Node v23 / Biome 1.9.4）の全パッケージビルド手順。
パッケージは依存順に以下の順序でビルドする。

---

## 前提条件

- Node.js v23 以上
- pnpm v10.33.0 以上
- AWS CLI（CDK synth の場合）

---

## ステップ 1: 依存関係インストール

```bash
# ワークスペースルートで実行
pnpm install
```

正常終了後に表示される出力:
```
Done in Xms using pnpm v10.33.0
```

---

## ステップ 2: 共有ライブラリ（@saboru/shared）ビルド

他のパッケージが依存するため、最初にビルドする。

```bash
pnpm --filter @saboru/shared build
```

成果物:
- `pkgs/shared/dist/index.js` (ESM)
- `pkgs/shared/dist/index.cjs` (CJS)
- `pkgs/shared/dist/index.d.ts` (型定義)
- サブエントリ: `types/`, `utils/`, `errors/`

---

## ステップ 3: エージェントパッケージ（@saboru/agent）ビルド

@saboru/shared に依存するため、Step 2 の後に実行する。

```bash
pnpm --filter @saboru/agent build
```

成果物:
- `pkgs/agent/dist/index.js` (ESM)
- `pkgs/agent/dist/task-extractor/TaskExtractorLambdaHandler.js`
- `pkgs/agent/dist/sabori-proposer/SaboriProposerLambdaHandler.js`

---

## ステップ 4: バックエンド（backend）ビルド

@saboru/shared と @saboru/agent に依存するため、Step 2-3 の後に実行する。

```bash
pnpm --filter backend build
```

内部処理:
1. `build:clean` — dist/ を削除
2. `build:api` — esbuild で src/handler.ts をバンドル（286.7kb）
3. `build:webhook` — esbuild で src/webhook-handler.ts をバンドル（76.7kb）

成果物:
- `pkgs/backend/dist/index.js` — API Lambda ハンドラ
- `pkgs/backend/dist/webhook.js` — Webhook Lambda ハンドラ

---

## ステップ 5: フロントエンド（frontend）ビルド

```bash
pnpm --filter frontend build
```

内部処理:
1. `tsc -b` — TypeScript 型チェック
2. `vite build` — プロダクションバンドル生成

成果物: `pkgs/frontend/dist/`

注意: three-vendor チャンク（822.82kb）がチャンクサイズ警告を出すが、
これは Three.js の性質上許容範囲内（gzip 後 217.87kb）。

---

## ステップ 6: CDK（cdk）ビルド

```bash
cd pkgs/cdk && npm run build
# または
pnpm --filter cdk build
```

内部処理: `tsc` — TypeScript を JavaScript にコンパイル

成果物: `pkgs/cdk/` 配下の各 `.js` ファイル

---

## ステップ 7: CDK synth（任意 — デプロイ前確認用）

```bash
cd pkgs/cdk && npx cdk synth
```

正常終了時: `Errors=0`、cdk-nag 全ルール準拠確認

---

## 全パッケージ一括ビルド

```bash
# 依存順序を考慮した一括ビルド
pnpm --filter @saboru/shared build && \
pnpm --filter @saboru/agent build && \
pnpm --filter backend build && \
pnpm --filter frontend build && \
cd pkgs/cdk && npm run build
```

---

## Biome フォーマットチェック

```bash
# チェックのみ（修正なし）
pnpm run biome:format:check

# 自動修正
pnpm run biome:format
```

---

## 型チェック

```bash
# shared
pnpm --filter @saboru/shared exec tsc --noEmit

# agent
pnpm --filter @saboru/agent exec tsc --noEmit

# backend
pnpm --filter backend typecheck

# frontend
pnpm --filter frontend typecheck

# cdk（build と同義）
cd pkgs/cdk && npm run build
```

---

---

# v3 追加ビルド手順（MCP Serverization — 2026-06-18）

## v3 追加パッケージ・変更概要

| パッケージ | v3 追加内容 |
|-----------|------------|
| `pkgs/backend` | MCP アダプタルート（`/api/mcp/tools/{toolName}`）/ MCPレジストリ / Slack委譲エンドポイント |
| `pkgs/cdk` | API Gateway アクセスログ / CloudWatch アラーム / AgentCore IAM スコープ / McpToolsBaseUrl CfnOutput |
| `pkgs/extension` | mcpFallback.ts / agentClient.ts 更新 |
| `pkgs/agent` | SlackDelegationService 追加 |

## v3 ビルド前提条件

- 既存の v1/v2 ビルド前提条件に加え:
- `COGNITO_USER_POOL_ID`、`COGNITO_CLIENT_ID`、`AGENTCORE_GATEWAY_ARN`（CDK デプロイ後に取得）
- `SLACK_BOT_TOKEN` を AWS Secrets Manager に登録済み

## v3 ビルドステップ

### v3-1. 依存関係確認（v3 追加 npm パッケージ）

v3 では新規 npm パッケージ追加はなし。既存の pnpm install で完結する。

```bash
pnpm install
```

### v3-2. backend（MCP アダプタ含む）ビルド

```bash
pnpm --filter backend build
```

期待される成果物:
- `pkgs/backend/dist/index.js` — MCP アダプタルート含む API Lambda ハンドラ
- `pkgs/backend/dist/webhook.js` — Webhook Lambda ハンドラ（変更なし）

### v3-3. CDK（MCP ログ・アラーム含む）ビルド

```bash
cd pkgs/cdk && npm run build
```

v3 で追加された CDK construct:
- `McpCallsMetricFilter` — `/api/mcp/tools/` 呼び出しメトリクスフィルタ
- `McpUnauthorizedAlarm` — MCP 401/403 異常アラーム
- `AgentCoreTargetPolicy` — AgentCore 向け最小権限 IAM Policy
- `McpToolsBaseUrl CfnOutput` — ElevenLabs Dashboard 登録用 URL 出力

### v3-4. CDK synth 検証

```bash
cd pkgs/cdk && npx cdk synth
```

期待される出力:
- `Errors=0`
- `cdk-nag` 全ルール準拠確認
- `McpToolsBaseUrl` が出力に含まれること

### v3-5. extension（mcpFallback 含む）ビルド

```bash
pnpm --filter extension build
```

期待される成果物:
- `pkgs/extension/dist/` 配下の完全な Chrome 拡張機能ファイル群
- `mcpFallback.js` がバンドルに含まれること

### v3-6. 検証スクリプト（scripts/ 配下）実行権確認

v3 で追加されたシェルスクリプトの実行権限を確認する:

```bash
ls -la scripts/verify-*.sh scripts/demo-reset.sh
# 期待: 全スクリプトに x 権限が付与されていること
# -rwxr-xr-x verify-build-test.sh
# -rwxr-xr-x verify-cdk-synth.sh
# -rwxr-xr-x verify-agentcore.sh
# -rwxr-xr-x verify-mcp-auth.sh
# -rwxr-xr-x verify-cloudwatch.sh
# -rwxr-xr-x verify-secret-scan.sh
# -rwxr-xr-x demo-reset.sh
```

権限が不足している場合:
```bash
chmod +x scripts/verify-*.sh scripts/demo-reset.sh
```

### v3-7. 一括ビルド（v3 完全版）

```bash
pnpm install && \
pnpm --filter @saboru/shared build && \
pnpm --filter @saboru/agent build && \
pnpm --filter backend build && \
pnpm --filter frontend build && \
pnpm --filter extension build && \
cd pkgs/cdk && npm run build && npx cdk synth
```

全工程で `Errors=0` / exit code 0 が期待値。

## v3 ビルドトラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| MCP アダプタルートで型エラー | `McpInvocationRequest` 型定義の不一致 | `pkgs/backend/src/mcp/mcpTypes.ts` を確認 |
| CDK synth で `McpToolsBaseUrl` が未解決 | `api-stack.ts` の CfnOutput 定義漏れ | U-V3-04 Infrastructure Design 成果物を確認 |
| extension ビルドで `mcpFallback` が未解決 | `pkgs/extension/src/lib/agentClient.ts` の import エラー | `pkgs/extension/src/lib/mcpFallback.ts` の存在確認 |
| CDK build で AgentCore IAM エラー | `AgentCoreGatewayArn` 環境変数未設定 | cdk.ts の enableAgentCore フラグを確認 |
