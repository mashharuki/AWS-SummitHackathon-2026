---
name: hono-inertia
description: >
  Hono × Inertia.js × React を使ったフルスタックアプリの設計・開発・レビューを包括的に支援するスキル。
  セットアップ（Bun + Vite）、型安全レンダリング（c.render）、CRUD + フォーム（Zod + Drizzle + useForm）、
  認証（Better Auth / Lucia）、デプロイ（Cloudflare Workers / Vercel / Fly.io）まで網羅。

  以下のいずれかに当てはまれば必ずこのスキルを使用すること：
  - Hono + Inertia.js のコードを書く・レビューする・設計する
  - @hono/inertia を使ったアプリを構築したい
  - Hono で React ページをサーバー駆動レンダリングしたい（c.render を使う）
  - APIなしフルスタック（"modern monolith"）を React + TypeScript で構築したい
  - Inertia useForm を使ったフォーム処理を実装したい
  - Hono + Inertia のルーティング・認証・デプロイを検討している
  - Hono Inertia アプリのコードレビューや設計レビューを行う
---

# Hono × Inertia.js 開発スキル

## このスタックとは

**"APIなしフルスタック" = サーバー駆動SPA**

```
ブラウザ ──Inertia.js──► Hono サーバー
         Page Object          ↓ c.render('PageName', props)
React コンポーネント ◄── Inertia ランタイム
```

Hono が `c.render('Posts/Show', { post })` を返すと、Inertia がそのままReactコンポーネントに props を渡してレンダリングする。
REST API の設計・fetch・状態管理が不要になり、機能追加は「サーバールート + React ページ」の2ファイルのみで完結する。

## 技術スタック

| レイヤー | 技術 | 役割 |
|---------|------|------|
| **バックエンド** | Hono | ルーティング・ミドルウェア・データ取得 |
| **アダプタ** | @hono/inertia | Inertia プロトコル実装 |
| **フロントエンド** | React + Inertia.js | UIレンダリング |
| **バリデーション** | Zod | サーバー・クライアント共有スキーマ |
| **ORM** | Drizzle ORM | 型安全DB操作（Workers対応） |
| **ランタイム** | Bun / Node.js | 実行環境 |
| **ビルド** | Vite + @hono/vite-dev-server | 開発サーバー・バンドル |

## 標準ディレクトリ構成

```
my-app/
├── server/
│   ├── index.ts          # Hono アプリ エントリポイント
│   ├── routes/           # ルート定義（ドメインごとに分割）
│   │   ├── posts.ts
│   │   └── users.ts
│   ├── db/               # Drizzle スキーマ・クライアント
│   │   ├── schema.ts
│   │   └── client.ts
│   └── middleware/       # 認証・セッションなど
├── client/
│   ├── main.tsx          # createInertiaApp エントリ
│   └── pages/            # React ページコンポーネント
│       ├── Home.tsx
│       └── Posts/
│           ├── Index.tsx
│           └── Show.tsx
├── shared/
│   └── schemas/          # Zod スキーマ（サーバー・クライアント共有）
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## コアパターン

### 1. サーバー側: c.render()

```typescript
// server/routes/posts.ts
import { Hono } from 'hono'
import { db } from '../db/client'
import { posts } from '../db/schema'
import { zValidator } from '@hono/zod-validator'
import { postSchema } from '../../shared/schemas/post'

const app = new Hono()

app.get('/', async (c) => {
  const allPosts = await db.select().from(posts)
  return c.render('Posts/Index', { posts: allPosts })
})

app.get('/:id', async (c) => {
  const post = await db.select().from(posts).where(eq(posts.id, c.req.param('id'))).get()
  return c.render('Posts/Show', { post })
})

app.post('/', zValidator('json', postSchema), async (c) => {
  const data = c.req.valid('json')
  await db.insert(posts).values(data)
  return c.redirect('/posts')  // PRG パターン
})
```

### 2. クライアント側: useForm + PageProps

```tsx
// client/pages/Posts/Show.tsx
import { useForm } from '@inertiajs/react'
import type { PageProps } from '../../types'  // 自動推論型

export default function Show({ post }: PageProps<'Posts/Show'>) {
  const form = useForm({ title: post.title, body: post.body })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.put(`/posts/${post.id}`)
  }

  return (
    <form onSubmit={submit}>
      <input value={form.data.title} onChange={e => form.setData('title', e.target.value)} />
      {form.errors.title && <p>{form.errors.title}</p>}
      <button disabled={form.processing}>保存</button>
    </form>
  )
}
```

### 3. Zod バリデーション: サーバー一元管理

```typescript
// shared/schemas/post.ts
import { z } from 'zod'

export const postSchema = z.object({
  title: z.string().min(1).max(255),
  body:  z.string().min(1),
})

export type Post = z.infer<typeof postSchema>
```

Zodエラーはサーバーが props として返し、`form.errors.fieldName` で自動表示される。
クライアント側に独立したバリデーションロジックを書かない。

### 4. 型安全な Props 推論

```typescript
// Hono の ExtractSchema で全ルートの型を抽出
// Vite プラグインが自動生成し、client/types.ts に書き出す
import type { AppType } from '../server'
import type { ExtractSchema } from 'hono/types'

type RenderOutput = ExtractSchema<AppType>[keyof ExtractSchema<AppType>]['$get']['output']
export type PageProps<C extends string> = Extract<RenderOutput, { component: C }>['props']
```

## タスク別ガイド

| やりたいこと | 参照 |
|-------------|------|
| 初期セットアップ（Bun + Vite + Hono + Inertia） | `references/setup.md` |
| アーキテクチャ詳細・型安全メカニズム | `references/architecture.md` |
| CRUD実装・フォーム・Drizzle ORM | `references/crud-forms.md` |
| 認証（セッション・Better Auth・Lucia） | `references/auth.md` |
| デプロイ（Workers / Vercel / Fly.io / ECS） | `references/deployment.md` |

## 設計・実装の判断基準

### このスタックを選ぶべきケース
- SEO不要の業務アプリ・社内ツール・SaaS
- フルスタック TypeScript で型安全性を最大化したい
- Next.js/Remix より軽量・柔軟なランタイム選択が必要
- Cloudflare Workers でグローバルエッジ配信したい

### このスタックを選ばないべきケース
- SEOが重要な公開サイト（SSRが必須ならNext.js）
- 外部公開APIが主目的（REST/GraphQL API専用サーバー）
- チームにReactの知識がない

## コードレビューチェックリスト

**必須確認事項**:
- [ ] `c.render()` の第2引数の props 型が正しく推論されているか
- [ ] バリデーションは Zod でサーバー側に集中しているか（クライアント二重定義NG）
- [ ] POST 成功後は `c.redirect()` でPRGパターンを踏んでいるか
- [ ] エラーは HTTP エラーレスポンスではなく props で返しているか（Inertia規約）
- [ ] Drizzle クエリにN+1問題がないか（`with` や `leftJoin` で eager load）
- [ ] セッション情報は共有 props（shared props）経由で渡しているか
- [ ] シークレット・APIキーが Git にコミットされていないか

**パフォーマンス**:
- [ ] Workers デプロイ時にNode.jsネイティブモジュールが混入していないか
- [ ] バンドルサイズが Cloudflare Workers 制限（1MB）を超えていないか
- [ ] セッションストアにメモリストアを使っていないか（KV/Redis 必須）

## よくあるミスと対処

| ミス | 対処 |
|------|------|
| `useEffect + fetch` でデータ取得 | `c.render()` で props として渡す |
| React Router でルーティング | サーバーのHonoルーティングに統一 |
| クライアント側にバリデーションロジック重複 | Zod スキーマを `shared/` に置いて共有 |
| POST後にページ再描画されない | `c.redirect()` を使ってPRGパターン |
| メモリセッションストア使用 | KV / Redis / D1 に変更 |
| Workers で Node.js モジュール使用 | Web標準APIのみ使用・Drizzleなら問題なし |
