# デザイントークン仕様書

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**改訂日**: 2026-05-20（3D シーン設定セクションを追加）
**参照元**: 共有 HTML `SABORU_THEME` 定数（`/tmp/saborou_src/10_49e19093.js`）

---

## 0. 改訂履歴

| 日付 | 改訂内容 |
|------|---------|
| 2026-05-20 (初版) | 2D 専用のトークン定義 |
| 2026-05-20 (本版) | **「11. 3Dシーン設定」セクションを追加**。Three.js 併用方針に伴い、マテリアル・ライティング・環境マップ・verdict 連動色を 2D と完全一致させる設定を追記 |

---

## 1. 色トークン

### 1.1 ベースカラー

| トークン名 | 値 | 用途 |
|-----------|-----|------|
| `orange` | `#F97316` | プライマリブランドカラー、CTA ボタン、アクティブ状態 |
| `orange-dark` | `#EA580C` | ホバー、押下状態 |
| `orange-light` | `#FED7AA` | バッジ背景、ハイライト |
| `cream` | `#FFFAF5` | ページ背景 |
| `paper` | `#FFFFFF` | カード背景、ヘッダー背景 |
| `ink` | `#1F2937` | 主要テキスト |
| `ink-soft` | `#6B7280` | サブテキスト、プレースホルダー |
| `ink-muted` | `#9CA3AF` | 補助テキスト、無効状態 |
| `line` | `#F3F4F6` | 区切り線、ボーダー（軽量） |
| `line-soft` | `#FAFAF9` | ゼブラ背景 |
| `border-heavy` | `#2B1E16` | ネオブルータリズム枠線・ハードシャドウ |

### 1.2 Verdict カラー

| トークン名 | 値 | 対応 verdict |
|-----------|-----|------------|
| `can-color` | `#10B981` | `can_saboru`（緑） |
| `can-bg` | `#ECFDF5` | `can_saboru` 背景 |
| `borderline-color` | `#F59E0B` | `borderline`（黄） |
| `borderline-bg` | `#FFFBEB` | `borderline` 背景 |
| `must-color` | `#EF4444` | `must_do`（赤） |
| `must-bg` | `#FEF2F2` | `must_do` 背景 |

---

## 2. Tailwind CSS 設定への落とし込み

`tailwind.config.ts` に以下を追加する。

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ブランドカラー
        orange: {
          DEFAULT: "#F97316",
          dark: "#EA580C",
          light: "#FED7AA",
        },
        cream: "#FFFAF5",
        paper: "#FFFFFF",
        ink: {
          DEFAULT: "#1F2937",
          soft: "#6B7280",
          muted: "#9CA3AF",
        },
        line: {
          DEFAULT: "#F3F4F6",
          soft: "#FAFAF9",
        },
        border: {
          heavy: "#2B1E16",
        },
        // verdict カラー
        verdict: {
          can: "#10B981",
          "can-bg": "#ECFDF5",
          borderline: "#F59E0B",
          "borderline-bg": "#FFFBEB",
          must: "#EF4444",
          "must-bg": "#FEF2F2",
        },
      },
      borderWidth: {
        3: "3px",
      },
      borderRadius: {
        "2xl": "18px",
        "3xl": "22px",
      },
      boxShadow: {
        // ネオブルータリズム ハードシャドウ
        "hard-sm": "0 4px 0 #2B1E16",
        "hard-md": "0 5px 0 #2B1E16",
        "hard-lg": "0 6px 0 #2B1E16, 0 14px 28px rgba(43,30,22,0.13)",
        "hard-orange": "0 4px 0 #EA580C",
      },
      fontFamily: {
        sans: ["Nunito", "Noto Sans JP", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
        "extra-tight": "-0.04em",
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 3. CSS 変数への落とし込み

`index.css` の `:root` セクションに追加する（Tailwind との二重定義だが、
CSS カスタムプロパティとして参照したいインラインスタイル対応のため残す）。

```css
/* index.css */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap');

:root {
  --color-orange: #F97316;
  --color-orange-dark: #EA580C;
  --color-orange-light: #FED7AA;
  --color-cream: #FFFAF5;
  --color-paper: #FFFFFF;
  --color-ink: #1F2937;
  --color-ink-soft: #6B7280;
  --color-ink-muted: #9CA3AF;
  --color-line: #F3F4F6;
  --color-border-heavy: #2B1E16;

  /* verdict */
  --color-can: #10B981;
  --color-can-bg: #ECFDF5;
  --color-borderline: #F59E0B;
  --color-borderline-bg: #FFFBEB;
  --color-must: #EF4444;
  --color-must-bg: #FEF2F2;
}
```

---

## 4. 影（ハードシャドウ）の使用指針

ネオブルータリズムの核心は「物理的な奥行き」の表現。

| クラス | 値 | 使用箇所 |
|--------|-----|---------|
| `shadow-hard-sm` | `0 4px 0 #2B1E16` | タスクカード、QuickReply ボタン |
| `shadow-hard-md` | `0 5px 0 #2B1E16` | 入力フィールド、セレクタ |
| `shadow-hard-lg` | `0 6px 0 #2B1E16, 0 14px 28px rgba(43,30,22,0.13)` | モーダル、認証カード |
| `shadow-hard-orange` | `0 4px 0 #EA580C` | プライマリボタン（ホバー時） |

**ルール**: ボタン押下時は `translateY(4px)` + `shadow: none` でクリック感を演出する。

---

## 5. 枠線のユーティリティ化

Tailwind の `border-3 border-[#2B1E16]` を組み合わせて使う。
頻出パターンとして `@layer components` に登録する。

```css
/* index.css に追加 */
@layer components {
  .card-brutal {
    @apply bg-paper border-3 border-[#2B1E16] rounded-2xl shadow-hard-md;
  }

  .card-brutal-lg {
    @apply bg-paper border-3 border-[#2B1E16] rounded-3xl shadow-hard-lg;
  }

  .btn-brutal-primary {
    @apply bg-orange border-3 border-[#2B1E16] rounded-xl shadow-hard-sm
           font-display font-700 text-paper
           active:translate-y-1 active:shadow-none transition-transform;
  }

  .btn-brutal-secondary {
    @apply bg-paper border-3 border-[#2B1E16] rounded-xl shadow-hard-sm
           font-display font-700 text-ink
           active:translate-y-1 active:shadow-none transition-transform;
  }

  .input-brutal {
    @apply bg-paper border-3 border-[#2B1E16] rounded-xl shadow-hard-sm
           px-4 py-3 text-ink placeholder:text-ink-muted
           focus:outline-none focus:border-orange;
  }
}
```

---

## 6. 角丸スケールの用途定義

| Tailwind クラス | 値 | 使用箇所 |
|---------------|-----|---------|
| `rounded-lg` | `8px` | タグ、バッジ、小型ボタン |
| `rounded-xl` | `12px` | 入力フィールド、小カード内要素 |
| `rounded-2xl` | `18px` | タスクカード、コンポーネントカード |
| `rounded-3xl` | `22px` | ページ主要カード（認証カード、詳細パネル） |
| `rounded-full` | `9999px` | アバター、ピル型バッジ |

---

## 7. フォント読み込み戦略

### 7.1 Google Fonts（プロダクション）

```html
<!-- index.html の <head> に追加 -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Noto+Sans+JP:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

**注意**: 審査・デモ環境でオフラインの可能性を考慮し、`font-display: swap` を確認する。
Google Fonts は `display=swap` パラメータで自動適用される。

### 7.2 フォール バックスタック

```css
font-family: "Space Grotesk", system-ui, sans-serif;  /* 見出し・コード風 */
font-family: "Nunito", "Noto Sans JP", system-ui, sans-serif;  /* 本文 */
```

### 7.3 フォント用途定義

| フォント | Tailwind クラス | 用途 |
|--------|---------------|------|
| Space Grotesk | `font-display` | ブランドロゴ、見出し（SABOROU / verdict ラベル）、数値表示 |
| Nunito + Noto Sans JP | `font-sans`（デフォルト） | 本文、チャット、説明文 |

---

## 8. タイポグラフィスケール

| 役割 | サイズ | ウェイト | クラス例 |
|------|-------|---------|---------|
| ブランドロゴ | 28px | 800 | `font-display text-[28px] font-extrabold tracking-extra-tight` |
| ページタイトル | 22px | 700 | `font-display text-[22px] font-bold tracking-tight` |
| セクション見出し | 16px | 700 | `font-display text-base font-bold` |
| タスクタイトル | 15px | 700 | `font-bold text-[15px]` |
| 本文 | 13px | 400 | `text-[13px]` |
| サブテキスト | 11px | 400〜500 | `text-[11px] text-ink-soft` |
| 補助テキスト | 9〜10px | 500 | `text-[10px] text-ink-muted` |
| verdict スコア | 28px | 800 | `font-display text-[28px] font-extrabold` |

---

## 9. アニメーション定数

共有 HTML の keyframe アニメーションを Tailwind `theme.extend.animation` に定義する。

```typescript
// tailwind.config.ts に追加
animation: {
  "saboru-bob": "saboruBob 4s ease-in-out infinite",
  "saboru-zzz": "saboruZzz 2.5s infinite",
  "saboru-lightning": "saboruLightning 1.5s infinite",
  "fade-slide": "fadeSlide 0.3s ease",
},
keyframes: {
  saboruBob: {
    "0%, 100%": { transform: "translateY(0) rotate(-2deg)" },
    "50%": { transform: "translateY(-4px) rotate(2deg)" },
  },
  saboruZzz: {
    "0%": { opacity: "0", transform: "translate(0, 0) scale(0.5)" },
    "50%": { opacity: "1" },
    "100%": { opacity: "0", transform: "translate(8px, -16px) scale(1)" },
  },
  saboruLightning: {
    "0%, 90%, 100%": { opacity: "1" },
    "92%, 96%": { opacity: "0.4" },
  },
  fadeSlide: {
    "0%": { opacity: "0", transform: "translateY(4px)" },
    "100%": { opacity: "1", transform: "translateY(0)" },
  },
},
```

---

## 10. レイアウト戦略（デバイスフレームなし）

共有 HTML は iPhone 枠内固定（`375px`）だが、本実装はレスポンシブ対応とする。

```css
/* AppShell のコンテナ戦略 */
.app-container {
  @apply w-full max-w-md mx-auto min-h-screen flex flex-col bg-cream;
}
```

- モバイル（`< 448px`）: フル幅
- タブレット・デスクトップ（`>= 448px`）: `max-w-md`（448px）でセンタリング
- `safe-area-inset-bottom` を BottomNav の padding-bottom に適用（iOS 対応）

---

## 11. 3D シーン設定（Three.js 併用）

**目的**: `SaborouCharacter3D` を「ちゃっち」に見せず、HTML 2D 世界観と整合する **Mid レベル仕上げ** で実装するための定数・パラメータを定義する。
**前提**: `2d-3d-coexistence-rules.md` の憲法6条を遵守すること。

### 11.1 採用ライブラリ

| パッケージ | バージョン | 用途 |
|----------|---------|------|
| `three` | `^0.177.0` | 既存維持 |
| `@react-three/fiber` | `^9.6.1` | 既存維持 |
| `@react-three/drei` | `^10.7.7` | **積極活用**: `<Environment>` / `<Cloud>` / `<ContactShadows>` / `<RoundedBox>` |
| `@types/three` | `^0.177.0` | 既存維持 |

### 11.2 3D verdict カラー（2D パレット完全共有）

3Dマテリアルの色は **CSS 変数 と完全一致** させる。新色は定義しない。

```typescript
// pkgs/frontend/src/lib/three/saboruColors.ts（新規予定）
import * as THREE from "three";
import type { Verdict } from "@saboru/shared";

export const SABORU_3D_COLOR: Record<Verdict, THREE.Color> = {
  can_saboru: new THREE.Color("#F97316"), // = --color-orange
  borderline:  new THREE.Color("#F59E0B"), // = --color-borderline
  must_do:     new THREE.Color("#EF4444"), // = --color-must
};

export const SABORU_3D_CLOUD_COLOR = new THREE.Color("#FED7AA"); // = --color-orange-light
export const SABORU_3D_BG_CLEAR = "#FFFAF5"; // = --color-cream（コンテナ背景と一致）
```

### 11.3 マテリアル設定

```typescript
// 共通マテリアル（柔らかさを出す）
{
  roughness: 0.5,     // やや拡散
  metalness: 0.0,     // メタル感ゼロ
  flatShading: false, // 滑らか
}
```

**禁止**:
- `metalness > 0.1`（プラスチック感が出てしまう）
- `roughness < 0.3`（テカリが強すぎてキャラっぽさが消える）
- `MeshBasicMaterial` の使用（ライティングが効かずちゃっちく見える）

### 11.4 ライティング（3点ライト）

```typescript
// pkgs/frontend/src/components/three/SaborouScene.tsx に展開予定
<>
  {/* key light: 主光源 */}
  <directionalLight position={[3, 4, 5]} intensity={1.2} color="#FFF7ED" castShadow />

  {/* fill light: 反対側からの柔らかい光 */}
  <directionalLight position={[-3, 2, 3]} intensity={0.4} color="#FFEDD5" />

  {/* rim light: 輪郭を浮かせる背面光 */}
  <directionalLight position={[0, 2, -4]} intensity={0.6} color="#F97316" />

  {/* ambient: 全体の底上げ */}
  <ambientLight intensity={0.3} color="#FFFAF5" />
</>
```

**色温度の意図**: 全ライトを **暖色寄り**（cream/orange 系）に統一し、HTML の温かい世界観に合わせる。

### 11.5 環境マップ

```tsx
import { Environment } from "@react-three/drei";

<Environment preset="sunset" background={false} />
```

- `preset="sunset"` を採用: 暖色系・反射が柔らかく、SABOROU の世界観と相性が良い
- `background={false}`: 環境マップは反射のみに使用、シーン背景は HTML コンテナの cream 色を見せる（憲法3）

### 11.6 接地影

```tsx
import { ContactShadows } from "@react-three/drei";

<ContactShadows
  position={[0, -0.5, 0]}
  opacity={0.4}
  scale={3}
  blur={2.5}
  far={1.5}
  color="#2B1E16"
/>
```

**影の色**: `#2B1E16`（HTML のハードシャドウ色と同じ）。**世界観統一の決め手**。

### 11.7 呼吸アニメーション

```typescript
useFrame((state) => {
  if (!groupRef.current) return;
  const t = state.clock.elapsedTime;

  // 呼吸（縦方向の伸縮）
  const breathSpeed = verdict === "must_do" ? 2.5 : verdict === "borderline" ? 1.5 : 1.0;
  groupRef.current.scale.y = 1 + Math.sin(t * breathSpeed) * 0.02;

  // 微小揺れ
  groupRef.current.rotation.z = Math.sin(t * 0.7) * 0.02;
});
```

`prefers-reduced-motion: reduce` の場合は呼吸停止（既存 `useReducedMotion` フックを再利用）。

### 11.8 verdict 連動の総合表現

| verdict | 色 | 雲の数 | 呼吸速度 | 追加エフェクト |
|---------|------|-------|---------|--------------|
| `can_saboru` | `#F97316` オレンジ | 3個（多め） | ゆったり（1.0x） | なし |
| `borderline` | `#F59E0B` 黄 | 1個（少なめ） | 通常（1.5x） | なし |
| `must_do` | `#EF4444` 赤 | 0個 | 速い（2.5x） | 稲妻エフェクト（不透明度点滅） |

稲妻エフェクトは `keyframes saboruLightning` を 3D 内ではなく **HTML コンテナ側**（オーバーレイ div）で実装する。Three.js 側で頑張らない。

### 11.9 カメラ設定

```tsx
<Canvas camera={{ position: [0, 0.5, 3], fov: 35 }} />
```

- `fov: 35`（既存 45 から狭く）: 圧縮効果でキャラを「映える」絵に
- `position: [0, 0.5, 3]`: やや上から見下ろす親しみのある角度

### 11.10 パフォーマンス制約

| 項目 | 目標値 |
|------|-------|
| ポリゴン数（キャラ全体） | < 3,000 |
| ドローコール | < 15 |
| FPS（M1 Mac） | 60fps 維持 |
| 初回ロード（lazy 後）| < 800ms |

drei `<RoundedBox>` の `smoothness` は `4` 程度に抑える（デフォルト 4、増やすとポリゴン爆発）。

### 11.11 3D コンテナ HTML スタイル（憲法4遵守）

3D を埋め込む HTML 側は必ず以下のクラス構成にする:

```jsx
// 例: タスク詳細の3Dヒーロー
<div className="rounded-3xl border-3 border-border-heavy shadow-hard-lg bg-cream overflow-hidden">
  <Suspense fallback={<SaborouCharacter2D verdict={verdict} size={120} />}>
    <Canvas style={{ width: '100%', height: 320 }}>
      <SaborouCharacter3D verdict={verdict} />
    </Canvas>
  </Suspense>
</div>
```

**Suspense fallback には必ず `SaborouCharacter2D` を入れる**: 3D ロード中も 2D で同じキャラが見え、世界観が崩れない。

