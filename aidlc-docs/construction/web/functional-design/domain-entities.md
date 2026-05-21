# ドメインエンティティ — U-05: web

**Unit**: U-05: web
**ステージ**: CONSTRUCTION / Functional Design
**作成日**: 2026-05-17
**バージョン**: 1.0.0

---

## 1. 概要

U-05 web は React 19.2.6 / TypeScript / Vite / shadcn/ui / Tailwind CSS で実装するフロントエンドアプリケーションである。
ドメインエンティティはすべて `@saboru/shared`（pkgs/shared）の型定義を import して型安全に利用する。
本ドキュメントでは Web レイヤー固有の UI 状態・Props・フォームモデルを定義する。

---

## 2. 画面別エンティティ

### 2.1 LoginPage（FE-03）

**モックUI参照**: `aidlc-inputs/ui/saborou_v2_01-login.png`

**画面デザイン仕様**:
- 背景: オフホワイト（#F5F4F0系）
- 中央に SABOROU ロゴ（オレンジ正方形アイコン + "SABOROU" テキスト）
- サブテキスト: "AIがあなたのサボりを守ります"
- ログインカード: 白背景・丸角・シャドウあり
  - タイトル: "ログインして始める"
  - サブタイトル: "Googleアカウントで安全にサインイン"
  - Google ログインボタン: 白背景・ボーダー・Google "G" アイコン付き
- フッター機能リスト: "タスクを自動で把握" / "AIが機能を使って判断" / "安心してサボれる"

```typescript
// UI固有の状態
interface LoginPageState {
  isLoading: boolean;    // OAuth リダイレクト中
  error: string | null;  // OAuth エラーメッセージ
}
```

---

### 2.2 TaskListPage（FE-01）

**モックUI参照**: `aidlc-inputs/ui/saborou_v2_02-tasklist.png`

**画面デザイン仕様**:
- ヘッダー: SABOROUロゴ（左上）・今日の日付バナー（"今日はサボれます！AIが安全を確認だよれます"）
- セクション構成:
  - 「承認待ちタスク」（pending セクション）: タスクカードをリスト表示
  - 「承認済みタスク」（approved セクション）: タスクカードをリスト表示
  - 各タスクカードに「承認する」オレンジボタン
- フローティング「+」ボタン（右下・オレンジ）: 手動タスク追加
- バナー: オレンジ背景・白テキスト（今日のサボり判定サマリ）

```typescript
// UI状態
interface TaskListPageState {
  tasks: Task[];
  candidates: TaskCandidate[];
  proposals: Record<string, Proposal>; // taskId -> Proposal
  isLoading: boolean;
  editingTaskId: string | null;        // インライン編集中のタスクID
  isAddModalOpen: boolean;             // 手動追加モーダル
  toast: ToastMessage | null;
}

// タスクカード用Props
interface TaskCardProps {
  task: Task | TaskCandidate;
  proposal?: Proposal;
  mode: 'pending' | 'approved';
  onApprove?: () => void;
  onEdit?: (updates: UpdateTaskRequest) => void;
  onDelete?: () => void;
  onClick?: () => void;
}

// インライン編集フォームモデル
interface TaskEditForm {
  title: string;
  deadline: string;   // ISO 8601 文字列
  description: string;
}

// 手動追加フォームモデル
interface TaskAddForm {
  title: string;       // 必須
  deadline?: string;   // 任意
}

// トースト通知
interface ToastMessage {
  message: string;
  type: 'success' | 'error' | 'info';
}
```

---

### 2.3 TaskDetailPage（FE-02）

**モックUI参照**: `aidlc-inputs/ui/saborou_v2_03-detail.png`

**画面デザイン仕様**（デスクトップ 2ペイン / モバイルタブ切替）:
- 左ペイン「タスク詳細」:
  - タスク名（大きめフォント）
  - 前提情報: "依頼: [依頼者名]" / "期限: [日付]"
  - 「さぼろうの根拠」ボックス（淡黄色背景 / 緑背景 for can_saboru、黄色 for caution、赤 for danger）:
    - 判定文 1行 + 根拠箇条書き
    - 「サボれます」緑バッジ / 「注意」黄バッジ / 「危険」赤バッジ
    - 信頼度 %表示
    - 「今日は安全にサボれます。根拠をばっちりたどれます！」のような口調テキスト
- 右ペイン「おっとりサボロー」チャット:
  - チャット履歴（サボローの吹き出し）
  - クイック返信ボタン2行（2x2グリッド）
  - 自由入力欄 + オレンジ送信ボタン（円形）
  - SSEストリーミング: サボローの返答テキストをリアルタイム表示

```typescript
// UI状態
interface TaskDetailPageState {
  task: Task | null;
  proposal: Proposal | null;
  chatMessages: ChatMessage[];
  isProposalLoading: boolean;     // SSEストリーミング中
  isHonneSending: boolean;        // 本音送信中
  freeText: string;               // 自由入力テキスト
  toast: ToastMessage | null;
}

// チャットメッセージ（ローカル状態）
interface ChatMessage {
  id: string;
  role: 'saboru' | 'user';
  content: string;
  isStreaming?: boolean;           // ストリーミング中フラグ
  quickReplyType?: QuickReplyType;
  timestamp: string;
}

// サボり判定UI状態マッピング
interface VerdictDisplay {
  verdict: Verdict;
  label: string;           // "サボれます" / "注意" / "危ない"
  badgeColor: string;      // Tailwind クラス
  bgColor: string;         // 判定ボックス背景色クラス
  emoji: string;
}

// クイック返信ボタン定義
interface QuickReplyButton {
  type: QuickReplyType;
  label: string;           // 表示テキスト
}
```

**クイック返信ボタン定義**:
```typescript
const QUICK_REPLY_BUTTONS: QuickReplyButton[] = [
  { type: 'keep_sleeping', label: 'たしかに、まだ寝かせる' },
  { type: 'do_it_early',   label: 'いや、このタスクは早めにやった方がいい' },
  { type: 'do_15min',      label: '15分だけやる' },
  { type: 'full_ignore',   label: '完全に放置したい' },
];
```

---

### 2.4 SettingsPage（FE-04）

**モックUI参照**: `aidlc-inputs/ui/saborou_v2_04-settings.png`

**画面デザイン仕様**:
- タイトル: "設定"
- ユーザー情報カード: アイコン（オレンジ円）+ 名前 + メールアドレス
- 「サービス連携」セクション:
  - Slack 行: Slackアイコン + "連携済み"緑バッジ / "連携する"ボタン
  - Gmail 行: Gmailアイコン + "連携済み"緑バッジ / "連携する"ボタン（v1.1.0）
  - Google Calendar 行: アイコン + "連携する"ボタン（v1.1.0）
- 「AIペルソナ」セクション（淡オレンジ背景）:
  - ペルソナアイコン（オレンジ円）+ "おっとりサボロー" + 説明文
- 「ログアウト」ボタン（テキストボタン・下部）

```typescript
// UI状態
interface SettingsPageState {
  user: User | null;
  connections: ServiceConnection[];
  isConnecting: Record<ServiceType, boolean>;  // 連携処理中フラグ
  toast: ToastMessage | null;
}

// 連携サービス表示定義
interface ServiceDisplay {
  type: ServiceType;
  label: string;         // "Slack" / "Gmail"（v1.1.0）
  iconSrc: string;       // アイコン画像パス
  available: boolean;    // v1.0.0では Slack のみ true
}
```

---

## 3. 共通 UI コンポーネントエンティティ

### 3.1 AppShell（FE-05）

```typescript
interface AppShellProps {
  children: React.ReactNode;
}

// 認証コンテキスト（FE-06 AuthProvider が提供）
interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string>;
}
```

### 3.2 APIClient（FE-07）エンティティ

```typescript
// APIクライアントが扱う14エンドポイント対応メソッド
interface ISaborouApiClient {
  // 認証
  exchangeToken(code: string, redirectUri: string): Promise<ExchangeTokenResponse>;

  // タスク候補
  getCandidates(): Promise<TaskCandidate[]>;
  approveCandidate(id: string): Promise<Task>;
  deleteCandidate(id: string): Promise<void>;

  // タスク
  getTasks(status?: TaskStatus): Promise<Task[]>;
  getTask(id: string): Promise<Task>;
  createTask(data: CreateTaskRequest): Promise<Task>;
  updateTask(id: string, data: UpdateTaskRequest): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // サボり提案
  getProposal(taskId: string): Promise<Proposal>;
  streamProposal(taskId: string): EventSource; // SSEストリーミング

  // 本音データ
  recordHonne(taskId: string, data: RecordHonneRequest): Promise<RecordHonneResponse>;

  // 連携設定
  getConnections(): Promise<ServiceConnection[]>;
  connectSlack(code: string): Promise<ServiceConnection>;
  deleteConnection(service: ServiceType): Promise<void>;
}
```

---

## 4. Three.js エフェクトエンティティ（M2 MVPスコープ）

```typescript
// Three.js / @react-three/fiber 演出コンポーネント
interface SaborouCharacterProps {
  verdict?: Verdict;             // 判定状態によってアニメーション変化
  isStreaming?: boolean;         // ストリーミング中はアニメーション活性化
  size?: 'sm' | 'md' | 'lg';
}

// 演出パターン（verdict別）
interface EffectConfig {
  can_saboru: 'floating';       // ふわふわ浮遊アニメーション
  caution: 'pulse';             // 注意パルスアニメーション
  danger: 'shake';              // 警告シェイクアニメーション
  idle: 'rotate';               // ローディング中回転
}
```
