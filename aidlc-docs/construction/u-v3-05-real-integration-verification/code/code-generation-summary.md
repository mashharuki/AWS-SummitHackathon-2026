# U-V3-05 Code Generation サマリー

**Unit**: U-V3-05: real-integration-verification
**生成日**: 2026-06-17
**ステージ**: Code Generation Part 2（実装完了）

---

## 生成ファイル一覧

| ファイルパス | 用途 | 対応 NFR | 優先度 |
|------------|------|---------|--------|
| `scripts/verify-build-test.sh` | 全パッケージ tsc + テスト検証 | NFR-V305-R1 | Critical |
| `scripts/verify-cdk-synth.sh` | CDK synth 成功・cdk-nag Error ゼロ確認 | NFR-V305-R2 | Critical |
| `scripts/verify-agentcore.sh` | AgentCore Gateway AVAILABLE 確認 | NFR-V305-R3 | High |
| `scripts/verify-mcp-auth.sh` | 認証付き 200 / 認証なし 401 確認 | NFR-V305-E4 | Critical |
| `scripts/verify-cloudwatch.sh` | CloudWatch tool-call ログ + トークン漏洩スキャン | NFR-V305-O1, O2 | High, Critical |
| `scripts/verify-secret-scan.sh` | ソースコード内シークレットスキャン (CI ゲート) | NFR-V305-M2 | Critical |
| `scripts/demo-reset.sh` | DynamoDB デモデータ削除 | NFR-V305-A2 | High |
| `evidence/README.md` | NFR ID ↔ 証拠ファイル対応インデックス | 全 NFR | - |
| `evidence/R1-build-test/.gitkeep` 〜 `evidence/A2-demo-reset/.gitkeep` | 証拠ストア構造保持 (13 ディレクトリ) | 全 NFR | - |
| `TROUBLESHOOTING.md` | 6 サービス × 3+ シナリオのトラブル対応マトリクス | NFR-V305-M1 | High |
| `DEMO_RUNBOOK.md` | 15分デモ手順書 + 3段フォールバック + Q&A準備 | NFR-V305-R4, A2 | High |
| `.gitignore` | `evidence/**/*.png` 等の画像を除外追記 | NFR-V305-M2 補助 | - |
| `package.json` | `verify` / `verify:secrets` / `verify:build` スクリプト追加 | NFR-V305-M2, R1 | Critical |

---

## 実行方法

### 前提条件

- Node.js 22+ / pnpm 10.33.0 以上
- AWS CLI v2 設定済み（`aws configure` or `AWS_PROFILE`）
- jq, python3 がインストール済み

### 環境変数一覧

| 環境変数 | 必須スクリプト | 取得方法 |
|---------|--------------|---------|
| `AWS_REGION` | verify-agentcore, verify-cloudwatch, demo-reset | `ap-northeast-1` (固定) |
| `AGENTCORE_GATEWAY_ID` | verify-agentcore | `aws cloudformation describe-stacks --stack-name SaborouStack --query 'Stacks[0].Outputs[?OutputKey==\`AgentCoreGatewayId\`].OutputValue' --output text` |
| `API_ENDPOINT` | verify-mcp-auth | `aws cloudformation describe-stacks --stack-name SaborouStack --query 'Stacks[0].Outputs[?OutputKey==\`ApiEndpoint\`].OutputValue' --output text` |
| `COGNITO_TOKEN` | verify-mcp-auth | `aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=...,PASSWORD=... --client-id <ClientId> --query 'AuthenticationResult.AccessToken' --output text` |
| `LOG_GROUP_NAME` | verify-cloudwatch | `aws cloudformation describe-stacks --stack-name SaborouStack --query 'Stacks[0].Outputs[?OutputKey==\`McpLogGroupName\`].OutputValue' --output text` |
| `DEMO_USER_ID` | demo-reset | `demo-user-01`（固定のデモ用ユーザーID） |
| `TASKS_TABLE` | demo-reset | CloudFormation Output `TasksTableName` |
| `PROPOSALS_TABLE` | demo-reset | CloudFormation Output `ProposalsTableName` |

### 推奨実行順序

```bash
# === CI ゲート（PR 時必須） ===
# 1. シークレットスキャン
./scripts/verify-secret-scan.sh

# 2. 全パッケージビルド・テスト
./scripts/verify-build-test.sh

# または一括実行
pnpm run verify

# === デプロイ後確認 ===
# 3. CDK synth 確認
AWS_PROFILE=myprofile ./scripts/verify-cdk-synth.sh

# 4. AgentCore 疎通確認
AWS_REGION=ap-northeast-1 AGENTCORE_GATEWAY_ID=<id> \
./scripts/verify-agentcore.sh

# 5. MCP 認証テスト（デプロイ後、Cognito トークン取得後）
API_ENDPOINT=https://xxx COGNITO_TOKEN=eyJ... \
./scripts/verify-mcp-auth.sh

# === デモ当日（30分前） ===
# 6. デモデータリセット
AWS_REGION=ap-northeast-1 DEMO_USER_ID=demo-user-01 \
TASKS_TABLE=saborou-tasks-prod PROPOSALS_TABLE=saborou-proposals-prod \
./scripts/demo-reset.sh

# 7. CloudWatch 監査確認（デモ実行後）
AWS_REGION=ap-northeast-1 LOG_GROUP_NAME=/aws/lambda/saborou-mcp \
./scripts/verify-cloudwatch.sh
```

---

## 証拠ストアの使い方

スクリプトを実行すると `evidence/` ディレクトリ配下に証拠ファイルが自動保存されます。

```
evidence/
├── R1-build-test/           ← verify-build-test.sh の出力ログ
├── R2-cdk-synth/            ← verify-cdk-synth.sh の出力ログ
├── R3-agentcore-status/     ← verify-agentcore.sh の出力
├── R4-fallback/             ← フォールバック実施記録（手動）
├── O1-cloudwatch-logs/      ← CloudWatch Insights クエリ結果
├── O2-error-log-scan/       ← シークレットスキャン結果
├── O3-elevenlabs-dashboard/ ← ElevenLabs ダッシュボードのスクショ（手動）
├── E1-get-tasks-e2e/        ← saborou_get_tasks デモスクショ（手動）
├── E2-slack-reply/          ← Slack 返信デモスクショ（手動）
├── E3-delegate-to-claude/   ← Claude 委譲デモスクショ（手動）
├── E4-unauth-reject/        ← verify-mcp-auth.sh の出力
├── A1-load-test/            ← k6 テスト結果（手動）
└── A2-demo-reset/           ← demo-reset.sh の実行ログ
```

詳細は `evidence/README.md` を参照。

---

## 注意事項

### シークレット管理

- **全スクリプトにシークレットをハードコード禁止**
- シークレットは必ず環境変数または AWS Secrets Manager 経由で参照する
- `verify-secret-scan.sh` が CI ゲートとして PR チェックで実行される
- `.env` ファイルは `.gitignore` で除外済み

### 実行順序

1. `verify-secret-scan.sh` → `verify-build-test.sh` の順で CI を実行する
2. デプロイ後は `verify-agentcore.sh` → `verify-mcp-auth.sh` の順で確認する
3. デモ当日は必ず `demo-reset.sh` でデータリセット後にデモを開始する

### フォールバック

デモ失敗時は `DEMO_RUNBOOK.md` の「フォールバック A / B」を参照すること。
30 秒以内の切り替えを目標としている。

---

## ストーリートレーサビリティ

| ステップ | 対応 NFR | 優先度 | 完了 |
|---------|---------|--------|------|
| Step 1 (verify-build-test.sh) | NFR-V305-R1 | Critical | 完了 |
| Step 2 (verify-cdk-synth.sh) | NFR-V305-R2 | Critical | 完了 |
| Step 3 (verify-agentcore.sh) | NFR-V305-R3 | High | 完了 |
| Step 4 (verify-mcp-auth.sh) | NFR-V305-E4 | Critical | 完了 |
| Step 5 (verify-cloudwatch.sh) | NFR-V305-O1, O2 | High, Critical | 完了 |
| Step 6 (verify-secret-scan.sh) | NFR-V305-M2 | Critical | 完了 |
| Step 7 (demo-reset.sh) | NFR-V305-A2 | High | 完了 |
| Step 8 (Evidence Store) | 全 NFR | All | 完了 |
| Step 9 (TROUBLESHOOTING.md) | NFR-V305-M1 | High | 完了 |
| Step 10 (DEMO_RUNBOOK.md) | NFR-V305-R4, A2 | High | 完了 |
| Step 11 (.gitignore) | NFR-V305-M2 補助 | - | 完了 |
| Step 12 (package.json verify) | NFR-V305-M2, R1 | Critical | 完了 |
| Step 13 (code-generation-summary) | ドキュメント | - | 完了 |
