# U-V3-05 Code Generation 計画

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**ステージ**: Code Generation Part 1（計画）

---

## Unit コンテキスト

### 目的
U-V3-01〜04 で実装した全コンポーネントが実際の AWS 環境・AgentCore・ElevenLabs・Slack 上で
正常に動作することを証明し、決勝デモに備えた検証スクリプト・手順書を生成する。

### 実装するストーリー
- NFR-V305-R1: 全パッケージビルド・テスト通過（Critical）
- NFR-V305-R2: CDK synth 成功（Critical）
- NFR-V305-R3: AgentCore Gateway 疎通確認（High）
- NFR-V305-R4: フォールバックパス稼働確認（High）
- NFR-V305-O1: CloudWatch MCP tool-call 監査確認（High）
- NFR-V305-O2: エラーログのトークン漏洩スキャン（Critical）
- NFR-V305-O3: ElevenLabs Dashboard 登録確認（High）
- NFR-V305-E1〜E4: E2E 検証証拠（Critical/High）
- NFR-V305-A1〜A2: デモ可用性（Medium/High）
- NFR-V305-M1〜M2: 保守性（High/Critical）

### 依存関係
- U-V3-01: mcp-transport-auth-adapter（検証対象）
- U-V3-02: mcp-tool-registry-schema（検証対象）
- U-V3-03: slack-claude-delegation（検証対象）
- U-V3-04: elevenlabs-registration-fallback（検証対象）

### 成果物の配置先
- `scripts/verify-*.sh`（ワークスペースルート `scripts/` ディレクトリ）
- `scripts/demo-reset.sh`（ワークスペースルート `scripts/` ディレクトリ）
- `aidlc-docs/construction/u-v3-05-real-integration-verification/evidence/`（証拠ストア）
- `aidlc-docs/construction/u-v3-05-real-integration-verification/TROUBLESHOOTING.md`
- `aidlc-docs/construction/u-v3-05-real-integration-verification/DEMO_RUNBOOK.md`
- `package.json`（root: `verify` スクリプト追加）
- `.gitignore`（`evidence/**/*.png` 追加）
- `aidlc-docs/construction/u-v3-05-real-integration-verification/code/code-generation-summary.md`

---

## 生成ステップ

### Step 1: verify-build-test.sh — 全パッケージビルド・テスト検証スクリプト

- [x] **対象ファイル**: `scripts/verify-build-test.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-R1（Critical）
- [x] **内容**:
  - `pnpm --filter @saboru/backend test` 実行とパス確認
  - `pnpm --filter @saborou/cdk test` 実行とパス確認
  - `pnpm --filter frontend test` 実行とパス確認
  - `pnpm --filter @saboru/agent test` 実行とパス確認
  - `pnpm --filter @saboru/shared test` 実行とパス確認
  - 各パッケージの `tsc --noEmit` でゼロエラー確認
  - 結果を `evidence/R1-build-test/*.log` に保存
- [x] **セキュリティ**: シークレット不要。環境変数なし。
- [x] 実行権限を付与（`chmod +x`）

---

### Step 2: verify-cdk-synth.sh — CDK synth 検証スクリプト

- [x] **対象ファイル**: `scripts/verify-cdk-synth.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-R2（Critical）
- [x] **内容**:
  - `pnpm --filter @saborou/cdk synth` 実行
  - `Errors=0` であることを確認
  - cdk-nag の Error がゼロであることを確認
  - 出力を `evidence/R2-cdk-synth/synth-output.log` に保存
- [x] **セキュリティ**: AWS 認証情報は環境変数（`AWS_PROFILE` or `AWS_ACCESS_KEY_ID`）経由
- [x] 実行権限を付与

---

### Step 3: verify-agentcore.sh — AgentCore Gateway 疎通確認スクリプト

- [x] **対象ファイル**: `scripts/verify-agentcore.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-R3（High）
- [x] **内容**:
  - 必須環境変数チェック: `AWS_REGION`, `AGENTCORE_GATEWAY_ID`
  - `aws bedrock-agent-runtime list-agent-action-groups` または
    `aws bedrock-agent get-agent` でステータス取得
  - ステータスが `AVAILABLE` であることを確認
  - 出力を `evidence/R3-agentcore-status/agentcore-status.txt` に保存
- [x] **セキュリティ**: `AGENTCORE_GATEWAY_ID` は CDK output から取得（コメントで誘導）
- [x] 実行権限を付与

---

### Step 4: verify-mcp-auth.sh — MCP 認証・未認証テストスクリプト

- [x] **対象ファイル**: `scripts/verify-mcp-auth.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-E4（Critical: Security Baseline SECURITY-02）
- [x] **内容**:
  - 必須環境変数チェック: `API_ENDPOINT`, `COGNITO_TOKEN`
  - 認証付きリクエスト → 200 を確認（saborou_get_tasks）
  - 認証なしリクエスト → 401 を確認（NFR-V305-E4）
  - 両テスト結果を `evidence/E4-unauth-reject/curl-reject-log.txt` に保存
- [x] **セキュリティ**: `COGNITO_TOKEN` 取得方法をコメントで誘導（ハードコード禁止）
- [x] 実行権限を付与

---

### Step 5: verify-cloudwatch.sh — CloudWatch Logs 監査ログ確認スクリプト

- [x] **対象ファイル**: `scripts/verify-cloudwatch.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-O1（High）, NFR-V305-O2（Critical）
- [x] **内容**:
  - 必須環境変数チェック: `AWS_REGION`, `LOG_GROUP_NAME`
  - CloudWatch Logs Insights で MCP tool-call ログをクエリ
  - `requestId`, `toolName`, `userId`, `status`, `durationMs` フィールドの存在確認
  - エラーログのトークン漏洩スキャン（Slack/ElevenLabs/Cognito キーパターン grep）
  - O1 クエリ結果を `evidence/O1-cloudwatch-logs/cloudwatch-query-result.txt` に保存
  - O2 スキャン結果を `evidence/O2-error-log-scan/secret-scan-result.txt` に保存
- [x] **セキュリティ**: AWS 認証情報は環境変数経由。ログにトークンが存在しないことを確認
- [x] 実行権限を付与

---

### Step 6: verify-secret-scan.sh — シークレットスキャンスクリプト

- [x] **対象ファイル**: `scripts/verify-secret-scan.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-M2（Critical: Security Baseline）
- [x] **内容**:
  - `scripts/` ディレクトリ配下の全シェルスクリプトをスキャン
  - スキャンパターン:
    - ElevenLabs API key: `sk-[a-zA-Z0-9]{20,}`
    - Slack token: `xox[bp]-[a-zA-Z0-9-]+`
    - AWS access key: `AKIA[A-Z0-9]{16}`
    - ハードコード ARN: `arn:aws:secretsmanager.*:secret:[^$]`
  - パターン検出なし → PASS
  - パターン検出あり → FAIL（exit 1）
  - スキャン結果を標準出力と `evidence/O2-error-log-scan/secret-scan-result.txt` に記録
- [x] **セキュリティ**: スクリプト自体にシークレット不使用
- [x] CI ゲートとして `pnpm run verify` に組み込む（Step 12 と連携）
- [x] 実行権限を付与

---

### Step 7: demo-reset.sh — デモリセットスクリプト

- [x] **対象ファイル**: `scripts/demo-reset.sh`（新規作成）
- [x] **対応 NFR**: NFR-V305-A2（High）
- [x] **内容**:
  - 必須環境変数チェック: `AWS_REGION`, `DEMO_USER_ID`, `TASKS_TABLE`, `PROPOSALS_TABLE`
  - Tasks テーブルの DEMO_USER_ID 関連アイテムを DynamoDB から削除
  - Proposals テーブルの DEMO_USER_ID 関連アイテムを削除
  - リセット結果ログを `evidence/A2-demo-reset/reset-run.log` に保存
  - CDK output からテーブル名を取得するコメント誘導を追加
- [x] **セキュリティ**: シークレット不要。AWS 認証情報は環境変数経由
- [x] 実行権限を付与

---

### Step 8: 証拠ストア（Evidence Store）ディレクトリ + README.md

- [x] **対象ファイル**: `aidlc-docs/construction/u-v3-05-real-integration-verification/evidence/` 配下
- [x] **対応 NFR**: NFR-V305-R1〜E4 全件（証拠収集パターン）
- [x] **内容**:
  - `evidence/README.md`（証拠インデックス: NFR ID ↔ ファイル対応表）
  - 各 NFR に対応する subdirectory に `.gitkeep` ファイルを作成（スクリプト実行前の構造保持）:
    - `R1-build-test/.gitkeep`
    - `R2-cdk-synth/.gitkeep`
    - `R3-agentcore-status/.gitkeep`
    - `R4-fallback/.gitkeep`
    - `O1-cloudwatch-logs/.gitkeep`
    - `O2-error-log-scan/.gitkeep`
    - `O3-elevenlabs-dashboard/.gitkeep`
    - `E1-get-tasks-e2e/.gitkeep`
    - `E2-slack-reply/.gitkeep`
    - `E3-delegate-to-claude/.gitkeep`
    - `E4-unauth-reject/.gitkeep`
    - `A1-load-test/.gitkeep`
    - `A2-demo-reset/.gitkeep`

---

### Step 9: TROUBLESHOOTING.md — トラブルシューティングマトリクス

- [x] **対象ファイル**: `aidlc-docs/construction/u-v3-05-real-integration-verification/TROUBLESHOOTING.md`（新規作成）
- [x] **対応 NFR**: NFR-V305-M1（High）
- [x] **内容**: 以下の 6 外部サービス × 各 3 シナリオ以上:
  1. AgentCore Gateway（ステータス FAILED / ツール未登録 / IAM 権限エラー）
  2. Cognito JWT 認証（トークン期限切れ / User Pool 設定エラー / PKCE フロー失敗）
  3. Slack Webhook（Webhook URL 無効 / レート制限 / Bot トークン権限不足）
  4. ElevenLabs（Agent ID 未設定 / MCP Server 未登録 / API キー期限切れ）
  5. Google（OAuth トークン失効 / Calendar API quota / Gmail フィルタなし）
  6. Hono fallback（Lambda Cold Start タイムアウト / CORS エラー / env var 未設定）
- [x] 各シナリオに「エラーシナリオ・推定原因・確認手順・解決方法・回避策」を記載

---

### Step 10: DEMO_RUNBOOK.md — 決勝デモ手順書

- [x] **対象ファイル**: `aidlc-docs/construction/u-v3-05-real-integration-verification/DEMO_RUNBOOK.md`（新規作成）
- [x] **対応 NFR**: NFR-V305-R4（High）, NFR-V305-A2（High）
- [x] **内容**:
  - **事前準備（デモ 30 分前）**:
    - Step 1: AWS デプロイ状態確認（`verify-agentcore.sh`）
    - Step 2: デモデータリセット（`demo-reset.sh`）
    - Step 3: ElevenLabs Agent ウォームアップ（音声テスト）
  - **メインデモシナリオ（7 分）**:
    - Step 1: ElevenLabs 音声エージェント起動
    - Step 2: 「タスクを見せて」→ `saborou_get_tasks` E2E
    - Step 3: 「Slack に返信して」→ `saborou_reply_to_slack` E2E
    - Step 4: 「Claude に頼んで」→ `saborou_delegate_to_claude` E2E
  - **フォールバック A**: ElevenLabs MCP 接続失敗時 → Chrome 拡張 clientTools（30 秒以内）
  - **フォールバック B**: Chrome 拡張全面失敗時 → Web UI で手動デモ
  - **Q&A 準備**: 4 審査員別の想定質問と対応メモ

---

### Step 11: .gitignore 更新

- [x] **対象ファイル**: `.gitignore`（既存ファイル更新）
- [x] **内容**: `evidence/**/*.png` を追加
  - スクリーンショット画像をバージョン管理から除外（git LFS でも可）
  - テキストログファイルはコミット対象として保持

---

### Step 12: root package.json — verify スクリプト追加

- [x] **対象ファイル**: `package.json`（既存ファイル更新）
- [x] **内容**: `"verify": "pnpm run verify:secrets && pnpm run verify:build"` を追加
  - `"verify:secrets": "./scripts/verify-secret-scan.sh"`
  - `"verify:build": "./scripts/verify-build-test.sh"`
- [x] **目的**: CI ゲートとして `pnpm run verify` でシークレットスキャン → ビルド・テスト確認を一括実行

---

### Step 13: code-generation-summary.md — コード生成サマリー

- [x] **対象ファイル**: `aidlc-docs/construction/u-v3-05-real-integration-verification/code/code-generation-summary.md`（新規作成）
- [x] **内容**:
  - 生成ファイル一覧（パス・用途・対応 NFR）
  - 実行方法（環境変数一覧 + コマンド例）
  - 証拠ストアの使い方
  - 注意事項（シークレット管理・実行順序）

---

## 前提条件チェック

- [x] U-V3-01〜04 の Code Generation が完了済み
- [x] NFR Requirements（15要件）が定義済み
- [x] NFR Design（5パターン + 5論理コンポーネント）が定義済み
- [x] Infrastructure Design スキップ判定完了

---

## ストーリートレーサビリティ

| ステップ | 対応 NFR | 優先度 |
|---------|---------|--------|
| Step 1（verify-build-test.sh） | NFR-V305-R1 | Critical |
| Step 2（verify-cdk-synth.sh） | NFR-V305-R2 | Critical |
| Step 3（verify-agentcore.sh） | NFR-V305-R3 | High |
| Step 4（verify-mcp-auth.sh） | NFR-V305-E4 | Critical |
| Step 5（verify-cloudwatch.sh） | NFR-V305-O1, O2 | High, Critical |
| Step 6（verify-secret-scan.sh） | NFR-V305-M2 | Critical |
| Step 7（demo-reset.sh） | NFR-V305-A2 | High |
| Step 8（Evidence Store） | R1〜E4 全件 | All |
| Step 9（TROUBLESHOOTING.md） | NFR-V305-M1 | High |
| Step 10（DEMO_RUNBOOK.md） | NFR-V305-R4, A2 | High |
| Step 11（.gitignore） | NFR-V305-M2 補助 | High |
| Step 12（package.json verify） | NFR-V305-M2, R1 | Critical |
| Step 13（code-generation-summary） | ドキュメント | - |

---

## 実装の注意事項

1. **シークレット安全**: 全スクリプトにシークレットをハードコードしない。Env-Safe Script Pattern に従う。
2. **実行可能性**: 検証スクリプトは `set -euo pipefail` で実行し、エラー時に即 exit 1 する。
3. **証拠保存先**: `evidence/` はドキュメントディレクトリに配置。アプリコードではない。
4. **フォールバック手順**: DEMO_RUNBOOK.md は 30 秒で切り替え可能な手順のみ記載する。
5. **CI 統合**: verify-secret-scan.sh は PR チェックでの使用を想定して設計する。
