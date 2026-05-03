# セットアップガイド: Bun + Vite + Hono + Inertia.js + React

## 1. プロジェクト初期化

```bash
mkdir my-app && cd my-app
bun init -y
```

## 2. パッケージインストール

```bash
# コアフレームワーク
bun add hono @hono/inertia @hono/zod-validator
bun add @inertiajs/react @inertiajs/server
bun add react react-dom

# ORM
bun add drizzle-orm drizzle-zod
bun add -d drizzle-kit

# バリデーション
bun add zod

# 開発ツール
bun add -d typescript @types/react @types/react-dom
bun add -d @vitejs/plugin-react vite
bun add -d @hono/vite-build @hono/vite-dev-server

# スタイリング (任意)
bun add -d @tailwindcss/vite tailwindcss
```

## 3. ディレクトリ作成

```bash
mkdir -p server/routes server/db server/middleware
mkdir -p client/pages shared/schemas
```

## 4. vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import honoDevServer from '@hono/vite-dev-server'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    honoDevServer({
      entry: 'server/index.ts',
    }),
    react(),
    tailwindcss(),  // Tailwind使用時
  ],
  build: {
    rollupOptions: {
      input: {
        client: 'client/main.tsx',
        server: 'server/index.ts',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
})
```

## 5. server/index.ts

```typescript
import { Hono } from 'hono'
import { inertia } from '@hono/inertia'
import { serveStatic } from '@hono/node-server/serve-static'
import postsRoute from './routes/posts'

const app = new Hono()

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './' }))

// Inertia ミドルウェア
app.use('*', inertia({
  html: (page) => `
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>My App</title>
      </head>
      <body>
        <div id="app" data-page='${JSON.stringify(page)}'></div>
        <script type="module" src="/static/client.js"></script>
      </body>
    </html>
  `,
}))

// ルート登録
app.route('/posts', postsRoute)

app.get('/', (c) => c.render('Home', { message: 'Hello, Inertia!' }))

export default app
export type AppType = typeof app
```

## 6. client/main.tsx

```tsx
import { createRoot } from 'react-dom/client'
import { createInertiaApp } from '@inertiajs/react'

createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob('./pages/**/*.tsx')
    const page = pages[`./pages/${name}.tsx`]
    if (!page) throw new Error(`Page not found: ${name}`)
    return (await page()) as { default: React.ComponentType }
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />)
  },
})
```

## 7. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "paths": {
      "@server/*": ["./server/*"],
      "@client/*": ["./client/*"],
      "@shared/*": ["./shared/*"]
    }
  },
  "include": ["server", "client", "shared"]
}
```

## 8. package.json スクリプト

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "node dist/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "typecheck": "tsc --noEmit"
  }
}
```

## 9. 動作確認

```bash
bun run dev
# → http://localhost:5173 で確認
```

## Drizzle ORM セットアップ

### server/db/schema.ts

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable('posts', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  title:     text('title').notNull(),
  body:      text('body').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
```

### server/db/client.ts

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'

const sqlite = new Database('sqlite.db')
export const db = drizzle(sqlite, { schema })
```

### drizzle.config.ts

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out:    './drizzle',
  dialect: 'sqlite',
  dbCredentials: { url: 'sqlite.db' },
})
```

## Cloudflare Workers向けセットアップ差分

Workersを使う場合はD1をDBに使い、KVをセッションストアにする:

```bash
bun add drizzle-orm/d1           # D1アダプタ
bun add hono/cloudflare-workers  # Workers用サーブ関数
bun add -d wrangler              # CLIツール
```

`wrangler.toml` でD1とKVバインディングを設定し、`server/db/client.ts` を Workers環境用に切り替える。
