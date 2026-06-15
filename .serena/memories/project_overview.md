# AWS-SummitHackathon-2026 プロジェクト概要

最終更新: 2026-06-15

## プロダクト
AWS Summit Japan 2026 ハッカソン向けの **SABOROU（サボロー）**。Slack 等から仕事を検知し、AI が「サボる／今やる」を文脈と心理学的根拠から判定する。現在の v2 は Chrome 拡張の Side Panel から Slack 新着を検知し、返信案を生成し、クリックまたは音声承認で返信する体験を追加している。

## 現在の状態
- AI-DLC v2 スプリントの Inception / Construction は 2026-06-15 に完了。
- v2 の U-V2-01〜09（8実装Unit + 統合）を実装済み。
- 約1,528テストが全パス、全パッケージ typecheck 0、CDK synth 成功と記録されている。
- 残作業は実AWSデプロイ、ElevenLabs Agent ID/API key 登録、AgentCore の実リージョン利用確認、実機デモ。
- セットアップ手順は `aidlc-docs/construction/v2/v2-setup-and-demo-guide.md`。
- 決勝は 2026-06-26。

## モノレポ構成
- `pkgs/shared`: 共有型、Zod schema、repository interface、utility。
- `pkgs/agent`: Bedrock Converse API ベースの TaskExtractorAgent、SaboriProposerAgent、SaboriProposerAgentV2、SchedulePlannerAgent、Slack client。
- `pkgs/backend`: Hono API/Lambda。Cognito認証、Slack/Google連携、task/proposal/honne/schedule API。
- `pkgs/frontend`: React Web UI。Three.js、ガント、ゲーミフィケーション、PWA。
- `pkgs/extension`: v2 Chrome Manifest V3 拡張。Side Panel、Slack content script、Cognito PKCE、ElevenLabs音声承認。
- `pkgs/cdk`: AWS CDK。Data/Frontend/Cognito/API/Agent/Webhook/AgentCore/ConfigDeploy と任意のカスタムドメイン証明書スタック。
- `aidlc-docs`: AI-DLC 文書と監査ログ。アプリコードを置かない。
- `aidlc-inputs`: 要件、方針、モック、UI入力。

## v2 の主要変更
- Chrome 拡張 `pkgs/extension` を新設。固定 Extension ID は `klnbcafcphlnmbdbjgmpdjfeimenokmj`。
- Slack DOM 監視、自動入力、Side Panel 通知、Cognito Authorization Code + PKCE S256 を実装。
- `@11labs/client@0.2.0` による音声対話。未設定時は「いいよ」ボタンで完走可能。
- `SaboriProposerAgentV2` が `reply_draft` / `decline_draft` を生成。既存 v1 agent は維持。
- Backend に `POST /api/proposals/judge`、`POST /api/slack/reply`、`POST /api/tasks/:id/report` を追加。
- AgentCore Gateway は `aws-cdk-lib` の L1 `CfnGateway` / `CfnGatewayTarget` で実装。`-c enableAgentCore=false` で無効化可能。
- EventBridge の17:00進捗報告Scheduleは安全のため DISABLED。

## 設計上の重要事項
- AWSリージョンは原則 `ap-northeast-1`。CloudFront証明書のみ任意で `us-east-1`。
- AgentCore/ElevenLabs/MCP は加点機能だが、Hono API直接呼び出しとクリック承認のフォールバックを持つ。
- `customDomain=true` と `enableAgentCore=false` は CDK context。
- `aidlc-docs/aidlc-state.md` が工程状態の正本。
- `AGENTS.md` の AI-DLC ワークフローと監査規則が最優先。

## Serena 注意事項
2026-06-15 時点で Serena はこのプロジェクトの active languages を `python` のみと誤認しており、TypeScript/TSX の symbol overview が失敗する。設定修正までは `search_for_pattern` または `rg` と限定ファイル読み込みを使う。