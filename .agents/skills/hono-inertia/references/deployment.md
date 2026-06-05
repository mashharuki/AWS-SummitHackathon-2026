# デプロイガイド: Hono × Inertia.js

## デプロイ先選定マトリクス

| デプロイ先 | ランタイム | コールドスタート | DB連携 | 推奨ケース |
|-----------|----------|----------------|--------|-----------|
| **Cloudflare Workers** | Workers | 最速（<1ms） | D1 / KV | グローバルSaaS |
| **Vercel** | Node/Edge | 速い | Neon/PlanetScale | DX重視・フロント中心 |
| **Fly.io** | Bun/Node | 普通 | Postgres付属 | 国内業務システム |
| **Bun on VPS** | Bun | 速い | 自由 | 小規模・高自由度 |
| **AWS ECS Fargate** | Node | やや遅い | RDS/Aurora | 既存AWS環境 |

---

## Cloudflare Workers デプロイ

### 追加パッケージ

```bash
bun add -d wrangler
```

### wrangler.toml

```toml
name        = "my-app"
main        = "dist/server.js"
compatibility_date = "2026-01-01"

[vars]
NODE_ENV = "production"

[[d1_databases]]
binding  = "DB"
database_name = "my-app-db"
database_id   = "xxxx-xxxx-xxxx-xxxx"

[[kv_namespaces]]
binding  = "SESSION_KV"
id       = "xxxx-xxxx-xxxx-xxxx"
```

### Workers 向けコード調整

```typescript
// server/index.ts
import { Hono } from 'hono'
import { drizzle } from 'drizzle-orm/d1'

type Env = {
  DB: D1Database
  SESSION_KV: KVNamespace
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  const db = drizzle(c.env.DB)
  c.set('db', db)
  await next()
})

export default app
```

### シークレット管理

```bash
wrangler secret put SESSION_SECRET
wrangler secret put DATABASE_URL
```

### デプロイコマンド

```bash
bun run build        # クライアント + サーバーをビルド
wrangler deploy      # Workers へデプロイ
```

### Workers の制約

- バンドルサイズ上限: 1MB（圧縮後）
- Node.js ネイティブモジュール（fs, path, crypto など）使用不可
- メモリセッションストア使用不可 → KVNamespace を使用
- ファイルアップロードは Workers ではなく R2 へ直接

---

## Vercel デプロイ

### vercel.json

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "functions": {
    "dist/server.js": {
      "runtime": "nodejs20.x"
    }
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/dist/server.js" }
  ]
}
```

### 環境変数設定

```bash
vercel env add DATABASE_URL production
vercel env add SESSION_SECRET production
```

### デプロイ

```bash
vercel deploy --prod
```

---

## Fly.io デプロイ（Bun）

### Dockerfile

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
CMD ["bun", "run", "dist/server.js"]
```

### fly.toml

```toml
app = "my-app"
primary_region = "nrt"  # 東京

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

### デプロイ

```bash
fly launch --no-deploy   # 初回設定
fly secrets set SESSION_SECRET=... DATABASE_URL=...
fly deploy
```

---

## GitHub Actions CI/CD パイプライン

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun run lint

      - name: Test
        run: bun run test

      - name: Build
        run: bun run build

  deploy-production:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Install & Build
        run: |
          bun install --frozen-lockfile
          bun run build

      # Cloudflare Workers の場合
      - name: Deploy to Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}

      # Fly.io の場合
      # - name: Deploy to Fly.io
      #   uses: superfly/flyctl-actions/setup-flyctl@master
      # - run: flyctl deploy --remote-only
      #   env:
      #     FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

---

## 環境変数・シークレット管理

```typescript
// server/config.ts - 環境変数の一元管理
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV:       z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL:   z.string().url(),
  SESSION_SECRET: z.string().min(32),
  PORT:           z.coerce.number().default(3000),
})

export const env = envSchema.parse(process.env)
```

### 原則
- Gitにシークレットをコミットしない（`.env` は `.gitignore` に追加）
- 環境ごとに異なるシークレットを使用（dev / staging / prod）
- Workers: `wrangler secret put` で管理
- Vercel: ダッシュボードまたは `vercel env add`
- Fly.io: `fly secrets set`

---

## ビルド設定

### vite.config.ts（本番ビルド）

```typescript
export default defineConfig(({ mode }) => ({
  plugins: [
    ...(mode === 'production' ? [] : [honoDevServer({ entry: 'server/index.ts' })]),
    react(),
  ],
  build: {
    rollupOptions: {
      input:  { client: 'client/main.tsx' },
      output: { entryFileNames: 'assets/[name]-[hash].js' },
    },
    outDir: 'dist/client',
  },
}))
```

### package.json スクリプト

```json
{
  "scripts": {
    "dev":       "vite",
    "build":     "bun run build:client && bun run build:server",
    "build:client": "vite build",
    "build:server": "bun build server/index.ts --outfile dist/server.js --target bun",
    "start":     "NODE_ENV=production bun dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint":      "biome check ."
  }
}
```

---

## 本番運用の必須要素

### モニタリング

```typescript
// Sentry によるエラー追跡
import * as Sentry from '@sentry/bun'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
})

// Hono エラーハンドラー
app.onError((err, c) => {
  Sentry.captureException(err)
  console.error(err)
  return c.render('Errors/500', { message: 'サーバーエラーが発生しました' })
})
```

### ヘルスチェックエンドポイント

```typescript
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))
```

### ログ設定

```typescript
import { logger } from 'hono/logger'

app.use('*', logger())  // リクエストログ
```

---

## よくあるデプロイのハマりポイント

| 問題 | 原因 | 対処 |
|------|------|------|
| Workers でランタイムエラー | Node.js ネイティブモジュール混入 | Web標準API・Drizzle D1アダプタを使用 |
| セッションが消える | メモリストア使用 | KV / Redis / D1 に変更 |
| ファイルアップロード失敗 | Workers の制約 | R2 / S3 へ直接アップロード |
| タイムゾーンずれ | UTC 環境でのデプロイ | `Asia/Tokyo` を明示的に設定 |
| 静的ファイル配信失敗 | パスの設定ミス | `serveStatic` の `root` を確認 |
| 環境変数 undefined | シークレット未設定 | `envSchema.parse()` で起動時に検証 |
