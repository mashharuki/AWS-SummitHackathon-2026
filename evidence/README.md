# 証拠ストア (Evidence Store)

U-V3-05 real-integration-verification の検証証拠ファイルを格納するディレクトリです。
各 NFR に対応する検証スクリプトを実行すると、このディレクトリに証拠ファイルが保存されます。

---

## NFR ID ↔ ファイル対応表

| NFR ID | 優先度 | 説明 | 証拠ディレクトリ | 生成スクリプト / 収集方法 |
|--------|--------|------|----------------|--------------------------|
| NFR-V305-R1 | Critical | 全パッケージビルド・テスト通過 | `R1-build-test/` | `./scripts/verify-build-test.sh` |
| NFR-V305-R2 | Critical | CDK synth 成功 | `R2-cdk-synth/` | `./scripts/verify-cdk-synth.sh` |
| NFR-V305-R3 | High | AgentCore Gateway 疎通確認 | `R3-agentcore-status/` | `./scripts/verify-agentcore.sh` |
| NFR-V305-R4 | High | フォールバックパス稼働確認 | `R4-fallback/` | `DEMO_RUNBOOK.md` フォールバック A/B の実行記録 |
| NFR-V305-O1 | High | CloudWatch MCP tool-call 監査 | `O1-cloudwatch-logs/` | `./scripts/verify-cloudwatch.sh` |
| NFR-V305-O2 | Critical | エラーログのトークン非漏洩 | `O2-error-log-scan/` | `./scripts/verify-cloudwatch.sh` + `./scripts/verify-secret-scan.sh` |
| NFR-V305-O3 | High | ElevenLabs Dashboard 登録確認 | `O3-elevenlabs-dashboard/` | 手動スクリーンショット（*.png は .gitignore 対象） |
| NFR-V305-E1 | Critical | saborou_get_tasks E2E | `E1-get-tasks-e2e/` | デモ実行後の手動スクリーンショット |
| NFR-V305-E2 | High | saborou_reply_to_slack E2E | `E2-slack-reply/` | デモ実行後の手動スクリーンショット |
| NFR-V305-E3 | High | saborou_delegate_to_claude E2E | `E3-delegate-to-claude/` | デモ実行後の手動スクリーンショット |
| NFR-V305-E4 | Critical | 未認証リクエスト拒否 | `E4-unauth-reject/` | `./scripts/verify-mcp-auth.sh` |
| NFR-V305-A1 | Medium | 3並行リクエスト耐性 | `A1-load-test/` | 手動 k6 テスト結果 (k6run.json) |
| NFR-V305-A2 | High | デモリセット完了 | `A2-demo-reset/` | `./scripts/demo-reset.sh` |

---

## 証拠ファイルの収集方法

### 自動収集（スクリプト実行）

以下の手順で環境変数を設定してスクリプトを実行します。

```bash
# Step 1: シークレットスキャン（CI ゲート）
./scripts/verify-secret-scan.sh

# Step 2: ビルド・テスト検証
./scripts/verify-build-test.sh

# Step 3: CDK synth 確認（AWS 認証必要）
AWS_PROFILE=myprofile ./scripts/verify-cdk-synth.sh

# Step 4: AgentCore 疎通確認
AWS_REGION=ap-northeast-1 \
AGENTCORE_GATEWAY_ID=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AgentCoreGatewayId`].OutputValue' \
  --output text) \
./scripts/verify-agentcore.sh

# Step 5: MCP 認証テスト
export API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name SaborouStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)
export COGNITO_TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=demo@example.com,PASSWORD=YourPassword \
  --client-id <CognitoClientId> \
  --query 'AuthenticationResult.AccessToken' \
  --output text)
./scripts/verify-mcp-auth.sh

# Step 6: CloudWatch 監査ログ確認（デモ実行後に行う）
AWS_REGION=ap-northeast-1 \
LOG_GROUP_NAME=/aws/lambda/saborou-mcp \
./scripts/verify-cloudwatch.sh
```

### 手動収集

| NFR | 収集手順 |
|-----|---------|
| O3-elevenlabs-dashboard | ElevenLabs ダッシュボードで Saborou エージェントが登録されていることを確認し、スクリーンショットを `O3-elevenlabs-dashboard/` に配置 |
| E1-get-tasks-e2e | デモで `saborou_get_tasks` を実行し、タスク一覧が返ってくる画面のスクリーンショットを `E1-get-tasks-e2e/` に配置 |
| E2-slack-reply | デモで `saborou_reply_to_slack` を実行し、Slack チャンネルに返信が届いたスクリーンショットを `E2-slack-reply/` に配置 |
| E3-delegate-to-claude | デモで `saborou_delegate_to_claude` を実行し、Claude からの応答スクリーンショットを `E3-delegate-to-claude/` に配置 |
| R4-fallback | フォールバック A（Chrome 拡張）または B（Web UI）に切り替えた際の記録を `R4-fallback/` に配置 |
| A1-load-test | k6 で 3 並行リクエストを送信し、`k6run.json` を `A1-load-test/` に配置 |

---

## ファイル管理ルール

- `*.png`, `*.jpg`, `*.webp`, `*.gif` — `.gitignore` で除外（スクリーンショット等）
- `*.log`, `*.txt`, `*.json` — バージョン管理の対象（テキストログは commit 可）
- `.gitkeep` — ディレクトリ構造を Git で管理するためのプレースホルダー

---

## 注意事項

1. デモ前に必ず `./scripts/demo-reset.sh` を実行してデータをクリーンにしてください
2. 証拠ファイル収集後に `TROUBLESHOOTING.md` を参照して問題がないか確認してください
3. 決勝当日は少なくとも 30 分前に全スクリプトを実行してください
4. `DEMO_RUNBOOK.md` のフォールバック手順を事前に練習してください
