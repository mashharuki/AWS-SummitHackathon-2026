# インフラ設計 — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / Infrastructure Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 概要

U-05 web は **静的ファイル（React SPA）** であり、実行時インフラは U-02 infra で定義済みの `SaborouFrontendStack` を使用する。
本 Unit の Infrastructure Design は主に以下を扱う:

1. 環境変数の定義（`VITE_*` プレフィックス）
2. ビルド成果物のデプロイ手順
3. U-02 infra CDK との接点（CfnOutput → `.env` 設定）
4. U-04 api との接続設定（API エンドポイント URL）

---

## 2. 既存インフラ利用（U-02 infra FrontendStack）

**新規 AWS リソースなし。** `SaborouFrontendStack` の既存構成を使用する。

| リソース | 詳細 |
|---------|------|
| S3 バケット | `saborou-frontend-{env}`（OAC 設定済み・パブリックアクセスブロック済み）|
| CloudFront Distribution | OAC + S3 オリジン・圧縮有効・`/index.html` SPA フォールバック |
| CfnOutput: CloudFrontDomainName | Cognito コールバック URL 登録に使用 |
| CfnOutput: S3BucketName | ビルド成果物デプロイ先 |

---

## 3. 環境変数定義

### 3.1 ファイル構成

```
pkgs/frontend/
├── .env.example          # テンプレート（コミット対象）
├── .env.local            # ローカル開発用（.gitignore対象）
└── .env.production       # 本番ビルド用（CI/CD で注入）
```

### 3.2 必須環境変数

```env
# .env.example

# API エンドポイント（U-04 api / ApiStack CfnOutput: ApiEndpointUrl）
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com

# SSEストリーミングエンドポイント（Lambda Function URL）
VITE_STREAM_BASE_URL=https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws

# Cognito 設定（U-02 infra / CognitoStack CfnOutput）
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=https://saborou-dev.auth.ap-northeast-1.amazoncognito.com

# OAuth リダイレクト URI（CloudFront URL + /auth/callback）
VITE_OAUTH_REDIRECT_URI=https://xxxxxxxxxx.cloudfront.net/auth/callback

# 環境識別
VITE_APP_ENV=development
```

### 3.3 ローカル開発時の設定

```env
# .env.local（ローカル開発専用）
VITE_API_BASE_URL=http://localhost:3000        # api ローカル起動時
VITE_STREAM_BASE_URL=http://localhost:3000
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxx  # 実際の Cognito を使用
VITE_COGNITO_CLIENT_ID=xxx
VITE_COGNITO_DOMAIN=https://saborou-dev.auth.ap-northeast-1.amazoncognito.com
VITE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_APP_ENV=development
```

---

## 4. ビルドとデプロイ手順

### 4.1 ビルドコマンド

```bash
# pkgs/frontend ディレクトリで実行
pnpm build
# 出力: pkgs/frontend/dist/
```

### 4.2 S3 デプロイ

```bash
# CfnOutput から S3 バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name SaborouFrontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
  --output text)

# dist/ を S3 にアップロード
aws s3 sync pkgs/frontend/dist/ s3://${BUCKET_NAME}/ --delete

# CloudFront キャッシュ無効化
DIST_ID=$(aws cloudformation describe-stacks \
  --stack-name SaborouFrontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id ${DIST_ID} \
  --paths "/*"
```

### 4.3 Cognito コールバック URL の更新

CloudFront のドメインが確定した後、Cognito User Pool Client のコールバック URL を更新する:

```bash
# CfnOutput から CloudFront ドメイン取得
CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --stack-name SaborouFrontend-dev \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" \
  --output text)

# .env.production に書き込み（CI/CD ステップ）
VITE_OAUTH_REDIRECT_URI="https://${CLOUDFRONT_DOMAIN}/auth/callback"
```

---

## 5. CORS 設定確認

U-04 api の ApiStack では以下の CORS が設定されている:

```
allowOrigins: [`https://${props.cloudfrontDomain}`]
allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
allowHeaders: ['Content-Type', 'Authorization']
```

フロントエンドのリクエストは `VITE_API_BASE_URL` を通じて CloudFront ドメインから発行されるため、CORS 設定は既存のまま適用可能。

**ローカル開発時**: `http://localhost:5173` への CORS 許可を API 側に追加する必要がある。
→ ApiStack の CORS 設定に `http://localhost:5173` を追加（開発環境限定）。

---

## 6. SPA フォールバック設定

CloudFront の `errorResponses` で `/index.html` へのフォールバックを設定済み（U-02 infra FrontendStack）:

```typescript
// 既存: frontend-stack.ts
errorResponses: [
  {
    httpStatus: 403,
    responseHttpStatus: 200,
    responsePagePath: '/index.html',
  },
  {
    httpStatus: 404,
    responseHttpStatus: 200,
    responsePagePath: '/index.html',
  },
],
```

React Router v7 のクライアントサイドルーティングが正常に機能する。

---

## 7. pkgs/cdk 変更点（U-05 起因）

### 7.1 FrontendStack への DistributionId CfnOutput 追加

```typescript
// pkgs/cdk/lib/stacks/frontend-stack.ts に追加
new cdk.CfnOutput(this, 'DistributionId', {
  value: distribution.distributionId,
  description: 'CloudFront Distribution ID for cache invalidation',
  exportName: `SaborouFrontend-${props.environment}-DistributionId`,
});
```

### 7.2 ApiStack の CORS 開発環境許可

```typescript
// pkgs/cdk/lib/stacks/api-stack.ts の CORS 設定に追加
const allowOrigins = [
  `https://${props.cloudfrontDomain}`,
  ...(props.environment === 'dev' ? ['http://localhost:5173'] : []),
];
```

---

## 8. モニタリング

U-05 web 固有の AWS モニタリングは U-02 infra で定義済みの CloudFront アクセスログに依存する。
フロントエンドの JavaScript エラーは `ErrorBoundary` でキャッチしてコンソールに出力する（CloudWatch への転送は M3 決勝スコープ）。
