# v1 流用資産サマリ（v2 スプリント用）

**作成日**: 2026-06-14  
**目的**: v2 の設計・実装時に参照する v1 既存資産の実在確認と流用方針の整理  
**注意**: v1 の完全なリバースエンジニアリングドキュメントは `aidlc-docs/inception/application-design/` 配下に存在する。本ドキュメントは v2 特有の流用観点のみを記述する。

---

## 1. pkgs/agent — コア AI エージェント資産

### ContextCollector（v2 変更不要）

- **パス**: `pkgs/agent/src/context-collector/ContextCollector.ts`
- **機能**: Secrets Manager から `saborou/slack-bot-token/<cognitoSub>` を取得し、Slack コンテキスト（会話履歴・ユーザー情報）を収集する
- **v2 流用**: Chrome 拡張 Side Panel から API 経由で呼び出す際にそのまま使用。Lambda ウォームキャッシュ（`tokenCache` Map）も流用
- **実在確認**: ✅

### SlackClient（v2 変更不要）

- **パス**: `pkgs/agent/src/slack-client/SlackClient.ts`
- **公開メソッド**: `postMessage` / `conversationsHistory` / `usersInfo` / `conversationsList`
- **v2 流用**: `postMessage` が UC-01/02 の返信送信に直結。5秒タイムアウト設定も適切
- **実在確認**: ✅

### BedrockClientAdapter（v2 変更不要）

- **パス**: `pkgs/agent/src/bedrock/BedrockClientAdapter.ts`
- **公開メソッド**: `converse` / `converseStream`
- **モデル**: `jp.anthropic.claude-sonnet-4-6`（JP 推論プロファイル）
- **v2 流用**: 返信文生成・断り文生成にそのまま使用
- **実在確認**: ✅

### SaboriProposerAgent（v2 では入力スキーマ拡張が必要）

- **パス**: `pkgs/agent/src/sabori-proposer/SaboriProposerAgent.ts`
- **構成**: 3フェーズ（コンテキスト組み立て → Bedrock 判定 → PersonaRenderer）
- **公開メソッド**: `propose` / `proposeStream`
- **v2 流用**: フェーズ 1〜3 を返信文・断り文生成に転用。`proposeStream` が SSE 配信に使用可能
- **変更内容**: 入力スキーマに「返信文生成モード」「断り文生成モード」を追加
- **実在確認**: ✅

### saboriJudgmentTool（v2 では新ツール定義を追加）

- **パス**: `pkgs/agent/src/sabori-proposer/saboriJudgmentTool.ts`
- **内容**: `sabori_judgment` Tool Use スキーマ・`SABORI_SYSTEM_PROMPT`
- **v2 変更**: `reply_generation`（返信文生成）・`decline_generation`（断り文生成）ツールを並列追加
- **実在確認**: ✅

### PersonaRenderer（v2 では軽微な変更が必要）

- **パス**: `pkgs/agent/src/sabori-proposer/PersonaRenderer.ts`
- **機能**: 生成テキストをサボロー口調に変換
- **v2 変更**: TTS 用の短い文章（100 文字程度）に整形する責務を追加。音声読み上げに適した文体調整
- **実在確認**: ✅

---

## 2. pkgs/backend — Hono API 資産

### 既存エンドポイント（v2 共用）

| エンドポイント | ルートファイル | v2 流用 |
|-------------|-------------|--------|
| `GET /tasks` | `routes/tasks.ts` | MCP ツール `saborou_get_tasks` の対象 |
| `GET /tasks/:taskId/proposal` | `routes/proposals.ts` | MCP ツール `saborou_judge_sabori` の対象（SSE） |
| `POST /tasks/:id/honne` | `routes/honne.ts` | 音声承認ログの記録に流用 |
| `GET /connections` | `routes/connections.ts` | 認証状態確認 |
| Slack 関連 | `routes/slack.ts` | Webhook 補助フローで継続使用 |

### v2 新規追加エンドポイント

| エンドポイント | 役割 | 対応 MCP ツール |
|-------------|------|--------------|
| `POST /api/slack/reply` | Slack 返信送信（承認後） | `saborou_send_slack_reply` |
| `POST /api/tasks/{id}/report` | 進捗報告スケジュール | `saborou_schedule_report` |
| `POST /api/tts` | ElevenLabs TTS プロキシ（フォールバック） | 直接呼び出し |

### OpenAPI スキーマ

- **パス**: `pkgs/backend/src/config/openapi.ts`
- **状況**: `@hono/zod-openapi` は導入済み。v2 では新規エンドポイントの `operationId` と `description` を AgentCore Gateway の MCP ツール変換品質を意識して記述する

---

## 3. pkgs/cdk — インフラ資産

### 継続使用スタック

| スタック | ファイル | v2 での役割 |
|---------|---------|-----------|
| DataStack | `stacks/data-stack.ts` | DynamoDB テーブル継続使用 |
| CognitoStack | `stacks/cognito-stack.ts` | 認証基盤継続（Chrome 拡張 PKCE フロー追加） |
| ApiStack | `stacks/api-stack.ts` | Hono API Lambda（v2 エンドポイント追加） |
| AgentStack | `stacks/agent-stack.ts` | SaboriProposerAgent Lambda（v2 モード追加） |
| WebhookStack | `stacks/webhook-stack.ts` | Slack Webhook 補助フロー継続 |

### v2 新規追加スタック

| スタック | 役割 |
|---------|------|
| AgentCoreStack | AgentCore Gateway + S3 スキーマバケット + IAM ロール |

### 変更が必要なスタック

| スタック | 変更内容 |
|---------|---------|
| FrontendStack | Chrome 拡張配信用に役割変更（S3 バケット + CloudFront は継続、ビルド対象を extension に変更） |
| ApiStack | v2 新規エンドポイントの Lambda 環境変数・IAM 権限追加 |
| CognitoStack | Chrome 拡張からの PKCE フロー対応（コールバック URL 追加） |

---

## 4. pkgs/frontend — v1 Web 資産（v2 では pkgs/extension として fork）

- **React 19 / Vite / Tailwind 4 / shadcn 風コンポーネント** が実装済み
- v2 では `pkgs/extension` として新パッケージを作成し、以下を流用:
  - `Button` / `Card` / `Badge` 等の共通 UI コンポーネント（`pkgs/shared` 経由）
  - `useChat` フック（Vercel AI SDK SSE ストリーミング）
  - CSS テーマ（オレンジ / オフホワイト）
- **除外**: Three.js / ガント / ゲーミフィケーション関連コンポーネント（ビルドサイズ削減）
- v1 `pkgs/frontend` は破壊せず温存。Chrome 拡張は独立した新パッケージ

---

## 5. 認証・シークレット管理

| 資産 | 値 / 規約 | v2 での扱い |
|-----|---------|-----------|
| Cognito User Pool | v1 デプロイ済み | 継続使用 + Chrome 拡張 redirect URI 追加 |
| Slack Bot Token | `saborou/slack-bot-token/<cognitoSub>` | 変更なし |
| ElevenLabs API Key | `saborou/elevenlabs-api-key` | v2 で新規追加（Lambda プロキシ用） |
| EventBridge Scheduler | v1 実装済み | 進捗報告スケジュール（UC-03）に流用 |

---

---

## 6. 実コード照合確認（2026-06-14 実施）

本 AI-DLC セッション（v2 Inception 開始時）に以下を直接確認済み：

| 資産 | 確認内容 | 結果 |
|-----|---------|------|
| `SlackClient.ts` | postMessage / conversationsHistory / usersInfo / conversationsList メソッド存在 | ✅ 実在確認 |
| `SaboriProposerAgent.ts` | propose / proposeStream 3 フェーズ設計 / SONNET_MODEL_ID = "jp.anthropic.claude-sonnet-4-6" | ✅ 実在確認 |
| `saboriJudgmentTool.ts` | SABORI_JUDGMENT_TOOL スキーマ / SABORI_SYSTEM_PROMPT | ✅ 実在確認（入力スキーマ詳細確認済み） |
| `ContextCollector.ts` | per-user Bot Token キャッシュ / DEFAULT_SECRET_PREFIX = "saborou/slack-bot-token/" | ✅ 実在確認 |
| `pkgs/backend/src/routes/` | tasks / proposals / slack / auth / connections / google / honne / schedule / users / webhooks 等 12 ルートファイル | ✅ 実在確認 |
| `pkgs/cdk/lib/stacks/` | acm / api / agent / cognito / data / frontend / webhook / config-deploy 8 スタック | ✅ 実在確認 |

**結論**: ブリーフ §6 の流用資産マップは実態と正確に一致している。v2 設計は本サマリの方針で進める。

*本ドキュメントは v2 設計・実装時の参照用。実コードの確認は各 pkgs/ 配下のファイルを直接参照すること。*
