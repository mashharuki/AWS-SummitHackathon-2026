# 認証実装ガイド: Hono × Inertia.js

## 推奨アーキテクチャ

**2026年の主流**: `HttpOnly Cookie + サーバー側セッション`

```
ブラウザ ──Cookie──► Hono ミドルウェア
                      ↓ セッション解決
                     ユーザー情報 → Inertia 共有 props
```

- JWTをlocalStorageに保存するのは XSS リスクがあるため非推奨
- セッションストアはメモリ不可（Workers/Bun再起動で消える）→ KV / Redis / D1 を使用

## 認証ライブラリ選択

| ライブラリ | 特徴 | 適したケース |
|-----------|------|------------|
| **Better Auth** | フルスタック認証、OAuth対応、Hono公式連携 | 本番プロダクト・OAuth必要 |
| **Lucia** | 軽量セッション管理、型安全 | シンプルなセッション認証 |
| **DIY セッション** | 完全制御可能 | 学習・高度なカスタマイズ |

---

## Better Auth を使った実装

### インストール

```bash
bun add better-auth
```

### セットアップ（server/auth.ts）

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/client'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite' }),
  emailAndPassword: { enabled: true },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 60 * 24 * 7 }, // 7日
  },
  socialProviders: {
    // GitHub OAuth (任意)
    github: {
      clientId:     process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
})
```

### Hono への統合（server/index.ts）

```typescript
import { auth } from './auth'

// Better Auth のルートハンドラーをマウント
app.on(['POST', 'GET'], '/api/auth/**', (c) => auth.handler(c.req.raw))
```

### 認証ミドルウェア

```typescript
// server/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { auth } from '../auth'

export const requireAuth = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })

  if (!session) {
    // Inertia redirect (SPAナビゲーション対応)
    return c.redirect('/login', 302)
  }

  c.set('user', session.user)
  c.set('session', session.session)
  await next()
})
```

### Inertia 共有 props でユーザー情報を全ページに渡す

```typescript
app.use('*', inertia({
  html: ...,
  sharedProps: async (c) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    })
    return {
      auth: {
        user: session?.user
          ? { id: session.user.id, name: session.user.name, email: session.user.email }
          : null,
      },
    }
  },
}))
```

---

## Lucia を使った軽量セッション実装

### インストール

```bash
bun add lucia @lucia-auth/adapter-drizzle
```

### セットアップ（server/auth.ts）

```typescript
import { Lucia } from 'lucia'
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle'
import { db } from './db/client'
import { sessions, users } from './db/schema'

const adapter = new DrizzleSQLiteAdapter(db, sessions, users)

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: { secure: process.env.NODE_ENV === 'production' },
  },
  getUserAttributes: (attrs) => ({
    email: attrs.email,
    name:  attrs.name,
  }),
})

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia
    DatabaseUserAttributes: { email: string; name: string }
  }
}
```

### Drizzle スキーマ（users + sessions）

```typescript
export const users = sqliteTable('users', {
  id:             text('id').primaryKey(),
  email:          text('email').notNull().unique(),
  name:           text('name').notNull(),
  hashedPassword: text('hashed_password').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id:        text('id').primaryKey(),
  userId:    text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
})
```

---

## DIYセッション実装（最小構成）

### パスワードハッシュ

```typescript
import { hash, verify } from '@node-rs/argon2'  // またはbcrypt

// 登録時
const hashedPassword = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
})

// 認証時
const valid = await verify(hashedPassword, inputPassword)
```

### セッションストア（SQLite/D1）

```typescript
// server/middleware/session.ts
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { db } from '../db/client'
import { sessions, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export async function createSession(c: Context, userId: string) {
  const sessionId = nanoid(32)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7日

  await db.insert(sessions).values({ id: sessionId, userId, expiresAt })

  setCookie(c, 'session', sessionId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/',
  })
}

export async function getSession(c: Context) {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) return null

  const result = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .get()

  if (!result || result.session.expiresAt < new Date()) return null
  return result
}

export async function destroySession(c: Context) {
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
  }
  deleteCookie(c, 'session')
}
```

---

## ログイン・ログアウト・登録ルート

### ルート定義（server/routes/auth.ts）

```typescript
const app = new Hono()

// ログインフォーム表示
app.get('/login', (c) => c.render('Auth/Login', { errors: {} }))

// ログイン処理
app.post('/login', zValidator('json', loginSchema, (result, c) => {
  if (!result.success) {
    const errors = Object.fromEntries(
      Object.entries(result.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0]])
    )
    return c.render('Auth/Login', { errors })
  }
}), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await db.select().from(users).where(eq(users.email, email)).get()
  if (!user || !await verify(user.hashedPassword, password)) {
    return c.render('Auth/Login', {
      errors: { email: 'メールアドレスまたはパスワードが正しくありません' }
    })
  }

  await createSession(c, user.id)
  return c.redirect('/', 303)
})

// ログアウト
app.post('/logout', async (c) => {
  await destroySession(c)
  return c.redirect('/login', 303)
})

// 新規登録
app.get('/register', (c) => c.render('Auth/Register', { errors: {} }))

app.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, name, password } = c.req.valid('json')
  const hashedPassword = await hash(password)

  try {
    const [user] = await db.insert(users).values({ id: nanoid(), email, name, hashedPassword }).returning()
    await createSession(c, user.id)
    return c.redirect('/', 303)
  } catch {
    return c.render('Auth/Register', {
      errors: { email: 'このメールアドレスは既に使用されています' }
    })
  }
})
```

---

## クライアント側の認証状態管理

### ログインページ（client/pages/Auth/Login.tsx）

```tsx
import { useForm } from '@inertiajs/react'
import { Link } from '@inertiajs/react'

interface Props {
  errors: Record<string, string | undefined>
}

export default function Login({ errors }: Props) {
  const form = useForm({ email: '', password: '' })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    form.post('/login')
  }

  return (
    <form onSubmit={submit}>
      <div>
        <label>メールアドレス</label>
        <input
          type="email"
          value={form.data.email}
          onChange={(e) => form.setData('email', e.target.value)}
        />
        {(form.errors.email || errors.email) && (
          <p className="text-red-500">{form.errors.email || errors.email}</p>
        )}
      </div>
      <div>
        <label>パスワード</label>
        <input
          type="password"
          value={form.data.password}
          onChange={(e) => form.setData('password', e.target.value)}
        />
        {form.errors.password && <p className="text-red-500">{form.errors.password}</p>}
      </div>
      <button type="submit" disabled={form.processing}>ログイン</button>
      <Link href="/register">アカウント登録</Link>
    </form>
  )
}
```

### 認証ユーザー情報の参照

```tsx
import { usePage } from '@inertiajs/react'

interface SharedProps {
  auth: { user: { id: string; name: string; email: string } | null }
}

function Navbar() {
  const { auth } = usePage<SharedProps>().props

  return (
    <nav>
      {auth.user ? (
        <>
          <span>{auth.user.name}</span>
          <form method="post" action="/logout">
            <button type="submit">ログアウト</button>
          </form>
        </>
      ) : (
        <a href="/login">ログイン</a>
      )}
    </nav>
  )
}
```

## 認可（ロールベース）

```typescript
// サーバー側: 最終防衛線（必須）
export const requireRole = (role: string) =>
  createMiddleware(async (c, next) => {
    const user = c.get('user')
    if (!user || user.role !== role) {
      return c.render('Errors/Forbidden', { message: '権限がありません' })
    }
    await next()
  })

// 使用例
app.delete('/posts/:id', requireAuth, requireRole('admin'), async (c) => { ... })
```

```tsx
// クライアント側: UX制御（サーバー認可の代替にはならない）
const { auth } = usePage<SharedProps>().props
{auth.user?.role === 'admin' && <button>削除</button>}
```
