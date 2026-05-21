# UI リデザイン仕様書

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**改訂日**: 2026-05-20（Three.js 併用版に方針変更）
**ステータス**: 設計完了・実装承認待ち

---

## 0. 改訂履歴

| 日付 | 改訂内容 |
|------|---------|
| 2026-05-20 (初版) | Three.js 全廃止・2D SVG 統一を前提に策定 |
| 2026-05-20 (本版) | **Three.js 併用 + Mid レベル仕上げ** に方針変更。HTML 2D 世界観に「3D ヒーロー」を局所投入する相乗効果設計に転換 |

---

## 1. 移行コンセプト

### 1.1 ネオブルータリズム × 局所3Dヒーロー の両立

チームメンバーが共有した `SABOROU Standalone (1).html`（以下「共有HTML」）のデザイン言語をベースに、
現行フロントエンドの API 配線・認証・型定義を保持したまま UI を全面刷新する。
**さらに既存の Three.js 実装を「リメイク（Mid 仕上げ）」して、限定された場所にだけ3Dヒーローを配置する**。

**デザイン言語の核心**:
- 太い黒枠: `3px solid #2B1E16`（全カード・入力・ボタンに適用）
- ハードシャドウ: `box-shadow: 0 5px 0 #2B1E16`（奥行き感をフラットに表現）
- 大きな角丸: `border-radius: 18〜22px`（柔らかさとブルータルの対比）
- **2D SVG キャラクター（`SaborouCharacter2D`）**: 一覧・チャット・小バナーなど高頻度・小サイズ箇所
- **3D キャラクター（`SaborouCharacter3D`）**: ログインヒーロー・タスク詳細ヒーローの2箇所限定。verdict 連動で表情・色・雲・呼吸が変化
- フォント3種: Space Grotesk（見出し/コード系）/ Nunito（本文）/ Noto Sans JP（日本語）

**「2D × 3D 併用」の整合性原則（憲法6条）**:
詳細は `2d-3d-coexistence-rules.md` に分離。要約のみ:
1. パレットは完全共有（3D も `SABORU_THEME` のみ使用）
2. 3Dの最小サイズは **横幅 240px** ／それ未満は2D
3. 3Dコンテナ背景は **cream `#FFFAF5`** で HTML 世界に溶け込ませる
4. 3Dの外枠は **HTML 側** が担当（`border-3 #2B1E16` + ハードシャドウ）
5. 2D/3D は同じ顔（`character-design-sheet.md` を真とする）
6. 3D は **verdict 連動の特別な瞬間** にしか出さない

**API 契約の優先ルール**:
- 共有 HTML のデザイン定数（`VERDICT_META`）は UI 表現に限り参照する
- verdict 値・QuickReply 種別・reasoning 型はすべて API 側（`pkgs/backend/openapi.yaml`）を正とする
- API に存在しないデータ構造はフロント側で静的定数として定義する

---

## 2. 7画面の画面構成表

| # | 共有HTML画面名 | 現フロント対応 | 移行方針 | 必要なAPI呼び出し |
|---|--------------|--------------|---------|----------------|
| 1 | `LoginScreen` | `LoginPage.tsx` | **既存改修**: Cognito Hosted UI リダイレクト形式を維持しつつ、ネオブルータリズムスタイルに置換。Google IdP 削除済みのためメール/PW タブのみ。**3D ヒーロー** を上部に配置 | `GET /api/users/me`（ログイン後リダイレクト先で呼び出し） |
| 2 | `TaskListScreen` | `TaskListPage.tsx` | **既存改修**: 承認済みタスク + 候補タスクのリスト表示。BottomNav を追加。PendingCard を新規作成。キャラはすべて 2D SVG | `GET /api/tasks`、`GET /api/tasks/candidates` |
| 3 | `TaskDetailScreen` | `TaskDetailPage.tsx` | **既存改修**: 判定ヒーローは **3D**（verdict 連動で表情・色・雲が変化）、チャット内アイコン等は 2D SVG。PsychSignalsCard・ContextCollectingAnimPro を追加 | `GET /api/tasks/:id`、`GET /api/tasks/:id/proposals/latest`、`POST /api/tasks/:id/proposals`（SSE）、`POST /api/tasks/:id/proposals/:proposalId/chat` |
| 4 | `ManualScreen` | **存在しない** | **新規追加**: 静的コンテンツ（フロントベタ書き）。APIなし。キャラは 2D SVG | なし |
| 5 | `SettingsScreen` | `SettingsPage.tsx` | **既存改修**: Slack 連携 ON/OFF カードに集約。ペルソナ画面への遷移ボタンを追加。キャラは 2D SVG | `GET /api/connections`、`POST /api/connections/slack`、`DELETE /api/connections/slack` |
| 6 | `PersonaScreen` | **存在しない** | **新規追加**: 静的コンテンツ（PERSONAS 定数）。将来的に API 拡張予定。キャラは 2D SVG | なし（MVP では静的） |
| 7 | `RoadmapScreen` | **存在しない** | **新規追加**: 静的コンテンツ（ROADMAP_ITEMS 定数）。APIなし | なし |

### 2.1 既存 Three.js 実装の扱い（方針変更）

| 対象 | 旧方針（初版） | **新方針（本版）** |
|------|--------------|------------------|
| `SaborouCanvas.tsx`（Three.js Canvas コンポーネント） | 廃止 | **リメイク**: Mid 仕上げに書き換え、ログインヒーロー+詳細ヒーロー専用に再配置 |
| `SaborouCharacter.tsx`（Three.js / r3f ベース） | 廃止 | **リメイク**: squircle ボディ + 頭上の雲 + 表情変化 + 呼吸アニメ + 環境マップに刷新 |
| `components/three/` ディレクトリ | 削除 | **維持**: リメイク後のファイル群を格納 |
| Three.js 依存パッケージ（`three`/`@react-three/fiber`/`@react-three/drei`/`@types/three`） | 削除 | **維持**: 既存設定どおり利用 |

理由: 共有 HTML の世界観は2Dで完成度が高いが、ハッカソンのデモ映え・差別化要素として
「verdict 確定の瞬間に動く 3D キャラ」は強力。既存実装（212行）を捨てるのではなく、Mid 仕上げで磨き直す方針に転換した。

---

## 3. 画面ごとの責務と必要な API 呼び出し

### 3.1 LoginPage（改修）

**責務**: Cognito Hosted UI へのリダイレクト起点。メール/PW ログインと新規登録のタブ切り替え UI を提供。

**現状との差分**:
- Google OAuth ボタンの削除（すでに削除済みのはずだが、HTML 参照で整合確認）
- ネオブルータリズムカード（`border: 3px solid #2B1E16`、`boxShadow: 0 6px 0 #2B1E16`）に変更
- **🎬 3D ヒーロー（`SaborouCharacter3D`、size=280, verdict="can_saboru"）** を最上部に配置。最初のインパクトを担う
- 3D は `border-3 #2B1E16 + shadow-hard-lg + bg-cream` の HTML コンテナで囲み、世界観統一

**API**: ログイン後 `/auth/callback` → `GET /api/users/me`（AuthCallbackPage が担当）

---

### 3.2 TaskListPage（改修）

**責務**: タスク一覧（承認済み）と候補タスク（承認待ち）を分けて表示。BottomNav からのナビゲーション起点。

**セクション構成**:
1. 上部ヘッダー（Logo + 新規追加ボタン）
2. 候補タスクセクション（PendingCard の横スクロール or リスト）
3. 承認済みタスクセクション（TaskCard のリスト）
4. BottomNav（タスク / 取説 / 設定）

**API**:
- `GET /api/tasks` — 承認済みタスク一覧
- `GET /api/tasks/candidates` — 候補タスク一覧

---

### 3.3 TaskDetailPage（改修）

**責務**: 単一タスクの詳細表示、サボリ提案の表示、チャット入力、QuickReply 送信。
**ハイライト**: 判定確定の瞬間に **3D ヒーロー** が verdict 連動で表情・色・雲を変化させる。プロダクトの「動く驚き」をここで提供。

**セクション構成**:
1. ヘッダー（← 戻る + タスクタイトル）
2. **🎬 3D 判定ヒーロー（`SaborouCharacter3D`、size=320）** — verdict に連動して以下が同時変化:
   - 色: `can_saboru` → オレンジ / `borderline` → 黄 / `must_do` → 赤
   - 表情: 笑顔 / 困り顔 / 警戒顔
   - 頭上の雲: 多め / 少なめ / なし＋稲妻
   - 呼吸アニメ: ゆったり / 通常 / 速い
   - 提案生成中（SSE ストリーミング中）は呼吸＋まばたきだけのアイドル状態
3. VerdictBox（verdict バッジ + summaryText、3Dヒーロー直下に配置）
4. PsychSignalsCard（心理学シグナル表示、静的プリセット値で表示）
5. reasoning リスト（`string[]` をそのまま箇条書き）
6. チャットエリア（ChatPane、内部のアバターは **2D SVG**）
7. QuickReplyButtons（4固定値）
8. FreeTextInput
9. ContextCollectingAnimPro（提案生成中のアニメーション、3D ヒーローと併存して状態表示）

**3D 配置の根拠**: 詳細画面は「提案受け取りの主役」位置。`2d-3d-coexistence-rules.md` 憲法6条「3Dは verdict 連動の特別な瞬間に出す」に最も合致する。

**API**:
- `GET /api/tasks/:id` — タスク詳細
- `GET /api/tasks/:id/proposals/latest` — 最新提案
- `POST /api/tasks/:id/proposals`（SSE）— 新規提案生成
- `POST /api/tasks/:id/proposals/:proposalId/chat` — チャット送信

---

### 3.4 ManualPage（新規）

**責務**: SABOROU の使い方・サービス説明を静的コンテンツで表示。

**コンテンツソース**: フロントベタ書き（`MANUAL_SECTIONS` 定数）
**構成**: 共有 HTML の `ManualScreen` を参考に以下のセクションを定義
1. サービス概要（SaborouCharacter + キャッチコピー）
2. 使い方ステップ（3ステップ）
3. サボリ判定の仕組み（verdict 3値の説明）
4. よくある質問

---

### 3.5 SettingsPage（改修）

**責務**: Slack 連携の ON/OFF 管理。ペルソナ・ロードマップへの遷移リンク。

**セクション構成**:
1. ヘッダー
2. アカウント情報カード（メールアドレス表示）
3. Slack 連携カード（接続/切断トグル）
4. ペルソナ設定への遷移ボタン（→ PersonaPage）
5. ロードマップへの遷移ボタン（→ RoadmapPage）
6. ログアウトボタン

**API**:
- `GET /api/connections`
- `POST /api/connections/slack`
- `DELETE /api/connections/slack`

---

### 3.6 PersonaPage（新規）

**責務**: AI 口調（ペルソナ）の選択 UI。MVP では静的表示のみ（選択状態はローカル state で管理）。

**コンテンツソース**: フロントベタ書き（`PERSONAS` 定数、共有 HTML より移植）
**ペルソナ定義**: おっとりサボロー（available）/ 鬼コーチ / 心理士 / エンジニア（available=false でグレーアウト）

---

### 3.7 RoadmapPage（新規）

**責務**: 将来機能のロードマップを静的表示。ハッカソン審査員向けビジョン提示。

**コンテンツソース**: フロントベタ書き（`ROADMAP_ITEMS` 定数、共有 HTML より移植）

---

## 4. verdict マッピング表

共有 HTML は `caution` / `danger` を使用しているが、API は `borderline` / `must_do` を返す。
フロント側でマッピングを吸収する。

| API 値 | 共有 HTML 値 | ラベル | 絵文字 | カラー | 背景色 | BodyColor（SVG） |
|--------|------------|--------|--------|--------|--------|----------------|
| `can_saboru` | `can_saboru`（同一） | サボれます | ☁️ | `#10B981` | `#ECFDF5` | `#F97316` |
| `borderline` | `caution` | 要検討 | 🌤️ | `#F59E0B` | `#FFFBEB` | `#F59E0B` |
| `must_do` | `danger` | やるしかない | ⚡ | `#EF4444` | `#FEF2F2` | `#EF4444` |

**実装方針**: `pkgs/shared/src/types/` に定義済みの `Verdict` 型（`can_saboru | borderline | must_do`）を
キーとする `VERDICT_META` 定数をフロントで定義する。共有 HTML の `caution`/`danger` キーは使用しない。

```typescript
// pkgs/frontend/src/lib/verdictMeta.ts として定義
export const VERDICT_META: Record<Verdict, VerdictMeta> = {
  can_saboru: { label: "サボれます", emoji: "☁️", color: "#10B981", bg: "#ECFDF5", bodyColor: "#F97316", ... },
  borderline:  { label: "要検討",    emoji: "🌤️", color: "#F59E0B", bg: "#FFFBEB", bodyColor: "#F59E0B", ... },
  must_do:     { label: "やるしかない", emoji: "⚡", color: "#EF4444", bg: "#FEF2F2", bodyColor: "#EF4444", ... },
};
```

---

## 5. 静的画面のデータソース定義

以下の定数はすべてフロントエンドにベタ書きとし、将来 API に昇格する可能性を考慮して
`pkgs/frontend/src/lib/staticContent.ts` に集約する。

| 定数名 | 用途 | 将来の API 化可能性 |
|--------|------|-----------------|
| `MANUAL_SECTIONS` | 取説コンテンツ | CMS 化（v1.1.0） |
| `PERSONAS` | ペルソナ定義（4種） | `GET /api/personas`（v1.1.0） |
| `ROADMAP_ITEMS` | ロードマップ項目 | なし（マーケティング用） |
| `PSYCH_SIGNAL_PRESETS` | verdict別心理学スコアのプリセット | `GET /api/proposals/:id/signals`（v2.0.0） |

---

## 6. ルーティング設計

| パス | コンポーネント | 備考 |
|------|--------------|------|
| `/login` | `LoginPage` | 未認証時のリダイレクト先 |
| `/auth/callback` | `AuthCallbackPage` | Cognito コールバック（変更なし） |
| `/tasks` | `TaskListPage` | デフォルトルート（認証済み） |
| `/tasks/:id` | `TaskDetailPage` | |
| `/settings` | `SettingsPage` | |
| `/settings/persona` | `PersonaPage` | 新規 |
| `/manual` | `ManualPage` | 新規 |
| `/roadmap` | `RoadmapPage` | 新規 |

BottomNav の遷移先: `タスク → /tasks`、`取説 → /manual`、`設定 → /settings`

---

## 7. 2D / 3D キャラクター配置マトリクス（憲法準拠）

「3D は限定された大ヒーローに、それ以外は 2D」を**全画面で一貫**させる。

| # | 画面 / 位置 | 表現 | サイズ | 役割 | 憲法条文 |
|---|------------|------|-------|------|---------|
| 1 | ログイン: 上部ヒーロー | **🎬 3D** | ~280px | 最初のインパクト | 憲法2,3,4,6 |
| 2 | タスク一覧: 今日バナー | 2D SVG | 56px | 文脈の話相手 | 憲法2 |
| 3 | タスク一覧: 各カード | 2D SVG | 36px | 状態の指標 | 憲法2 |
| 4 | タスク詳細: 判定ヒーロー | **🎬 3D** | ~320px | 提案受け取りの主役 | 憲法2,3,4,6 |
| 5 | タスク詳細: チャットアイコン | 2D SVG | 28px | 発話者識別 | 憲法2 |
| 6 | 取説: 各セクション | 2D SVG | 各種 | 静的説明 | 憲法2 |
| 7 | ペルソナ: カードプレビュー | 2D SVG | 48px | ペルソナごとの顔 | 憲法2 |
| 8 | ロードマップ: 装飾 | 2D SVG | 32px | ビジョンの主役 | 憲法2 |
| 9 | 設定: アカウントカード | 2D SVG | 36px | アイデンティティ | 憲法2 |

**3D 配置は #1 と #4 のみ**。他はすべて 2D SVG。

**3D 配置の最終ルール**:
- 必ず `border-3 border-[#2B1E16] shadow-hard-lg bg-cream rounded-3xl overflow-hidden` の HTML コンテナで囲む
- 240px 未満には 3D を置かない
- 同一画面に 3D を複数置かない
- ストリーミング中・判定確定時にアニメーション挙動が変化する

---

## 8. 既存 Three.js 実装からの差分（リメイク方針）

| 観点 | 現状（`pkgs/frontend/src/components/three/`） | リメイク後 |
|------|-----------------------------|----------|
| ボディ形状 | `SphereGeometry` を2個重ねた雪だるま型 | `RoundedBox` ベースの **squircle**（HTML キャラと同じ比率） |
| マテリアル | デフォルト `MeshStandardMaterial` | `roughness: 0.5, metalness: 0` に統一、サブサーフェススキャタリング風の柔らかさ |
| 色 | `#FF6B2B` 系（旧）| **`#F97316` 系**（HTML パレットに完全一致） |
| ライティング | `AmbientLight 0.6` + `DirectionalLight 1` のみ | 3 点ライト（key + fill + rim）+ `<Environment preset="sunset">` の環境マップ |
| 影 | なし | `<ContactShadows>` で接地感 |
| 雲（頭上） | なし | drei `<Cloud>` または半透明スフィア複数 |
| 表情変化 | 球の位置・色のみ | テクスチャ or shader で目鼻口を描画。`can_saboru`/`borderline`/`must_do` で表情切替 |
| 待機モーション | 軽い `useFrame` 回転 | **呼吸アニメ**（`scale.y = 1 + sin(t)*0.02`）+ まばたき |
| verdict 演出 | 色のみ | 色 + 表情 + 雲の量 + 呼吸速度 が同時変化、`must_do` 時は稲妻エフェクト |
| 配置箇所 | TaskDetailPage 内のみ | **LoginPage ヒーロー** + **TaskDetailPage 判定ヒーロー** の2箇所 |

詳細な技術設定は `design-tokens.md` の「11. 3D シーン設定」、形状・表情の設計図は `character-design-sheet.md` に分離。
