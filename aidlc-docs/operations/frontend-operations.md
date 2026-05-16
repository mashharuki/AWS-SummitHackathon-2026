# フロントエンド操作ガイド（React / Vite / S3 + CloudFront）

**プロジェクト名**: SABOROU（サボロー）
**バージョン**: v1.0.0
**作成日**: 2026-05-16
**対象**: U-05（web） / `apps/web/`

---

## 1. ローカル開発環境セットアップ

### 1.1 フロントエンド構成

```
apps/web/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx          # FE-03: Google ログイン
│   │   ├── TaskListPage.tsx       # FE-01: タスク一覧
│   │   ├── TaskDetailPage.tsx     # FE-02: タスク詳細・チャット
│   │   └── SettingsPage.tsx       # FE-04: 連携設定
│   ├── components/
│   │   ├── AppShell.tsx           # FE-05: アプリシェル・ナビゲーション
│   │   ├── TaskCard.tsx           # FE-08: タスクカード（判定3状態）
│   │   └── SaborouCharacter3D.tsx # FE-09: Three.js 3Dキャラクター
│   ├── providers/
│   │   └── AuthProvider.tsx       # FE-06: Cognito JWT 管理
│   └── lib/
│       └── api-client.ts          # FE-07: REST API + SSE クライアント
├── public/
├── vite.config.ts
├── tailwind.config.ts
├── components.json                # shadcn/ui 設定
└── package.json
```

### 1.2 依存関係インストール

```bash
cd apps/web
npm install
```

### 1.3 ローカル開発サーバー起動

```bash
cd apps/web

# Vite dev サーバー起動（デフォルトポート: 5173）
npm run dev

# ブラウザで http://localhost:5173 を開く
```

---

## 2. .env.local 設定

`apps/web/.env.local` を作成する（git には含めないこと）。

```bash
# API エンドポイント（ローカル開発時はFloci経由 or SAM Local）
VITE_API_BASE_URL=http://localhost:3001

# 本番環境（CDK デプロイ後のAPI Gateway URL）
# VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com

# Cognito 設定（Cognito Local or 本番 dev User Pool を使用）
VITE_COGNITO_REGION=ap-northeast-1
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_DOMAIN=saborou-dev.auth.ap-northeast-1.amazoncognito.com

# Google OAuth コールバック（Cognito Hosted UI 経由）
VITE_REDIRECT_SIGN_IN=http://localhost:5173/callback
VITE_REDIRECT_SIGN_OUT=http://localhost:5173
```

---

## 3. Cognito ローカル設定

### 3.1 Cognito Hosted UI のコールバック URL に localhost を追加

1. AWS コンソール → Amazon Cognito → ユーザープール → アプリケーションクライアント
2. 対象クライアントを選択 → 「許可されたコールバック URL」に以下を追加:
   - `http://localhost:5173/callback`
3. 「許可されたサインアウト URL」に以下を追加:
   - `http://localhost:5173`
4. 変更を保存

### 3.2 ローカルでの Google ソーシャルログインテスト

Google OAuth のコールバック URL に localhost を追加する必要がある。

1. Google Cloud Console → OAuth 2.0 クライアント → 対象クライアントを編集
2. 「承認済みのリダイレクト URI」に Cognito の OAuth エンドポイントが既に登録済みであることを確認
3. ローカルテスト時は Cognito Hosted UI（`https://saborou-dev.auth.ap-northeast-1.amazoncognito.com/login`）経由でログインする

```bash
# ローカル開発時のログインフロー
# 1. http://localhost:5173 にアクセス
# 2. 「Google でログイン」をクリック
# 3. Cognito Hosted UI（AWS の認証ページ）にリダイレクト
# 4. Google アカウントで認証
# 5. http://localhost:5173/callback にリダイレクト（JWT 取得）
```

---

## 4. Three.js / @react-three/fiber 動作確認

### 4.1 SaborouCharacter3D のローカル確認

```bash
# ローカルサーバーを起動した状態で
# http://localhost:5173/tasks（TaskListPage）または
# http://localhost:5173/tasks/:id（TaskDetailPage）にアクセス

# SaborouCharacter3D コンポーネントが正しく表示されることを確認:
# - 3D キャンバスが表示される
# - サボローキャラクターがアニメーションする
# - 判定状態（can_saboru / caution / danger）に応じてキャラクターの表情・色が変わる
```

### 4.2 WebGL 動作確認

```bash
# ブラウザの開発者ツール（DevTools）で確認
# Console タブで WebGL エラーがないことを確認

# Three.js Stats（オプション）でフレームレート確認
# 開発環境では @react-three/drei の <Stats /> コンポーネントを追加して確認
# 目標: 60fps

# WebGL 非対応ブラウザでのフォールバック確認
# canvas.getContext('webgl') が null になるブラウザでは
# 2D フォールバック UI が表示されることを確認
```

### 4.3 バンドルサイズ確認

```bash
cd apps/web

# ビルド後のバンドルサイズ確認
npm run build
npx vite-bundle-visualizer

# Three.js は動的インポートで遅延ロードされていることを確認
# 初期バンドル（index.js）に Three.js が含まれていないこと
```

---

## 5. ビルド・デプロイ

### 5.1 本番ビルド

```bash
cd apps/web

# 本番ビルド（dist/ フォルダに成果物が生成される）
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com \
VITE_COGNITO_REGION=ap-northeast-1 \
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx \
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
VITE_COGNITO_DOMAIN=saborou.auth.ap-northeast-1.amazoncognito.com \
npm run build

# ビルド成果物確認
ls -la dist/
du -sh dist/
```

### 5.2 S3 への手動デプロイ（CDK 未使用の場合）

```bash
# S3 バケットに dist/ フォルダをアップロード
aws s3 sync apps/web/dist/ s3://saborou-frontend-dev --delete \
  --region ap-northeast-1

# 確認
aws s3 ls s3://saborou-frontend-dev/ --region ap-northeast-1
```

### 5.3 CloudFront キャッシュ無効化

```bash
# CloudFront ディストリビューション ID を確認
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?Comment==`saborou-frontend-dev`].Id' \
  --output text

# キャッシュ無効化（全パス）
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXXXXX \
  --paths "/*" \
  --region us-east-1  # CloudFront は us-east-1 で管理

# 無効化ステータス確認
aws cloudfront get-invalidation \
  --distribution-id XXXXXXXXXXXXX \
  --id [invalidation-id]
```

### 5.4 CDK FrontendStack 経由のデプロイ（推奨）

CDK の FrontendStack を使うと、S3 + CloudFront のデプロイが一括で完結する。

```bash
cd infra

# FrontendStack をデプロイ（ビルド成果物を S3 に自動アップロード + CloudFront 設定）
npx cdk deploy FrontendStack --require-approval never

# デプロイ後に CloudFront URL を確認
aws cloudformation describe-stacks \
  --stack-name SaborouFrontendStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontUrl`].OutputValue' \
  --output text \
  --region ap-northeast-1
```

---

## 6. パフォーマンス確認

### 6.1 Core Web Vitals チェック（Lighthouse）

```bash
# Lighthouse CLI でパフォーマンス計測（CloudFront URL 指定）
npx lighthouse https://d[xxxxxxxx].cloudfront.net \
  --output json \
  --output-path ./lighthouse-report.json \
  --preset desktop

# スコア目標:
# - Performance: 80 以上
# - Accessibility: 90 以上
# - Best Practices: 90 以上
# - SEO: 80 以上
```

### 6.2 ブラウザ上でのパフォーマンス確認

```
DevTools → Performance タブ:
  1. 「Record」をクリックしてプロファイリング開始
  2. タスク一覧→タスク詳細→サボり提案生成の操作を実施
  3. 「Stop」をクリックしてプロファイル終了
  4. 以下を確認:
     - JavaScript 実行時間（Long Tasks がないか）
     - Three.js レンダリングの FPS（60fps 目標）
     - SSE 受信時のレンダリング（ProposalHandler の delta 更新）
```

### 6.3 Three.js フレームレート確認

```tsx
// 開発環境での FPS モニタリング（SaborouCharacter3D.tsx に追加）
import { Stats } from '@react-three/drei'

// Canvas 内に追加（開発環境のみ）
{import.meta.env.DEV && <Stats />}
```

---

## 7. よくある問題と対処法

### 7.1 Cognito リダイレクト後に 404 になる

**原因**: SPA のルーティングで CloudFront が `/callback` パスをオリジン（S3）に転送している。

**対処**:
- CloudFront → エラーページ設定 → 403/404 を `index.html` にリダイレクト（エラーコード 200 を返す）
- CDK の FrontendStack に以下を追加:
  ```typescript
  errorResponses: [
    { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
    { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
  ]
  ```

### 7.2 SSE（Server-Sent Events）が受信できない

**原因**: Vite の開発プロキシ設定が不足、または API Gateway のタイムアウト。

**対処**:
```typescript
// vite.config.ts にプロキシ設定を追加
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
```

### 7.3 Three.js がレンダリングされない

**原因**: WebGL がブラウザで無効化されている、または @react-three/fiber のバージョン不整合。

**対処**:
```bash
# WebGL サポート確認
# ブラウザコンソールで実行:
# const canvas = document.createElement('canvas');
# console.log(canvas.getContext('webgl') !== null);

# Three.js / @react-three/fiber バージョン確認
cd apps/web && npm list three @react-three/fiber
```

### 7.4 ビルドサイズが大きい

**対処**:
```typescript
// vite.config.ts で Three.js を手動チャンク化
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          '@react-three/fiber': ['@react-three/fiber'],
          '@react-three/drei': ['@react-three/drei'],
        },
      },
    },
  },
})
```

---

## 8. 関連文書

| 文書 | パス |
|------|------|
| CDK 操作ガイド | `aidlc-docs/operations/cdk-operations.md` |
| バックエンド操作ガイド | `aidlc-docs/operations/backend-operations.md` |
| Unit-of-Work（U-05 web） | `aidlc-docs/inception/units/unit-of-work.md` |
| AWS アーキテクチャ設計 | `aidlc-docs/inception/application-design/aws-architecture.md` |

---

*本ガイドは AI-DLC OPERATIONS フェーズの成果物です（v1.0.0 作成: 2026-05-16）。*
