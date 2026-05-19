# フロントエンドコンポーネント詳細設計 — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0
**モックUI参照**: aidlc-inputs/ui/saborou_v2_01〜04-*.png

---

## 1. ディレクトリ構成

```
pkgs/frontend/src/
├── main.tsx
├── App.tsx                    # ルーティング定義
├── index.css                  # Tailwind CSS base + SABOROU カラーパレット
├── components/
│   ├── ui/                    # shadcn/ui コンポーネント（shadcn CLI で生成）
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── toast.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── AppShell.tsx       # FE-05: ヘッダー・認証ガード・トースト
│   │   └── Header.tsx
│   ├── task/
│   │   ├── TaskCard.tsx       # FE-08: pending / approved カード
│   │   ├── TaskEditForm.tsx   # インライン編集フォーム
│   │   └── TaskAddModal.tsx   # 手動追加モーダル
│   ├── chat/
│   │   ├── ChatPane.tsx       # 右ペイン全体
│   │   ├── ChatMessage.tsx    # 吹き出し
│   │   ├── QuickReplyButtons.tsx
│   │   └── FreeTextInput.tsx
│   ├── verdict/
│   │   ├── VerdictBox.tsx     # 判定ボックス（色分け）
│   │   └── EvidenceList.tsx   # 根拠箇条書き
│   └── three/
│       ├── SaborouCanvas.tsx  # Three.js Canvas コンテナ
│       └── SaborouCharacter.tsx # 3Dキャラクター
├── pages/
│   ├── LoginPage.tsx          # FE-03
│   ├── AuthCallbackPage.tsx   # Cognito OAuth コールバック
│   ├── TaskListPage.tsx       # FE-01
│   ├── TaskDetailPage.tsx     # FE-02
│   └── SettingsPage.tsx       # FE-04
├── hooks/
│   ├── useAuth.ts             # FE-06 AuthProvider フック
│   ├── useTasks.ts
│   ├── useProposalStream.ts   # Vercel AI SDK useChat ラッパー
│   ├── useConnections.ts
│   └── useToast.ts
├── providers/
│   ├── AuthProvider.tsx       # FE-06: Cognito JWT 管理
│   └── ToastProvider.tsx
├── lib/
│   ├── apiClient.ts           # FE-07: APIクライアント
│   ├── cognito.ts             # Cognito Hosted UI 連携
│   └── utils.ts               # 日付フォーマット等
└── types/
    └── ui.ts                  # UI固有の型（ChatMessage / ToastMessage 等）
```

---

## 2. コンポーネント別 Props・State・インタラクション定義

### 2.1 App.tsx（ルーティング）

```tsx
// React Router v7 を使用
// ルート定義:
//   /login              → LoginPage（認証ガードなし）
//   /auth/callback      → AuthCallbackPage（認証ガードなし）
//   /tasks              → TaskListPage（認証ガードあり）
//   /tasks/:id          → TaskDetailPage（認証ガードあり）
//   /settings           → SettingsPage（認証ガードあり）
//   /                   → /tasks へリダイレクト
```

---

### 2.2 AuthProvider.tsx（FE-06）

```tsx
interface AuthProviderProps {
  children: React.ReactNode;
}

// 内部状態
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// コンテキスト値
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => void;              // Cognito Hosted UI へリダイレクト
  signOut: () => Promise<void>;    // Cognito サインアウト + 状態クリア
  getAccessToken: () => Promise<string>; // トークン取得（リフレッシュ込み）
  handleCallback: (code: string, state: string) => Promise<void>;
}

// Amazon Cognito SDK: amazon-cognito-identity-js を使用
// JWT保存: メモリ（accessToken）+ localStorage（refreshToken）
```

---

### 2.3 AppShell.tsx（FE-05）

```tsx
interface AppShellProps {
  children: React.ReactNode;
}

// 認証ガード: isAuthenticated が false なら /login へリダイレクト
// ヘッダー: SABOROUロゴ（左）+ ユーザーアイコン（右）
// トースト表示: 画面右下に固定
// ナビゲーション: タスク一覧 / 設定（シンプルナビ）
```

---

### 2.4 LoginPage.tsx（FE-03）

```tsx
// Props: なし
// State: { isLoading: boolean, error: string | null }
// モックUI: saborou_v2_01-login.png に忠実に実装

// デザイン仕様:
// - 背景: bg-[#F5F4F0]（オフホワイト）
// - 中央カード: bg-white rounded-2xl shadow-md
// - SABOROUロゴ: オレンジ角丸正方形（bg-[#FF6B2B]）+ 白字 "SABOROU"
// - Google ログインボタン: border border-gray-300 + Googleアイコン
// - フッターリスト: 小文字テキスト・中央寄せ
```

---

### 2.5 TaskListPage.tsx（FE-01）

```tsx
// Props: なし
// State: TaskListPageState（domain-entities.md 参照）
// カスタムフック: useTasks()

// 描画ロジック:
// - candidates[] → 承認待ちタスクセクション
// - tasks[] → 承認済みタスクセクション（各 task に proposal をマップ）
// - バナー判定: BR-WEB-07

// モックUI: saborou_v2_02-tasklist.png
// - ヘッダー背景: bg-white + SABOROUロゴ
// - バナー: bg-[#FF6B2B] テキスト
// - セクション見出し: "承認待ちタスク" / "承認済みタスク"
// - FAB: 右下固定 bg-[#FF6B2B] rounded-full h-14 w-14 + "+"
```

---

### 2.6 TaskCard.tsx（FE-08）

```tsx
interface TaskCardProps {
  task: Task | TaskCandidate;
  proposal?: Proposal;
  mode: 'pending' | 'approved';
  onApprove?: () => void;
  onEdit?: (updates: UpdateTaskRequest) => void;
  onDelete?: () => void;
  onClick?: () => void;
}

// pending モード:
//   - カード内: タスク名（太字）/ 期限テキスト / 依頼者
//   - ボタン行: 「承認する」（bg-[#FF6B2B] 主CTA）/ 編集アイコン / 削除アイコン
//   - 編集モード: TaskEditForm をインライン展開

// approved モード:
//   - カード内: タスク名 / 期限 / 1行サボり判定サマリ（proposal.one_line_summary）
//   - クリックで TaskDetailPage へ遷移
//   - サマリ下に verdict バッジ（緑/黄/赤）

// モックUI: saborou_v2_02-tasklist.png の各カード要素に準拠
// デザイン: bg-white rounded-xl shadow-sm border border-gray-100
```

---

### 2.7 TaskDetailPage.tsx（FE-02）

```tsx
// Props: なし（URL params から taskId を取得）
// State: TaskDetailPageState（domain-entities.md 参照）
// カスタムフック:
//   useProposalStream(taskId) → SSEストリーミング
//   useToast()

// レイアウト:
// - md以上: grid grid-cols-2 (左:タスク詳細 右:チャット)
// - md未満: タブ切替 (Tabs コンポーネント)

// モックUI: saborou_v2_03-detail.png
// - 左ペインヘッダー: "タスク詳細"
// - 右ペインヘッダー: "おっとりサボロー"（キャラ名）
// - 左ペイン: タスク名（大）/ 前提情報 / VerdictBox / EvidenceList
// - 右ペイン: SaborouCanvas（Three.js）/ ChatMessageList / QuickReplyButtons / FreeTextInput
```

---

### 2.8 VerdictBox.tsx

```tsx
interface VerdictBoxProps {
  verdict: Verdict | null;
  summary: string;           // 1行判定文
  confidence: number;        // 0-100 (%)
  isLoading: boolean;        // SSEストリーミング中
}

// 表示仕様（モック準拠）:
// can_saboru:
//   bg-green-50 border-green-200
//   バッジ: 緑 "サボれます"
//   絵文字: ☁️
// caution:
//   bg-yellow-50 border-yellow-200
//   バッジ: 黄 "注意"
//   絵文字: ⚠️
// danger:
//   bg-red-50 border-red-200
//   バッジ: 赤 "危ない"
//   絵文字: 🔥
// isLoading:
//   スケルトンアニメーション表示
```

---

### 2.9 ChatPane.tsx と useProposalStream

```tsx
// useProposalStream(taskId):
//   Vercel AI SDK の useChat を使用
//   endpoint: `/api/tasks/${taskId}/proposal`
//   → GET ?stream=true パラメータで SSE 接続
//   → messages: ChatMessage[] として管理
//   → isStreaming: boolean
//   → append: (message) => void  ← クイック返信・自由テキスト送信

// ChatMessage.tsx:
//   role: 'saboru' → 左寄せ吹き出し（白背景）
//   role: 'user' → 右寄せ（オレンジ背景）

// QuickReplyButtons.tsx:
//   4ボタン 2x2グリッド
//   ストリーミング中は disabled

// FreeTextInput.tsx:
//   textarea + オレンジ円形送信ボタン
//   空文字は disabled（BR-WEB-12）
//   500文字カウンター
```

---

### 2.10 SaborouCanvas.tsx（Three.js）

```tsx
interface SaborouCanvasProps {
  verdict?: Verdict;
  isStreaming?: boolean;
}

// @react-three/fiber の Canvas でラップ
// 内部: SaborouCharacter（verdict / isStreaming で props 制御）
// サイズ: w-full h-[200px] max-w-[200px] mx-auto
// Suspense フォールバック: オレンジ円形絵文字（"☁️"）

// SaborouCharacter.tsx:
//   <mesh>: 球体ジオメトリ（SphereGeometry）+ オレンジマテリアル
//   useFrame で verdict 別アニメーション:
//     can_saboru → float（y軸 sin 波）
//     caution → pulse（scale sin 波）
//     danger → shake（x軸 randomShake）
//     idle → rotate（y軸 回転）
```

---

### 2.11 SettingsPage.tsx（FE-04）

```tsx
// Props: なし
// State: SettingsPageState（domain-entities.md 参照）
// モックUI: saborou_v2_04-settings.png

// デザイン仕様:
// - 背景: bg-[#F5F4F0]
// - セクション: ユーザー情報 / サービス連携 / AIペルソナ / ログアウト
// - ユーザーカード: オレンジ円アイコン + 名前 + メール
// - サービス連携行: アイコン + サービス名 + 「連携済み」バッジ or 「連携する」ボタン
// - AIペルソナ: bg-orange-50 / おっとりサボローの説明文
// - ログアウト: テキストリンク（border-t 区切り線の下）
```

---

## 3. デザイントークン（Tailwind カスタム設定）

```typescript
// tailwind.config.ts の extend.colors に追加:
{
  saborou: {
    primary: '#FF6B2B',      // オレンジ（メインCTA・ロゴ）
    'primary-light': '#FFF0EA', // 薄オレンジ（ペルソナ背景）
    bg: '#F5F4F0',            // オフホワイト（ページ背景）
    text: '#333333',          // メインテキスト
    'text-sub': '#888888',    // サブテキスト
  },
  verdict: {
    'can-saboru': '#22C55E',  // green-500
    caution: '#EAB308',       // yellow-500
    danger: '#EF4444',        // red-500
  }
}
```

---

## 4. ユーザーインタラクションフロー（画面遷移）

```
/login
  ↓ Google でログイン
/auth/callback（自動処理）
  ↓ 認証成功
/tasks（タスク一覧）
  ↓ タスクカードをクリック
/tasks/:id（タスク詳細・チャット）
  ↓ ← 戻るボタン
/tasks
  ↓ ヘッダーのユーザーアイコン
/settings（連携設定）
```

---

## 5. アクセシビリティ要件

- すべてのインタラクティブ要素に `aria-label` を付与
- キーボードフォーカス可視化（`focus-visible:ring-2`）
- スクリーンリーダー対応（verdict ステータスは `role="status"` + `aria-live="polite"`）
- SSEストリーミング中のテキスト追加は `aria-live="polite"` で読み上げ
- カラーのみに依存しない情報伝達（バッジテキスト + アイコン併用）
