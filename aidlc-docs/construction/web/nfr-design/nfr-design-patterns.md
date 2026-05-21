# NFR 設計パターン — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / NFR Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## パターン一覧

### NFR-DESIGN-1: メモリ内トークン管理パターン（セキュリティ）

**対応 NFR**: NFR-WEB-S1

```typescript
// AuthProvider 内でクロージャとしてアクセストークンを保持
// React state ではなくモジュールスコープ変数（XSS対策）

// lib/cognito.ts
let _accessToken: string | null = null;

export function setAccessToken(token: string) {
  _accessToken = token;
}
export function getAccessToken(): string | null {
  return _accessToken;
}
export function clearAccessToken() {
  _accessToken = null;
}
```

**適用箇所**: AuthProvider.tsx / lib/apiClient.ts

---

### NFR-DESIGN-2: OAuth CSRF 防止パターン

**対応 NFR**: NFR-WEB-S2

```typescript
// ログイン開始時
const state = crypto.randomUUID();
sessionStorage.setItem('oauth_state', state);
window.location.href = buildCognitoAuthUrl(state);

// コールバック時
const expectedState = sessionStorage.getItem('oauth_state');
const receivedState = new URLSearchParams(window.location.search).get('state');
if (expectedState !== receivedState) {
  throw new Error('OAuth state mismatch');
}
sessionStorage.removeItem('oauth_state');
```

**適用箇所**: lib/cognito.ts, AuthCallbackPage.tsx

---

### NFR-DESIGN-3: 楽観的更新パターン（Optimistic Update）

**対応 NFR**: NFR-WEB-P2, NFR-WEB-R3

```typescript
// useTasks.ts 内
async function approveCandidate(id: string) {
  // 楽観的更新
  const rollback = {
    candidates: [...candidates],
    tasks: [...tasks],
  };
  setCandidates(prev => prev.filter(c => c.taskId !== id));
  setTasks(prev => [...prev, optimisticTask(id)]);

  try {
    const approved = await apiClient.approveCandidate(id);
    // サーバー確定値で置換
    setTasks(prev => prev.map(t => t.taskId === id ? approved : t));
  } catch (error) {
    // ロールバック
    setCandidates(rollback.candidates);
    setTasks(rollback.tasks);
    showToast('タスクの承認に失敗しました。再試行してください', 'error');
  }
}
```

**適用箇所**: hooks/useTasks.ts

---

### NFR-DESIGN-4: ErrorBoundary 障害分離パターン

**対応 NFR**: NFR-WEB-R4

```typescript
// three/SaborouCanvas.tsx に ErrorBoundary でラップ
<ErrorBoundary
  fallback={<span role="img" aria-label="サボロー">☁️</span>}
>
  <Canvas>
    <Suspense fallback={null}>
      <SaborouCharacter verdict={verdict} isStreaming={isStreaming} />
    </Suspense>
  </Canvas>
</ErrorBoundary>
```

**適用箇所**: components/three/SaborouCanvas.tsx

---

### NFR-DESIGN-5: SSE 自動リトライパターン（障害対応）

**対応 NFR**: NFR-WEB-R2

```typescript
// useProposalStream.ts 内
// Vercel AI SDK useChat の onError コールバックで制御
const { messages, append, isLoading } = useChat({
  api: `/api/tasks/${taskId}/proposal`,
  onError: async (error) => {
    // 1回リトライ
    if (retryCount.current < 1) {
      retryCount.current += 1;
      // ... retry logic
    } else {
      // フォールバック: 非ストリーミングで取得
      const proposal = await apiClient.getProposal(taskId);
      setFallbackProposal(proposal);
    }
  },
});
```

**適用箇所**: hooks/useProposalStream.ts

---

### NFR-DESIGN-6: コード分割 + Suspense 遅延ロードパターン（パフォーマンス）

**対応 NFR**: NFR-WEB-P1

```typescript
// App.tsx でページを遅延ロード
const TaskListPage = React.lazy(() => import('./pages/TaskListPage'));
const TaskDetailPage = React.lazy(() => import('./pages/TaskDetailPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));

// Three.js は別 chunk へ（最大のバンドルサイズ削減効果）
const SaborouCanvas = React.lazy(() => import('./components/three/SaborouCanvas'));
```

**vite.config.ts での設定**:
```typescript
// manualChunks で Three.js を分割
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        'cognito-vendor': ['amazon-cognito-identity-js'],
        'ai-vendor': ['ai'],
      }
    }
  }
}
```

**適用箇所**: App.tsx, vite.config.ts

---

### NFR-DESIGN-7: prefers-reduced-motion 適応パターン

**対応 NFR**: NFR-WEB-A2

```typescript
// hooks/useReducedMotion.ts
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reducedMotion;
}

// SaborouCharacter.tsx
const reducedMotion = useReducedMotion();
useFrame(({ clock }) => {
  if (reducedMotion) return;  // アニメーション停止
  // ... アニメーション処理
});
```

**適用箇所**: hooks/useReducedMotion.ts, components/three/SaborouCharacter.tsx

---

### NFR-DESIGN-8: APIクライアント 認証ヘッダー自動付与パターン

**対応 NFR**: NFR-WEB-S1

```typescript
// lib/apiClient.ts
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    // トークンリフレッシュ試行
    const newToken = await refreshAccessToken();
    if (!newToken) {
      clearAccessToken();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    setAccessToken(newToken);
    // リトライ（1回のみ）
    return request<T>(path, options);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await response.json());
  }
  return response.json() as Promise<T>;
}
```

**適用箇所**: lib/apiClient.ts

---

### NFR-DESIGN-9: MSW モックパターン（テスト分離）

**対応 NFR**: NFR-WEB-T4

```typescript
// src/mocks/handlers.ts
export const handlers = [
  http.get('/api/tasks', () => {
    return HttpResponse.json(mockTasks);
  }),
  http.post('/api/tasks/candidates/:id/approve', ({ params }) => {
    return HttpResponse.json(mockApprovedTask(params.id as string));
  }),
  http.get('/api/tasks/:id/proposal', () => {
    // SSE レスポンスをモック
    const stream = new ReadableStream({ ... });
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }),
];

// vitest.setup.ts でサーバー起動
import { server } from './mocks/server';
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**適用箇所**: src/mocks/, vitest.setup.ts

---

### NFR-DESIGN-10: カスタム API エラー型パターン

**対応 NFR**: NFR-WEB-R1

```typescript
// lib/apiClient.ts
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API Error: ${status}`);
  }
  isUnauthorized() { return this.status === 401; }
  isNotFound() { return this.status === 404; }
  isServerError() { return this.status >= 500; }
}

// トースト表示に統一変換
function toUserMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isServerError()) return 'サーバーエラーが発生しました。再試行してください';
    if (error.isNotFound()) return 'データが見つかりませんでした';
    return 'エラーが発生しました';
  }
  if (error instanceof TypeError) return '接続できませんでした。再試行してください';
  return '予期しないエラーが発生しました';
}
```

**適用箇所**: lib/apiClient.ts, hooks/*.ts
