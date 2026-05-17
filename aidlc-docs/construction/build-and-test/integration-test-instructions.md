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
