# 統合テスト手順書

## 概要

Unit間の連携を確認する統合テスト手順。各Unitのモックベーステストで検証している範囲と、
実環境での手動確認手順を記載する。

---

## 統合ポイントの全体像

```
Slack Webhook
     │
     ▼
[U-04: backend/webhook] ──EventBridge──► [U-03a: agent/task-extractor]
                                                │
                                                ▼
                                         [DynamoDB: task-candidates]
                                                │
                                                ▼ Slack message
                                         [User approval]
                                                │
[U-05: frontend/web] ──REST API──► [U-04: backend/api]
                                         │         │
                                         ▼         ▼
                                   [DynamoDB]  [U-03b: agent/sabori-proposer]
                                                    │
                                                    ▼
                                            [Bedrock Claude]
                                                    │
                                                    ▼
                                         [SSE stream to frontend]
```

---

## Unit間統合テスト

### 1. shared ↔ agent 統合

**検証内容**: @saboru/shared の型・スキーマが @saboru/agent で正しく使用されている

```bash
# shared ビルド後に agent テストを実行
pnpm --filter @saboru/shared build
pnpm --filter @saboru/agent test
```

合格基準: agent の 128テストが全パス

---

### 2. shared ↔ backend 統合

**検証内容**: @saboru/shared の型・スキーマが backend で正しく使用されている

```bash
pnpm --filter @saboru/shared build
pnpm --filter backend test
```

合格基準: backend の 173テストが全パス

---

### 3. backend ↔ agent 統合（モックベース）

backend の proposals ルートは @saboru/agent の SaboriProposerAgent を呼び出す。
モックで検証済み（`pkgs/backend/src/__tests__/routes/proposals.test.ts`）。

実環境確認手順（ローカル）:
```bash
# 1. ローカル DynamoDB を起動（Docker）
docker run -p 8000:8000 amazon/dynamodb-local

# 2. テーブル作成
aws dynamodb create-table \
  --table-name saborou-tasks-dev \
  --attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
  --key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000

# 3. バックエンド起動
AWS_REGION=ap-northeast-1 \
DYNAMODB_TABLE_TASKS=saborou-tasks-dev \
COGNITO_USER_POOL_ID=ap-northeast-1_dummy \
pnpm --filter backend dev

# 4. API 疎通確認
curl -s http://localhost:3000/health
```

---

### 4. frontend ↔ backend 統合（E2E テスト）

```bash
# 1. フロントエンド dev サーバーを起動
pnpm --filter frontend dev &

# 2. E2E テスト実行
cd pkgs/frontend && PLAYWRIGHT_BASE_URL=http://localhost:5173 npx playwright test --project=chromium
```

合格基準: 5テストが全パス（ログインページ表示・リダイレクト・アクセシビリティ）

---

### 5. CDK スタック間統合

CDK の各スタックは Props 経由でリソースを共有する。

```bash
cd pkgs/cdk && npx cdk synth
```

確認項目:
- `Errors=0` — 構文エラーなし
- cdk-nag 全ルール準拠
- スタック間のクロスリファレンス（ARN注入）が正しく解決されている

---

## Slack Webhook → DynamoDB フロー確認（手動）

本フローは AWS 上の実環境が必要なため、以下の手順で確認する。

```bash
# Slack からの Webhook を模擬
curl -X POST http://localhost:3000/slack/events \
  -H "Content-Type: application/json" \
  -H "X-Slack-Request-Timestamp: $(date +%s)" \
  -H "X-Slack-Signature: v0=dummy" \
  -d '{
    "type": "event_callback",
    "event": {
      "type": "message",
      "text": "明日の会議の資料を作成してください",
      "user": "U12345678",
      "ts": "1234567890.123456",
      "channel": "C12345678"
    }
  }'
```

期待動作:
1. Webhook 受信 → EventBridge へ Publish
2. EventBridge → TaskExtractor Lambda トリガー
3. Bedrock でタスク判定
4. DynamoDB に task-candidates 保存
5. Slack へ確認メッセージ送信

---

## SSE ストリーミング確認（手動）

```bash
# サボろうかどうか判定リクエスト
curl -N -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/tasks/{taskId}/proposals/stream"
```

期待動作:
1. `event: reasoning_item` イベントが順次ストリーミング
2. `event: verdict` で判定結果（can_saboru / borderline / must_do）
3. `event: chat_message_chunk` でペルソナメッセージ
4. `event: complete` で終了

---

## 統合テスト合格基準まとめ

| 統合ポイント | テスト方法 | 合格基準 |
|------------|---------|--------|
| shared ↔ agent | 自動（vitest） | 128テスト全パス |
| shared ↔ backend | 自動（vitest） | 173テスト全パス |
| backend ↔ agent | モック（vitest） | proposals.test.ts 全パス |
| frontend ↔ backend | E2E（Playwright） | 5テスト全パス |
| CDK スタック間 | cdk synth | Errors=0 |
| Slack → DynamoDB | 手動（実環境） | 要 AWS 環境 |
| SSE ストリーミング | 手動（実環境） | 要 AWS 環境 |

---

---

# v3 統合テスト手順（MCP Serverization — 2026-06-18）

## v3 統合ポイントの全体像

```
ElevenLabs Agent
    │ (streamable_http または SSE)
    ▼
[AgentCore Gateway] ──IAM Auth──► [MCP Adapter /api/mcp/tools/{toolName}]
                                           │
                          ┌────────────────┼─────────────────┐
                          ▼                ▼                 ▼
                   [Identity Resolver] [Tool Registry]  [Precheck]
                          │                │                 │
                          └────────────────┴─────────────────┘
                                           │
                              Cognito JWT 認証維持 ◄── [既存 Hono JWT routes]
                                           │
                                           ▼
                              [既存バックエンドルート]
                                    │           │
                              [DynamoDB]   [Slack API]
                                                │
                                       (@Claude 委譲の場合)
                                                ▼
                                      [Slack #task-channel]
                                         Claude @mention
```

---

## v3 Unit 間統合テスト

### v3-1. U-V3-01 ↔ U-V3-02: MCP アダプタ ↔ ツールレジストリ統合

**検証内容**: `/api/mcp/tools/{toolName}` が allowlist 外ツール呼び出しを拒否すること

```bash
# backend の MCP 関連テストを実行
pnpm --filter backend test -- --testPathPattern="mcp|registry"
```

合格基準: MCP テスト全パス（precheck が allowlist 外で 403 を返す）

---

### v3-2. U-V3-01 ↔ U-V3-03: MCP アダプタ ↔ Slack 委譲統合

**検証内容**: `saborou_delegate_to_claude` が approval metadata なしで Slack 投稿しないこと

```bash
pnpm --filter backend test -- --testPathPattern="slackDelegation"
```

合格基準: approval なし呼び出しが 400/403 を返すこと

---

### v3-3. U-V3-04 ↔ U-V3-01: ElevenLabs フォールバック ↔ MCP アダプタ統合

**検証内容**: mcpFallback.ts が適切な FallbackMode を検出し、直接 Hono API を呼び出すこと

```bash
pnpm --filter extension test -- --testPathPattern="mcpFallback|agentClient"
```

合格基準: mcpFallback テスト 15件 + agentClient テスト 6件 全パス

---

### v3-4. CDK スタック間統合（v3 追加リソース）

```bash
cd pkgs/cdk && npx cdk synth
bash scripts/verify-cdk-synth.sh
```

確認項目:
- `McpToolsBaseUrl` CfnOutput が API スタック出力に存在すること
- `McpCallsMetricFilter` と `McpUnauthorizedAlarm` が API スタックに存在すること
- AgentCore Gateway ターゲット設定が agent スタックに存在すること

---

### v3-5. AgentCore Gateway 統合（実環境 — 手動）

前提: CDK デプロイ完了、AgentCore Gateway ARN 取得済み

```bash
# AgentCore Gateway の状態確認
bash scripts/verify-agentcore.sh
```

期待される出力:
```
[PASS] AgentCore Gateway: ACTIVE
[PASS] GatewayTarget: ACTIVE
[INFO] McpToolsBaseUrl: https://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod
```

---

### v3-6. MCP 認証フロー統合（実環境 — 手動）

前提: Cognito ユーザープール・クライアント ID 設定済み

```bash
bash scripts/verify-mcp-auth.sh
```

期待される動作:
1. IAM 認証のみのリクエスト → 401 拒否（userId 解決不可）
2. Cognito JWT 付きリクエスト → 200 成功
3. allowlist 外ツール名 → 403 拒否

---

### v3-7. ElevenLabs MCP 統合（実環境 — 手動）

前提: ElevenLabs Dashboard でエージェントに MCP サーバー登録済み（ELEVENLABS_MCP_SETUP.md 参照）

検証シナリオ:
1. ElevenLabs 音声エージェントに「今日のタスクを教えて」と話しかける
2. エージェントが AgentCore → MCP Adapter 経由で `saborou_get_tasks` を呼び出す
3. タスク一覧が音声で返却される

証拠: `evidence/elevenlabs-mcp/` にスクリーンショットまたはログを保存

---

### v3-8. Slack @Claude 委譲統合（実環境 — 手動）

前提: Slack Bot Token が Secrets Manager に登録済み、テストチャンネルが存在する

検証シナリオ:
1. MCP 経由または UI で `saborou_delegate_to_claude` を approval metadata 付きで呼び出す
2. Slack テストチャンネルに @claude メンション付きタスク委譲メッセージが投稿される
3. メッセージにタスクタイトル・背景・期待成果物・制約が含まれること

証拠: `evidence/slack-delegation/` にスクリーンショットを保存

---

### v3-9. CloudWatch ログ・アラーム統合（実環境 — 手動）

```bash
bash scripts/verify-cloudwatch.sh
```

確認項目:
- API Gateway アクセスログに MCP 呼び出しのエントリが存在すること
- `McpCallsMetricFilter` が呼び出し件数をカウントしていること
- 404 テストリクエストに対して `McpUnauthorizedAlarm` が ALARM 状態になること（閾値設定確認）

---

## v3 統合テスト合格基準まとめ

| 統合ポイント | テスト方法 | 合格基準 |
|------------|---------|--------|
| MCP アダプタ ↔ ツールレジストリ | 自動（vitest） | backend 437テスト全パス |
| MCP アダプタ ↔ Slack 委譲 | 自動（vitest） | slackDelegation テスト全パス |
| ElevenLabs フォールバック ↔ MCP | 自動（vitest） | extension 187テスト全パス |
| CDK v3 スタック間 | cdk synth / verify-cdk-synth.sh | Errors=0 + 全出力値存在 |
| AgentCore Gateway 疎通 | 手動（verify-agentcore.sh） | ACTIVE status 確認 |
| MCP 認証フロー | 手動（verify-mcp-auth.sh） | 認証なし拒否 + 認証あり成功 |
| ElevenLabs 音声 MCP 呼び出し | 手動（ELEVENLABS_MCP_SETUP.md） | タスク取得成功 + 証拠保存 |
| Slack @Claude 委譲 | 手動（DEMO_RUNBOOK.md） | 委譲メッセージ投稿 + 証拠保存 |
| CloudWatch ログ・アラーム | 手動（verify-cloudwatch.sh） | ログ存在 + アラーム設定確認 |
