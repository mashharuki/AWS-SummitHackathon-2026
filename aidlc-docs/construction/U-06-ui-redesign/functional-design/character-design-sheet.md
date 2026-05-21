# サボローキャラクター設計図（2D / 3D 共通）

**Unit**: U-06-ui-redesign
**作成日**: 2026-05-20
**目的**: 2D SVG (`SaborouCharacter2D`) と 3D r3f (`SaborouCharacter3D`) で**同じ顔のキャラ**として認識される設計図。
**参照元**: 共有 HTML の SVG 実装 (`/tmp/saborou_src/04_a148c0b6.js`)

---

## 0. 本書の位置づけ

本書は **2D と 3D の "顔の真"** である。2D 実装者と 3D 実装者は本書を起点に作業し、
完成後は本書の図と並べて目視チェックする。
`2d-3d-coexistence-rules.md` 憲法5「同じ顔」の根拠資料。

---

## 1. 全体仕様

### 1.1 キャラクター名
**おっとりサボロー**（読み: おっとりさぼろー）

### 1.2 性格設定
- ふわふわ・ゆったり
- 罪悪感を持たせない
- やさしく背中を押す（サボらせる）
- 困っているときは寄り添う

### 1.3 viewBox 共通
- 2D SVG: `viewBox="0 0 120 120"`
- 3D シーン座標系: `viewBox` 相当のスケーリング比を保つ（後述 2.1）

---

## 2. ボディ形状（squircle）

### 2.1 SVG パス（2D の真）

```
M 30 50 Q 30 30 50 30
L 70 30
Q 90 30 90 50
L 90 80
Q 90 100 70 100
L 50 100
Q 30 100 30 80 Z
```

**特徴**:
- 横幅: 60 (x=30 → x=90)
- 縦幅: 70 (y=30 → y=100)
- 角丸: 半径 20（`Q 30 30 50 30` の二次ベジエ）
- **アスペクト比 1 : 1.167** = squircle 形状（完全な正方形でも円でもない）

### 2.2 3D 再現方法

drei `<RoundedBox>` を使用:

```tsx
<RoundedBox
  args={[1.0, 1.05, 0.8]}  // width, height, depth（HTML比率 60:70 ≒ 1.0:1.167 を depth 0.8 で立体化）
  radius={0.18}            // 角丸（SVG の radius 20/60 ≒ 0.33 を視覚に合わせて 0.18 に調整）
  smoothness={4}           // ポリゴン数を抑える（憲法11.10 制約）
>
  <meshStandardMaterial color={SABORU_3D_COLOR[verdict]} roughness={0.5} metalness={0} />
</RoundedBox>
```

**注意**: drei の `<RoundedBox>` のデフォルト原点は中心。SVG パスの原点（左上）と一致させるため、Y 軸の位置調整は親 group で行う。

### 2.3 ボディ色

| verdict | 2D `bodyColor` | 2D `bodyShadow` | 3D マテリアル色 | CSS 変数 |
|---------|---------------|-----------------|---------------|---------|
| `can_saboru` | `#F97316` | `#EA580C` | `#F97316` | `--color-orange` |
| `borderline` | `#F59E0B` | `#D97706` | `#F59E0B` | `--color-borderline` |
| `must_do` | `#EF4444` | `#DC2626` | `#EF4444` | `--color-must` |

**3D の影色** (`bodyShadow`): マテリアルの暗部色として直接指定はしないが、`directionalLight` の影方向で自然に表現される。

---

## 3. パーツ仕様（2D SVG パス + 3D 配置）

### 3.1 目（瞳）

| verdict | 2D 形状（眠そう/思考/驚き） | 2D SVG | 3D 表現 |
|---------|-------------------------|--------|---------|
| `can_saboru` | sleepy（眠そうな弧） | `path d="M 42 64 Q 47 67 52 64"` / `path d="M 68 64 Q 73 67 78 64"` stroke=#1F2937 width=2.5 | テクスチャ平面（squircle 前面 z=0.41） |
| `borderline` | thinking（点 + 上に眉） | `circle cx=47 cy=64 r=2.5` + `path d="M 43 60 Q 47 58 51 60"` | 同上、テクスチャを差し替え |
| `must_do` | shocked（大きな黒丸 + 白ハイライト） | `circle cx=47 cy=64 r=3.5` + `circle cx=48 cy=63 r=1.2` fill=white | 同上 |

**目の中心座標（viewBox 120 系）**:
- 左目: (47, 64)
- 右目: (73, 64)
- 左右間隔: 26

**3D 座標換算**（squircle の中央を原点とする）:
- 左目: (-0.108, +0.05, 0.42)（中心から左へ 26/240、上下方向は ±0、squircle 表面 z=0.4 + テクスチャ厚 0.02）
- 右目: (+0.108, +0.05, 0.42)

### 3.2 口

| verdict | 形状 | 2D SVG |
|---------|------|--------|
| `can_saboru` | smile（笑顔の弧） | `path d="M 54 80 Q 60 85 66 80"` stroke=#1F2937 width=2.5 |
| `borderline` | neutral（一文字） | `path d="M 55 82 L 65 82"` stroke=#1F2937 width=2.5 |
| `must_do` | ohno（縦長楕円・口を開けている） | `ellipse cx=60 cy=83 rx=4 ry=5` fill=#1F2937 |

**口の中心座標**: (60, 82)
**3D 座標換算**: (0, -0.27, 0.42)

### 3.3 頬（チーク）

両頬ともにオレンジ系の楕円・透明度 0.7。

| verdict | チーク色 |
|---------|---------|
| `can_saboru` | `#FED7AA`（orange-light） |
| `borderline` | `#FDE68A`（yellow-light） |
| `must_do` | `#FECACA`（red-light） |

**位置**:
- 左頬: `ellipse cx=42 cy=72 rx=6 ry=4`
- 右頬: `ellipse cx=78 cy=72 rx=6 ry=4`

**3D 表現**: 表情テクスチャに含める（独立メッシュにしない、パフォーマンス節約）。

### 3.4 頭上の雲・天気

| verdict | 天気 | 2D SVG | 3D 表現 |
|---------|------|--------|---------|
| `can_saboru` | cloud（雲3個） | 3つの ellipse 重ね: (42,18 rx=12 ry=8) + (58,14 rx=14 ry=9) + (74,18 rx=11 ry=7) fill=#F3F4F6 | drei `<Cloud opacity={0.6}>` または半透明 sphere ×3 個 |
| `borderline` | sun_cloud（太陽 + 雲） | circle(42,14 r=8 fill=#FCD34D) + ellipse(62,18 rx=14 ry=8) + ellipse(76,20 rx=9 ry=6) | sphere(emissive=#FCD34D, scale=0.15) + sphere ×2 個 |
| `must_do` | lightning（暗い雲 + 稲妻） | ellipse(50,16 rx=14 ry=8 fill=#9CA3AF) + ellipse(68,14 rx=12 ry=8 fill=#6B7280) + 稲妻パス | 暗色 sphere ×2 + **HTML オーバーレイで稲妻**（憲法11.8） |

**雲の位置（viewBox 120 系）**: 中心 (60, 18) 周辺、頭上 30px ほど浮かせる。
**3D 雲の Y 座標**: squircle 上端（+0.525）から +0.5 ほど上の位置 = `y ≈ 1.0`

### 3.5 Zzz エフェクト

| verdict | 表示 | 2D SVG |
|---------|------|--------|
| `can_saboru` | あり（眠そう） | `text x=80 y=24 fontSize=10 fill=#9CA3AF fontWeight=700>z</text>` + `@keyframes saboruZzz` |
| `borderline` | なし | — |
| `must_do` | なし | — |

**3D 表現**: 平面プレーンに「z」文字テクスチャを貼り、`useFrame` で透明度+位置をアニメ。

### 3.6 ハイライト（艶）

squircle の左上に白い楕円で艶を表現。全 verdict 共通。

**2D**: `ellipse cx=48 cy=48 rx=10 ry=6 fill=#FFFFFF opacity=0.25`
**3D**: `directionalLight` のスペキュラハイライトで自然に表現される（追加メッシュ不要）。

---

## 4. アニメーション

### 4.1 ボディ揺れ（saboruBob）

- 周期: 4 秒
- 動き: `translateY(0 → -4px) + rotate(-2deg → 2deg)` を往復
- 2D: CSS keyframe `saboruBob` を適用
- 3D: `useFrame` で `group.position.y = Math.sin(t * Math.PI/2) * 0.04` + `group.rotation.z = Math.sin(t * Math.PI/2) * 0.035`

### 4.2 呼吸（3D 専用）

- 周期: verdict 別（`can_saboru` 1.0x / `borderline` 1.5x / `must_do` 2.5x）
- 動き: `scale.y = 1 + sin(t * speed) * 0.02`
- 2D 版にはなし（CSS keyframes の bob のみ）

### 4.3 まばたき（3D 専用、オプション）

- 4〜6 秒間隔でランダムに 0.15 秒だけ目を閉じる
- 3D 表情テクスチャを「目開き」と「目閉じ」の 2 枚用意して差し替え

### 4.4 Zzz 浮遊（saboruZzz）

- 周期: 2.5 秒
- 動き: `translate(0 → 8px, 0 → -16px) + scale(0.5 → 1) + opacity(0 → 1 → 0)`
- `can_saboru` + `animated=true` のときのみ表示

### 4.5 稲妻（saboruLightning）

- 周期: 1.5 秒
- 動き: `opacity 1 → 0.4 → 1`（90%-100%・92%-96% の区間で点滅）
- `must_do` + `animated=true` のときのみ表示
- 3D 実装: HTML オーバーレイ div で適用（憲法4: 3D に枠線同様、エフェクトも HTML 側）

### 4.6 prefers-reduced-motion 対応

`useReducedMotion()` が `true` の場合、すべてのアニメーションを停止する。
- 2D: `animation: 'none'`
- 3D: `useFrame` の処理を早期 return

---

## 5. SaborouAvatar（チャット用ミニアバター）

チャットバブル左に表示する 28〜36px のミニアバター。`SaborouCharacter` とは別コンポーネント。

### 5.1 仕様

```tsx
function SaborouAvatar({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: "30%",  // 30% の角丸（squircle 風）
      background: "linear-gradient(135deg, #F97316, #EA580C)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      boxShadow: "0 2px 6px rgba(249,115,22,0.3)"
    }}>
      <svg viewBox="0 0 40 40" width={size * 0.75} height={size * 0.75}>
        {/* 両頬 */}
        <ellipse cx="14" cy="22" rx="2" ry="1.2" fill="#FED7AA" opacity="0.7" />
        <ellipse cx="26" cy="22" rx="2" ry="1.2" fill="#FED7AA" opacity="0.7" />
        {/* 眠そうな目（左右） */}
        <path d="M 12 19 Q 14 21 16 19" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M 24 19 Q 26 21 28 19" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* 笑顔 */}
        <path d="M 17 26 Q 20 28 23 26" stroke="#1F2937" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
```

**用途**: チャットバブル発話者識別、コメント欄、設定画面のキャラタブなど 28〜48px の小サイズ箇所。
**verdict 非依存**: 常に「おっとり笑顔」固定。

---

## 6. カラーチャート（パレット完全共有の視覚化）

### 6.1 ボディ・天気・チークの対応

```
verdict        body         shadow       cheek        weather        zzz/lightning
─────────────────────────────────────────────────────────────────────────────────
can_saboru     #F97316      #EA580C      #FED7AA      #F3F4F6 雲     Zzz あり
borderline     #F59E0B      #D97706      #FDE68A      #FCD34D 太陽   なし
must_do        #EF4444      #DC2626      #FECACA      #9CA3AF 暗雲   稲妻 #FBBF24
```

### 6.2 全カラーが SABORU_THEME 由来

| キャラ色 | SABORU_THEME 対応 |
|---------|------------------|
| `#F97316` | `orange` |
| `#EA580C` | `orange-dark` |
| `#FED7AA` | `orange-light` |
| `#F59E0B` | `verdict.borderline` |
| `#EF4444` | `verdict.must` |
| `#F3F4F6` | `line` |
| `#1F2937` | `ink` |
| `#9CA3AF` | `ink-muted` |

**新色は一切使わない**（憲法1）。

---

## 7. 実装チェックリスト

### 7.1 2D 実装時（Phase 2）

- [ ] viewBox 120×120 で実装
- [ ] verdict 3 値（`can_saboru`/`borderline`/`must_do`）すべてで表情切替が動く
- [ ] `animated=true` で saboruBob アニメが動く
- [ ] `sleeping=true` で目を閉じた状態になる
- [ ] `can_saboru` + `animated=true` で Zzz が浮く
- [ ] `must_do` + `animated=true` で稲妻が点滅する
- [ ] `prefers-reduced-motion: reduce` で全アニメ停止
- [ ] サイズ指定（28 / 36 / 56 / 100 / 120）で破綻しない
- [ ] スナップショットテストを撮る（Phase 7 で 3D と比較するため）

### 7.2 3D 実装時（Phase 3）

- [ ] 2D のスナップショットと並べて目視チェック → **同じキャラに見える**
- [ ] verdict 3 値ですべて表情・色・雲が変化
- [ ] 呼吸アニメが動く（verdict 別速度）
- [ ] 接地影あり
- [ ] 環境マップ反射が確認できる
- [ ] 3 点ライティングが効いている
- [ ] `prefers-reduced-motion: reduce` で停止
- [ ] 240px / 280px / 320px で破綻しない
- [ ] 60fps 維持（Chrome DevTools Performance で確認）

### 7.3 共通レビュー（Phase 7）

- [ ] 2D 36px と 3D 320px を並べて、表情の角度・口の形・目の大きさ比率が一致している
- [ ] 雲の数・位置が一致している
- [ ] `must_do` の稲妻が両方とも黄系
- [ ] パレットが完全に同じ
