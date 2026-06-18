# v3 Operations フェーズ — 実デプロイ検証・デモ準備

**対象バージョン**: v3（SABOROU MCP Serverization）  
**作成日**: 2026-06-18  
**決勝日**: 2026-06-26 @幕張メッセ  
**残り日数**: 8 日  
**前提フェーズ**: v3 Build and Test 完了（backend 437 tests / CDK 90 tests / extension 187 tests 全パス）

---

## 目的

本番 AWS 環境に v3 変更（MCP Transport Auth Adapter / Tool Registry / Slack Delegation / ElevenLabs Fallback）を反映し、決勝デモが確実に動作する状態を作る。

---

## 前提確認チェックリスト

デプロイ作業を開始する前に以下を確認すること。

### AWS 環境
- [x] `AWS_PROFILE` または `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` が設定済み（リージョン: `ap-northeast-1`）
- [x] CDK デプロイに必要な IAM 権限がある（CloudFormation / Lambda / API Gateway / DynamoDB / Secrets Manager / IAM / CloudWatch）
- [x] 既存スタック `SaborouStack` が正常稼働中

### シークレット
- [x] `SLACK_BOT_TOKEN` が Secrets Manager に登録済み
- [x] `SLACK_SIGNING_SECRET` が Secrets Manager に登録済み
- [x] ElevenLabs Agent ID が環境変数または Secrets Manager に設定済み
- [x] Cognito User Pool ID / Client ID が CDK context または環境変数に設定済み

### ローカル環境
- [x] `pnpm install` 完了済み
- [x] `node --version` が `.nvmrc` と一致している（v23）
- [x] `aws --version` が利用可能

---

## タスク一覧

| # | タスク | 目的 | 所要時間目安 |
|---|--------|------|------------|
| O-01 | CDK デプロイ実行 | v3 変更を本番環境へ反映 | 30 分 |
| O-02 | verify-* スクリプト全実行 | 実環境で全 6 スクリプトをパスさせる | 30 分 |
| O-03 | ElevenLabs Dashboard MCP 登録 | streamable_http で MCP ツール呼び出しを確認 | 30 分 |
| O-04 | デモデータリセット & E2E 動作確認 | DEMO_RUNBOOK.md のシナリオを通し確認 | 45 分 |
| O-05 | 証拠収集（evidence/ 格納） | 各検証のスクリーンショット/ログを保存 | 随時 |
| O-06 | DEMO_RUNBOOK.md 最終調整 | 実環境で気づいた差異をランブックへ反映 | 15 分 |

---

## O-01: CDK デプロイ実行

### 目的

v3 で追加・変更された CDK リソースを本番環境へ反映する。主な変更点:
- `McpToolsBaseUrl` CfnOutput 追加（U-V3-04）
- API Gateway アクセスログ・90 日保持（U-V3-01）
- MCP アラーム・AgentCore IAM スコープ（U-V3-01）

### 手順

```bash
# 1. CDK synth でエラーがないことを確認
cd /path/to/AWS-SummitHackathon-2026
pnpm --filter @saboru/cdk run synth

# 2. diff で変更内容を確認
pnpm --filter @saboru/cdk run diff

# 3. 本番デプロイ
pnpm --filter @saboru/cdk run deploy
```

または:

```bash
./scripts/deploy_all.sh
```

### 期待結果
- CloudFormation スタックが `UPDATE_COMPLETE` になる
- `McpToolsBaseUrl` output が表示される（例: `https://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod/api/mcp/tools`）

### トラブルシュート
- デプロイ失敗時は `TROUBLESHOOTING.md` の「CDK / CloudFormation」セクションを参照
- ロールバックが発生した場合は CloudFormation コンソールで Events タブを確認

---

## O-02: verify-* スクリプト全実行

### 目的

実環境に対して NFR 検証スクリプトを実行し、全て PASS であることを確認する。

### 実行手順

```bash
# ビルド・テスト検証（CI パリティ確認）
./scripts/verify-build-test.sh

# CDK synth 検証
./scripts/verify-cdk-synth.sh

# AgentCore Gateway 状態確認（デプロイ後）
AWS_REGION=ap-northeast-1 \
AGENTCORE_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayId`].OutputValue' \
  --output text) \
./scripts/verify-agentcore.sh

# MCP Auth エンドポイント検証
MCP_BASE_URL=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`McpToolsBaseUrl`].OutputValue' \
  --output text) \
./scripts/verify-mcp-auth.sh

# CloudWatch アラーム・メトリクス確認
./scripts/verify-cloudwatch.sh

# シークレットスキャン（ハードコードキーがないか確認）
./scripts/verify-secret-scan.sh
```

### 期待結果

各スクリプトで `[RESULT] PASS` が出力されること。

| スクリプト | 対応 NFR | 期待結果 |
|-----------|---------|---------|
| verify-build-test.sh | NFR-V305-R1 | 全テスト PASS |
| verify-cdk-synth.sh | NFR-V305-R2 | synth エラーゼロ |
| verify-agentcore.sh | NFR-V305-R3 | AVAILABLE 状態 |
| verify-mcp-auth.sh | NFR-V305-E4 | 認証・認可動作確認 |
| verify-cloudwatch.sh | NFR-V305-O1/O2 | アラーム INSUFFICIENT_DATA or OK |
| verify-secret-scan.sh | NFR-V305-M2 | ハードコードシークレットゼロ |

### トラブルシュート
- `verify-agentcore.sh` が FAIL する場合は `TROUBLESHOOTING.md` の「AgentCore Gateway」セクションを参照
- `verify-mcp-auth.sh` が 401 を返す場合は Cognito JWT 検証ロジックを確認（`pkgs/backend/src/middleware/cognitoAuth.ts`）

---

## O-03: ElevenLabs Dashboard MCP 登録

### 目的

ElevenLabs Conversational AI の Dashboard で SABOROU の MCP エンドポイントを Remote MCP (streamable_http) として登録し、音声ツール呼び出しを確認する。

### 必要な情報

```bash
# McpToolsBaseUrl を取得
MCP_BASE_URL=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`McpToolsBaseUrl`].OutputValue' \
  --output text)
echo "MCP Base URL: $MCP_BASE_URL"
```

### 登録手順

詳細は `docs/ELEVENLABS_MCP_SETUP.md`（または `pkgs/extension/src/panel/lib/` 配下の設定ガイド）を参照。

1. ElevenLabs Dashboard → Conversational AI → 対象 Agent を選択
2. **Tools** タブ → **Add Tool** → **MCP (Remote)**
3. **URL** に `${MCP_BASE_URL}` を入力
4. **Transport Type**: `streamable_http`（第一選択）
5. **Authentication**: Bearer Token（Cognito アクセストークン）
6. Save して Tool 一覧に `saborou_judge_sabori` / `saborou_get_tasks` / `saborou_delegate_to_claude` が表示されることを確認

### 動作確認

1. ElevenLabs Widget を開き、音声で「今日のタスクを教えて」と話しかける
2. `saborou_get_tasks` ツールが呼び出されることを確認
3. 結果が音声で返ってくることを確認

### フォールバック

streamable_http が失敗する場合:
1. Transport Type を `sse` に変更して再試行
2. それも失敗する場合は `mcpFallback.ts` の `FallbackMode` に従い `DIRECT_HONO` フォールバックへ切り替え
   - Chrome 拡張の `agentClient.ts` が自動的に Hono API を直接呼び出す設定になっている

---

## O-04: デモデータリセット & E2E 動作確認

### 目的

`DEMO_RUNBOOK.md` に記載された 15 分デモシナリオを通し確認し、問題なく実演できることを検証する。

### Step 1: デモデータリセット

```bash
AWS_REGION=ap-northeast-1 \
DEMO_USER_ID=demo-user-01 \
TASKS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`TasksTableName`].OutputValue' \
  --output text) \
PROPOSALS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ProposalsTableName`].OutputValue' \
  --output text) \
./scripts/demo-reset.sh
```

期待結果: タスク一覧が空になっていることをブラウザで確認

### Step 2: E2E シナリオ実行

`DEMO_RUNBOOK.md` の「メインデモシナリオ」に従って以下を確認:

- [ ] ElevenLabs 音声エージェントが起動する
- [ ] `saborou_judge_sabori` ツールが呼び出せる（サボり判定）
- [ ] `saborou_get_tasks` ツールが呼び出せる（タスク一覧取得）
- [ ] `saborou_delegate_to_claude` ツールが呼び出せる（Claude への委譲）
- [ ] Slack に委譲メッセージが投稿される
- [ ] Chrome 拡張が Slack DOM を正しく検出する
- [ ] Cognito PKCE 認証フローが完了する

### Step 3: フォールバック確認

意図的に Primary パスを壊してフォールバックが動くことを確認:
- streamable_http → sse への自動切り替えを確認（`mcpFallback.ts` の `getMcpFallbackMode`）
- sse 失敗時に `DIRECT_HONO` フォールバックが有効になることを確認

---

## O-05: 証拠収集（evidence/ 格納）

### 目的

デプロイ成功・検証パスの証拠を `evidence/` ディレクトリに保存する。

### 収集対象

| ディレクトリ | 収集内容 |
|------------|---------|
| `evidence/agentcore-status/` | `verify-agentcore.sh` の出力ログ |
| `evidence/mcp-auth/` | `verify-mcp-auth.sh` の HTTP レスポンス |
| `evidence/cloudwatch/` | CloudWatch アラーム・ダッシュボードのスクリーンショット |
| `evidence/demo-run/` | デモシナリオ実行のスクリーンショット |
| `evidence/elevenlabs-registration/` | ElevenLabs Dashboard 登録完了のスクリーンショット |
| `evidence/build-test/` | 全テストパスのターミナル出力 |

### 保存方法

```bash
# スクリプト出力をファイルに保存する例
./scripts/verify-agentcore.sh 2>&1 | tee evidence/agentcore-status/$(date +%Y%m%d_%H%M%S).log
```

スクリーンショットは手動で各ディレクトリに保存する（`.gitignore` で除外済み）。

---

## O-06: DEMO_RUNBOOK.md 最終調整

### 目的

実環境での確認で判明した差異や補足事項を `docs/DEMO_RUNBOOK.md` に反映し、決勝当日に使える状態にする。

### 確認・更新ポイント

- [ ] 実際の `McpToolsBaseUrl` を記載
- [ ] ElevenLabs Agent ID・Widget URL を記載（シークレット値は記載しない）
- [ ] CloudFormation スタック名・Output キーが正確か確認
- [ ] フォールバック手順が実環境で動作することを確認し、手順を更新
- [ ] デモリセット手順（`demo-reset.sh`）のパラメータを実環境に合わせて更新
- [ ] Q&A セクション（審査員への想定質問）を最新状態に更新

---

## 当日（2026-06-26）直前チェックリスト

デモ 30 分前に以下を実行:

```bash
# 1. AgentCore 状態確認
./scripts/verify-agentcore.sh

# 2. デモデータリセット
./scripts/demo-reset.sh

# 3. ElevenLabs ウォームアップ（ブラウザで音声テスト）
# → Widget を開いて「テスト」と話しかけ、応答を確認

# 4. 全 verify スクリプト（任意）
./scripts/verify-build-test.sh
./scripts/verify-mcp-auth.sh
```

- [ ] スマートフォンのマイク権限が許可されている（モバイルでデモする場合）
- [ ] ブラウザのマイク権限が許可されている
- [ ] 会場 Wi-Fi に接続済み（または LTE ホットスポット準備済み）
- [ ] バックアップ端末が手元にある

---

## 関連ドキュメント

| ドキュメント | 場所 | 内容 |
|------------|------|------|
| DEMO_RUNBOOK.md | `docs/DEMO_RUNBOOK.md` | 15 分デモ手順書・3 段フォールバック |
| TROUBLESHOOTING.md | `docs/TROUBLESHOOTING.md` | 6 サービス × トラブル事例 |
| cdk-operations.md | `aidlc-docs/operations/cdk-operations.md` | CDK 操作リファレンス |
| backend-operations.md | `aidlc-docs/operations/backend-operations.md` | バックエンド操作リファレンス |
| deploy-e2e-verification.md | `aidlc-docs/operations/deploy-e2e-verification.md` | E2E 検証手順（v2） |
| build-and-test-summary.md | `aidlc-docs/construction/build-and-test/build-and-test-summary.md` | v3 ビルド・テストサマリー |
