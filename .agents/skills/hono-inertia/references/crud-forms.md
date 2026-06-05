# CRUD実装・フォーム・Drizzle ORM ガイド

## 実装の5ステップ

1. Zod スキーマ定義（`shared/schemas/`）
2. Drizzle テーブルスキーマ定義（`server/db/schema.ts`）
3. Hono エンドポイント実装（`server/routes/`）
4. React ページ + useForm（`client/pages/`）
5. フラッシュメッセージ設定（ミドルウェア）

---

## Step 1: Zod スキーマ（shared/schemas/post.ts）

```typescript
import { z } from 'zod'

export const createPostSchema = z.object({
  title: z.string().min(1, '必須項目です').max(255, '255文字以内で入力'),
  body:  z.string().min(1, '必須項目です'),
})

export const updatePostSchema = createPostSchema.partial()

export type CreatePost = z.infer<typeof createPostSchema>
export type UpdatePost = z.infer<typeof updatePostSchema>
```

## Step 2: Drizzle スキーマ（server/db/schema.ts）

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable('posts', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
               .notNull()
               .$defaultFn(() => new Date()),
})

export type Post    = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
```

## Step 3: Hono エンドポイント（server/routes/posts.ts）

```typescript
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { db } from '../db/client'
import { posts } from '../db/schema'
import { createPostSchema, updatePostSchema } from '../../shared/schemas/post'

const app = new Hono()

// 一覧
app.get('/', async (c) => {
  const allPosts = await db.select().from(posts).orderBy(posts.createdAt)
  return c.render('Posts/Index', { posts: allPosts })
})

// 新規作成フォーム表示
app.get('/new', (c) => {
  return c.render('Posts/New', { errors: {} })
})

// 詳細
app.get('/:id', async (c) => {
  const post = await db.select().from(posts)
    .where(eq(posts.id, Number(c.req.param('id'))))
    .get()
  if (!post) return c.notFound()
  return c.render('Posts/Show', { post })
})

// 編集フォーム表示
app.get('/:id/edit', async (c) => {
  const post = await db.select().from(posts)
    .where(eq(posts.id, Number(c.req.param('id'))))
    .get()
  if (!post) return c.notFound()
  return c.render('Posts/Edit', { post, errors: {} })
})

// 作成（PRGパターン）
app.post('/', zValidator('json', createPostSchema, (result, c) => {
  if (!result.success) {
    // バリデーションエラーは props で返す（Inertia規約）
    const errors = Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v?.[0]])
    )
    return c.render('Posts/New', { errors })
  }
}), async (c) => {
  const data = c.req.valid('json')
  await db.insert(posts).values(data)
  // PRG: 成功はリダイレクト
  return c.redirect('/posts', 303)
})

// 更新
app.patch('/:id', zValidator('json', updatePostSchema, (result, c) => {
  if (!result.success) {
    const errors = Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors)
        .map(([k, v]) => [k, v?.[0]])
    )
    return c.render('Posts/Edit', { errors })
  }
}), async (c) => {
  const data = c.req.valid('json')
  await db.update(posts)
    .set(data)
    .where(eq(posts.id, Number(c.req.param('id'))))
  return c.redirect('/posts', 303)
})

// 削除
app.delete('/:id', async (c) => {
  await db.delete(posts).where(eq(posts.id, Number(c.req.param('id'))))
  return c.redirect('/posts', 303)
})

export default app
```

## Step 4: React ページ + useForm

### 一覧ページ（client/pages/Posts/Index.tsx）

```tsx
import { Link } from '@inertiajs/react'
import type { Post } from '../../../server/db/schema'

interface Props {
  posts: Post[]
}

export default function Index({ posts }: Props) {
  return (
    <div>
      <h1>投稿一覧</h1>
      <Link href="/posts/new">新規作成</Link>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/posts/${post.id}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

### 新規作成ページ（client/pages/Posts/New.tsx）

```tsx
import { useForm } from '@inertiajs/react'

interface Props {
  errors: Record<string, string | undefined>
}

export default function New({ errors }: Props) {
  const form = useForm({ title: '', body: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post('/posts')  // POST /posts
  }

  return (
    <form onSubmit={submit}>
      <div>
        <label>タイトル</label>
        <input
          value={form.data.title}
          onChange={(e) => form.setData('title', e.target.value)}
        />
        {(form.errors.title || errors.title) && (
          <p className="text-red-500">{form.errors.title || errors.title}</p>
        )}
      </div>
      <div>
        <label>本文</label>
        <textarea
          value={form.data.body}
          onChange={(e) => form.setData('body', e.target.value)}
        />
        {(form.errors.body || errors.body) && (
          <p className="text-red-500">{form.errors.body || errors.body}</p>
        )}
      </div>
      <button type="submit" disabled={form.processing}>
        {form.processing ? '送信中...' : '作成'}
      </button>
    </form>
  )
}
```

### 編集ページ（client/pages/Posts/Edit.tsx）

```tsx
import { useForm } from '@inertiajs/react'
import type { Post } from '../../../server/db/schema'

interface Props {
  post:   Post
  errors: Record<string, string | undefined>
}

export default function Edit({ post, errors }: Props) {
  const form = useForm({ title: post.title, body: post.body })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.patch(`/posts/${post.id}`)  // PATCH /posts/:id
  }

  function destroy() {
    if (confirm('本当に削除しますか？')) {
      form.delete(`/posts/${post.id}`)
    }
  }

  return (
    <form onSubmit={submit}>
      <div>
        <label>タイトル</label>
        <input
          value={form.data.title}
          onChange={(e) => form.setData('title', e.target.value)}
        />
        {form.errors.title && <p className="text-red-500">{form.errors.title}</p>}
      </div>
      <div>
        <label>本文</label>
        <textarea
          value={form.data.body}
          onChange={(e) => form.setData('body', e.target.value)}
        />
        {form.errors.body && <p className="text-red-500">{form.errors.body}</p>}
      </div>
      <button type="submit" disabled={form.processing}>保存</button>
      <button type="button" onClick={destroy} disabled={form.processing}>削除</button>
    </form>
  )
}
```

## Step 5: フラッシュメッセージ

```typescript
// server/index.ts のミドルウェア設定
app.use('*', inertia({
  html: ...,
  sharedProps: async (c) => {
    const session = await getSession(c)
    const flash = session?.flash ?? {}
    await clearFlash(c)  // フラッシュはワンタイム
    return { flash }
  },
}))
```

```tsx
// client/components/Layout.tsx
import { usePage } from '@inertiajs/react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { flash } = usePage().props as { flash: { success?: string; error?: string } }

  return (
    <div>
      {flash.success && (
        <div className="bg-green-100 p-4">{flash.success}</div>
      )}
      {flash.error && (
        <div className="bg-red-100 p-4">{flash.error}</div>
      )}
      {children}
    </div>
  )
}
```

## よくある実装パターン

### N+1 対策（Drizzleのリレーション）

```typescript
// schema.ts でリレーション定義
export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}))

// クエリ時に with で eager load
const postsWithAuthor = await db.query.posts.findMany({
  with: { author: true },
})
```

### 検索・フィルタリング

```typescript
app.get('/', async (c) => {
  const q = c.req.query('q') ?? ''
  const allPosts = await db.select().from(posts)
    .where(q ? like(posts.title, `%${q}%`) : undefined)
    .orderBy(posts.createdAt)
  return c.render('Posts/Index', { posts: allPosts, query: q })
})
```

### ページネーション

```typescript
const PAGE_SIZE = 20
const page = Number(c.req.query('page') ?? 1)
const offset = (page - 1) * PAGE_SIZE

const [items, total] = await Promise.all([
  db.select().from(posts).limit(PAGE_SIZE).offset(offset),
  db.select({ count: sql<number>`count(*)` }).from(posts),
])

return c.render('Posts/Index', {
  posts: items,
  pagination: { page, pageSize: PAGE_SIZE, total: total[0].count },
})
```

### ファイルアップロード

```tsx
// useForm は multipart/form-data をサポート
const form = useForm<{ title: string; image: File | null }>({
  title: '',
  image: null,
})

form.post('/posts', {
  forceFormData: true,  // multipart として送信
})
```
