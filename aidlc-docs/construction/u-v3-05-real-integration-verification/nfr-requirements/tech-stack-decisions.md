# U-V3-05 Tech Stack Decisions

**Unit**: U-V3-05: real-integration-verification
**作成日**: 2026-06-17

---

## 技術スタック選定

本 Unit は新規コードよりも検証スクリプト・手順書・トラブルシューティングドキュメントが主な成果物のため、
使用技術は最小限に抑える。

---

## 検証ツール

| ツール | 選定理由 |
|--------|---------|
| **pnpm** | 既存モノレポのパッケージマネージャー。`pnpm -r test` で全パッケージ一括テスト |
| **AWS CLI v2** | CDK synth/deploy・AgentCore/CloudWatch 確認に使用 |
| **curl / HTTPie** | MCP エンドポイントの手動疎通確認 |
| **AWS CloudWatch Logs Insights** | MCP tool-call 監査ログの確認 |
| **jq** | CloudWatch JSON ログの整形・解析 |

---

## 検証スクリプト言語

- **Bash / zsh**: 環境変数参照ベースの軽量スクリプト
- **TypeScript (Node.js)**: 複雑な E2E 検証が必要な場合のみ。`tsx` で直接実行
- **理由**: 既存パッケージの依存関係を使い回せる。シークレットは `$ENV_VAR` 参照のみ

---

## ドキュメント形式

- **Markdown**: 全手順書・トラブルシューティングマトリクス
- **Mermaid**: フォールバック遷移図・検証フロー図（必要な場合）
- **理由**: aidlc-docs の標準フォーマット。GitHub 上で直接閲覧可能

---

## 除外技術

| 技術 | 除外理由 |
|------|---------|
| Playwright/Cypress (E2E) | 実環境 AWS は自動 E2E テストの対象外。手動検証で十分 |
| k6 / Locust | 負荷テストは NFR-V305-A1 の Medium 優先度。必要に応じて別途検討 |
| New Relic / Datadog | 既存 CloudWatch で対応可能 |

---

## シークレット管理

- AWS 認証情報: `~/.aws/credentials` または IAM ロール（EC2/Cloud9 環境）
- Slack トークン: `SLACK_BOT_TOKEN` 環境変数（Secrets Manager から取得）
- ElevenLabs API キー: `ELEVENLABS_API_KEY` 環境変数（Secrets Manager から取得）
- シークレット取得スクリプト例:
  ```bash
  export SLACK_BOT_TOKEN=$(aws secretsmanager get-secret-value \
    --secret-id saborou/slack-token \
    --query SecretString \
    --output text | jq -r .token)
  ```
- **ハードコード禁止**: スクリプト内に直接キーを書かない（NFR-V305-M2）
