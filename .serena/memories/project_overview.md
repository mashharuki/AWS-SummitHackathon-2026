# AWS-SummitHackathon-2026 プロジェクト概要

最終更新: 2026-06-20

## プロダクト
AWS Summit Japan 2026 ハッカソン向けの **SABOROU（サボロー）**。Slack 等から仕事を検知し、AI が「サボる／今やる」を文脈と心理学的根拠から判定する。v2 は Chrome 拡張 Side Panel から Slack 新着を検知し、返信案を生成し、クリックまたは音声承認で返信する体験を提供。ElevenLabs 音声エージェントと MCP (JSON-RPC 2.0) により、音声でタスク管理・Slack返信・Claude委譲が可能。

## 現在の状態（2026-06-20）
- 決勝: **2026年6月26日（金）@幕張メッセ** ← 6日後
- v2 Construction U-V2-01〜09（8実装Unit + 統合）完了済み。
- MCP ツール拡充・Slack User Token 実装・`saborou_find_task` 追加を 2026-06-20 に実施。
- デプロイは AWS 認証切れのため未完了（要: `cd pkgs/cdk && npx cdk deploy SaborouApi-dev SaborouAgent-dev --require-approval never`）
- セットアップ手順: `aidlc-docs/construction/v2/v2-setup-and-demo-guide.md`

## モノレポ構成
- `pkgs/shared`: 共有型、Zod schema、repository interface、utility。
- `pkgs/agent`: Bedrock Converse API ベースの TaskExtractorAgent、SaboriProposerAgent、SaboriProposerAgentV2、SchedulePlannerAgent、Slack client。`getSlackUserToken()` 追加済み（2026-06-20）。
- `pkgs/backend`: Hono API/Lambda。Cognito認証、Slack/Google連携、task/proposal/honne/schedule/MCP API。
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

## 2026-06-20 追加実装
- **MCP API キー認証**: `identity.ts` にて静的APIキー (`saborou/mcp-api-key`) と Cognito JWT の両方に対応。ElevenLabs Bearer Token: `a5ecae63-d213-4f99-916b-8f325bec2e4e`
- **`slackChannelId` フィールド**: `Task` / `TaskCandidate` 型に追加。Slack由来タスクは作成時に自動保存、`approve()` でコピー。
- **`saborou_delegate_to_claude` の `channelId` オプション化**: タスクに `slackChannelId` があればフォールバック。
- **MCPツール description 全面拡充**: `registry.ts`（ツールレベル）・`mcp-jsonrpc.ts`（パラメータレベル）を日本語化。ElevenLabsが正確にツールを選択できるよう改善。
- **`saborou_find_task` 新規追加**: `GET /api/tasks/search?keyword=xxx`。タイトル・説明・依頼者名の部分一致検索。音声向け `message` フィールド付き（「〜でよろしいですか？」「N件見つかりました...」）。タスクIDを言わずにタスクを特定できる。
- **Slack User Token 実装**: OAuth に `user_scope=chat:write` 追加。`saborou/slack-user-token/{userId}` に保存。返信送信時に User Token 優先、未設定時は Bot Token フォールバック。Slack App Portal 側の設定変更と再OAuth が必要。

## MCPツール一覧（2026-06-20時点）
| ツール名 | 概要 |
|---------|------|
| `saborou_list_tasks` | タスク一覧（status絞り込み可） |
| `saborou_get_task` | タスクID指定で詳細取得 |
| `saborou_list_candidates` | 承認待ち候補一覧 |
| `saborou_generate_reply_draft` | 返信案生成（3モード） |
| `saborou_judge_sabori` | メッセージのサボり判定 |
| `saborou_fetch_google_calendar` | Googleカレンダー同期 |
| `saborou_fetch_gmail` | Gmail同期 |
| `saborou_send_slack_reply` | Slack返信送信 |
| `saborou_schedule_report` | 進捗報告文生成 |
| `saborou_find_task` | **キーワードでタスク検索（新規）** |
| `saborou_delegate_to_claude` | ClaudeへのSlack委譲 |

## 設計上の重要事項
- AWSリージョンは原則 `ap-northeast-1`。CloudFront証明書のみ任意で `us-east-1`。
- AgentCore/ElevenLabs/MCP は加点機能だが、Hono API直接呼び出しとクリック承認のフォールバックを持つ。
- `customDomain=true` と `enableAgentCore=false` は CDK context。
- `aidlc-docs/aidlc-state.md` が工程状態の正本。
- `AGENTS.md` の AI-DLC ワークフローと監査規則が最優先。
- **ElevenLabs MCP**: スキーマ変更後は必ず disconnect → reconnect が必要（ツールリストをキャッシュするため）。
- **Slack User Token**: `saborou/slack-user-token/{userId}` に保存。Slack App PortalでUser Token Scope `chat:write` 追加後、ユーザーが再OAuth必要。

## Secrets Manager キー
| キー | 内容 |
|-----|------|
| `saborou/slack-bot-token/{userId}` | per-user Bot Token (xoxb-) |
| `saborou/slack-user-token/{userId}` | per-user User Token (xoxp-)（2026-06-20追加） |
| `saborou/slack-signing-secret-dev` | Webhook署名検証用 |
| `saborou/slack-client-secret-dev` | OAuth token交換用 |
| `saborou/mcp-api-key` | ElevenLabs MCP認証キー |
| `saborou/google-token/{userId}` | Google OAuth Token |

## Serena 注意事項
- Serena の active languages に `typescript` / `typescriptreact` が含まれていない場合、symbol overview が失敗する。`search_for_pattern` または `rg` と限定ファイル読み込みで代替する。
