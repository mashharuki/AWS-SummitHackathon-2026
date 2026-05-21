# コンポーネントマッピング仕様書

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**改訂日**: 2026-05-20（Three.js 廃止撤回・併用設計に変更）
**参照元**: `/tmp/saborou_src/10_49e19093.js`（saborou-screens.jsx）、`/tmp/saborou_src/08_16ee81b3.js`（saborou-extras.jsx）

---

## 0. 改訂履歴

| 日付 | 改訂内容 |
|------|---------|
| 2026-05-20 (初版) | Three.js 全廃止、`SaborouCharacter` を 2D SVG に統一する案 |
| 2026-05-20 (本版) | **Three.js 廃止を撤回**。`SaborouCharacter` を `SaborouCharacter2D`（SVG）と `SaborouCharacter3D`（r3f リメイク）に分離する併存設計へ変更 |

---

## 1. コンポーネント対応表

### 1.1 共通コンポーネント

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| `Header` | `components/layout/AppShell.tsx`（部分的） | **新規作成**: 共有 HTML の Header 仕様（戻るボタン / タイトル / サブタイトル / right スロット）に合わせて独立コンポーネント化 | `components/layout/PageHeader.tsx` |
| `BottomNav` | なし | **新規作成**: タスク / 取説 / 設定の3タブ。react-router-dom の `NavLink` を使用 | `components/layout/BottomNav.tsx` |
| `Logo` | なし | **新規作成**: SaborouAvatar + "SABOROU" テキスト | `components/layout/Logo.tsx` |
| `SectionLabel` | なし | **新規作成**: セクション見出しのスタイルコンポーネント | `components/ui/SectionLabel.tsx` |
| `AppShell` | `components/layout/AppShell.tsx` | **既存改修**: BottomNav を組み込み、`max-w-md` コンテナ化 | `components/layout/AppShell.tsx` |

---

### 1.2 キャラクター関連（2D/3D 併存設計）

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| `SaborouCharacter`（SVG版 in `04_a148c0b6.js`） | — | **新規作成（2D）**: 共有 HTML の SVG 実装を TypeScript/React に移植。`verdict: Verdict` を props で受ける | `components/character/SaborouCharacter2D.tsx` |
| `SaborouAvatar`（ミニアバター） | なし | **新規作成（2D）**: チャットバブル用の小型アバター | `components/character/SaborouAvatar.tsx` |
| —（共有 HTML には 3D なし） | `components/three/SaborouCharacter.tsx`（r3f版） | **全面リメイク（Mid 仕上げ）**: squircle ボディ・頭上の雲・表情変化・呼吸アニメ・3点ライト・環境マップ・接地影。配置はログインヒーロー+詳細ヒーローの2箇所のみ | `components/three/SaborouCharacter3D.tsx`（ファイル名変更） |
| —（共有 HTML には 3D なし） | `components/three/SaborouCanvas.tsx` | **全面リメイク**: Canvas 設定・lighting・Environment・ContactShadows をラップする `<SaborouScene3D>` に書き換え。`SaborouCharacter3D` をマウントする責務に集約 | `components/three/SaborouScene3D.tsx`（ファイル名変更） |

**配置の役割分担（憲法6条準拠）**:
- `SaborouCharacter2D`: 一覧アバター（36px）・今日バナー（56px）・チャットアバター（28px）・取説/設定/ペルソナ/ロードマップ（各種小サイズ）
- `SaborouCharacter3D`: ログインヒーロー（280px）・タスク詳細判定ヒーロー（320px） **のみ**

---

### 1.3 タスク関連

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| `TaskCard`（承認済みタスクのリストアイテム） | `components/task/TaskCard.tsx` | **既存改修**: ネオブルータリズムスタイルに変更。verdict バッジ・SaborouCharacter（size=36）を追加 | `components/task/TaskCard.tsx` |
| `PendingCard`（候補タスク） | なし | **新規作成**: `TaskCandidate` 型を受ける | `components/task/PendingCard.tsx` |
| `PremiseRow`（前提条件行） | なし | **新規作成**: タスク詳細の前提情報表示（依頼者・期限・内容）| `components/task/PremiseRow.tsx` |

---

### 1.4 Verdict・提案関連

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| `VerdictBox`相当（verdict 表示カード） | `components/verdict/VerdictBox.tsx` | **既存改修**: `summaryText`・verdict バッジ・SaborouCharacter を含む大型カードに変更 | `components/verdict/VerdictBox.tsx` |
| `ReasonRow`（reasoning の各項目） | `components/verdict/EvidenceList.tsx` | **既存改修**: `string[]` を受けるシンプルなリスト表示に変更（API は `{text, theory, source}` 構造体を返さない） | `components/verdict/EvidenceList.tsx` |
| `PsychSignalsCard`（心理学シグナルカード） | なし | **新規作成**: `PSYCH_SIGNAL_PRESETS[verdict]` を静的プリセットとして表示 | `components/verdict/PsychSignalsCard.tsx` |

---

### 1.5 チャット関連

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| チャットバブル（サボロー発言） | `components/chat/ChatMessage.tsx` | **既存改修**: ネオブルータリズムバブルスタイルに変更 | `components/chat/ChatMessage.tsx` |
| チャットバブル（ユーザー発言） | `components/chat/ChatMessage.tsx` | **既存改修**: 右寄せ・オレンジ背景に変更 | `components/chat/ChatMessage.tsx` |
| QuickReply ボタン群 | `components/chat/QuickReplyButtons.tsx` | **既存改修**: `QUICK_REPLY_OPTIONS` 定数（4固定値）に対応したスタイルに変更 | `components/chat/QuickReplyButtons.tsx` |
| FreeText 入力欄 | `components/chat/FreeTextInput.tsx` | **既存改修**: `input-brutal` スタイルに変更 | `components/chat/FreeTextInput.tsx` |
| `ChatPane`（チャット全体コンテナ） | `components/chat/ChatPane.tsx` | **既存改修**: スクロール制御・SaborouAvatar 付きバブルに対応 | `components/chat/ChatPane.tsx` |

---

### 1.6 提案生成アニメーション

| 共有 HTML コンポーネント | 現フロント対応 | 移行方針 | 新ファイルパス |
|----------------------|--------------|---------|-------------|
| `ContextCollectingAnimPro`（3フェーズアニメーション） | なし（既存は単純スピナー） | **新規作成**: Phase 0（外部API収集）/ Phase 1（Tool Use可視化）/ Phase 2（ペルソナ変換）の3フェーズ表示 | `components/verdict/ContextCollectingAnim.tsx` |

---

### 1.7 静的画面専用コンポーネント

| コンポーネント | 移行方針 | 新ファイルパス |
|-------------|---------|-------------|
| `PersonaCard`（ペルソナ選択カード） | **新規作成** | `components/persona/PersonaCard.tsx` |
| `RoadmapItem`（ロードマップ項目） | **新規作成** | `components/roadmap/RoadmapItem.tsx` |
| `ManualSection`（取説セクション） | **新規作成** | `components/manual/ManualSection.tsx` |

---

## 2. 移行方針サマリー（本版）

| 方針 | コンポーネント数 |
|------|--------------|
| 新規作成 | 15（2D `SaborouCharacter2D` / `SaborouAvatar` 含む） |
| 既存改修 | 8 |
| 全面リメイク | 2（`SaborouCharacter.tsx` → `SaborouCharacter3D.tsx`、`SaborouCanvas.tsx` → `SaborouScene3D.tsx`） |
| 廃止 | 0（前版から方針変更） |

**Three.js パッケージ**: `three` / `@react-three/fiber` / `@react-three/drei` / `@types/three` はすべて維持。

---

## 3. Props インターフェース案

### 3.1 SaborouCharacter2D（新規・SVG）

```typescript
// components/character/SaborouCharacter2D.tsx
import type { Verdict } from "@saboru/shared";

interface SaborouCharacter2DProps {
  verdict?: Verdict;           // デフォルト: "can_saboru"
  size?: number;               // デフォルト: 36（28/36/56/100 推奨）
  animated?: boolean;          // デフォルト: true（ボブアニメーション）
  sleeping?: boolean;          // デフォルト: false（目を閉じた状態）
  className?: string;
}
```

verdict マッピングは内部で処理。`character-design-sheet.md` の SVG パス定義を参照。

```typescript
// 内部マッピング（API 値 → SVG 設定）
const VERDICT_SVG_CONFIG: Record<Verdict, SvgConfig> = {
  can_saboru: { bodyColor: "#F97316", weather: "cloud", eyeShape: "sleepy", zzz: true, ... },
  borderline:  { bodyColor: "#F59E0B", weather: "sun_cloud", eyeShape: "thinking", zzz: false, ... },
  must_do:     { bodyColor: "#EF4444", weather: "lightning", eyeShape: "shocked", zzz: false, ... },
};
```

**用途**: 一覧・チャット・小バナーなど **240px 未満** の全表示箇所（憲法2）。

---

### 3.1b SaborouCharacter3D（リメイク・r3f）

```typescript
// components/three/SaborouCharacter3D.tsx
import type { Verdict } from "@saboru/shared";

interface SaborouCharacter3DProps {
  verdict: Verdict | null;     // null 時はデフォルト "can_saboru" 相当の表情
  isStreaming?: boolean;       // SSE ストリーミング中はアイドル動作（呼吸+まばたきのみ）
}
```

**用途**: `<Canvas>` の中で使う 3D シーン本体。`SaborouScene3D` 経由でマウントする。
**配置**: ログインヒーロー（280px）/ タスク詳細判定ヒーロー（320px）の2箇所のみ（憲法2, 6）。

```typescript
// components/three/SaborouScene3D.tsx（旧 SaborouCanvas をリメイク）
interface SaborouScene3DProps {
  verdict: Verdict | null;
  isStreaming?: boolean;
  size?: number;               // デフォルト 320。240 未満を渡すと console.warn（憲法2）
  className?: string;
}
```

責務:
- `<Canvas>` 設定（fov: 35, position: [0, 0.5, 3]）
- 3点ライト + `<Environment preset="sunset">` + `<ContactShadows>`
- `<SaborouCharacter3D>` を子としてマウント
- ロード失敗時の `ErrorBoundary` フォールバックとして **`<SaborouCharacter2D>`** を表示（憲法5: 同じ顔）
- `Suspense fallback` も **`<SaborouCharacter2D>`** で世界観を切らさない

---

### 3.2 SaborouAvatar（新規）

```typescript
// components/character/SaborouAvatar.tsx
interface SaborouAvatarProps {
  size?: number;  // デフォルト: 36
  className?: string;
}
```

---

### 3.3 TaskCard（改修）

```typescript
// components/task/TaskCard.tsx
import type { Task, Proposal } from "@saboru/shared";

interface TaskCardProps {
  task: Task;
  latestProposal?: Pick<Proposal, "verdict" | "summaryText">;
  onClick: (taskId: string) => void;
}
```

---

### 3.4 PendingCard（新規）

```typescript
// components/task/PendingCard.tsx
import type { TaskCandidate } from "@saboru/shared";

interface PendingCardProps {
  candidate: TaskCandidate;
  onApprove: (candidateId: string) => void;
  onDismiss: (candidateId: string) => void;
}
```

---

### 3.5 VerdictBox（改修）

```typescript
// components/verdict/VerdictBox.tsx
import type { Verdict, Proposal } from "@saboru/shared";

interface VerdictBoxProps {
  proposal: Proposal;
  isStreaming?: boolean;
}
```

---

### 3.6 PsychSignalsCard（新規）

```typescript
// components/verdict/PsychSignalsCard.tsx
import type { Verdict } from "@saboru/shared";

interface PsychSignalsCardProps {
  verdict: Verdict;
  // 将来: signals?: PsychSignals（API拡張後に型を追加）
}
```

内部で `PSYCH_SIGNAL_PRESETS` 静的定数を参照。API が返さないため、verdict 値から静的プリセットを引く。

---

### 3.7 ContextCollectingAnim（新規）

```typescript
// components/verdict/ContextCollectingAnim.tsx
interface ContextCollectingAnimProps {
  phase: 0 | 1 | 2;
}
```

`useProposalStream` フックの SSE イベント進行状況に応じて phase を渡す:
- phase 0: SSE 接続開始〜`verdict` イベント前
- phase 1: `verdict` イベント受信〜`chat` イベント前
- phase 2: `chat` イベント受信〜`done` イベント

---

### 3.8 PageHeader（新規）

```typescript
// components/layout/PageHeader.tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}
```

---

### 3.9 BottomNav（新規）

```typescript
// components/layout/BottomNav.tsx
// react-router-dom の useLocation で現在パスを検知してアクティブ状態を制御
// Props なし（ルーターから自動判定）
```

---

### 3.10 QuickReplyButtons（改修）

```typescript
// components/chat/QuickReplyButtons.tsx
import type { QuickReplyType } from "@saboru/shared";

interface QuickReplyButtonsProps {
  onSelect: (type: QuickReplyType) => void;
  disabled?: boolean;
}

// QUICK_REPLY_LABELS: Record<QuickReplyType, string> をローカル定義
// truly_tired → "本当に疲れてる"
// actually_important → "実は重要かも"
// agree_with_ai → "AIに同意"
// disagree_with_ai → "AIに反対"
```

---

## 4. Three.js リメイクリスト（旧「廃止リスト」から方針変更）

### 4.1 リメイク対象ファイル

| ファイルパス | リメイク内容 |
|-----------|------------|
| `pkgs/frontend/src/components/three/SaborouCharacter.tsx` → `SaborouCharacter3D.tsx` | r3f 命令型 Three.js から **drei `<RoundedBox>` ベースの宣言型**に書き換え。squircle ボディ・頭上の雲・表情テクスチャ・呼吸アニメ・verdict 連動を実装 |
| `pkgs/frontend/src/components/three/SaborouCanvas.tsx` → `SaborouScene3D.tsx` | Canvas 設定見直し（fov 35, position [0,0.5,3]）+ 3点ライト + `<Environment preset="sunset">` + `<ContactShadows>` をラップ。Suspense/ErrorBoundary フォールバックを `SaborouCharacter2D` に変更 |

### 4.2 維持する npm パッケージ（`pkgs/frontend/package.json`）

| パッケージ | バージョン | 用途 |
|----------|---------|------|
| `three` | `^0.177.0` | 3Dエンジン本体 |
| `@react-three/fiber` | `^9.6.1` | React 統合 |
| `@react-three/drei` | `^10.7.7` | RoundedBox / Environment / ContactShadows / Cloud などの高機能コンポーネント |
| `@types/three` | `^0.177.0` | 型定義 |
| `react-error-boundary` | （既存）| 3D 描画失敗時のフォールバック |

### 4.3 バンドルサイズ方針

**初期バンドルへの影響を防ぐ**:
- `SaborouScene3D` は **`lazy()` で遅延ロード**（既存 `TaskDetailPage` の構造を維持）
- ログインページの 3D ヒーローも `lazy()` で読み込み、初回 LCP に影響させない
- Three.js + r3f + drei の約 800KB は **別チャンク**として分離（Vite default の code splitting で実現）

### 4.4 リメイクの影響を受けるファイル

| ファイルパス | 影響内容 | 対応方針 |
|-----------|---------|---------|
| `pkgs/frontend/src/pages/TaskDetailPage.tsx` | `SaborouCanvas` の import パスを `SaborouScene3D` に変更 | `lazy(import('@/components/three/SaborouScene3D'))` |
| `pkgs/frontend/src/pages/LoginPage.tsx` | 新規 3D ヒーロー埋め込み | `lazy()` で SaborouScene3D を読み込み、Suspense fallback に SaborouCharacter2D |
| `pkgs/frontend/src/__tests__/components.test.tsx` | `SaborouScene3D` のテストは E2E に委ねる（jsdom 環境では WebGL が動かない） | unit テストは `SaborouCharacter2D` のみカバー |
| `pkgs/frontend/src/types/r3f.d.ts` | 既存維持 | 変更なし |
| `pkgs/frontend/vite.config.ts` | チャンク分割が既存どおりなら変更不要 | 確認のみ |

### 4.5 リメイク時のリスクと対策

| リスク | 深刻度 | 対応策 |
|--------|-------|-------|
| 3D の見た目が「ちゃっち」のままになる | 高 | `design-tokens.md` 11 章 / `character-design-sheet.md` の仕様を厳格に遵守。Mid 仕上げ完了基準（呼吸・雲・3点ライト・接地影・環境マップが揃う）をフェーズ完了条件にする |
| 3D ロード時間が長く、初回表示が遅い | 中 | `lazy()` + `Suspense` で初期バンドル除外。fallback に 2D を表示し、ユーザーに「待たされている感」を与えない |
| 2D と 3D の顔が違って見え、別キャラに見える | 高 | `character-design-sheet.md` を真として、2D の SVG パスと 3D のジオメトリ比率を一致させる。実装順序は **2D 先・3D 後** |
| jsdom 環境（Vitest）で WebGL が動かずテストが落ちる | 中 | 3D 関連は E2E（Playwright）でカバー。Vitest では `SaborouCharacter2D` のみテスト |
| WebGL 非対応ブラウザでクラッシュ | 低 | `react-error-boundary` で 3D 失敗時 `SaborouCharacter2D` にフォールバック（既存設計を維持） |
