# Slack App 設定ガイド — 本番 Webhook URL 登録手順

**プロジェクト名**: SABOROU（サボロー）  
**バージョン**: v1.0.0  
**作成日**: 2026-05-21  
**対象**: 予選会デモ環境（AWS ap-northeast-1）  
**所要時間**: 約 30〜45 分（CDK deploy 完了済みの前提）

---

## 全体フロー

```
[STEP 1] Slack App 新規作成
      ↓
[STEP 2] OAuth スコープ設定
      ↓
[STEP 3] Slack 資格情報を Secrets Manager に登録
      ↓
[STEP 4] CDK deploy → Lambda Function URL を取得
      ↓
[STEP 5] Slack Event Subscriptions に Request URL を登録
      ↓
[STEP 6] Slack App を Workspace にインストール
      ↓
[STEP 7] 動作確認（E2E テスト）
```

---

## 前提条件

| 項目 | 確認内容 |
|------|---------|
| AWS CLI | `aws sts get-caller-identity` が成功すること |
| CDK deploy | `SaborouDataStack` および `SaborouWebhookStack` がデプロイ済みであること |
| Slack ワークスペース | テスト用 Slack ワークスペースへの管理者権限があること |
| Node.js | v23 以上（`.nvmrc` 参照） |

---

## STEP 1: Slack App 新規作成

### 1-1. Slack API ポータルにアクセス

1. ブラウザで [https://api.slack.com/apps](https://api.slack.com/apps) を開く
2. Slack アカウントでサインイン（テスト用ワークスペースの管理者アカウントを使用）
3. 右上の **「Create New App」** をクリック

### 1-2. 作成方法を選択

- **「From scratch」** を選択

### 1-3. App 情報を入力

| 項目 | 値 |
|------|----|
| App Name | `SABOROU` |
| Pick a workspace to develop your app in | テスト用ワークスペースを選択 |

**「Create App」** をクリック。

### 1-4. App ID を控える

作成後、**Basic Information** ページに遷移する。  
URL に含まれる App ID（例: `A0XXXXXXXX`）をメモしておく。

---

## STEP 2: OAuth スコープ設定

### 2-1. Bot Token Scopes を追加

左メニュー → **「OAuth & Permissions」** を開く。  
**「Scopes」** セクションの **「Bot Token Scopes」** で以下を追加:

| スコープ | 用途 |
|---------|------|
| `channels:history` | パブリックチャンネルのメッセージ取得 |
| `groups:history` | プライベートチャンネルのメッセージ取得 |
| `im:history` | DM（ダイレクトメッセージ）取得 |
| `mpim:history` | グループ DM のメッセージ取得 |
| `users:read` | ユーザーステータス・プロフィール取得（サボり判定に使用） |

> **注**: これらは `routes/auth.ts` の `SLACK_OAUTH_SCOPES` 定数で定義されているスコープと完全に一致させること。

### 2-2. Redirect URLs を追加

同じページ **「Redirect URLs」** セクション → **「Add New Redirect URL」** をクリック。  
CDK deploy 後に取得した API Gateway URL を以下の形式で追加:

```
https://{API_GATEWAY_ID}.execute-api.ap-northeast-1.amazonaws.com/auth/slack/callback
```

> API Gateway URL の確認方法は STEP 4 参照。

**「Save URLs」** をクリック。

---

## STEP 3: Slack 資格情報を Secrets Manager に登録

Slack App の **Basic Information** ページから以下の情報を取得し、Secrets Manager に登録する。

### 3-1. Signing Secret の取得

**Basic Information** → **「App Credentials」** セクション:

- **Signing Secret** の横の「Show」をクリックして値をコピー

### 3-2. Client Secret の取得

同じ **「App Credentials」** セクション:

- **Client Secret** の横の「Show」をクリックして値をコピー

### 3-3. Client ID の取得

同じセクション:

- **App ID** および **Client ID** をコピー

### 3-4. Secrets Manager に値を登録

CDK が作成したシークレットプレースホルダーに実際の値を書き込む。

```bash
# 環境変数設定
export SIGNING_SECRET="ここにSlackのSigning Secretを貼り付ける"
export CLIENT_SECRET="ここにSlackのClient Secretを貼り付ける"

pnpm run register:secret
```

---

## STEP 4: CDK deploy → Lambda Function URL の取得

### 4-1. バックエンドビルド（未実施の場合）

```bash
# リポジトリルートで実行
pnpm shared run build
pnpm backend run build
```

### 4-2. WebhookStack デプロイ

```bash
# DataStack が先にデプロイされている必要あり
pnpm cdk run deploy SaborouDataStack --require-approval never
pnpm cdk run deploy SaborouWebhookStack --require-approval never
```

### 4-3. Lambda Function URL を取得

デプロイ完了後、CDK の出力から `WebhookUrl` を取得する。

```bash
# CfnOutput から WebhookUrl を取得
aws cloudformation describe-stacks \
  --stack-name SaborouWebhookStack \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
  --output text
```

出力例:
```
https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws/
```

> この URL が Slack Event Subscriptions に登録する **Lambda Function URL** となる。

### 4-4. API Gateway URL を取得（Redirect URL 用）

```bash
aws cloudformation describe-stacks \
  --stack-name SaborouApiStack \
  --region ap-northeast-1 \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

出力例:
```
https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
```

---

## STEP 5: Slack Event Subscriptions に Request URL を登録

### 5-1. Event Subscriptions を有効化

Slack API ポータル → 左メニュー **「Event Subscriptions」** → **「Enable Events」** トグルを **ON** にする。

### 5-2. Request URL を入力

**「Request URL」** フィールドに以下の URL を入力:

```
{Lambda Function URL}/webhooks/slack
```

具体例:
```
https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws/webhooks/slack
```

> **重要**: URL の末尾に `/webhooks/slack` を付けること。Lambda Function URL 単体では `404` になる。

### 5-3. Verification（検証）の確認

URL を入力すると、Slack が自動的に以下のリクエストを送信する:

```json
{
  "token": "...",
  "challenge": "3eZbrw1aBm2rZgRNFdxV2595E9CY3gmdALWMmHkvFXO7tYXBqio",
  "type": "url_verification"
}
```

Lambda は `routes/webhooks.ts` 内で `url_verification` タイプを検出し、自動的に challenge を返す。

**「Verified ✓」** と表示されれば成功。  
失敗した場合は [トラブルシューティング](#トラブルシューティング) を参照。

### 5-4. Subscribe to Bot Events を設定

**「Subscribe to Bot Events」** セクション → **「Add Bot User Event」** をクリックして以下を追加:

| イベント名 | 用途 |
|-----------|------|
| `message.channels` | パブリックチャンネルのメッセージ受信 |
| `message.groups` | プライベートチャンネルのメッセージ受信 |
| `message.im` | DM のメッセージ受信 |
| `message.mpim` | グループ DM のメッセージ受信 |

**「Save Changes」** をクリック。

---

## STEP 6: Slack App を Workspace にインストール

### 6-1. OAuth & Permissions からインストール

左メニュー **「OAuth & Permissions」** → **「Install to Workspace」** をクリック。  
権限確認ダイアログで **「許可する」** をクリック。

### 6-2. Bot User OAuth Token を取得

インストール後、**「Bot User OAuth Token」** が表示される（`xoxb-` で始まる）。  
このトークンは後続の Slack API 呼び出しで必要になる場合があるが、  
**SABOROU では Webhook 受信のみのため現時点では不要**。

### 6-3. App がワークスペースに追加されたことを確認

Slack ワークスペースで **「Apps」** セクションに `SABOROU` が表示されていることを確認する。

---

## STEP 7: 動作確認（E2E テスト）

### 7-1. テスト用チャンネルに App を招待

Slack ワークスペースのテスト用チャンネルで以下のコマンドを実行:

```
/invite @SABOROU
```

### 7-2. テストメッセージを送信

チャンネルにメッセージを送信:

```
テスト: 明日の提案書レビュー、今日中に準備してください
```

### 7-3. CloudWatch ログで受信確認

```bash
# Webhook Lambda のログを確認
aws logs tail /aws/lambda/saborou-webhook-dev \
  --region ap-northeast-1 \
  --follow \
  --since 5m
```

期待するログ出力:
```json
{"level":"info","message":"[WEBHOOK] Slack event received","type":"event_callback"}
{"level":"info","message":"[WEBHOOK] EventBridge put succeeded"}
```

### 7-4. TaskExtractor Lambda のログ確認

```bash
# TaskExtractor Lambda のログを確認
aws logs tail /aws/lambda/saborou-task-extractor-dev \
  --region ap-northeast-1 \
  --follow \
  --since 5m
```

### 7-5. DynamoDB にタスク候補が保存されているか確認

```bash
# TaskCandidates テーブルを確認
aws dynamodb scan \
  --table-name saborou-task-candidates-dev \
  --region ap-northeast-1 \
  --select COUNT \
  --query 'Count'
```

0 以上の数値が返れば、Slack → Webhook → EventBridge → TaskExtractor → DynamoDB の全フローが正常に動作している。

---

## デモ用環境の事前準備

### デモ当日のための事前データ投入

デモ開始時にタスク一覧が空だと Slack 送信 → 抽出 → 承認の手順が必要になり時間を消費する。  
以下のスクリプトで事前にデモ用タスクデータを DynamoDB に直接投入しておく。

```bash
# デモ用タスクデータ投入
export DEMO_USER_ID="demo-user-001"
export TABLE_TASKS="saborou-tasks-dev"
export REGION="ap-northeast-1"
export NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# タスク1: サボれる状態（デモの核心）
aws dynamodb put-item \
  --table-name ${TABLE_TASKS} \
  --region ${REGION} \
  --item '{
    "pk": {"S": "USER#'"${DEMO_USER_ID}"'"},
    "sk": {"S": "TASK#demo-task-001"},
    "taskId": {"S": "demo-task-001"},
    "userId": {"S": "'"${DEMO_USER_ID}"'"},
    "title": {"S": "提案資料の初稿作成"},
    "source": {"S": "slack"},
    "status": {"S": "approved"},
    "slackContext": {"S": "依頼者は別件でオフライン中"},
    "urgencyLevel": {"S": "low"},
    "createdAt": {"S": "'"${NOW}"'"},
    "updatedAt": {"S": "'"${NOW}"'"}
  }'

# タスク2: 要注意状態
aws dynamodb put-item \
  --table-name ${TABLE_TASKS} \
  --region ${REGION} \
  --item '{
    "pk": {"S": "USER#'"${DEMO_USER_ID}"'"},
    "sk": {"S": "TASK#demo-task-002"},
    "taskId": {"S": "demo-task-002"},
    "userId": {"S": "'"${DEMO_USER_ID}"'"},
    "title": {"S": "請求書の送付"},
    "source": {"S": "slack"},
    "status": {"S": "approved"},
    "slackContext": {"S": "リマインド2回、締切は明日"},
    "urgencyLevel": {"S": "medium"},
    "createdAt": {"S": "'"${NOW}"'"},
    "updatedAt": {"S": "'"${NOW}"'"}
  }'

# タスク3: 要対応状態
aws dynamodb put-item \
  --table-name ${TABLE_TASKS} \
  --region ${REGION} \
  --item '{
    "pk": {"S": "USER#'"${DEMO_USER_ID}"'"},
    "sk": {"S": "TASK#demo-task-003"},
    "taskId": {"S": "demo-task-003"},
    "userId": {"S": "'"${DEMO_USER_ID}"'"},
    "title": {"S": "ロゴ修正"},
    "source": {"S": "manual"},
    "status": {"S": "approved"},
    "slackContext": {"S": "今日中に必要、クライアントが待機中"},
    "urgencyLevel": {"S": "high"},
    "createdAt": {"S": "'"${NOW}"'"},
    "updatedAt": {"S": "'"${NOW}"'"}
  }'

echo "デモ用タスクデータ投入完了"
```

---

## トラブルシューティング

### ❌ Request URL が「Verified」にならない

**原因1**: Webhook Lambda がデプロイされていない  
```bash
# Lambda の存在確認
aws lambda get-function \
  --function-name saborou-webhook-dev \
  --region ap-northeast-1 \
  --query 'Configuration.State'
# "Active" と返れば OK
```

**原因2**: URL に `/webhooks/slack` が付いていない  
→ `{Lambda Function URL}/webhooks/slack` の形式になっているか再確認。

**原因3**: CORS 設定の問題  
`webhook-stack.ts` の `cors.allowedOrigins` は `["https://hooks.slack.com"]` に設定済み。  
Slack の検証リクエストは CORS を経由しないため通常は問題ない。

**原因4**: Lambda がコールドスタートでタイムアウト  
Slack の url_verification は 3 秒以内に応答が必要。  
初回デプロイ直後はコールドスタートで失敗することがある。30 秒待ってから再試行する。

---

### ❌ HMAC 署名検証エラー（403 Forbidden）

```
[WEBHOOK] Invalid Slack signature
```

**原因**: Secrets Manager の Signing Secret が正しく設定されていない  
```bash
# シークレットが存在するか確認
aws secretsmanager get-secret-value \
  --secret-id "/saborou/slack/signing-secret-dev" \
  --region ap-northeast-1 \
  --query 'SecretString' \
  --output text | wc -c
# 0 以上の文字数が返れば値は存在する
```

**原因**: Lambda の IAM ロールに Secrets Manager へのアクセス権限がない  
```bash
# Lambda 実行ロールの確認
aws lambda get-function-configuration \
  --function-name saborou-webhook-dev \
  --region ap-northeast-1 \
  --query 'Role'
# ロール ARN を確認して IAM コンソールでポリシーを確認する
```

---

### ❌ EventBridge への転送が失敗する

```
[WEBHOOK] EventBridge put failed
```

**原因**: EventBridge カスタムバスが存在しない  
```bash
aws events describe-event-bus \
  --name saborou-event-bus-dev \
  --region ap-northeast-1 \
  --query 'Name'
```

`SaborouWebhookStack` が正常にデプロイされていれば `saborou-event-bus-dev` が返る。

---

### ❌ タスク候補が DynamoDB に保存されない

TaskExtractor Lambda のログを確認:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/saborou-task-extractor-dev \
  --region ap-northeast-1 \
  --start-time $(date -d '10 minutes ago' +%s000) \
  --filter-pattern "ERROR"
```

よくある原因:
1. **Bedrock モデルアクセス未申請**: ap-northeast-1 で `claude-3-5-sonnet-20241022-v2:0` のモデルアクセスが有効化されているか確認
2. **DynamoDB テーブル名の不一致**: `DYNAMODB_TABLE_TASK_CANDIDATES` 環境変数が CDK 出力と一致しているか確認

---

## セキュリティ注意事項

- Signing Secret・Client Secret は絶対にコードにハードコードしない（Secrets Manager 経由のみ）
- Lambda Function URL は `FunctionUrlAuthType.NONE` だが、HMAC-SHA256 検証（リプレイ攻撃防止 5 分制限付き）で保護済み
- `X-Slack-Signature` ヘッダーの検証は `timingSafeEqual` で実装済み（タイミング攻撃防止）

---

## 関連ドキュメント

| ドキュメント | パス |
|------------|------|
| CDK 操作ガイド | `aidlc-docs/operations/cdk-operations.md` |
| API 動作検証ガイド | `aidlc-docs/operations/api-verification-guide.md` |
| バックエンド操作ガイド | `aidlc-docs/operations/backend-operations.md` |
| Slack HMAC 実装 | `pkgs/backend/src/services/slack-verification.ts` |
| Webhook Lambda エントリ | `pkgs/backend/src/webhook-handler.ts` |
| Webhook ルート実装 | `pkgs/backend/src/routes/webhooks.ts` |
| CDK WebhookStack | `pkgs/cdk/lib/stacks/webhook-stack.ts` |

---

*本文書は AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-21）。*
