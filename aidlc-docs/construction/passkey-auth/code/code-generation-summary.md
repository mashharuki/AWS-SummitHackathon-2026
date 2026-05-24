# U-08: passkey-auth — Code Generation Summary

**バージョン**: 1.0.0  
**作成日**: 2026-05-24  
**ブランチ**: feature/google-integration（PR #39 に追加コミット）

---

## 変更ファイル一覧

### CDK（`pkgs/cdk/`）

| ファイル | 変更種別 | 内容 |
|---|---|---|
| `lib/stacks/cognito-stack.ts` | 修正 | featurePlan（ESSENTIALS）/ パスキー設定 / Choice-based authFlow / マネージドログイン設定 |
| `bin/cdk.ts` | 修正 | CognitoStack に passkeyRelyingPartyId（CloudFront ドメイン）を追加注入 |
| `test/cognito-stack.test.ts` | 修正 | 新設定（Essentials/USER_AUTH/ManagedLogin/passkey）の検証テストケース追加 |

### フロントエンド（`pkgs/frontend/`）

変更なし。マネージドログインへの移行後もエンドポイント（`/oauth2/authorize`, `/oauth2/token`, `/logout`）は変わらないため、`cognito.ts` / `LoginPage.tsx` / `AuthCallbackPage.tsx` への変更は不要。

---

## 使用した実 CDK/CFN API と根拠

すべて aws-cdk-lib 2.232.1 の実在プロパティで確認済み。

| プロパティ | 確認ファイル | 行番号 |
|---|---|---|
| `UserPoolProps.featurePlan: FeaturePlan.ESSENTIALS` | `aws-cognito/lib/user-pool.d.ts` | L545-551, L795 |
| `UserPoolProps.passkey: boolean` | `aws-cognito/lib/user-pool.d.ts` | L447 |
| `UserPoolProps.passkeyRelyingPartyId: string` | `aws-cognito/lib/user-pool.d.ts` | L728 |
| `UserPoolProps.passkeyUserVerification: PasskeyUserVerification.PREFERRED` | `aws-cognito/lib/user-pool.d.ts` | L453-456, L736 |
| `AuthFlow.user: boolean`（Choice-based） | `aws-cognito/lib/user-pool-client.d.ts` | L34-36 |
| `UserPoolDomainProps.managedLoginVersion: ManagedLoginVersion.NEWER_MANAGED_LOGIN` | `aws-cognito/lib/user-pool-domain.d.ts` | L9-17 |

### CloudFormation プロパティへのマッピング（synth 出力で確認済み）

| L2 プロパティ | CFN プロパティ | 設定値 |
|---|---|---|
| `featurePlan: FeaturePlan.ESSENTIALS` | `UserPoolTier` | `"ESSENTIALS"` |
| `passkeyRelyingPartyId` | `WebAuthnRelyingPartyID` | CloudFront ドメイン（CloudFormation 参照） |
| `passkeyUserVerification: PREFERRED` | `WebAuthnUserVerification` | `"preferred"` |
| `authFlows.user: true` | `ExplicitAuthFlows` に追加 | `"ALLOW_USER_AUTH"` |
| `managedLoginVersion: NEWER_MANAGED_LOGIN` | `ManagedLoginVersion` | `2` |

---

## 品質ゲート結果

| ゲート | 結果 | 詳細 |
|---|---|---|
| CDK synth | グリーン | エラーゼロ（既存 Warning のみ） |
| CDK tests | 47/47 グリーン | 元 43 件 + 新規 4 件 |
| agent tests | 196/196 グリーン | 変更なし |
| shared tests | 103/103 グリーン | 変更なし |
| frontend tests | 140/140 グリーン | 変更なし |
| backend tests | 307/307 グリーン | 変更なし |
| typecheck | 全パッケージ通過 | エラーなし |
| Biome | 悪化なし | 新規エラーなし |

**既存テスト破壊**: なし（全パッケージ既存テスト維持）

---

## コスト注記

Essentials フィーチャープランへの移行により以下の変更が生じる:

- MAU 1,000 まで無料（ハッカソン規模では追加コスト発生しない見込み）
- MAU 1,000 超過後: $0.0055/MAU（税別）
- destroy→再デプロイで UserPool が新規作成される場合、MAU カウントがリセットされる（RemovalPolicy.RETAIN のため通常は維持）

---

## 実 AWS デプロイ後のパスキー E2E テスト前提

### 必要環境

- **URL**: CloudFront HTTPS URL（`https://xxx.cloudfront.net`）からアクセス
- **ブラウザ**: Chrome 109+ / Safari 16+ / Firefox 119+
- **認証器**: Touch ID（macOS/iOS）/ Windows Hello / YubiKey / Android 生体認証
- **RP ID の一致**: デプロイ時に設定した CloudFront ドメインと同じドメインからアクセスする必要がある

### ドメイン固定の推奨

CloudFront ドメインが変わるたびにパスキー RP ID の更新と再デプロイが必要になる。デモ前に Route53 + ACM でカスタムドメインを当てれば再デプロイしてもドメインが変わらず、パスキー設定の再設定が不要になる。

### マネージドログイン URL

```text
https://saborou-auth-dev.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize?...
```

旧 Hosted UI と同じドメイン・エンドポイント形式。`managedLoginVersion: 2` への切り替えにより、Cognito がパスキー選択 UI を含む新しいサインイン画面を提供する。

### E2E テスト手順

1. CloudFront URL にアクセスし「サインイン」ボタンをクリック
2. Cognito マネージドログイン（v2）UI が表示され、パスキー選択肢が表示される
3. 初回はパスワードでサインイン後、「このデバイスにパスキーを登録しますか？」プロンプトを確認
4. Touch ID / Windows Hello で登録完了
5. サインアウト後、「パスキーでサインイン」を選択して生体認証でログインできることを確認
