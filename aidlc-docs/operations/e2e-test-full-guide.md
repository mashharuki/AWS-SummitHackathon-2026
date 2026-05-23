# A〜D 全機能 E2E テスト完全手順書

**作成日**: 2026-05-24
**対象環境**: 実AWS ap-northeast-1 / アカウント 853672407542
**デプロイ済みエンドポイント**:
- フロント: https://dd85fdpvb9hjv.cloudfront.net
- API: https://gzo2aekr6c.execute-api.ap-northeast-1.amazonaws.com
- Webhook: https://knqhtglyei57eztvrfojzmze640xqogz.lambda-url.ap-northeast-1.on.aws/
- Cognito ドメイン: https://saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com

---

## ⚠️ テスト前に必須の前提作業（2つ）

### 前提1: Bedrock の Anthropic use case フォーム提出【ユーザー作業・必須】
判定（Sonnet）と口調変換（Haiku）の両方がこれ未提出だと `ResourceNotFoundException` で動かない。
1. https://ap-northeast-1.console.aws.amazon.com/bedrock/home?region=ap-northeast-1#/modelaccess
2. Anthropic Claude Sonnet 4.6 / Haiku 4.5 の use case フォームを提出
3. 提出後 数分〜15分 で有効化

### 前提2: Slack OAuth が動くためのコード/設定修正【要対応】
現状のままだと B/C の Slack 連携が動かない既知の問題が2つある:
- **問題A**: `SLACK_CLIENT_ID` 環境変数が API Lambda に未設定 → OAuth 開始リダイレクトが client_id 空で失敗
- **問題B**: `client-secret-dev` シークレットは `{clientId, clientSecret}` のJSON形式が必要だが register スクリプトは単体文字列を入れる
→ これらは Slack アプリ作成後に対応（後述の手順で反映）

---

## テスト順序

A（ログイン・ユーザー情報）→ D（ペルソナ切替）→ B（Slack連携）→ C（履歴取得・返信）

A/D は Slack 不要。B/C は Slack アプリ設定が前提。

---

## 【A】ユーザー名・メール表示  ※確認済み（2026-05-24）

1. https://dd85fdpvb9hjv.cloudfront.net を開く
2. サインアップ（メール・名前・パスワード → メール認証コード）
3. ログイン → 設定（⚙️）画面
4. ✅ 名前・メールが表示される（id_token 経由）→ **確認済み**

---

## 【D】ペルソナ切替  ※前提1（Bedrock）が必要

1. 設定 → AIペルソナ → 人格を選ぶ（おっとり/鬼コーチ/心理士/エンジニア）
2. タスクタブ → タスクを手動追加（「+」）
3. 追加したタスクを**タップして詳細画面（/tasks/:id）を開く** ← 判定はここで自動生成
4. ✅ 判定（サボれる/微妙/やるべき）が、選んだ人格の口調で表示される
5. 別人格に変えて**別の新タスク**を追加→詳細を開く → 同じ判定でも口調が変わる
   - おっとり: 「〜だよぉ ☁️」/ 鬼コーチ: 「結論: 〜。以上だ。」/ 心理士: 問いかけ / エンジニア: 箇条書き
   - ※ 同一タスクは判定がキャッシュされるため、口調比較は別タスクで

> 判定が出ない場合: 前提1（Bedrock フォーム）未完了か、CloudWatch Logs `/aws/lambda/saborou-api-dev` を確認。

---

## 【B+C】Slack 連携  ※Slack アプリ作成が必要（15〜30分）

### B-1. Slack アプリ作成
1. https://api.slack.com/apps → Create New App → From scratch
2. App名「SABOROU（test）」、ワークスペースを選択
3. 控える: **Client ID**, **Client Secret**, **Signing Secret**（Basic Information）

### B-2. OAuth スコープ設定
OAuth & Permissions → Bot Token Scopes:
`channels:history` / `groups:history` / `im:history` / `mpim:history` / `users:read` / `chat:write`

### B-3. Redirect URL 登録
OAuth & Permissions → Redirect URLs:
`https://gzo2aekr6c.execute-api.ap-northeast-1.amazonaws.com/auth/slack/callback`

### B-4. シークレットを Secrets Manager に登録（JSON形式に注意）
> client-secret は `{clientId, clientSecret}` JSON で入れる（コードが JSON.parse するため）
```bash
# Signing Secret（単体文字列）
aws secretsmanager put-secret-value \
  --secret-id "/saborou/slack/signing-secret-dev" \
  --secret-string "<SLACK_SIGNING_SECRET>" --region ap-northeast-1

# Client Secret（JSON 形式！）
aws secretsmanager put-secret-value \
  --secret-id "/saborou/slack/client-secret-dev" \
  --secret-string '{"clientId":"<SLACK_CLIENT_ID>","clientSecret":"<SLACK_CLIENT_SECRET>"}' \
  --region ap-northeast-1
```

### B-5. SLACK_CLIENT_ID を API Lambda 環境変数に追加【コード修正】
`api-stack.ts` の HonoFn environment に `SLACK_CLIENT_ID` を追加し再デプロイ。
（OAuth 開始リダイレクトに必要。詳細は実装時に対応）

### B-6. Slack Event Subscriptions（Webhook URL 登録）
Event Subscriptions → Request URL:
`https://knqhtglyei57eztvrfojzmze640xqogz.lambda-url.ap-northeast-1.on.aws/`
→ Verified 表示を確認 → Subscribe to bot events: `message.channels` 等

### B-7. アプリをワークスペースにインストール → チャンネルに招待
`/invite @SABOROU`

### B の確認
1. フロント設定画面 → Slack 連携ボタン → OAuth 承認
2. ✅ 連携済み表示。User に slackUserId/slackTeamId が保存される
3. Slack のチャンネルにタスク依頼を投稿（例「明日までに資料作って」）
4. ✅ フロントのタスク候補に出る（逆引き成功）

### C の確認
- C-1 遡及取得: `POST /api/slack/sync-messages {channelId}` → 過去メッセージがタスク候補化
- C-2 返信: `POST /api/slack/notify-task {taskId, channelId}` → Slack に判定が投稿される

---

## トラブル時の調査
- API Lambda: CloudWatch Logs `/aws/lambda/saborou-api-dev`
- TaskExtractor: `/aws/lambda/saborou-task-extractor-dev`
- Webhook: `/aws/lambda/saborou-webhook-dev`

## 後片付け
`pnpm cdk run destroy --all --force`
