# U-V3-05 NFR Design Patterns

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17
**依存 NFR Requirements**: nfr-requirements.md（R1〜R4 / O1〜O3 / E1〜E4 / A1〜A2 / M1〜M2）

---

## 概要

U-V3-05 は新規ランタイムコンポーネントを追加しない「検証・文書化 Unit」である。
NFR Design では、以下の目的を達成するための設計パターンを定義する:

1. 検証証拠を体系的に収集・整理する仕組み
2. シークレットを安全に扱う検証スクリプトの構造
3. 外部サービスのエラーシナリオを網羅するトラブルシューティング文書
4. フォールバック時に即時実行可能な手順書
5. デモ前にクリーンな状態を再現するリセット手順

---

## パターン 1: Verification Evidence Pattern（検証証拠収集パターン）

### 目的

NFR-V305-R1〜R4 / O1〜O3 / E1〜E4 の各要件について、
再現可能・第三者確認可能な形で証拠を収集・整理する。

### 証拠ディレクトリ構造

```
aidlc-docs/construction/u-v3-05-real-integration-verification/evidence/
├── README.md              ← 証拠インデックス（どの NFR をどの証拠が満たすか）
├── R1-build-test/         ← NFR-V305-R1: テスト通過ログ
│   ├── backend-test.log
│   ├── cdk-test.log
│   └── extension-test.log
├── R2-cdk-synth/          ← NFR-V305-R2: CDK synth 出力
│   └── synth-output.log
├── R3-agentcore-status/   ← NFR-V305-R3: AgentCore AVAILABLE 確認
│   └── agentcore-status.png (または .txt)
├── R4-fallback/           ← NFR-V305-R4: フォールバック実行ログ
│   └── fallback-demo.log
├── O1-cloudwatch-logs/    ← NFR-V305-O1: MCP tool-call 構造化ログ
│   └── cloudwatch-query-result.txt
├── O2-error-log-scan/     ← NFR-V305-O2: エラーログのトークン漏洩スキャン結果
│   └── secret-scan-result.txt
├── O3-elevenlabs-dashboard/ ← NFR-V305-O3: ElevenLabs Dashboard スクリーンショット
│   └── elevenlabs-tools-registered.png
├── E1-get-tasks-e2e/      ← NFR-V305-E1: saborou_get_tasks E2E
│   └── e2e-get-tasks-transcript.txt
├── E2-slack-reply/        ← NFR-V305-E2: Slack 返信 E2E
│   └── slack-reply-screenshot.png
├── E3-delegate-to-claude/ ← NFR-V305-E3: @Claude 委譲 E2E
│   └── delegate-screenshot.png
├── E4-unauth-reject/      ← NFR-V305-E4: 未認証リクエスト拒否
│   └── curl-reject-log.txt
├── A1-load-test/          ← NFR-V305-A1: 並列アクセス耐性
│   └── loadtest-result.txt
└── A2-demo-reset/         ← NFR-V305-A2: デモリセット手順実行確認
    └── reset-run.log
```

### 証拠インデックス（README.md）の形式

```markdown
# 検証証拠インデックス

| NFR ID | カテゴリ | 証拠ファイル | 検証日時 | 結果 |
|--------|---------|------------|---------|------|
| NFR-V305-R1 | 信頼性 | R1-build-test/*.log | YYYY-MM-DDTHH:MM:SSZ | PASS |
| NFR-V305-O2 | 観測性 | O2-error-log-scan/*.txt | YYYY-MM-DDTHH:MM:SSZ | PASS |
...
```

### 適用ルール

- 証拠ファイルは**テキスト形式を優先**（スクリーンショットは補助）
- CloudWatch 出力は `aws logs filter-log-events` の生テキストで保存
- 証拠ファイルに AWS アカウント ID 以外の機密情報を含めない
- `.gitignore` に `evidence/**/*.png` を追加して画像を除外推奨（git LFS でも可）

---

## パターン 2: Env-Safe Script Pattern（シークレット安全スクリプトパターン）

### 目的

NFR-V305-M2 に準拠し、検証スクリプトにシークレットをハードコードしない。

### スクリプト構造テンプレート

```bash
#!/usr/bin/env bash
# verify-mcp-auth.sh
# Usage: ./verify-mcp-auth.sh
# Requires env vars: API_ENDPOINT (from CDK output), COGNITO_TOKEN (from auth flow)
# Do NOT hardcode secrets here.

set -euo pipefail

# ---- 必須環境変数チェック ----
: "${API_ENDPOINT:?API_ENDPOINT is required (e.g. export API_ENDPOINT=https://xxx.execute-api.ap-northeast-1.amazonaws.com)}"
: "${COGNITO_TOKEN:?COGNITO_TOKEN is required (obtain via: aws cognito-idp initiate-auth ...)}"

# ---- 検証ロジック ----
echo "[verify-mcp-auth] Testing authenticated MCP call..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${COGNITO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"tool":"saborou_get_tasks","args":{}}' \
  "${API_ENDPOINT}/api/mcp/tools/saborou_get_tasks")

if [ "${RESPONSE}" = "200" ]; then
  echo "[PASS] Authenticated request returned 200"
else
  echo "[FAIL] Expected 200, got ${RESPONSE}"
  exit 1
fi

# ---- 未認証テスト（NFR-V305-E4）----
echo "[verify-mcp-auth] Testing unauthenticated MCP call..."
UNAUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"tool":"saborou_get_tasks","args":{}}' \
  "${API_ENDPOINT}/api/mcp/tools/saborou_get_tasks")

if [ "${UNAUTH_RESPONSE}" = "401" ]; then
  echo "[PASS] Unauthenticated request correctly returned 401"
else
  echo "[FAIL] Expected 401, got ${UNAUTH_RESPONSE}"
  exit 1
fi
```

### シークレット取得方法（コメントで誘導）

スクリプト先頭コメントに以下を必ず記載する:

```bash
# Secrets Management:
# - COGNITO_TOKEN: aws cognito-idp initiate-auth --client-id <CLIENT_ID> \
#     --auth-flow USER_PASSWORD_AUTH \
#     --auth-parameters USERNAME=<USER>,PASSWORD=<PASS>
# - SLACK_TOKEN: aws secretsmanager get-secret-value --secret-id <SECRET_NAME>
# - ELEVENLABS_API_KEY: aws secretsmanager get-secret-value --secret-id <SECRET_NAME>
# Do NOT set these values in this file.
```

### 静的スキャンルール

シークレットパターンの grep チェック（CI または手動実行）:

```bash
# シークレットスキャン（secrets-scan.sh）
PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'  # ElevenLabs API key
  'xox[bp]-[a-zA-Z0-9-]+'  # Slack token
  'AKIA[A-Z0-9]{16}'  # AWS access key
  'arn:aws:secretsmanager.*:secret:[^$]'  # ハードコードされた Secret ARN
)
for pattern in "${PATTERNS[@]}"; do
  if grep -rE "${pattern}" scripts/ 2>/dev/null; then
    echo "[FAIL] Potential secret found in scripts/"
    exit 1
  fi
done
echo "[PASS] No hardcoded secrets found"
```

---

## パターン 3: Troubleshooting Matrix Pattern（トラブルシューティングマトリクスパターン）

### 目的

NFR-V305-M1 に準拠し、外部サービスの主要エラーシナリオを体系的に文書化する。

### マトリクス構造

各外部サービスについて以下の列を持つ Markdown テーブルで記述:

| 列名 | 内容 |
|------|------|
| エラーシナリオ | 症状・エラーメッセージ |
| 推定原因 | 最もあり得る原因 |
| 確認手順 | 原因を特定するためのコマンド/手順 |
| 解決方法 | 解決するためのアクション |
| 回避策 | 解決できない場合のフォールバック |

### 対象外部サービス（各 3 シナリオ以上）

1. **AgentCore Gateway**
   - シナリオ例: Gateway status が FAILED / ツールが見つからない / IAM 権限エラー

2. **Cognito (JWT 認証)**
   - シナリオ例: トークン期限切れ / User Pool 設定エラー / PKCE フロー失敗

3. **Slack Webhook**
   - シナリオ例: Webhook URL 無効 / レート制限 / Bot トークン権限不足

4. **ElevenLabs**
   - シナリオ例: Agent ID 未設定 / MCP Server 未登録 / API キー期限切れ

5. **Google（Calendar/Gmail）**
   - シナリオ例: OAuth トークン失効 / Calendar API quota / Gmail フィルタなし

6. **Hono fallback（直接 API）**
   - シナリオ例: Lambda Cold Start タイムアウト / CORS エラー / バンドルサイズ超過

### 格納先

```
aidlc-docs/construction/u-v3-05-real-integration-verification/
└── TROUBLESHOOTING.md
```

---

## パターン 4: Fallback Runbook Pattern（フォールバック手順書パターン）

### 目的

NFR-V305-R4 / NFR-V305-A2 に準拠し、
決勝デモ中に ElevenLabs `streamable_http` 登録が失敗した場合でも
30 秒以内に Chrome 拡張 `clientTools` フォールバックへ切り替えられる手順を記述する。

### 手順書の形式

実行可能なステップ番号付きリスト（コピー&ペースト可能なコマンド含む）:

```markdown
## フォールバック手順: ElevenLabs → Chrome 拡張 clientTools

**前提**: Chrome 拡張がインストール済み・Cognito ログイン済みであること

### Step 1（30 秒）: フォールバックモード確認
1. ブラウザコンソールを開く（F12）
2. 以下を実行: `window.__SABOROU_FALLBACK_MODE__` が `clientTools` を返すこと
3. または設定画面の「MCP接続ステータス」で「フォールバック: clientTools」を確認

### Step 2（0 秒）: 動作確認
音声エージェントに「タスクを見せて」と話しかけ、タスク一覧が返ることを確認

### 切り替え不要な場合のフォールバック
Chrome 拡張が利用できない場合は Web UI（http://localhost:5173 または CloudFront URL）で
手動でサボり提案を取得してデモする（バックアップシナリオ B）
```

### 格納先

```
aidlc-docs/construction/u-v3-05-real-integration-verification/
└── DEMO_RUNBOOK.md
```

---

## パターン 5: Demo Reset Script Pattern（デモリセットスクリプトパターン）

### 目的

NFR-V305-A2 に準拠し、デモ開始前に DynamoDB のテストデータをリセットして
クリーンな状態からデモを開始できる手順を確立する。

### リセット対象

| テーブル | リセット内容 | 方法 |
|---------|------------|------|
| Tasks | テスト userId のタスクを削除 | aws dynamodb delete-item |
| Proposals | テスト userId のサボり提案を削除 | aws dynamodb delete-item |
| TaskCandidates | テスト userId の候補を削除 | aws dynamodb delete-item |

### リセットスクリプトのテンプレート

```bash
#!/usr/bin/env bash
# demo-reset.sh
# Usage: ./demo-reset.sh
# Requires env vars: AWS_REGION, DEMO_USER_ID

set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${DEMO_USER_ID:?DEMO_USER_ID is required}"
: "${TASKS_TABLE:?TASKS_TABLE is required (from CDK output)}"
: "${PROPOSALS_TABLE:?PROPOSALS_TABLE is required (from CDK output)}"

echo "[demo-reset] Resetting demo data for user: ${DEMO_USER_ID}"

# Tasks テーブルのテストデータ削除
aws dynamodb query \
  --region "${AWS_REGION}" \
  --table-name "${TASKS_TABLE}" \
  --key-condition-expression "userId = :uid" \
  --expression-attribute-values '{":uid":{"S":"'"${DEMO_USER_ID}"'"}}' \
  --query "Items[].taskId.S" \
  --output text | tr '\t' '\n' | while read -r taskId; do
    aws dynamodb delete-item \
      --region "${AWS_REGION}" \
      --table-name "${TASKS_TABLE}" \
      --key '{"userId":{"S":"'"${DEMO_USER_ID}"'"},"taskId":{"S":"'"${taskId}"'"}}' \
    && echo "[demo-reset] Deleted task: ${taskId}"
done

echo "[demo-reset] Reset complete. Ready for demo."
```

### 実行手順（5 分以内）

1. CDK output から `TASKS_TABLE` / `PROPOSALS_TABLE` を確認
2. `export DEMO_USER_ID=<デモ用の Cognito userId>`
3. `./scripts/demo-reset.sh` を実行
4. DynamoDB コンソールで対象 userId のアイテムが 0 件であることを確認

---

## Security Baseline 準拠評価（NFR Design レベル）

| Security Baseline ルール | 適用可否 | パターンでの対応 |
|--------------------------|---------|----------------|
| SB-02: シークレット外部化 | Applicable | Env-Safe Script Pattern で完全対応 |
| SB-05: 認証・認可 | Applicable | Verification Evidence Pattern の E4 証拠で実証 |
| SB-06: 監査ログ | Applicable | Verification Evidence Pattern の O1/O2 証拠で確認 |
| SB-08: トークン非漏洩 | Applicable | Env-Safe Script Pattern + 証拠ファイルの機密排除ルール |
| SB-09: テストカバレッジ | Applicable | Verification Evidence Pattern の R1 証拠で確認 |

**ブロッキングファインディング**: なし
