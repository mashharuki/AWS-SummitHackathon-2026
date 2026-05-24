# U-08: passkey-auth — Infrastructure Design

**バージョン**: 1.0.0  
**作成日**: 2026-05-24

---

## 1. 変更スタック

### SaborouCognitoStack（pkgs/cdk/lib/stacks/cognito-stack.ts）

#### 使用 CDK API（aws-cdk-lib 2.232.1 実在確認済み）

| 設定項目 | CDK L2 プロパティ | 設定値 | 根拠 |
|---|---|---|---|
| フィーチャープラン | `UserPoolProps.featurePlan` | `cognito.FeaturePlan.ESSENTIALS` | user-pool.d.ts L545-551 で enum 確認 |
| パスキー許可 | `UserPoolProps.passkey` | `true` | user-pool.d.ts L447 で確認 |
| RP ID | `UserPoolProps.passkeyRelyingPartyId` | CloudFront ドメイン（props で注入） | user-pool.d.ts L728 で確認 |
| ユーザー検証 | `UserPoolProps.passkeyUserVerification` | `cognito.PasskeyUserVerification.PREFERRED` | user-pool.d.ts L453-456 で確認 |
| Choice-based フロー | `UserPoolClientProps.authFlows.user` | `true` | user-pool-client.d.ts L34-36 で確認（"Enable Choice-based authentication"） |
| マネージドログイン | `UserPoolDomainProps.managedLoginVersion` | `cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN` | user-pool-domain.d.ts L9-17 で確認（= 2） |

#### cdk-nag 対応

新たに追加する抑制:
- `AwsSolutions-COG8`: Essentials フィーチャープランは必要だが Plus は不要（ハッカソン規模）という理由で passkey 機能を利用

既存の抑制（COG1/COG2/COG3/COG8/IAM4/IAM5/L1）は継続維持。  
COG8 の `reason` を「Essentials tier is required for passkey（WebAuthn）authentication; Plus tier features are not needed for hackathon scope」に更新。

---

## 2. パラメータ設計

`CognitoStackProps` に `passkeyRelyingPartyId?: string` を追加。  
デプロイ時に CloudFront ドメインを渡す（bin/app.ts 側で設定）。

フォールバック（未設定時）: パスキー RP ID を設定せず、Cognito のデフォルト動作を使用。  
> ただし RP ID なしだと一部環境でパスキー登録が失敗するため、デプロイ手順で RP ID の設定を明示する。

---

## 3. デプロイ手順と注意点

### 初回デプロイ時（重要）

```bash
# CloudFront ドメインを取得してから RP ID を設定
# 1. 先に CognitoStack だけデプロイ（passkeyRelyingPartyId なし）
pnpm cdk run deploy SaborouCognitoStack

# 2. FrontendStack をデプロイして CloudFront ドメインを確認
pnpm cdk run deploy SaborouFrontendStack

# 3. CloudFront ドメインを確認
aws cloudformation describe-stacks \
  --stack-name SaborouFrontendStack \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text

# 4. app.ts に passkeyRelyingPartyId を設定して再デプロイ
# （例: xxx.cloudfront.net）
pnpm cdk run deploy SaborouCognitoStack
```

### 再デプロイ（destroy 後）の注意

CloudFront ドメインが変わると RP ID も変わる。新しいドメインで CognitoStack を再デプロイする必要がある。  
登録済みのパスキー資格情報は UserPool の再作成で失われる（UserPool は RemovalPolicy.RETAIN のため、全 destroy では消えない）。

### ローカル開発での制約

- パスキー登録/認証は `localhost` でのみブラウザが許可（HTTPS なし環境）
- Cognito マネージドログインは HTTPS の RP ID を要求するため、ローカルではパスキー選択肢がグレーアウトされる場合がある
- ローカル開発ではパスワード認証フォールバックを使用する

---

## 4. フロントエンド側の変更

マネージドログインへの移行後、認可エンドポイント（`/oauth2/authorize`）のベース URL は変わらない。  
`cognito.ts` の `buildCognitoAuthUrl()` は変更不要。

マネージドログインの UI は Cognito 側が提供するため、フロントエンドはリダイレクト後の処理（`AuthCallbackPage`）に変更はない。

---

## 5. E2E テスト前提（実 AWS デプロイ後）

### 必要な環境

- CloudFront HTTPS URL からアクセス（`localhost` 不可）
- パスキー対応ブラウザ: Chrome 109+ / Safari 16+ / Firefox 119+
- パスキー対応認証器: Touch ID（macOS/iOS）/ Windows Hello / YubiKey / Android 指紋認証

### テスト手順

1. CloudFront URL（`https://xxx.cloudfront.net`）にアクセス
2. 「サインイン」ボタンをクリック → Cognito マネージドログイン UI が表示される
3. **パスキーログイン確認**: 「パスキーでサインイン」オプションが表示される（初回は未登録のため選択不可）
4. パスワードでサインイン後、「このデバイスにパスキーを登録しますか？」プロンプトを確認
5. 承諾して Touch ID / Windows Hello で登録
6. サインアウト後、マネージドログインで「パスキーでサインイン」を選択して生体認証でログインできることを確認

### マネージドログインの URL 形式

```
https://<domain-prefix>.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize?...
```

旧 Hosted UI と同じドメイン・エンドポイントを使用（version 2 に切り替えるのは managedLoginVersion フラグのみ）。

---

## 6. Well-Architected チェック（関連項目）

| 柱 | 評価 |
|---|---|
| セキュリティ | パスキーは FIDO2 / WebAuthn 準拠で最高クラスの認証強度。フィッシング耐性あり。パスワードフォールバックを残す場合でも全体的なセキュリティ向上 |
| 信頼性 | パスワードフォールバックにより、認証器未対応環境でもサービス継続可能 |
| コスト最適化 | Essentials プランは MAU 1,000 まで無料。ハッカソン規模では追加コストなし |
| 運用上の優秀性 | CDK で宣言的に管理。RP ID を props で注入するため環境ごとの設定が明確 |
