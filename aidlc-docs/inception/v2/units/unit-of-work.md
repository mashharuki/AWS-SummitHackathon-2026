# SABOROU v2 Unit of Work

**バージョン**: 1.0.0
**作成日**: 2026-06-14
**スプリント**: v2（Chrome 拡張 + 音声対話 + AgentCore Gateway）

---

## Unit 分解方針

- 1 Unit = 独立してテスト・コミット可能な最小の作業単位
- v1 を破壊しない（後方互換維持が必須条件）
- 並行開発を考慮した分割（バックエンド系と拡張機能系を分離）
- デモ優先順位: UC-01（Slack 検知 → 音声承認 → 自動送信）を最高優先

---

## Unit 一覧

| Unit ID | Unit 名 | 規模 | 実装パッケージ | 流用資産 | 依存 Unit |
|---------|--------|------|-------------|---------|---------|
| U-V2-01 | extension-scaffold | S | `pkgs/extension`（新規） | pkgs/frontend の UI コンポーネント | なし |
| U-V2-02 | content-script | M | `pkgs/extension/src/content/` | なし | U-V2-01 |
| U-V2-03 | voice-agent-hook | M | `pkgs/extension/src/panel/` | ElevenLabs SDK | U-V2-01, U-V2-08 |
| U-V2-04 | agentcore-gateway | M | `pkgs/cdk/lib/stacks/` + OpenAPI | Hono API / CDK | なし |
| U-V2-05 | sabori-proposer-v2 | M | `pkgs/agent/src/sabori-proposer/` | SaboriProposerAgent | U-V2-04 |
| U-V2-06 | slack-reply-endpoint | S | `pkgs/backend/src/routes/` | SlackClient / Hono | U-V2-05 |
| U-V2-07 | progress-report | S | `pkgs/backend/src/routes/` + CDK | EventBridge Scheduler | U-V2-05 |
| U-V2-08 | extension-auth | S | `pkgs/extension/src/auth/` | Cognito v1 | U-V2-01 |
| U-V2-09 | integration-and-demo | M | 全パッケージ | 全 Unit | U-V2-01〜08 |

---

## Unit 詳細

### U-V2-01: extension-scaffold

**目的**: Chrome 拡張の骨格（Manifest V3 / Side Panel / build 設定）を確立する

**スコープ**:
- `pkgs/extension/` ディレクトリ新規作成
- `manifest.json`（Manifest V3 / permissions / side_panel）
- `package.json` / `vite.config.ts`（Vite + React 19 ビルド）
- Side Panel エントリポイント（`panel.html` + `src/panel/main.tsx`）
- 最小 UI（サボローアイコン + チャット欄のスケルトン）
- pnpm workspace への追加

**成果物**: Chrome 拡張として開発者インストール可能な最小構成

**テスト基準**:
- `npm run build` でエラーゼロ
- Chrome 拡張としてインストールできる（Side Panel が開く）

---

### U-V2-02: content-script

**目的**: Slack ページで自分宛てメッセージを DOM から検知し、Side Panel に通知する

**スコープ**:
- `pkgs/extension/src/content/index.ts`（content script）
- `MutationObserver` による DOM 監視（デバウンス 300ms）
- 自分宛て判定ロジック（`data-qa` 属性 / URL パターン）
- content script ↔ Side Panel の message passing
- Slack ContentEditable への自動入力・送信実装（`execCommand` + `InputEvent`）

**変更耐性設計**:
- `data-qa="message_container"` / `data-qa="message_input"` 等のアクセシビリティ属性を使用
- セレクター定数を 1 ファイルに集約（変更時の修正範囲を最小化）

**テスト基準**:
- ユニットテスト: DOM 判定ロジック（`isMentionedToMe` / `isSelfMessage`）
- 手動テスト: Slack DM 受信時に Side Panel に通知が表示される

---

### U-V2-03: voice-agent-hook

**目的**: ElevenLabs Conversational AI SDK を Side Panel に組み込み、音声対話を実現する

**スコープ**:
- `pkgs/extension/src/panel/hooks/useConversationalAgent.ts`
- `@11labs/client` パッケージインストール
- AgentCore Gateway MCP 接続設定（Cognito JWT 注入）
- TTS 音声再生（`<audio>` 要素 or SDK 内蔵）
- STT 結果の承認フレーズ判定（「いいよ」「OK」等）
- 3 秒タイムアウトロジック（`VoiceApprovalHandler`）
- 「いいよ」ボタン UI（音声認識失敗フォールバック）

**注意点（TP-06）**: `@11labs/client` の MCP クライアント設定は実装前に最新ドキュメントを確認すること

**テスト基準**:
- ユニットテスト: 承認フレーズ判定ロジック / タイムアウト処理
- 手動テスト: マイクで「いいよ」と言うと承認され送信が実行される

---

### U-V2-04: agentcore-gateway

**目的**: SABOROU Hono API を AgentCore Gateway 経由で MCP サーバーとして公開する

**スコープ**:
- `pkgs/cdk/lib/stacks/agentcore-stack.ts`（新規 CDK スタック）
- S3 バケット（OpenAPI スキーマ保管）
- `agentcore.Gateway`（CDK L2）— Cognito Custom JWT 認証
- `gateway.addOpenApiTarget()`（OpenAPI スキーマ → MCP ツール自動生成）
- `pkgs/backend/src/config/openapi.ts` への `operationId` / `description` 追加
- Hono ルートへの `@hono/zod-openapi` アノテーション追加（対象: tasks / proposals / slack）
- OpenAPI YAML を S3 にアップロードするデプロイスクリプト

**前提確認（TP-05）**: `aws bedrock-agentcore-control list-gateways --region ap-northeast-1` で GA を確認してから実装開始

**テスト基準**:
- CDK synth エラーゼロ
- `aws bedrock-agentcore-control get-gateway-target` でステータスが `ACTIVE`
- MCP エンドポイント URL が取得できる

---

### U-V2-05: sabori-proposer-v2

**目的**: SaboriProposerAgent を拡張し、返信文・断り文生成モードを追加する

**スコープ**:
- `pkgs/agent/src/sabori-proposer/saboriJudgmentTool.ts` に `ReplyDraftTool` / `DeclineDraftTool` を追加
- `pkgs/agent/src/sabori-proposer/SaboriProposerAgentV2.ts`（新規クラス or 既存拡張）
- 入力スキーマに `mode: 'sabori_judgment' | 'reply_draft' | 'decline_draft'` を追加
- `PersonaRenderer.ts` に TTS 用 100 文字制限の整形ロジック追加
- v1 の `SaboriProposerAgent` との後方互換維持（既存テスト全パス）

**テスト基準**:
- 既存 104 テストが全パスすること（v1 後方互換）
- 新規テスト: `reply_draft` / `decline_draft` ツール呼び出しの正常系・異常系

---

### U-V2-06: slack-reply-endpoint

**目的**: 承認後の Slack 返信を Hono API から実行する新エンドポイントを追加する

**スコープ**:
- `pkgs/backend/src/routes/slack.ts` に `POST /api/slack/reply` 追加
- リクエスト: `{ taskId, replyText, channelId, cognitoSub }`
- 処理: Secrets Manager から Slack Bot Token 取得 → `SlackClient.postMessage()`
- OpenAPI アノテーション（operationId: `sendSlackReply`）追加
- Hono の `createSlackRoute` に統合

**テスト基準**:
- ユニットテスト: SlackClient モックで正常系・認証エラー・Slack API エラー
- CDK 既存テスト全パス（ApiStack 変更が最小限であることを確認）

---

### U-V2-07: progress-report

**目的**: 毎日 17:00 に進捗報告文を自動生成し、Side Panel に通知する

**スコープ**:
- `pkgs/backend/src/routes/tasks.ts` に `POST /api/tasks/{id}/report` 追加
- EventBridge Scheduler ルール追加（`cron(0 8 * * ? *)` = 17:00 JST）
- Lambda ハンドラーでアクティブタスクスキャン → SaboriProposerAgentV2 で報告文生成
- Side Panel への WebSocket プッシュ（または SSE プッシュ）実装
- `saborou_schedule_report` MCP ツール登録

**テスト基準**:
- ユニットテスト: 報告文生成ロジック（モック Bedrock 応答）
- CDK synth: EventBridge ルール追加後もエラーゼロ

---

### U-V2-08: extension-auth

**目的**: Chrome 拡張から Cognito PKCE 認証フローを実行できるようにする

**スコープ**:
- `pkgs/extension/src/auth/cognitoAuth.ts`（新規）
- Chrome の `identity` API または `chrome.tabs.create()` + コールバック URL 処理
- Cognito コールバック URL への extension ID 追加（CDK CognitoStack 変更）
- JWT を `chrome.storage.local` に保存
- 既存 Web アプリの認証と共存（同一 Cognito User Pool / Client ID）

**テスト基準**:
- ユニットテスト: JWT 保存・読み込み・有効期限チェック
- 手動テスト: Google ログイン後に JWT が取得でき、API 呼び出しが成功する

---

### U-V2-09: integration-and-demo

**目的**: 全 Unit を統合し、デモシナリオ（DS-V2-01）の全フローを動作確認する

**スコープ**:
- UC-01 エンドツーエンドテスト（Slack DM 検知 → 音声承認 → 自動送信）
- UC-03 エンドツーエンドテスト（進捗報告 → 音声承認 → 送信）
- デモバックアップ動画の作成（`ScreenRecord`）
- バグ修正・パフォーマンス最適化
- `aidlc-docs/construction/build-and-test/` の手順書更新

**テスト基準**:
- DS-V2-01 デモシナリオが 1 分 30 秒以内に完走する
- 音声認識なし（「いいよ」ボタン）でも全フローが動作する
- バックアップ動画が準備されている

---

## 依存関係マトリクス

```
U-V2-01（scaffold）
├── U-V2-02（content script）→ U-V2-06（slack reply）
├── U-V2-08（auth）→ U-V2-03（voice hook）
└── U-V2-03（voice hook）

U-V2-04（agentcore gateway）→ U-V2-05（proposer v2）
U-V2-05（proposer v2）→ U-V2-06（slack reply）
U-V2-05（proposer v2）→ U-V2-07（progress report）

[U-V2-01〜08 全完了] → U-V2-09（統合）
```

---

## 実装順序と並行開発戦略

**Track A（バックエンド・インフラ）**: U-V2-04 → U-V2-05 → U-V2-06 → U-V2-07
**Track B（Chrome 拡張）**: U-V2-01 → U-V2-08 → U-V2-03 → U-V2-02

Track A と Track B は独立して並行開発可能（Mock API / Stub で疎結合）。
統合は U-V2-09 で実施。

---

## v1 資産との関係

| Unit | v1 からの変更 |
|------|------------|
| U-V2-01 | pkgs/frontend を参照して Side Panel UI を新規作成（v1 は非破壊） |
| U-V2-02 | 完全新規（v1 に content script は存在しない） |
| U-V2-03 | 完全新規（ElevenLabs SDK は v1 にない） |
| U-V2-04 | 完全新規（CDK スタック追加。v1 スタックは非破壊） |
| U-V2-05 | SaboriProposerAgent を拡張（後方互換必須） |
| U-V2-06 | Hono API にルート追加（既存ルートは非破壊） |
| U-V2-07 | EventBridge ルール追加 + Hono ルート追加 |
| U-V2-08 | v1 Cognito を流用（コールバック URL のみ追加） |
| U-V2-09 | 統合テスト（コード変更なし、確認のみ） |
