# 実AWS デプロイ & E2E 確認手順（F: Google連携 / G: パスキー認証）

PR #39（`feature/google-integration`）で追加した **F: Google連携（Gmail/Calendar）** と
**G: パスキー認証** を、実 AWS にデプロイして自分で動作確認するための手順。

> 既存の A〜E（Slack 系）の手順は `deploy-e2e-verification.md` を参照。本書はそれに F/G を上乗せする差分。
> リージョンは **ap-northeast-1**、AWS アカウントは **055259484931（mameta）** を前提とする。

---

## 0. 全体像（最短ルート）

```
1. Google Cloud Console で OAuth クライアントを作る（F の外部前提）
2. SSM / Secrets Manager に Google の client-id / client-secret を登録
3. CDK で全スタックをデプロイ
4. デプロイ出力の URL を Slack / Google の Redirect URL に登録
5. ブラウザで CloudFront URL を開いて E2E（Google 連携・パスキー）
6. 終わったら destroy（課金停止）
```

所要時間の目安: 初回 40〜60 分（Google Console 設定込み）、2 回目以降 15〜20 分。

---

## 1. 事前条件

- [ ] AWS CLI が `aws sts get-caller-identity` でアカウント **055259484931** を返す
- [ ] `pnpm install` 済み・`pnpm -r build` が通る
- [ ] CDK bootstrap 済み（初回のみ `pnpm --filter cdk exec cdk bootstrap`）
- [ ] Bedrock のモデルアクセス有効（Sonnet 4.6 / Haiku 4.5）— 申請済み
- [ ] パスキー検証用に **WebAuthn 対応のブラウザ + 認証器**（Touch ID / Windows Hello / スマホ / YubiKey）

---

## 2. F の外部前提: Google Cloud Console 設定（ユーザー作業）

パスキーと違い、Google 連携は **Google 側でアプリ登録**が必要。

### 2-1. プロジェクト & API 有効化
1. https://console.cloud.google.com/ でプロジェクトを作成（既存でも可）。
2. **「API とサービス」→「ライブラリ」** で以下を有効化:
   - **Gmail API**
   - **Google Calendar API**

### 2-2. OAuth 同意画面
1. 「API とサービス」→「OAuth 同意画面」→ **External**（テスト）。
2. アプリ名・サポートメール等を入力。
3. **スコープ**に以下を追加（読み取り専用）:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/calendar.readonly`
4. **テストユーザー**に自分の Google アカウントを追加（本番公開しない限りテストユーザーのみ連携可）。

### 2-3. OAuth クライアント ID 作成
1. 「認証情報」→「認証情報を作成」→ **OAuth クライアント ID** → **ウェブアプリケーション**。
2. **承認済みのリダイレクト URI** は **デプロイ後に確定する**（手順 5 で追記）。いったん仮で作成しておき、API URL が出てから更新する。
3. 発行された **クライアント ID** と **クライアントシークレット**を控える（後で SSM / Secrets Manager に登録）。

---

## 3. SSM / Secrets Manager 登録（デプロイ前に必要）

### 3-1. Slack 系（既存・A〜E で登録済みなら不要）
`deploy-e2e-verification.md` の手順 2・手順 5 を参照。OAuth state secret / 仮名化ソルト / Slack secret。

### 3-2. Google の Client ID（SSM パラメータ）
バックエンドは `GOOGLE_CLIENT_ID` 環境変数を SSM `/saborou/google/client-id` から取得する。

```bash
export AWS_REGION=ap-northeast-1
aws ssm put-parameter \
  --name "/saborou/google/client-id" \
  --type String \
  --value "<Google の クライアント ID>" \
  --region ${AWS_REGION} \
  --overwrite
```

### 3-3. Google の Client Secret（Secrets Manager・⚠️ JSON 形式）
> ⚠️ **重要**: CDK が空の Secret `/saborou/google/client-secret-dev` を作る。
> バックエンド（`google-auth.ts`）は `JSON.parse` で **`{ "clientId": ..., "clientSecret": ... }`** を期待する。
> Slack の client-secret は値のみだが、**Google は JSON で登録する**（ここを間違えると OAuth が落ちる）。

CDK デプロイ後（手順 4 のあと）に登録する:

```bash
export ENV=dev
export AWS_REGION=ap-northeast-1
aws secretsmanager put-secret-value \
  --secret-id "/saborou/google/client-secret-${ENV}" \
  --secret-string '{"clientId":"<クライアントID>","clientSecret":"<クライアントシークレット>"}' \
  --region ${AWS_REGION}

# 確認（値は表示しない）
aws secretsmanager describe-secret \
  --secret-id "/saborou/google/client-secret-${ENV}" \
  --region ${AWS_REGION} --query 'Name'
```

---

## 4. ビルド & デプロイ

```bash
# リポジトリルートで
pnpm -r build
pnpm cdk run deploy --require-approval never --all
```

- デプロイ中は **PC をスリープさせない**（過去に SignatureDoesNotMatch で失敗）。
- 成功後、出力（CfnOutput）から以下を控える:
  - **API URL**（ApiStack の出力）
  - **CloudFront URL / ドメイン**（FrontendStack の出力）
  - **Cognito マネージドログイン ドメイン**（CognitoStack の `https://saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com`）

> デプロイ後、手順 3-3 の Google client-secret 登録をまだしていなければここで実施。

---

## 5. デプロイ後の URL 再設定（再構築のたびに必須）

destroy → 再 deploy で **API Gateway / CloudFront のドメインが変わる**ため、外部サービス側の URL を更新する。

### 5-1. Slack（A〜E 既存・Slack 連携を使うなら）
- Slack アプリ → OAuth & Permissions → Redirect URLs に **`https://<新API URL>/api/auth/slack/callback`**
  （⚠️ パスは `/api/auth/slack/callback`。`/auth/...` ではない）

### 5-2. Google（F）
- Google Cloud Console → 認証情報 → 作成した OAuth クライアント → **承認済みのリダイレクト URI** に:
  ```
  https://<新API URL>/api/auth/google/callback
  ```
  （⚠️ パスは `/api/auth/google/callback`）

### 5-3. Cognito / パスキー（G に関係）
- パスキー認証は **Cognito マネージドログイン（v2 UI）の画面上**で行う。WebAuthn の仕様上、**RP ID は「ログインページを提供するドメイン」= Cognito ドメイン**でなければならない（CloudFront ではない）。
- 本構成では CDK が RP ID を **Cognito マネージドログインドメイン**
  `saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com` に設定する（カスタムドメイン未使用のためプレフィックスドメイン）。
- 実機テストでは、アプリのログイン導線から **Cognito マネージドログイン画面に遷移した状態**でパスキーを登録・使用する
  （登録も認証も Cognito ドメイン上で行われるため RP ID と一致する）。HTTPS 必須・localhost 不可。
- Cognito のドメインプレフィックス（`saborou-auth-${env}`）は固定なので、再デプロイしても RP ID は基本変わらない
  （ドメインプレフィックスを変えた場合のみ CognitoStack 再デプロイで追従）。
- 📌 参考: Cognito 公式では「managed login / classic hosted UI で認証する場合、RP ID はログインページのドメイン（カスタムドメインまたはプレフィックスドメイン）に一致させる」と規定されている。

---

## 6. E2E 確認シナリオ

### 6-A. パスキー認証（G）
1. ブラウザで **CloudFront URL** を開く → ログイン導線 → Cognito **マネージドログイン（v2 UI）** へ遷移。
   （パスキーの登録・認証は、この **Cognito マネージドログイン画面上**で行われる＝RP ID と一致する）
2. **初回はパスワードでサインイン**（email + password。サインアップ済みのユーザーで）。
   - まだユーザーがいなければマネージドログインからサインアップ。
3. マネージドログインの **パスキー登録**フローで **パスキーを登録**（Touch ID / Windows Hello 等）。
4. サインアウト。
5. 再度マネージドログイン画面で **「パスキーでサインイン」**（choice-based 認証の選択肢）→ 認証器で認証 → ログイン確認。
6. ✅ 確認ポイント: パスキーで入れること / パスワードでも入れること（フォールバック維持）。

> パスキーが使えない端末では、choice-based 認証で **パスワードを選べばログインできる**（必須化していないため詰まない）。

### 6-B. Google 連携 → Calendar 予定のタスク化（F-Calendar）
1. ログイン後、**設定画面**の「**Google 連携**」ボタンを押す → Google OAuth 同意 → 戻ってくる。
   - ✅ 設定画面に「Google 連携済み」と表示されること。
2. 設定画面の「**カレンダーを取り込む**」ボタンを押す。
3. ✅ 確認ポイント: 取り込み件数・最終取得時刻が表示される（予定タイトルは保存されない設計）。

### 6-C. Gmail → タスク抽出（F-Gmail）
1. 設定画面の「**Gmail を取り込む**」ボタンを押す。
2. ✅ 確認ポイント: 直近 7 日の未読メールから AI が「要対応」を選別し、タスク候補が追加される
   （雑談・通知系は除外される。本文は保存されない）。

### 6-D. 予定考慮のサボり判定（F-Calendar × 判定）
1. タスクに対して「サボり判定」を実行。
2. ✅ 確認ポイント: Calendar を取り込んでいる場合、多忙度・次の予定までの時間が判定に反映される
   （例: 直後に会議があると「今はやった方がいい」寄り、空いていれば「サボってOK」寄り）。
   Calendar 未取り込みでも判定は正常に動く（calendarContext は任意）。

---

## 7. 後片付け（課金停止）

```bash
pnpm cdk run destroy --all --force
```

- CloudFront 削除に 10〜20 分。`DELETE_FAILED` が出たら再度 destroy。
- 残置（再利用・課金ほぼゼロ）: CDKToolkit / SSM パラメータ / 一部 Secret（force-delete 対象外で skip）。
- ⚠️ **G のコスト注記**: Cognito を **Essentials プラン**にしたため、MAU 1,000 を超えると課金（$0.0055/MAU）。
  ハッカソン規模（数十名）では無料枠内。`RemovalPolicy.RETAIN` のため UserPool は destroy 後も残る場合がある
  （MAU カウントは継続）。完全に消すなら UserPool を手動削除。

---

## 8. つまずきポイント早見表

| 症状 | 原因 / 対処 |
|---|---|
| Google OAuth `redirect_uri did not match` | 手順 5-2 の Redirect URI が新 API URL と不一致。Google Console を更新 |
| Google 連携後に `JSON.parse` エラー / token 交換失敗 | client-secret を**値のみで登録**した。手順 3-3 の **JSON 形式**で登録し直す |
| Gmail/Calendar が 403 | OAuth 同意画面のスコープ不足、またはテストユーザー未登録（手順 2-2） |
| パスキー登録ボタンが出ない / 失敗 | localhost や非HTTPSからアクセスしている。Cognito マネージドログイン画面（HTTPS）で操作する。ブラウザ/認証器が WebAuthn 非対応 |
| パスキーで弾かれる | RP ID（Cognito ドメイン）と認証画面のドメイン不一致。マネージドログイン画面上で登録・認証しているか確認。ドメインプレフィックスを変えたら CognitoStack 再デプロイ |
| デプロイが SignatureDoesNotMatch | PC スリープ。スリープ無効化して再実行 |
