# 2D / 3D 共存ルール（憲法6条）

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**目的**: HTML の 2D 世界観と Three.js 製 3D ヒーローを**ぶつからずに共存**させ、相乗効果を得るための実装憲法。

---

## 0. 本書の位置づけ

本書は U-06-ui-redesign の**全実装者・全レビュアーが従う絶対ルール**である。
本書に反する実装・PR は、たとえ機能が動いていても **マージしない**こと。
2D と 3D が同居する SABOROU のような構成は油断すると世界観が壊れる。
ルールがあるからこそ、リッチな 3D 演出が「浮かず」「ちゃっちくならず」HTML 世界観と相乗効果を生む。

---

## 1. なぜ 2D と 3D は「ぶつからない」のか — 役割分担の原理

2D と 3D がぶつかるのは、**同じ役割を奪い合うとき**だけ。
役割を 3 軸（位置 / サイズ / タイミング）で完全に分けてしまえば、必ず共存できる。

### 1.1 役割分担の 3 軸

| 軸 | 2D の領分 | 3D の領分 |
|-----|----------|----------|
| **位置（どの画面）** | 全画面（ログイン・一覧・詳細・取説・ペルソナ・ロードマップ・設定） | ログイン上部ヒーロー / タスク詳細判定ヒーロー の **2 箇所のみ** |
| **サイズ** | 横幅 240px **未満**（28 / 36 / 56 / 100 / 120px） | 横幅 240px **以上**（280 / 320px） |
| **タイミング** | 常時表示・静的・装飾 | 「verdict 連動の特別な瞬間」のみ |

**例**: タスク詳細では「左上ヒーロー＝3D 大」「右側チャットアバター＝2D 小」が**位置とサイズで役割分担**して共存する。同じカード内でも、サイズが違えば奪い合いは起きない。

---

## 2. 憲法6条（絶対遵守）

### 憲法1: パレットは完全共有

3D マテリアル・ライト・雲・影の色は **HTML の `SABORU_THEME` から取った色しか使わない**。
新しいカラーを 3D 専用に作ることは禁止。

**OK**:
```typescript
// design-tokens.md 11.2 で定義された SABORU_3D_COLOR を使う
material.color = SABORU_3D_COLOR.can_saboru; // = #F97316（= --color-orange）
```

**NG**:
```typescript
material.color = new THREE.Color("#FFA500"); // 独自色禁止
material.color = new THREE.Color("#FF7700"); // HTML パレットに無い橙系禁止
```

**根拠**: 色が一致すれば、形が違っても「同じ世界」に見える。色が違うと、どんなにリッチでも世界観が裂ける。

---

### 憲法2: 3Dの最小サイズは横幅 240px

横幅 240px 未満には 3D を置かない。それより小さい場所はすべて 2D SVG。

| サイズ帯 | 表現 | 理由 |
|---------|------|------|
| 240px 以上 | 3D OK | リッチに見える |
| 240px 未満 | 2D 必須 | 3D は小さく見せると粗が目立ち、ローポリ感が出る |

**実装ガード**: `SaborouScene3D` の `size` prop が 240 未満で渡された場合、`console.warn` を出す（リリースビルドでは無効化）。

```typescript
// SaborouScene3D 内部
if (size < 240 && process.env.NODE_ENV !== "production") {
  console.warn(`[SaborouScene3D] size=${size} は憲法2に違反します（240 以上推奨）。SaborouCharacter2D の使用を検討してください。`);
}
```

**根拠**: 小さい3Dは粗が目立ち「ちゃっち」に見える。大きく見せれば「リッチ」、小さく見せれば「ちゃっち」。この境界は経験則で 240px。

---

### 憲法3: 3D コンテナ背景は cream `#FFFAF5`

3D を埋め込む親 div の `background` は **`cream`（`#FFFAF5`）** または「`cream` → `orange-light` の淡いグラデーション」のみ。
3D の `<Canvas>` 自体は背景透明にし、HTML コンテナの色が見える状態にする。

**OK**:
```jsx
<div className="bg-cream rounded-3xl ...">
  <Canvas style={{ background: 'transparent' }}>
    <SaborouCharacter3D verdict={verdict} />
  </Canvas>
</div>
```

**NG**:
```jsx
<Canvas style={{ background: '#000' }}>       {/* 黒背景禁止 */}
<Canvas style={{ background: '#1F2937' }}>    {/* ink 色禁止 */}
<scene background={new THREE.Color('#fff')} />{/* 真っ白も禁止 */}
```

**根拠**: 3D の "空間" を HTML の世界観に溶け込ませる。背景が違うと「外部から持ち込んだ別物」に見える。

---

### 憲法4: 3D の "外枠" は HTML 側が担当

3D 自体に枠線を付けない。代わりに **3D をラップする HTML コンテナ**側で
`border-3 border-[#2B1E16]` + ハードシャドウ（`shadow-hard-lg`）を適用する。

**OK**:
```jsx
<div className="rounded-3xl border-3 border-border-heavy shadow-hard-lg bg-cream overflow-hidden">
  <Suspense fallback={<SaborouCharacter2D verdict={verdict} size={120} />}>
    <Canvas style={{ width: '100%', height: 320 }}>
      <SaborouScene3D verdict={verdict} />
    </Canvas>
  </Suspense>
</div>
```

**NG**:
```jsx
{/* HTML 枠線なしで Canvas を直置き → 浮いて見える */}
<Canvas><SaborouCharacter3D /></Canvas>

{/* 3D 内で BoxGeometry を枠として使う → ブルータリズム再現困難・パフォーマンス低下 */}
<lineSegments>
  <edgesGeometry args={[boxGeometry]} />
  <lineBasicMaterial color="#2B1E16" />
</lineSegments>
```

**根拠**: 3D 空間で「太い黒枠 + ハードシャドウ」を再現するのは難しく、再現してもちゃっちく見える。HTML の表現力をそのまま使った方が美しい。

---

### 憲法5: 2D と 3D は「同じ顔」

ユーザーが「アレ、一覧の小さい子と詳細の大きい子、同じキャラだ」と気づくこと。
そのために、以下のすべてを **2D と 3D で一致**させる:

| 一致させる要素 | 真とする設計図 |
|---------------|--------------|
| 目の位置（中心からのオフセット） | `character-design-sheet.md` 3.1 |
| 目の形状（眠そう/困り/警戒） | `character-design-sheet.md` 3.2 |
| 口の角度（笑顔/への字/不安） | `character-design-sheet.md` 3.3 |
| 雲のかたち・数 | `character-design-sheet.md` 3.4 |
| squircle の縦横比 | `character-design-sheet.md` 2.1（1.0 : 1.05） |
| Zzz エフェクトの有無 | `character-design-sheet.md` 3.5 |
| 頬の赤み（チーク）の有無 | `character-design-sheet.md` 3.6 |

**順序ルール**: 必ず **2D を先に作って顔を確定**してから、3D を作る（migration-plan.md Phase 2 → Phase 3）。

**Suspense fallback / ErrorBoundary fallback** は必ず `SaborouCharacter2D`。3D ロード中・3D 失敗時に「同じ顔の小さい版」が見える → ユーザーに違和感を与えない。

---

### 憲法6: 3D は verdict 連動の特別な瞬間にしか出さない

3D が出る瞬間は、ユーザーにとって「**大事なことが起きた**」と感じる UX シグナルである。
裏を返せば、情報密度の高い場所・常時表示する場所には 3D を置かない。

**3D を出していい場所**:
- ログイン直後のヒーロー（最初の挨拶、「これはサボロー」のアイデンティティ提示）
- タスク詳細の判定ヒーロー（提案を受け取る主役の瞬間）

**3D を出してはいけない場所**:
- 一覧カード（各カードに 3D を置くとパフォーマンス悲惨）
- 取説・ペルソナ・ロードマップ・設定（静的説明の場面で 3D は過剰）
- ローディングスピナー・トースト通知・モーダル

**根拠**: 3D が普通になると、3D の "特別感" が失われる。ハイライトとして残すことで「動く驚き」を維持する。

---

## 3. 配置マトリクス（憲法準拠の最終答え）

`ui-redesign-spec.md` 7 章と同期。ここでも掲載:

| # | 画面 / 位置 | 表現 | サイズ | 適用憲法 |
|---|------------|------|-------|---------|
| 1 | ログイン: 上部ヒーロー | 🎬 3D | ~280px | 1,2,3,4,5,6 |
| 2 | タスク一覧: 今日バナー | 2D SVG | 56px | 2 |
| 3 | タスク一覧: 各カード | 2D SVG | 36px | 2 |
| 4 | タスク詳細: 判定ヒーロー | 🎬 3D | ~320px | 1,2,3,4,5,6 |
| 5 | タスク詳細: チャットアイコン | 2D SVG | 28px | 2 |
| 6 | 取説: 各セクション | 2D SVG | 各種 | 2,6 |
| 7 | ペルソナ: カードプレビュー | 2D SVG | 48px | 2,6 |
| 8 | ロードマップ: 装飾 | 2D SVG | 32px | 2,6 |
| 9 | 設定: アカウントカード | 2D SVG | 36px | 2,6 |
| 10 | エラー画面・404 | 2D SVG | 120px | 6（特別な瞬間ではない） |

**3D 配置は #1 と #4 の 2 箇所のみ**。

---

## 4. アンチパターン集（PR レビュー時の確認用）

以下を見つけたら **即指摘・差し戻し**:

### AP-01: 240px 未満に 3D
```jsx
{/* NG: 小さい3Dはちゃっち */}
<SaborouScene3D verdict="can_saboru" size={120} />
```
→ 代替: `<SaborouCharacter2D verdict="can_saboru" size={120} />`

### AP-02: HTML コンテナの枠線なしで 3D を直置き
```jsx
{/* NG: 世界観から浮く */}
<div>
  <Canvas><SaborouCharacter3D verdict={v} /></Canvas>
</div>
```
→ 代替: 憲法4 の OK 例を参照

### AP-03: 3D の独自カラーパレット
```typescript
// NG: SABORU_THEME 外の色
new THREE.Color("#FF8800");
```
→ 代替: `SABORU_3D_COLOR[verdict]` を使う

### AP-04: 3D を一覧カードに大量配置
```jsx
{/* NG: 性能悲惨・特別感喪失 */}
{tasks.map(t => (
  <Card key={t.id}>
    <Canvas><SaborouCharacter3D verdict={t.verdict} /></Canvas>
  </Card>
))}
```
→ 代替: `<SaborouCharacter2D verdict={t.verdict} size={36} />`

### AP-05: Suspense fallback が 2D ではない
```jsx
{/* NG: ロード中に世界観が切れる */}
<Suspense fallback={<Spinner />}>
  <SaborouScene3D verdict={v} />
</Suspense>
```
→ 代替: `fallback={<SaborouCharacter2D verdict={v} size={120} />}`

### AP-06: 同一画面に 3D を 2 体以上配置
```jsx
{/* NG: 主役が分散する */}
<div>
  <SaborouScene3D verdict={v1} />
  <SaborouScene3D verdict={v2} />
</div>
```
→ 代替: 主役は 1 体だけ、もう一方は 2D に

### AP-07: 3D に黒背景・濃色背景
```jsx
{/* NG: HTML 世界観から完全離脱 */}
<Canvas style={{ background: '#000' }} />
```
→ 代替: 憲法3 を参照

### AP-08: 2D と 3D の顔が違う
- 例: 2D は眠そうな目だが、3D ではぱっちりした目
- 例: 2D は雲が頭上だが、3D には雲がない
→ 代替: `character-design-sheet.md` を真として両者を揃える

### AP-09: 3D を初期バンドルに含めた
- `import { SaborouScene3D } from '@/components/three/SaborouScene3D'`（同期 import）
→ 代替: `const SaborouScene3D = lazy(() => import('@/components/three/SaborouScene3D'))`

### AP-10: prefers-reduced-motion 無視
- 3D の呼吸アニメ・回転が止まらない
→ 代替: `useReducedMotion()` フックを参照して `useFrame` 内で早期 return

---

## 5. レビュー時チェックリスト（PR テンプレートに含める）

```markdown
## 2D / 3D 共存ルール準拠（U-06）

- [ ] 憲法1: 3D の色はすべて `SABORU_3D_COLOR` から取っている
- [ ] 憲法2: 240px 未満に 3D を置いていない
- [ ] 憲法3: 3D コンテナ背景は cream または淡いオレンジグラデ
- [ ] 憲法4: 3D の外枠は HTML 側（`border-3 border-border-heavy shadow-hard-*`）で表現
- [ ] 憲法5: Suspense / ErrorBoundary fallback が `SaborouCharacter2D`
- [ ] 憲法6: 3D は配置マトリクス #1 / #4 以外に出ていない
- [ ] アンチパターン AP-01 〜 AP-10 のいずれにも該当しない
- [ ] `prefers-reduced-motion: reduce` で 3D アニメが止まる
- [ ] `lazy()` で別チャンクに分離されている
```

---

## 6. 例外申請プロセス

新しい場所に 3D を置きたい / 憲法に反する実装が必要、と感じた場合:

1. PR 説明欄に「**憲法例外申請**」セクションを設け、どの条文に反するか・なぜ必要かを記述
2. レビュアー 2 名以上の承認が必要（うち 1 名は U-06 オーナー）
3. 承認された場合は本書の「7. 例外履歴」に記録

ハッカソン期間中は原則として **例外申請を認めない**（時間がない・品質が乱れる）。

---

## 7. 例外履歴

| 日付 | 適用画面 | 例外内容 | 承認者 | 理由 |
|------|---------|---------|--------|------|
| - | - | （現時点なし）| - | - |
