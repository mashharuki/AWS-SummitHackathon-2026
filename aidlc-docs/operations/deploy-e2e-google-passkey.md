# 実AWS デプロイ & E2E 確認手順（F: Google連携 / G: パスキー認証 / URL固定化）

PR #39（`feature/google-integration`）の **F: Google連携（Gmail/Calendar）**・**G: パスキー認証**・
**URL固定化（カスタムドメイン）** を、実 AWS にデプロイして自分で動作確認するための手順。

> リージョンは **ap-northeast-1**（CloudFront 用証明書のみ **us-east-1**）、AWS アカウントは **055259484931（mameta）**。
> ドメインは **Cloudflare 管理の `agentic-jp.com`**。Slack 系（A〜E）の基本は `deploy-e2e-verification.md` も参照。

## 固定ドメイン（destroy/deploy しても不変）

| サービス | 固定ドメイン |
|---|---|
| フロント (CloudFront) | `https://saborou.agentic-jp.com` |
| API (HTTP API) | `https://saborou-api.agentic-jp.com` |
| 認証 (Cognito・元々固定) | `https://saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com` |

→ **Slack / Google の Redirect URL は初回1回だけ登録すれば、以降 destroy/deploy しても再設定不要。**

---

## 0. 全体像

```
【準備】
A. Google Cloud Console で OAuth クライアント作成（固定ドメインでRedirect URI確定登録）
B. SSM に google/client-id 登録
C. CDK bootstrap（ap-northeast-1 + us-east-1 の両方）

【証明書フェーズ（customDomain=true の段階性）】
D. 証明書スタックだけ先に deploy → 検証用CNAMEを Cloudflare 登録 → Issued 待ち（5〜30分）

【本デプロイ】
E. Google client-secret を Secrets に JSON 登録 → 全スタック deploy
F. CfnOutput の CNAME（saborou / saborou-api）を Cloudflare 登録（Proxy OFF）
G. Slack / Google の Redirect URL を固定ドメインで登録（初回のみ）

【E2E】
H. https://saborou.agentic-jp.com で動作確認（パスキー・Google・Slack）

【後片付け】
I. destroy（課金停止）。次回は D の証明書から or 既存証明書を残せば E から
```

---

## 1. 事前条件

- [ ] `aws sts get-caller-identity` がアカウント **055259484931** を返す
- [ ] `pnpm install` 済み・`pnpm -r build` が通る
- [ ] **CDK bootstrap（ap-northeast-1 と us-east-1 の両方）** — 手順 C 参照
- [ ] Bedrock モデルアクセス有効（Sonnet 4.6 / Haiku 4.5）
- [ ] Cloudflare で `agentic-jp.com` の DNS を編集できる
- [ ] パスキー検証用に **WebAuthn 対応ブラウザ + 認証器**（Touch ID / Windows Hello / スマホ / YubiKey）

---

## A. Google Cloud Console 設定（新 UI「Google Auth Platform」）

> 新 UI ではメニュー名が変わっている: **Branding**=アプリ情報 / **Audience**=対象ユーザー+テストユーザー / **Data Access**=スコープ / **Clients**=OAuthクライアント。

### A-1. API 有効化
ハンバーガー(☰) →「API とサービス」→「ライブラリ」で有効化:
- **Gmail API**
- **Google Calendar API**

### A-2. Audience（対象ユーザー）
左メニュー **Audience** → User type が **External** であること → **Test users** に自分の Google アカウントを追加。

### A-3. Data Access（スコープ）
左メニュー **Data Access** →「Add or remove scopes」or「Manually add scopes」で2つ追加:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`

### A-4. Clients（OAuthクライアント作成）
左メニュー **Clients** →「Create OAuth client」:
- Application type: **Web application**
- Name: `saborou-web`
- **Authorized redirect URIs**: 固定ドメインなので**最初から確定登録できる**:
  ```
  https://saborou-api.agentic-jp.com/api/auth/google/callback
  ```
  （⚠️ パスは `/api/auth/google/callback`）
- 作成 → **Client ID** と **Client secret** を控える

---

## B. SSM に Google Client ID 登録

```bash
export AWS_REGION=ap-northeast-1
aws ssm put-parameter \
  --name "/saborou/google/client-id" \
  --type String \
  --value "<Google の クライアント ID>" \
  --region ${AWS_REGION} \
  --overwrite
```

> Slack 系 SSM（`/saborou/oauth/state-secret`・`/saborou/pseudonymize-salt-dev`・`/saborou/slack/client-id`）は登録済み。

---

## C. CDK bootstrap（両リージョン）

カスタムドメインの CloudFront 証明書は **us-east-1** に作るため、**us-east-1 も bootstrap が必要**。

```bash
ACCOUNT=055259484931
pnpm --filter cdk exec cdk bootstrap aws://${ACCOUNT}/ap-northeast-1   # 済みなら不要
pnpm --filter cdk exec cdk bootstrap aws://${ACCOUNT}/us-east-1        # 今回必要（未実施）
```

---

## D. 証明書フェーズ（先に証明書だけ deploy → Cloudflare 検証 → Issued 待ち）

### D-1. 証明書スタックだけ deploy
```bash
pnpm --filter cdk exec cdk deploy SaborouAcmUsEast1-dev SaborouAcmApi-dev \
  -c customDomain=true -c environment=dev --require-approval never
```

### D-2. ACM 検証用 CNAME を Cloudflare に登録
- **ACM コンソール（us-east-1）** → 証明書 `saborou.agentic-jp.com` → 「ドメイン」欄の **検証 CNAME（Name / Value）**
- **ACM コンソール（ap-northeast-1）** → 証明書 `saborou-api.agentic-jp.com` → 同上
- Cloudflare DNS にそれぞれ追加:
  ```
  Type: CNAME
  Name: <ACMが示すName（例 _xxxx.saborou）>
  Target: <ACMが示すValue（例 _yyyy.zzz.acm-validations.aws）>
  Proxy status: DNS only（グレー雲・OFF） ← 必須
  TTL: Auto
  ```

### D-3. Issued になるまで待機
ACM コンソールでステータスが `Pending validation` → **`Issued`** になるまで待つ（通常 5〜30 分）。

---

## E. 本デプロイ

### E-1. Google Client Secret を Secrets Manager に JSON 形式で登録
> ⚠️ CDK が空の Secret を作る。バックエンドは `JSON.parse` で `{clientId, clientSecret}` を期待（**値のみだと OAuth 失敗**）。

証明書 deploy 後（Secret リソースが既にあれば put-secret-value、無ければ全 deploy 後に実施）:
```bash
export ENV=dev AWS_REGION=ap-northeast-1
aws secretsmanager put-secret-value \
  --secret-id "/saborou/google/client-secret-${ENV}" \
  --secret-string '{"clientId":"<クライアントID>","clientSecret":"<クライアントシークレット>"}' \
  --region ${AWS_REGION}
```

### E-2. 全スタック deploy（customDomain=true）
```bash
pnpm -r build
pnpm cdk run deploy --all -c customDomain=true -c environment=dev --require-approval never
```
- デプロイ中は **PC をスリープさせない**（SignatureDoesNotMatch 回避）。

---

## F. サービス向け CNAME を Cloudflare に登録（証明書 Issued 後）

deploy 出力（CfnOutput）から値を取得:
```bash
aws cloudformation describe-stacks --stack-name SaborouFrontend-dev --region ap-northeast-1 \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name SaborouApi-dev --region ap-northeast-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiDomainRegionalDomainName'].OutputValue" --output text
```

Cloudflare に登録（**Proxy OFF / DNS only**）:
| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `saborou` | `<CloudFrontDomainName>`（例 dxxxx.cloudfront.net） | DNS only |
| CNAME | `saborou-api` | `<ApiDomainRegionalDomainName>` | DNS only |

---

## G. Slack / Google の Redirect URL 登録（初回のみ・以降不要）

### G-1. Google（A-4 で登録済みなら確認のみ）
- Redirect URI: `https://saborou-api.agentic-jp.com/api/auth/google/callback`

### G-2. Slack（Slack 連携を使う場合）
- Slack アプリ → OAuth & Permissions → Redirect URLs:
  ```
  https://saborou-api.agentic-jp.com/api/auth/slack/callback
  ```
- Event Subscriptions の Request URL は Webhook Lambda Function URL（CfnOutput `WebhookUrl`）。

---

## H. E2E 確認シナリオ

### H-A. パスキー認証（G）
1. `https://saborou.agentic-jp.com` を開く → ログイン → Cognito **マネージドログイン（v2 UI）** へ遷移
   （パスキー登録/認証は Cognito マネージドログイン画面上＝RP ID と一致）
2. **初回はパスワードでサインイン**（未登録ならサインアップ）
3. マネージドログインの **パスキー登録**フローで登録（Touch ID 等）
4. サインアウト → 再度 **パスキーでサインイン** → 入れることを確認
5. ✅ パスキーで入れる / パスワードでも入れる（フォールバック維持）

### H-B. Google 連携 → Calendar 取り込み
1. 設定画面の「**Google 連携**」→ 同意 → 戻る → 「連携済み」表示
2. 「**カレンダーを取り込む**」→ 件数・最終取得時刻表示（予定タイトルは保存されない）

### H-C. Gmail → タスク抽出
1. 「**Gmail を取り込む**」→ 直近7日の未読から AI がタスク候補化（本文は保存されない）

### H-D. 予定考慮のサボり判定
1. タスクで「サボり判定」→ Calendar 取り込み済みなら多忙度・次の予定までの時間が反映

---

## I. 後片付け（課金停止）

```bash
pnpm cdk run destroy --all -c customDomain=true -c environment=dev --force
```
- ⚠️ **ACM 証明書スタック（SaborouAcmUsEast1/AcmApi）を残せば、次回は手順 E から再開でき検証待ちが不要**。証明書は無料なので残す運用が楽（destroy 対象から外すか、別途残す）。
- Cognito Essentials は MAU 1,000 まで無料。`RemovalPolicy.RETAIN` のため UserPool は残る場合あり。
- **Cloudflare の CNAME は destroy しても消えない**（固定ドメインの肝）。向き先は次回 deploy で同じ値になるため再登録不要。

---

## つまずきポイント早見表

| 症状 | 原因 / 対処 |
|---|---|
| us-east-1 証明書スタックの deploy 失敗 | us-east-1 が未 bootstrap。手順 C の us-east-1 bootstrap を実施 |
| 証明書が Pending のまま | 検証 CNAME 未登録 or Cloudflare Proxy ON。手順 D-2 を Proxy OFF で |
| `saborou.agentic-jp.com` に繋がらない | CNAME 未登録 or Proxy ON。手順 F を Proxy OFF で。CloudFront 反映に数分 |
| Google OAuth `redirect_uri did not match` | Google Console の Redirect URI が `https://saborou-api.agentic-jp.com/api/auth/google/callback` と一致するか |
| Google token 交換失敗 / JSON.parse エラー | client-secret を値のみで登録した。手順 E-1 の JSON 形式で登録し直す |
| Gmail/Calendar が 403 | スコープ不足 or テストユーザー未登録（手順 A-2/A-3） |
| パスキー登録ボタンが出ない/失敗 | 非 HTTPS。Cognito マネージドログイン画面で操作。ブラウザ/認証器が WebAuthn 非対応 |
| デプロイが SignatureDoesNotMatch | PC スリープ。スリープ無効化で再実行 |
