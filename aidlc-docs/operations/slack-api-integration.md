# Slack API 連携ガイド（Bot Token を能動的に使う）

タスクCで追加した「Slack からタスク一覧取得」「インタラクティブ返信」の仕組みをまとめる。
Webhook 受信（Slack → SABOROU）の設定は [slack-app-setup.md](./slack-app-setup.md) を参照。

---

## 全体像

```
[遡及取得: Slack 履歴 → タスク化]
ユーザー（認証済み）
  │ POST /api/slack/sync-messages { channelId, oldest?, limit? }
  ▼
backend (HonoFn)
  │ getSlackToken(cognitoSub) で per-user Bot Token 取得
  │ SlackClient.conversationsHistory() で過去メッセージ取得
  │ bot/subtype/空 を除外
  │ 各メッセージを EventBridge (SlackBackfill, userId 直接) へ publish
  ▼
TaskExtractor Lambda
  │ SlackBackfill を検知（逆引き不要）→ Bedrock でタスク抽出 → TaskCandidate 保存
  ▼
GET /api/tasks/candidates でユーザーが確認・承認

[インタラクティブ返信: 判定 → Slack 投稿]
ユーザー（認証済み）
  │ POST /api/slack/notify-task { taskId, channelId, threadTs? }
  ▼
backend
  │ タスク所有者確認 → 最新 Proposal の verdict 取得
  │ getSlackToken(cognitoSub) → SlackClient.postMessage()
  ▼
Slack チャンネル/スレッドにサボロー口調で投稿
```

---

## SlackClient（`pkgs/agent/src/slack-client/SlackClient.ts`）

Bot Token を受け取る薄いラッパー。

| メソッド | Slack API | 必要スコープ |
|---|---|---|
| `conversationsHistory({channel, oldest?, limit?})` | `conversations.history` | `channels:history` 他 |
| `postMessage({channel, text, thread_ts?})` | `chat.postMessage` | `chat:write` |

- fetch + AbortController で **5 秒タイムアウト**（Lambda タイムアウトとの整合）
- Slack は HTTP 200 でも `ok:false` を返すため両方を検査し、失敗時は `SlackApiError` を投げる
- レート制限（HTTP 429）は `SlackApiError("http_429")` として伝播

---

## per-user Bot Token の取得

- OAuth コールバックで `saborou/slack-bot-token/<cognitoSub>` に保存（[slack-app-setup.md](./slack-app-setup.md) STEP 6-2）
- `getSlackToken(userId)`（`ContextCollector`）が `${SLACK_BOT_TOKEN_SECRET_PREFIX}${userId}` を解決
- Lambda ウォーム呼び出し時は userId 別にキャッシュ（DP-06）

### 必要な環境変数 / IAM（CDK 設定済み）

| Lambda | env | IAM |
|---|---|---|
| api (HonoFn) | `SLACK_BOT_TOKEN_SECRET_PREFIX`, `EVENT_BUS_NAME` | `secretsmanager:GetSecretValue` on `saborou/slack-bot-token/*`, `events:PutEvents` |
| TaskExtractor | `SLACK_BOT_TOKEN_SECRET_PREFIX`, `DYNAMODB_TABLE_CONNECTIONS` | 同上 GetSecretValue, connections 読み取り |
| SaboriProposer | `SLACK_BOT_TOKEN_SECRET_PREFIX` | 同上 GetSecretValue |

---

## API リファレンス

### POST /api/slack/sync-messages（認証必須）

Slack チャンネルの過去メッセージを取得し、タスク候補化キューへ投入する。

リクエスト:
```json
{ "channelId": "C12345", "oldest": "1700000000.000", "limit": 50 }
```
レスポンス:
```json
{ "scanned": 20, "queued": 7 }
```
- `scanned`: 取得した総メッセージ数
- `queued`: タスク化キューに投入した数（bot/subtype/空を除外後）

### POST /api/slack/notify-task（認証必須）

タスクの最新サボり判定を Slack に投稿する。

リクエスト:
```json
{ "taskId": "01HX...", "channelId": "C12345", "threadTs": "1700000000.000" }
```
レスポンス:
```json
{ "posted": true, "ts": "1700000123.456", "verdict": "can_saboru" }
```
- 他人のタスクを指定すると 404
- Proposal が無い場合は `borderline` にフォールバック

---

## 注意点

- **スコープ変更後の再認可**: `chat:write` 追加後、既存連携ユーザーは再連携が必要（古い Bot Token には新スコープが無い）。
- **チャンネルへの Bot 招待**: `conversations.history` / `chat.postMessage` は対象チャンネルに Bot が参加している必要がある（`/invite @SABOROU`）。
- **レート制限**: `conversations.history` は Tier 3。遡及取得は `oldest` / `limit` で範囲を絞る。
- **冪等性**: 同一メッセージの重複タスク化は TaskCandidate の ULID 冪等性に委ねる（完全な重複排除は MVP スコープ外）。
- **プライバシー**: 取り込んだメッセージの依頼者は仮名化（BR-05）。Slack 本文は TaskCandidate 保存後に破棄。
