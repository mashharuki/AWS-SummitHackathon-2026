# U-08: passkey-auth — NFR Requirements

**バージョン**: 1.0.0  
**作成日**: 2026-05-24

---

## NFR-PK-S1: パスキーはフォールバック構成（パスワード必須ではない）

パスキー未対応の環境でも認証できること。  
パスキーは WebAuthn 対応ブラウザ + 認証器（Touch ID / Windows Hello 等）が必要。未対応環境ではパスワード認証にフォールバックできる設計にする。

## NFR-PK-S2: HTTPS 必須

WebAuthn は HTTPS（または localhost）でのみ動作する。  
本番環境は CloudFront 経由で HTTPS 提供済みのため要件を満たしている。ローカル開発時は `localhost:5173` でパスキーは動作しない（Cognito マネージドログインへのリダイレクト方式のため問題なし）。

## NFR-PK-S3: RP ID の一致

Cognito に設定する `passkeyRelyingPartyId` は、フロントエンドの配信ドメイン（CloudFront ドメイン）と一致させること。不一致の場合、ブラウザがパスキー登録・認証を拒否する。

## NFR-PK-S4: 最小権限 IAM

CDK スタック変更に伴う新規 IAM ロール・ポリシーは最小権限原則を維持する。今回の変更は Cognito の設定変更のみで新規 IAM リソースの追加はない。

## NFR-PK-P1: CDK synth 必達

変更後の CDK スタックは `cdk synth` でエラーゼロであること。

## NFR-PK-T1: 既存テスト維持

変更後もすべての既存テストがパスすること（CDK 43 件 / agent 196 件 / shared 103 件 / frontend 140 件 / backend 307 件）。

## NFR-PK-T2: 新設定のテスト追加

cognito-stack.test.ts に以下を追加する:
- FeaturePlan.ESSENTIALS が設定されていること
- Choice-based 認証フロー（`user: true`）が有効であること
- ManagedLoginVersion.NEWER_MANAGED_LOGIN が設定されていること
- passkeyRelyingPartyId が設定されていること
