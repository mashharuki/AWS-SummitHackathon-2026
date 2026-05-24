# U-08: passkey-auth — Functional Design

**バージョン**: 1.0.0  
**作成日**: 2026-05-24  
**ブランチ**: feature/google-integration（PR #39 に追加コミット）

---

## 1. ビジネス要件

パスキー（WebAuthn）認証を追加し、パスワード認証をフォールバックとして維持する。  
パスキー対応環境（Touch ID / Windows Hello / YubiKey / スマートフォン生体認証）ではよりスムーズなサインインを提供し、対応していない環境でも既存のメール+パスワード認証で引き続きログインできる。

### 確定方針（ユーザー承認済み）
- パスキーを **追加** する（パスワード認証は残す）
- パスキー必須にはしない（デモ中に認証器未対応でログイン不能になるリスクを回避）
- Cognito マネージドログイン（Managed Login）への移行（旧 Hosted UI から更新）

---

## 2. データモデル変更

変更なし。Cognito が WebAuthn 資格情報を内部的に管理するため、DynamoDB 側のモデル変更は不要。

---

## 3. ビジネスロジック

### BR-PK-01: Choice-based 認証フロー
- ユーザーがログインページの「サインイン」ボタンを押すと、Cognito マネージドログインへリダイレクト
- マネージドログイン画面でユーザーが認証手段（パスキー / パスワード）を選択
- 選択後の認可コードフローは既存の PKCE 実装をそのまま利用

### BR-PK-02: パスキー登録フロー
- 初回サインイン後、マネージドログイン UI が「デバイスを登録しますか？」を提示
- ユーザーが承諾するとブラウザが WebAuthn 登録ダイアログを表示
- 登録された資格情報は Cognito が保管（フロントエンド側での追加実装不要）

### BR-PK-03: パスワードフォールバック
- パスキー未登録 / 認証器未対応の端末ではパスワードでサインイン
- 旧 Hosted UI からマネージドログインへの移行後も、パスワード認証は引き続き利用可能

### BR-PK-04: RP ID（Relying Party ID）
- RP ID = CloudFront カスタムドメインまたは CloudFront デフォルトドメイン（`xxx.cloudfront.net`）
- 再デプロイで CloudFront ドメインが変わった場合、RP ID を更新して CDK 再デプロイが必要

---

## 4. コンポーネント影響範囲

| コンポーネント | 変更種別 | 詳細 |
|---|---|---|
| `pkgs/cdk/lib/stacks/cognito-stack.ts` | 修正 | featurePlan/passkeyRelyingPartyId/passkeyUserVerification/Choice-based authFlow/ManagedLogin 設定 |
| `pkgs/cdk/test/cognito-stack.test.ts` | 修正 | 新設定を検証するテストケース追加 |
| `pkgs/frontend/src/lib/cognito.ts` | 変更なし | マネージドログインでもエンドポイントは同一（/oauth2/authorize, /oauth2/token, /logout）のため変更不要 |
| `pkgs/frontend/src/pages/LoginPage.tsx` | 変更なし | signIn() の呼び出しは変わらない。マネージドログイン UI で選択画面が表示される |

---

## 5. エンドポイント変更

なし。フロントエンドが呼ぶ Cognito エンドポイント（`/oauth2/authorize`, `/oauth2/token`, `/logout`）はマネージドログインでも同一。

---

## 6. コスト注記

### Essentials フィーチャープランの課金

| 項目 | Lite（現状） | Essentials（変更後） |
|---|---|---|
| 基本料金 | MAU 課金なし（最初の 10,000 MAU 無料枠内） | **MAU 課金あり** — 最初の 1,000 MAU 無料、以降 $0.0055/MAU |
| パスキー/WebAuthn | 非対応 | 対応 |
| マネージドログイン | 非対応（旧 Hosted UI のみ） | 対応 |

**ハッカソン規模での影響**: デモ参加人数が 1,000 MAU を超える可能性は極めて低く、**無料枠内で収まる想定**。ただし destroy 後の再デプロイを繰り返す運用では UserPool が毎回新規作成されるため、MAU のリセットが発生する。本番環境（destroy しない運用）では Essentials 移行による追加コストはゼロに近い。

> 参考: Cognito フィーチャープラン料金 — https://aws.amazon.com/cognito/pricing/
