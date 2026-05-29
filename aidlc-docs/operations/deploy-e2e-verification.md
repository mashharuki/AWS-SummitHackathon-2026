# 実AWS デプロイ & E2E 確認手順（A〜D 検証）

**作成日**: 2026-05-23
**対象**: main `769dade`（A: ユーザー情報表示 / B: Slack↔Cognito紐付け / C: Bot Token+Slack履歴+返信 / D+E: ペルソナ切替）
**リージョン**: ap-northeast-1 / **アカウント**: 853672407542

完全な初回デプロイ（既存スタックなし）。以下の順序で進める。

---

## 事前条件チェック結果（2026-05-23 調査）

| 項目 | 状態 |
|---|---|
| AWS 認証 | ✅ user/shinei.kikkawa |
| CDK bootstrap | ❌ 未実施 → 手順1 |
| SSM `/saborou/oauth/state-secret` | ❌ 未登録 → 手順2 |
| SSM `/saborou/pseudonymize-salt-dev` | ❌ 未登録 → 手順2 |
| Slack signing/client secret（Secrets Manager） | ❓ デプロイで枠は作られる。値は手順5で登録 |
| Bedrock Sonnet 4.6 | ✅ jp.anthropic.claude-sonnet-4-6 利用可 |
| Bedrock Haiku 4.5 | ✅ jp.anthropic.claude-haiku-4-5-20251001-v1:0 利用可（PR #28 で対応） |
| Slack アプリ | ❓ 手順4・6（ユーザー作業） |

---

## デプロイ手順

### 手順1: CDK bootstrap（初回のみ）
```bash
cd pkgs/cdk
npx cdk bootstrap aws://853672407542/ap-northeast-1
```

### 手順2: 必須 SSM パラメータを登録（デプロイ前に必要）
CDK が `valueForStringParameter` でデプロイ時に参照するため、deploy より前に作る。
```bash
# OAuth state HMAC secret（CSRF対策）
aws ssm put-parameter --name "/saborou/oauth/state-secret" \
  --value "$(openssl rand -hex 32)" --type "SecureString" --region ap-northeast-1
# 仮名化ソルト
aws ssm put-parameter --name "/saborou/pseudonymize-salt-dev" \
  --value "$(openssl rand -hex 16)" --type "String" --region ap-northeast-1
```
> 注: README は salt をデプロイ後に作るとあるが、AgentStack が参照するため**デプロイ前**に作る。

### 手順3: ビルド & デプロイ
```bash
# リポジトリルートで
pnpm shared run build
pnpm agent run build
pnpm backend run build
pnpm frontend run build
pnpm cdk run deploy --require-approval never --all
```
完了後、CfnOutput から以下を控える:
- HttpApiUrl（API Gateway）
- Cognito UserPool/Client ID、Hosted UI ドメイン
- CloudFront ドメイン（フロント）
- WebhookUrl

### 手順4: Slack アプリ作成（ユーザー作業）
`slack-app-setup.md` STEP 1-2 に従う。
- Bot Token Scopes: channels:history / groups:history / im:history / mpim:history / users:read / **chat:write**
- Redirect URL: `{HttpApiUrl}/auth/slack/callback`

### 手順5: Slack シークレットを Secrets Manager に登録
```bash
SLACK_SIGNING_SECRET=xxx SLACK_CLIENT_ID=xxx SLACK_CLIENT_SECRET=xxx \
  pnpm run register:secret
```
（`scripts/register_slack_secret.sh` の実装に合わせる）

### 手順6: Slack Event Subscriptions に Webhook URL 登録（ユーザー作業）
`slack-app-setup.md` STEP 5。Request URL = WebhookUrl。

---

## E2E 確認シナリオ（A〜D）

| # | 機能 | 手順 | 期待結果 |
|---|---|---|---|
| A | ユーザー情報表示 | フロントにログイン → 設定画面 | 名前・メールが表示される（id_token 経由） |
| B | Slack↔Cognito紐付け | 設定でSlack連携 → Slackにタスク依頼を投稿 | 自分のタスク候補に出る（逆引き成功） |
| C-1 | Slack履歴の遡及取得 | POST /api/slack/sync-messages | 過去メッセージがタスク候補化 |
| C-2 | Slack返信 | POST /api/slack/notify-task | Slackチャンネルに判定が投稿される |
| D+E | ペルソナ切替 | 設定でペルソナを鬼コーチ等に変更 → 判定生成 | 同じ判定が違う口調で返る |

---

## 後片付け
```bash
pnpm cdk run destroy --all --force
# SSM / Secrets Manager の一部は手動削除が必要
```

---

## 再デプロイ手順（2回目以降・例: 翌日の再開）

初回デプロイ済みなら bootstrap と SSM パラメータは**残っている**ため、再現は deploy だけで済む。

```bash
cd /Users/shineikikkawa/dev/hackson/AWS-SummitHackathon-2026
git checkout main && git pull   # 最新（A〜D+Haiku修正込み）
# ビルド
pnpm shared run build && pnpm agent run build && pnpm backend run build && pnpm frontend run build
# デプロイ
pnpm cdk run deploy --require-approval never --all
```
- bootstrap 不要（CDKToolkit 残存）
- SSM `/saborou/oauth/state-secret`(String) と `/saborou/pseudonymize-salt-dev`(String) は残存（destroy で消えない）。消えていたら手順2を再実行
- デプロイ後、CfnOutput を再取得（API/Cognito/CloudFront/Webhook の URL は再生成される場合あり）

### 2026-05-23 初回デプロイ時の確認済み事項
- 全7スタック CREATE_COMPLETE を確認（途中 SignatureDoesNotMatch=マシンスリープ起因の一時エラーで残り3スタックのみ再デプロイして完走）
- Cognito callbackURL に CloudFront ドメインが自動登録されることを確認済み
- env-config.json（ConfigDeployStack）が実 API/Cognito URL を配信する設計を確認済み
- **未実施の E2E**: A（ログイン→設定画面で名前/メール表示）/ B（Slack連携→投稿→タスク化）/ C（履歴遡及・Slack返信）/ D（ペルソナ切替）
- **既知の注意点**: `register_slack_secret.sh` は client-secret-dev に Client Secret のみ登録するが、auth.ts コールバックは `{clientId, clientSecret}` のJSON形式を期待 → Slack OAuth 時に要対処
