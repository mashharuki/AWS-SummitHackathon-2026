# タスクB 設計：Slack ↔ Cognito ユーザーID 紐付け

**作成日**: 2026-05-23
**ブランチ**: `feature/slack-cognito-user-linking`
**スコープ**: 逆引きまで含む完全版（GSI + Webhook/Agent 経路の改修）

---

## 問題の本質（実コードで特定済み）

Slack イベントは `teamId` と Slack の `user` ID しか持たない。しかし、それを処理するパイプラインは Cognito の `userId` を必要とする。両者を紐付ける仕組みが無いため、**Slack の user ID が Cognito userId として誤って扱われている**。

### 決定的なバグ箇所

`pkgs/agent/src/task-extractor/TaskExtractorLambdaHandler.ts:60-71`:
```ts
const payload: SlackEventPayload = {
  source: "slack",
  userId: rawEvent.user,   // ← Slack user ID を Cognito userId として代入（バグ）
  message: { userId: rawEvent.user, teamId: detail.teamId, ... },
};
```

結果、TaskCandidate が `userId = SlackユーザーID` で保存され、`GSI-UserCreatedAt` でCognitoユーザーが自分のタスクを取得できない（ミスマッチ）。

### 付随バグ

`pkgs/backend/src/routes/auth.ts:87`:
```ts
const clientId = env.COGNITO_CLIENT_ID; // Slack 用なのに Cognito の client_id（誤用・未使用）
```
実際の `GET /auth/slack` は `process.env.SLACK_CLIENT_ID ?? ""` を使う（`auth.ts:103`）。矛盾コードを整理する。

---

## データフロー（改修後）

```
Slack message
  │ event.user (Slack), team_id (Slack)
  ▼
webhooks.ts → EventBridge Detail { event, teamId, receivedAt }
  ▼
TaskExtractorLambdaHandler
  │ ★ ここで (teamId + event.user) → cognitoSub を逆引き
  │   見つからなければスキップ（未連携ユーザーのメッセージ）
  ▼
SlackEventPayload { userId: cognitoSub, message: { userId: slackUserId, teamId } }
  ▼
TaskExtractorAgent → TaskCandidate (userId = cognitoSub で保存) ✅
```

逆引きの鍵: OAuth 連携時に「どの Cognito ユーザーが、どの Slack team の、どの Slack user か」を保存しておく。

---

## 変更一覧

### 1. shared（型）
- `User` 型に `slackUserId?: string` / `slackTeamId?: string` を追加（オプショナル＝既存互換）
- `ServiceConnection` 型に `slackUserId?: string` / `slackTeamId?: string` を追加
- `IServiceConnectionRepository` に逆引きメソッド `findCognitoSubBySlackIdentity(teamId, slackUserId): Promise<string | null>` を追加

### 2. CDK（インフラ）
- `data-stack.ts`: connections テーブルに **GSI `GSI-SlackLookup`** を追加
  - PK: `slackLookupKey`（= `${slackTeamId}#${slackUserId}` の合成属性）
  - 射影: `KEYS_ONLY`（cognitoSub は PK `USER#<sub>` から復元可能）または `INCLUDE` で cognitoSub
  - 設計: 合成キー属性 `slackLookupKey` を保存時に書き込む
- `webhook-stack.ts` または `agent-stack.ts`: TaskExtractor Lambda に connections テーブル + GSI の Read 権限を付与
  - ※ 逆引きは TaskExtractorLambdaHandler で行うため、AgentStack の TaskExtractor に権限付与

### 3. backend
- `auth.ts`:
  - OAuth コールバックで `oauth.v2.access` レスポンスから `authed_user.id`・`team.id` を取得
  - User を upsert（slackUserId/slackTeamId 付き）
  - ServiceConnection を保存（slackUserId/slackTeamId/slackLookupKey 付き）
  - client_id 誤用バグ（`auth.ts:87`）を整理
- `DynamoServiceConnectionRepository.ts`:
  - `saveForUser` で `slackLookupKey` 合成属性を書き込む
  - `findCognitoSubBySlackIdentity(teamId, slackUserId)` を GSI Query で実装
- `DynamoUserRepository` は型追加に追従（upsert がそのまま slackUserId/slackTeamId を保存）

### 4. agent
- `TaskExtractorLambdaHandler.ts`:
  - connections テーブルへアクセスする逆引きリポジトリを初期化
  - `(detail.teamId + rawEvent.user)` から cognitoSub を逆引き
  - 見つからなければ `logInfo({ action: "skipped_unlinked_slack_user" })` でスキップ（未連携ユーザー）
  - `payload.userId = cognitoSub`、`message.userId = rawEvent.user`（Slack ID は仮名化用に保持）

### 5. テスト
- shared: 型変更に伴う既存テストの追従
- backend: auth コールバック（authed_user 保存）、Repository 逆引き、connectionsの slackLookupKey 書き込み
- agent: TaskExtractorLambdaHandler の逆引き成功/失敗（未連携スキップ）

---

## 設計判断・留意点

- **オプショナル属性**: 既存ユーザー・既存接続レコードは slackUserId 未設定。逆引きで見つからない場合は安全にスキップ（エラーにしない）。
- **GSI 射影**: KEYS_ONLY が最安だが、cognitoSub を直接取りたいので合成キー `slackLookupKey` を PK にして、テーブル本体の PK(`USER#<sub>`) を射影に含める（または cognitoSub 属性を INCLUDE）。実装時に最小射影で確定。
- **既知の Floci 制限**: GSI 作成は Floci で動くが、EventBridge ルールの一部が CREATE_FAILED になる既知問題あり（本番では正常）。検証は GSI 部分のみ Floci、E2E は実 AWS。
- **冪等性**: OAuth 再連携時は同じ slackLookupKey で上書き（PutItem）。
- **プライバシー**: TaskCandidate の requester は引き続き仮名化（BR-05）。slackUserId はユーザー紐付け専用で、タスク本文には残さない。

---

## 実装順序（このPR内）

1. shared 型・インターフェース追加 → ビルド
2. CDK GSI + 権限（synth で検証）
3. backend Repository 逆引き + auth コールバック保存 + バグ修正
4. agent TaskExtractorLambdaHandler 逆引き
5. 各層テスト追加 → 全テストパス確認
6. Biome / typecheck / build 確認
