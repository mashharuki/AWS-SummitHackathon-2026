# 論理コンポーネント — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 論理コンポーネント一覧

```
フロントエンドアプリ（pkgs/frontend）
│
├── [AUTH LAYER]
│   ├── AuthProvider         ← JWT管理・Cognito連携
│   ├── lib/cognito.ts       ← Cognito Hosted UI・トークン操作
│   └── AuthCallbackPage     ← OAuth コールバック処理
│
├── [API LAYER]
│   ├── lib/apiClient.ts     ← HTTP + 認証ヘッダー + 401リトライ
│   └── src/mocks/           ← MSW モック（テスト用）
│
├── [ROUTING]
│   └── App.tsx              ← React Router v7・コード分割
│
├── [SHELL]
│   └── AppShell.tsx         ← 認証ガード・ヘッダー・トースト
│
├── [PAGE COMPONENTS]
│   ├── LoginPage            ← Google OAuth 起点
│   ├── TaskListPage         ← タスク一覧・承認・削除・楽観的更新
│   ├── TaskDetailPage       ← SSEストリーミング・チャット・本音記録
│   └── SettingsPage         ← Slack連携・ログアウト
│
├── [SHARED COMPONENTS]
│   ├── shadcn/ui            ← Button/Card/Badge/Input/Toast/Dialog
│   ├── TaskCard             ← pending/approved 2モード
│   ├── VerdictBox           ← 3状態色分け判定ボックス
│   ├── ChatPane             ← チャットUI全体
│   └── SaborouCanvas        ← Three.js ErrorBoundary ラッパー
│
├── [THREE.JS LAYER]（遅延ロード chunk分割）
│   ├── SaborouCanvas        ← Canvas + ErrorBoundary
│   └── SaborouCharacter     ← 3Dオブジェクト・verdict別アニメーション
│
└── [CUSTOM HOOKS]
    ├── useAuth              ← AuthContext 取得
    ├── useTasks             ← タスク CRUD・楽観的更新
    ├── useProposalStream    ← Vercel AI SDK useChat ラッパー
    ├── useConnections       ← 連携設定 CRUD
    ├── useToast             ← 通知管理
    └── useReducedMotion     ← アクセシビリティ
```

---

## 2. インフラ境界（フロントエンドが依存する外部）

| 依存先 | 用途 | プロトコル |
|--------|------|-----------|
| API Gateway + Lambda（U-04 api） | REST API 14エンドポイント | HTTPS / REST |
| Lambda Function URL（U-04 api） | SSEストリーミング（GET /api/tasks/:id/proposal?stream=true） | HTTPS / SSE |
| Cognito Hosted UI | Google OAuth 認証 | HTTPS リダイレクト |
| S3 + CloudFront（U-02 infra FrontendStack） | 静的ファイル配信 | HTTPS |

---

## 3. バンドルサイズ最適化（chunk 分割戦略）

| chunk | 内容 | 推定サイズ |
|-------|------|-----------|
| index（初期） | React + React Router + shadcn/ui 基本 + AppShell | ~200KB gzip |
| three-vendor | three.js + @react-three/fiber + @react-three/drei | ~300KB gzip（遅延） |
| cognito-vendor | amazon-cognito-identity-js | ~50KB gzip（遅延） |
| ai-vendor | Vercel AI SDK | ~30KB gzip（TaskDetailPage と共に遅延） |
| TaskListPage | タスク一覧コンポーネント | ~20KB gzip（遅延） |
| TaskDetailPage | タスク詳細コンポーネント | ~20KB gzip（遅延） |

---

## 4. テスト論理コンポーネント

| コンポーネント | テストタイプ | ツール |
|--------------|------------|------|
| lib/apiClient.ts | ユニット | Vitest + MSW |
| hooks/useAuth.ts | ユニット | Vitest + renderHook |
| hooks/useTasks.ts | ユニット | Vitest + renderHook + MSW |
| hooks/useProposalStream.ts | ユニット | Vitest + MSW（SSEモック） |
| components/task/TaskCard.tsx | コンポーネント | @testing-library/react |
| components/verdict/VerdictBox.tsx | コンポーネント | @testing-library/react |
| pages/LoginPage.tsx | コンポーネント | @testing-library/react |
| 認証フロー | E2E | Playwright |
| タスク承認フロー | E2E | Playwright |
| チャットフロー | E2E | Playwright |
