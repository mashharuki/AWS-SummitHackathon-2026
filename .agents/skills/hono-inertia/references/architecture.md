# アーキテクチャ詳細: Hono × Inertia.js

## サーバー駆動 SPA の仕組み

### Page Object

Hono の `c.render()` が返す JSON 構造:

```json
{
  "component": "Posts/Show",
  "props": { "post": { "id": 1, "title": "Hello", "body": "World" } },
  "url": "/posts/1",
  "version": "abc123"
}
```

Inertia ランタイムがこれを受け取り、`component` 名に対応するReactコンポーネントを解決して `props` を渡してレンダリングする。

### 初回リクエストとSPAナビゲーションの違い

| シナリオ | サーバーの返却 | クライアントの動作 |
|---------|---------------|-------------------|
| **初回アクセス（フルページ）** | HTML（Page Object 埋め込み） | React マウント |
| **Inertia リンク/フォーム** | JSON（Page Object のみ） | コンポーネント差し替え |
| **外部リンク・直接URL** | HTML（フルページ） | React マウント |

## 型安全メカニズム（4段階）

### Phase 1: c.render() の型記録

```typescript
// Honoが c.render() の戻り値型を自動追跡
app.get('/posts/:id', async (c) => {
  const post = await getPost(c.req.param('id'))
  return c.render('Posts/Show', { post })
  // TypedResponse<{ component: 'Posts/Show'; props: { post: Post } }> として記録
})
```

### Phase 2: ExtractSchema でルート型抽出

```typescript
import type { ExtractSchema } from 'hono/types'
import type { AppType } from '../server'

type Routes = ExtractSchema<AppType>
// すべてのエンドポイントの component + props 型が含まれる
```

### Phase 3: モジュール拡張（Viteプラグイン自動生成）

```typescript
// client/types.ts (自動生成)
import type { AppType } from '../server'
import type { ExtractSchema } from 'hono/types'

declare module '@hono/inertia' {
  interface AppRegistry {
    app: AppType
  }
}

type RenderOutput = {
  [K in keyof ExtractSchema<AppType>]:
    ExtractSchema<AppType>[K]['$get']['output']
}[keyof ExtractSchema<AppType>]
```

### Phase 4: PageProps<C> 型ユーティリティ

```typescript
// union から特定コンポーネントの props だけ取得
export type PageProps<C extends string> =
  Extract<RenderOutput, { component: C }>['props']

// 使用例:
// Post コンポーネント側で型安全に props を受け取る
function Show({ post }: PageProps<'Posts/Show'>) { ... }
// → post の型は自動的に推論される
```

## Laravel/Rails との比較

| 観点 | Laravel + Inertia | Hono + Inertia |
|------|-------------------|----------------|
| スキーマ定義 | PHP と TypeScript で二重管理 | TypeScript のみで一元管理 |
| Props 型 | 手動で型定義が必要 | サーバーから自動推論 |
| タイポ検知 | 実行時エラー | コンパイル時エラー |
| コールドスタート | 数秒 | ミリ秒以下（Workers） |

## tRPC との位置づけの違い

| 観点 | Hono + Inertia | tRPC |
|------|----------------|------|
| 粒度 | ページ全体の props | 個別API呼び出し |
| 最適な用途 | ページが状態単位の業務アプリ | 細粒度APIが必要なSPA |
| クライアント状態管理 | 最小化（サーバーが信頼の源） | useQuery などで管理 |
| SEO対応 | CSR寄り（業務アプリ向け） | 柔軟 |

## Inertia 共有プロパティ（Shared Props）

全ページに渡したい共通データ（認証ユーザー情報・フラッシュメッセージなど）は
Inertia ミドルウェアの `sharedProps` オプションで設定する:

```typescript
app.use('*', inertia({
  html: (page) => `...`,
  sharedProps: async (c) => {
    const session = await getSession(c)
    return {
      auth: {
        user: session?.user ?? null,
      },
      flash: {
        success: session?.flash?.success ?? null,
        error:   session?.flash?.error ?? null,
      },
    }
  },
}))
```

クライアント側での参照:

```tsx
import { usePage } from '@inertiajs/react'

function Layout({ children }: { children: React.ReactNode }) {
  const { auth, flash } = usePage().props as any

  return (
    <div>
      {flash.success && <Toast message={flash.success} />}
      <nav>ようこそ {auth.user?.name}</nav>
      {children}
    </div>
  )
}
```

## Partial Reloads（部分リロード）

Inertia のリクエスト時に必要な props だけを取得する最適化:

```tsx
// クライアント側: only で必要な props を指定
router.reload({ only: ['posts'] })

// useForm でも同様
form.post('/posts', { only: ['errors'] })
```

サーバー側は Inertia が自動的に必要なプロパティのみ評価するよう制御する。
重いデータ取得をラップするには `lazy()` を使用する。

## バージョン管理（アセットキャッシュバスティング）

```typescript
app.use('*', inertia({
  html: (page) => `...`,
  version: () => process.env.ASSET_VERSION ?? 'dev',
}))
```

バージョンが変わると Inertia がフルページリロードを強制し、
古いJSバンドルを参照し続けるバグを防ぐ。
