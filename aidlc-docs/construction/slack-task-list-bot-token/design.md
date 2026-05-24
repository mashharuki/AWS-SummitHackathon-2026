# タスクC 設計：Bot Token化 + Slackからタスク一覧取得 + インタラクティブ返信

**作成日**: 2026-05-23
**ブランチ**: `feature/slack-task-list-and-bot-token`
**スコープ**: 全部（SlackClient実装・Bot Token不整合修正・遡及取得API・返信機構・ドキュメント）
**前提**: タスクB（slackUserId/slackTeamId 紐付け・GSI-SlackLookup 逆引き）マージ済み

---

## 解決する3つの課題

ユーザー要望:
1. **StackのBot Token化手順が抜けている** → セットアップ手順とコードの不整合を解消
2. **Bot Token化できたらもっとインタラクティブなやり取り** → chat.postMessage で Slack へ返信
3. **Slackからタスク一覧とか取得できる？** → conversations.history で過去メッセージを遡及取得しタスク化／Slackにタスク一覧を投稿

---

## 最重要：Bot Token 取得の不整合（バグ）

### 現状の不整合（実コードで確認）

| 項目 | 場所 | 実態 |
|---|---|---|
| Bot Token 保存先 | `auth.ts:207` | `saborou/slack-bot-token/{userId}`（**per-user**） |
| ContextCollector の取得先 | `ContextCollector.ts:40` | env `SLACK_TOKEN_SECRET_NAME` |
| その env に CDK が渡す値 | `agent-stack.ts:105-107,166-167` | `slackClientSecret.secretName`（= `/saborou/slack/client-secret-{env}` = **OAuth用 Client Secret**） |

→ ContextCollector は **Bot Token ではなく Client Secret を取得**してしまい、かつ per-user の Bot Token にアクセスできない。Slack API を叩けば確実に失敗する。これが「Bot Token化が抜けている」の技術的核心。

### 修正方針

ContextCollector を **userId（cognitoSub）を受け取って per-user の Bot Token を取得**する形にする:
- env で受け取るのは「シークレット名のプレフィックス」（`SLACK_BOT_TOKEN_SECRET_PREFIX = saborou/slack-bot-token/`）
- `getSlackToken(userId)` で `{prefix}{userId}` を解決して取得
- キャッシュは userId 別（Map）に変更
- CDK: agent Lambda に `saborou/slack-bot-token/*` への `secretsmanager:GetSecretValue` 権限を付与（per-user シークレットはワイルドカード ARN）。誤って渡していた `SLACK_TOKEN_SECRET_NAME=clientSecret` を廃止

---

## 実装一覧

### 1. shared / SlackClient（新規・最重要）
- `pkgs/agent/src/slack-client/SlackClient.ts`（新規）
  - Bot Token を受け取り Slack Web API を叩く薄いラッパー
  - メソッド: `conversationsHistory({channel, oldest?, limit?})`, `postMessage({channel, text, thread_ts?})`, `usersInfo(user)`（必要に応じ）
  - `https://slack.com/api/*` を fetch。`ok:false` 時はエラー、レート制限(429)は素直に伝播
  - タイムアウト（AbortController、既定 5s）

### 2. ContextCollector の Bot Token 取得修正
- `pkgs/agent/src/context-collector/ContextCollector.ts`
  - `getSlackToken(userId)` に変更（per-user）。キャッシュを `Map<userId, token>` に
  - シークレット名は `${SLACK_BOT_TOKEN_SECRET_PREFIX}${userId}`
  - 後方互換: 既存呼び出し元（SaboriProposer の collectMinimalSlackContext スタブ）も追従

### 3. CDK
- `agent-stack.ts`:
  - `SLACK_TOKEN_SECRET_NAME=clientSecret` を廃止し、`SLACK_BOT_TOKEN_SECRET_PREFIX` を設定
  - per-user Bot Token シーク360レットへの GetSecretValue 権限を追加（`arn:aws:secretsmanager:...:secret:saborou/slack-bot-token/*`）
- backend Lambda（api-stack）: 遡及取得 API が Bot Token を読むため同様の権限が必要

### 4. backend: 遡及取得 API
- `pkgs/backend/src/routes/slack.ts`（新規）
  - `POST /api/slack/sync-messages`（認証必須）
  - body: `{ channelId, oldest? }`
  - 認証ユーザーの Bot Token を取得 → SlackClient.conversationsHistory → 各メッセージを EventBridge `SlackEvent` として publish（既存 TaskExtractor パイプ再利用）
  - 逆引き不要（呼び出し元が認証済み Cognito ユーザー＝userId 確定。EventBridge detail に userId を載せる経路を追加）
- `index.ts` にルート登録

> 設計判断: 遡及取得は「認証ユーザー自身が自分のチャンネル履歴を同期する」操作なので、Webhook 経由（逆引き必要）とは別に、userId を直接持つ EventBridge イベント（`detailType: SlackBackfill` 等）にする。TaskExtractorLambdaHandler は両方（逆引き要/不要）を扱えるよう分岐。

### 5. インタラクティブ返信（chat.postMessage）
- サボり提案が完了したら Slack スレッドに返信する経路
- スコープに `chat:write` を追加（`auth.ts` SLACK_OAUTH_SCOPES）
- 実装は SaboriProposer 側 or backend エンドポイント。MVP は backend に `POST /api/tasks/:taskId/notify-slack` を置き、提案結果を Slack へ postMessage する薄い実装

### 6. ドキュメント
- `aidlc-docs/operations/slack-app-setup.md` に Bot Token 化手順を追記:
  - Bot Token Scopes に `chat:write` 追加
  - Bot User OAuth Token（xoxb-）の確認手順
  - `SLACK_BOT_TOKEN_SECRET_PREFIX` 環境変数の説明と CDK 出力との対応
  - OAuth スコープ変更後は既存連携ユーザーに再認可が必要、の注意
- `aidlc-docs/operations/slack-api-integration.md`（新規）: SlackClient の使い方・エラー処理・遡及取得/返信フロー図

### 7. テスト
- SlackClient: conversationsHistory / postMessage の成功・ok:false・タイムアウト
- ContextCollector: per-user 取得・キャッシュ・env未設定
- backend slack route: 認証・sync-messages の publish
- agent TaskExtractor: backfill 経路（userId 直接）の処理
- 既存テストの追従（ContextCollector シグネチャ変更の波及）

---

## 設計上の留意点

- **既存連携ユーザーの再認可**: `chat:write` 追加で OAuth スコープが変わるため、既存トークンでは chat.postMessage が 403。設定画面に「再連携」導線が必要（本PRではドキュメント注意に留め、UI改善は別途）。
- **Slack API レート制限**: conversations.history は Tier 3（~50+/min）。遡及取得は limit と oldest で範囲を絞る。
- **Lambda タイムアウト**: Slack API 呼び出しは AbortController で 5s。TaskExtractor 60s / SaboriProposer 90s と矛盾しない。
- **冪等性**: 遡及取得で同じ messageTs を重複処理しないよう、TaskCandidate 側の ULID 冪等性（既存 attribute_not_exists）に委ねる。完全な重複排除は MVP スコープ外。
- **AWS制約**: per-user シークレットのワイルドカード権限は最小権限の範囲（`saborou/slack-bot-token/*` のみ）。

---

## 実装順序（このPR内）

1. SlackClient 実装 + テスト
2. ContextCollector を per-user Bot Token 取得に修正 + テスト + 既存波及修正
3. CDK 権限・env 修正（synth 確認）
4. backend 遡及取得 API + EventBridge backfill 経路 + テスト
5. agent TaskExtractor の backfill 分岐 + テスト
6. chat:write スコープ追加 + 返信エンドポイント + テスト
7. ドキュメント整備（slack-app-setup.md 追記 + slack-api-integration.md 新規）
8. 全テスト・型・カバレッジ・Biome・CDK synth で品質確認
