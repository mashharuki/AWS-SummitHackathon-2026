# コードスタイル・規約（2026-05-23 更新）

最終更新: 2026-05-23

## 基本方針
- **TypeScript strict モード**（全パッケージ）
- **Biome 1.9.4**: フォーマット + Lint（ESLint / Prettier 禁止）
  - 設定: プロジェクトルートの `biome.json`
- **pnpm ^10.33.0** モノレポ（npm / yarn 禁止）
- **Node.js 23** 

## ファイル命名
- ファイル名: `camelCase.ts` または `PascalCase.tsx`（コンポーネントは PascalCase）
- テストファイル: `*.test.ts` / `*.spec.ts`
- 型定義ファイル: `types.ts`（パッケージルートまたは `src/types/`）

## ディレクトリ構成（パッケージ別）

### pkgs/shared
```
src/
├── types/       # 共有型定義
├── utils/       # ユーティリティ関数
└── index.ts     # エントリーポイント
```
- tsup でビルド（ESM/CJS/DTS 出力）

### pkgs/agent
```
src/
├── agents/      # エージェント実装（task-extractor, sabori-proposer）
├── types/       # エージェント固有型
└── index.ts     # エントリーポイント
```
- IBedrockClient インタフェース経由でテスト可能
- tsup でビルド（ESM/CJS/DTS 出力）

### pkgs/backend
```
src/
├── routes/      # Hono ルート定義
├── handlers/    # ビジネスロジック
├── middleware/  # 認証・バリデーション等
├── services/    # 外部サービス統合
└── index.ts     # エントリーポイント（API）
webhook.ts       # Slack Webhook エントリーポイント
```
- esbuild でバンドル（dist/index.js + dist/webhook.js）

### pkgs/frontend
```
src/
├── pages/           # ページコンポーネント（ルーティング単位）
│   ├── AuthCallbackPage.tsx
│   ├── LoginPage.tsx
│   ├── ManualPage.tsx
│   ├── PersonaPage.tsx
│   ├── RoadmapPage.tsx
│   ├── SettingsPage.tsx
│   ├── TaskDetailPage.tsx
│   └── TaskListPage.tsx
├── components/      # UI コンポーネント群
│   ├── character/   # Three.js キャラクター（SaborouCharacter3D, SaborouScene3D）
│   ├── chat/        # チャット UI
│   ├── layout/      # レイアウト（Header, Footer 等）
│   ├── task/        # タスク関連
│   ├── three/       # Three.js シーン構成
│   ├── ui/          # shadcn/ui コンポーネント
│   └── verdict/     # 判定UI
├── hooks/           # カスタムフック
├── i18n.ts          # react-i18next 設定・翻訳定義
├── App.tsx          # ルーティング定義
├── App.css          # Tailwind v4 @theme スタイル
└── index.css        # グローバルスタイル
public/
├── banner.svg       # ブランドバナー
├── favicon.svg      # ファビコン
├── icons.svg        # アイコンスプライト
└── mockServiceWorker.js  # PWA サービスワーカー
```

### pkgs/cdk
```
lib/
├── stacks/      # 各 CDK スタック（DataStack, StorageStack 等）
├── constructs/  # カスタム Construct
└── index.ts
bin/
└── app.ts       # CDK エントリーポイント
test/            # Jest テスト（35テスト）
```

## 命名規則（TypeScript）
- インタフェース: `I` プレフィックスなし（型エイリアス優先）。ただし DI 用は `I` プレフィックス可（例: `IBedrockClient`）
- Enum: 使用禁止（const オブジェクト + type エクスポートで代替）
- React コンポーネント: `PascalCase`
- フック: `use` プレフィックス + `camelCase`
- 定数: `UPPER_SNAKE_CASE`

## テスト規約
- フレームワーク: **Vitest**（shared/agent/backend/frontend）/ **Jest**（cdk のみ）
- テストファイル: コードと同階層の `__tests__/` 配下 または `*.test.ts` 同一ディレクトリ
- モックパターン: `vi.fn()` / `vi.mock()`（Vitest）、`jest.fn()` / `jest.mock()`（Jest）
- **Bedrock などの外部依存はインタフェース経由でモック**
- カバレッジ目標: shared 100%、その他 80%以上

## Tailwind CSS v4 設定
- `App.css` で `@import "tailwindcss"` + `@theme {}` ブロックを定義
- `@utility` でカスタムユーティリティ追加
- shadcn/ui との共存（`components.json` 設定）

## i18n 規約
- `pkgs/frontend/src/i18n.ts` で言語設定・翻訳定義
- `react-i18next` の `useTranslation` フック使用
- 翻訳キー: `camelCase` でネスト形式

## Three.js 規約
- コンポーネントは `components/three/` または `components/character/` に配置
- Three.js は別チャンクに分離（Vite の `build.rollupOptions.output.manualChunks`）
- `<Suspense>` でローディング管理

## ドキュメント規約（重要）
- **アプリコードは pkgs/ 配下のみ**（aidlc-docs/ には置かない）
- **aidlc-docs/ はドキュメントのみ**（AI-DLC成果物専用）
- 日本語で全成果物を記述（コードコメント・変数名は英語可）
- コミットメッセージ: 日本語 + Conventional Commits 形式
