# 段階的移行計画

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**改訂日**: 2026-05-20（Phase 3 を Three.js リメイクに変更、所要時間を再見積もり）
**前提**: 実装は本設計書のユーザー承認後に開始する

---

## 0. 改訂履歴

| 日付 | 改訂内容 |
|------|---------|
| 2026-05-20 (初版) | 全7フェーズ・うち Phase 3 が「Three.js 廃止」 |
| 2026-05-20 (本版) | **Phase 3 を「Three.js リメイク（Mid 仕上げ）」に変更**。所要時間 1〜2h → **6〜8h** に拡張。全体は 15〜23h → **20〜29h** に再見積もり |

---

## 移行方針サマリー

- **ビッグバン移行を避ける**: フェーズを分けて既存テストが通り続ける状態を維持する
- **API 配線を壊さない**: スタイルの置換が主。hooks / apiClient / 認証フローには原則触れない
- **2D 先・3D 後**: Phase 2 で 2D キャラの顔を確定させてから Phase 3 で 3D を作る。`character-design-sheet.md` を真として共有
- **3D リメイクは単独フェーズ**: 他のスタイル変更と混ぜない（差分が追いやすい・パフォーマンス検証が容易）

---

## フェーズ構成（本版）

| フェーズ | 名称 | 内容 | 成果物 | 所要時間目安 |
|--------|------|------|--------|------------|
| Phase 1 | デザイントークン基盤 | Tailwind 設定・CSS 変数・フォント・3D カラー定義 | 設定ファイル変更 | 1〜2h |
| Phase 2 | 2D キャラクター実装（先行） | `SaborouCharacter2D`・`SaborouAvatar` の新規作成。**顔の確定** | 新規コンポーネント2点 | 2〜3h |
| Phase 3 | **Three.js リメイク（Mid 仕上げ）** | `SaborouCharacter3D` / `SaborouScene3D` を Mid 仕上げに刷新。squircle・雲・表情・呼吸・3点ライト・環境マップ・接地影 | リメイク2点 | **6〜8h** |
| Phase 4 | 共通レイアウト改修 | AppShell・PageHeader・BottomNav・Logo | コンポーネント改修 | 2〜3h |
| Phase 5 | 既存ページ改修 | Login（3Dヒーロー埋込）/ TaskList / TaskDetail（3Dヒーロー埋込）/ Settings | ページ4画面改修 | 4〜6h |
| Phase 6 | 新規ページ追加 | Manual / Persona / Roadmap + ルーティング追加 | 新規ページ3画面 | 3〜4h |
| Phase 7 | 仕上げ・E2E 確認 | 視覚確認・クロスブラウザ・テスト更新・3Dパフォーマンス確認 | テスト更新・バグ修正 | 2〜3h |

**合計**: 20〜29h

---

## Phase 1: デザイントークン基盤

### 成果物
- `pkgs/frontend/tailwind.config.ts`: カラー拡張・borderWidth・boxShadow・fontFamily・animation を追加
- `pkgs/frontend/index.html`: Google Fonts の `<link>` 追加
- `pkgs/frontend/src/index.css`: CSS 変数・`@layer components`（.card-brutal 等）追加

### テスト戦略
- Tailwind のパース確認（`pnpm --filter frontend build` でビルドエラーなし）
- ビジュアル変化なし（トークンを定義するだけで使用箇所はまだ変更しない）

### リスク
- Tailwind v4 への移行が予定されている場合は設定形式が異なる可能性あり（現状 v3 想定）

---

## Phase 2: 2D キャラクター実装（先行・顔の確定）

**重要**: このフェーズで決まる「顔・色・比率」が Phase 3 の 3D 実装の基準になる。
`character-design-sheet.md` を真として、必ずこの順序で進める。

### 成果物
- `pkgs/frontend/src/components/character/SaborouCharacter2D.tsx`（新規）
- `pkgs/frontend/src/components/character/SaborouAvatar.tsx`（新規）
- `pkgs/frontend/src/lib/verdictMeta.ts`（新規: `VERDICT_META`、`VERDICT_SVG_CONFIG`）

### テスト戦略
- `__tests__/components.test.tsx` に `SaborouCharacter2D` の描画テストを追加
  - `can_saboru` / `borderline` / `must_do` の3 verdict でレンダリングエラーなし
  - `animated=false` でアニメーションが無効になること（`aria-hidden` などで判定）
- スナップショットテストで SVG 構造を固定

### リスク
- SVG の `viewBox` と `size` prop のスケーリングが崩れる可能性 → 実装時に `width=s height=s` の指定を確認
- Phase 3 で 3D に再現する際の「顔のズレ」を防ぐため、Phase 2 完了時点で **デザインレビュー**を 1 回挟む

---

## Phase 3: Three.js リメイク（Mid 仕上げ）

**目的**: 既存の Three.js 実装（緑の雪だるま、平らな光、影なし）を、**「商業プロダクトっぽい」Mid レベル**まで一気に引き上げる。

### 成果物
- `pkgs/frontend/src/components/three/SaborouCharacter3D.tsx`（旧 `SaborouCharacter.tsx` をリメイク）
- `pkgs/frontend/src/components/three/SaborouScene3D.tsx`（旧 `SaborouCanvas.tsx` をリメイク）
- `pkgs/frontend/src/lib/three/saboruColors.ts`（新規: 3Dマテリアル色マップ）

### 実装サブタスク（チェックリスト）

`design-tokens.md` 11 章 / `character-design-sheet.md` の仕様に厳密準拠:

- [ ] 旧 `SaborouCharacter.tsx` / `SaborouCanvas.tsx` をファイル名変更（git mv）
- [ ] ボディを `RoundedBox`（drei）ベースの **squircle** に書き換え（HTML の body path と同比率）
- [ ] マテリアルを `roughness: 0.5, metalness: 0` に統一
- [ ] 色を `SABORU_3D_COLOR` から verdict 別に取得
- [ ] 3点ライト（key + fill + rim）+ ambient を導入
- [ ] `<Environment preset="sunset" background={false}>` を組み込み
- [ ] `<ContactShadows color="#2B1E16">` で接地影
- [ ] 頭上の雲（drei `<Cloud>` または半透明スフィア3個）を `verdict` 連動で配置
- [ ] 表情をテクスチャ平面 or shader で描画（眠そう/困り/警戒の3パターン）
- [ ] 呼吸アニメ（`useFrame` で `scale.y` を sin 関数で揺らす）
- [ ] `prefers-reduced-motion: reduce` 時は呼吸停止（既存 `useReducedMotion` フックを再利用）
- [ ] `must_do` 時の稲妻オーバーレイ（HTML コンテナ側で実装）
- [ ] カメラを `fov: 35, position: [0, 0.5, 3]` に変更
- [ ] `SaborouScene3D` の Suspense fallback / ErrorBoundary fallback に **`<SaborouCharacter2D>`** を入れる（憲法5）

### テスト戦略
- `pnpm --filter frontend build` でバンドルサイズを確認（Three.js は別チャンクに分離されていることを確認）
- `pnpm --filter frontend test` で既存テストが全 PASS（unit テストは 2D のみカバー、3D は E2E に委ねる）
- TS コンパイルエラーなし（`tsc --noEmit`）
- **目視レビュー**: 240px / 280px / 320px で表示して「ちゃっち脱却」「2D と同じキャラ」が満たされているか確認
- **パフォーマンス**: Chrome DevTools の Performance で 60fps 維持を確認

### 完了基準（Mid 仕上げの定義）

以下全てを満たすこと:
1. ✅ squircle ボディ（球体ではない）
2. ✅ 頭上の雲が verdict 連動で表示
3. ✅ 呼吸アニメーション
4. ✅ 接地影あり
5. ✅ 環境マップで反射が乗っている
6. ✅ 3点ライティング
7. ✅ 表情が verdict 連動で変化
8. ✅ 色が HTML パレット（`#F97316` 系）と一致

### リスク
- **高リスク**: 「ちゃっち」のまま完了してしまう → 完了基準を厳格に運用、必要なら Phase 3 内でデザインレビューを2回挟む
- **中リスク**: drei `<Environment>` の HDR 読み込みが遅い → preset 指定なら CDN 不要だが、念のため初回ロード時間を計測
- **中リスク**: 2D と 3D の顔が違って見える → Phase 2 で確定した SVG 設計図を 3D に厳密適用、目線・口角の角度を一致させる
- **低リスク**: WebGL 非対応環境でクラッシュ → `react-error-boundary` で 2D フォールバック（既存設計を維持）

---

## Phase 4: 共通レイアウト改修

### 成果物
- `pkgs/frontend/src/components/layout/AppShell.tsx`: `max-w-md` コンテナ + `bg-cream` + BottomNav 組み込み
- `pkgs/frontend/src/components/layout/PageHeader.tsx`（新規）
- `pkgs/frontend/src/components/layout/BottomNav.tsx`（新規）
- `pkgs/frontend/src/components/layout/Logo.tsx`（新規）
- `pkgs/frontend/src/components/ui/SectionLabel.tsx`（新規）

### テスト戦略
- `__tests__/components.test.tsx` に BottomNav の遷移テストを追加（NavLink のアクティブ状態）
- アクセシビリティ: BottomNav に `role="navigation"` + `aria-label` を付与

### リスク
- BottomNav の `safe-area-inset-bottom` が iOS 実機でのみ確認できる → CSS 上書きで対処

---

## Phase 5: 既存ページ改修

### 対象ページと主な変更

**LoginPage**:
- Cognito ログインフローは `AuthCallbackPage` 経由のため、UI のみ変更
- **🎬 `<SaborouScene3D verdict="can_saboru" size={280}>` を最上部に配置**（lazy で読み込み、Suspense fallback は `SaborouCharacter2D size={100}`）
- `card-brutal-lg` スタイルの認証カード

**TaskListPage**:
- BottomNav の追加（PageHeader と BottomNav の間にコンテンツ）
- `PendingCard` の追加（候補タスクセクション）
- `TaskCard` のスタイルを `card-brutal` に変更
- **キャラはすべて `SaborouCharacter2D`**（今日バナー56px、各カード36px）

**TaskDetailPage**:
- 既存の `SaborouCanvas` import を `SaborouScene3D` import に変更
- **🎬 `<SaborouScene3D verdict={proposal?.verdict} isStreaming={isStreaming} size={320}>` を判定ヒーローに配置**
- ストリーミング中は `SaborouScene3D` の内部でアイドル動作（呼吸+まばたきのみ）、`verdict` 受信時に色・表情・雲が遷移
- チャット内のアバターは `SaborouAvatar`（2D、28px）
- `ContextCollectingAnim` を 3D ヒーローと併存して表示（phase は SSE 進行で制御）
- `PsychSignalsCard` を VerdictBox の下に追加
- `EvidenceList`（reasoning の `string[]` 表示）をスタイル更新

**SettingsPage**:
- Slack 連携カード（`card-brutal`）
- ペルソナ・ロードマップへの遷移リンク追加

### テスト戦略
- 既存の `__tests__/components.test.tsx` / `hooks.test.tsx` を実行してリグレッションなし確認
- MSW モック（`mocks/handlers.ts`）の verdict 値が `can_saboru` / `borderline` / `must_do` であることを確認（現状 `can_saboru` のみ → `borderline` / `must_do` のケースを追加）

### リスク
- **中リスク**: `TaskDetailPage` の `lazy + Suspense + ErrorBoundary` の境界が `SaborouCanvas` を囲んでいた場合、削除時に Suspense の粒度を再設計する必要あり

---

## Phase 6: 新規ページ追加

### 成果物
- `pkgs/frontend/src/pages/ManualPage.tsx`（新規）
- `pkgs/frontend/src/pages/PersonaPage.tsx`（新規）
- `pkgs/frontend/src/pages/RoadmapPage.tsx`（新規）
- `pkgs/frontend/src/lib/staticContent.ts`（新規: 全静的定数を集約）
- `pkgs/frontend/src/App.tsx`: ルーティングに `/manual` / `/settings/persona` / `/roadmap` を追加

### テスト戦略
- 各静的ページのスモークテスト（レンダリングエラーなし確認）
- BottomNav の「取説」タブクリックで `/manual` に遷移すること

### リスク
- 低リスク（純粋に静的コンポーネントのため）

---

## Phase 7: 仕上げ・E2E 確認

### 成果物
- `__tests__/components.test.tsx`: 新規コンポーネントのテスト追加
- `tests/e2e.spec.ts`: 新画面（Manual / Persona / Roadmap）への遷移確認を追加
- バグ修正・スタイル微調整

### テスト戦略
- 全テスト（unit + e2e）が PASS することを確認
- `pnpm --filter frontend build` + バンドルサイズレポート確認
- `biome check` でリントエラーなし

---

## 既存テストへの影響と更新方針

### `__tests__/components.test.tsx`

| 変更点 | 対応 |
|--------|------|
| `SaborouCanvas` / Three.js 関連テストが存在する場合は削除 | Phase 3 で確認・削除 |
| `TaskCard` のスナップショットが変わる | Phase 5 でスナップショット更新 |
| 新規コンポーネント（`SaborouCharacter`・`BottomNav` 等）のテストを追加 | Phase 2・4 で追加 |

### `__tests__/hooks.test.tsx`

API フックへの影響はなし。`useProposalStream` の verdict 値テストケースに `borderline` / `must_do` を追加することを推奨。

### `__tests__/utils.test.ts`

`verdictMeta.ts` のユーティリティ関数が増えた場合は対応するテストを追加。

### `mocks/handlers.ts` の verdict 値整合性

現状のモックは `verdict: "can_saboru"` のみ。`borderline` / `must_do` の SSE モックを追加する。

```typescript
// handlers.ts に追加予定
// borderline ケースのモック
// must_do ケースのモック
// → Phase 5 のテスト拡充時に対応
```

---

## Three.js 維持時のバンドルサイズ戦略（旧「削除見込み」から方針変更）

| パッケージ | サイズ（minified gzip 概算） | 配置先チャンク |
|----------|----------------------|--------------|
| `three` | ~580KB | 別チャンク（`saborou-scene-3d`） |
| `@react-three/fiber` | ~120KB | 同上 |
| `@react-three/drei` | ~100KB | 同上 |
| `SaborouCharacter2D` SVG | < 5KB | 初期バンドル |
| **3D チャンク合計** | **~800KB** | **lazy() で遅延ロード** |

**初期バンドルへの影響なし**:
- `SaborouScene3D` を `lazy()` で読み込み、初回 LCP（Largest Contentful Paint）に影響させない
- Suspense fallback として `SaborouCharacter2D` を表示するため、ユーザーは待たされ感を感じない
- 3D が必要になる画面（Login / TaskDetail）に到達して初めて Three.js チャンクをダウンロード

**それでも 3D が重い場合の手当て**:
- Login ページの 3D は `requestIdleCallback` または Intersection Observer で読み込みを後回し
- TaskDetail の 3D は提案ストリーミング開始まで `SaborouCharacter2D` を表示し、`verdict` イベント受信タイミングで 3D に切り替える

---

## 移行完了基準

- [ ] 全テスト（unit: 全件 + e2e: 全件）が PASS
- [ ] `pnpm --filter frontend build` が成功
- [ ] `tsc --noEmit` エラーゼロ
- [ ] `biome check` エラーゼロ
- [ ] Three.js パッケージが `package.json` に維持されている（**廃止しない**）
- [ ] `SaborouScene3D` が初期バンドルではなく別チャンクに分離されている
- [ ] 7 画面すべてがネオブルータリズムスタイルに統一されている
- [ ] `SaborouCharacter2D` が一覧・チャット・小バナーで使われている
- [ ] `SaborouScene3D` がログインヒーロー・タスク詳細ヒーローの **2箇所のみ** で使われている
- [ ] 3D Mid 仕上げ完了基準8項目（squircle/雲/呼吸/接地影/環境マップ/3点ライト/表情変化/色一致）をすべて満たす
- [ ] API 配線（認証・タスク取得・SSE・チャット）が正常動作する
- [ ] BottomNav の3タブ遷移が正常動作する
- [ ] `2d-3d-coexistence-rules.md` 憲法6条のアンチパターンに該当する箇所がない
