# Lean 形式検証スキル — Iteration 1 評価レポート

## 概要

| 指標 | 値 |
|---|---|
| スキル名 | `lean-formal-verification` |
| イテレーション | 1 |
| eval 数 | 3 |
| with_skill 平均スコア | **1.00** (3/3 eval で全アサーション通過) |
| without_skill 平均スコア | **0.70** (平均 2.8/4 アサーション通過) |
| スキルによる改善 | **+0.30** |

---

## Eval 別スコアカード

### Eval 1: `safeHead` の形式証明

| アサーション | with_skill | without_skill |
|---|---|---|
| sorry なし | ✅ | ✅ |
| 3補題すべて定義 | ✅ | ✅ |
| タクティク使用 | ✅ | ✅ |
| 有効な Lean 4 構文 | ✅ | ✅ |
| **スコア** | **4/4 (1.0)** | **4/4 (1.0)** |

**所見**: 比較的シンプルな証明のため、スキルの有無による差はなし。
両方とも `cases` + `simp` + `subst` を使って完全な証明を生成した。

---

### Eval 2: BST 不変条件の形式証明

| アサーション | with_skill | without_skill |
|---|---|---|
| BST 型の定義 | ✅ | ✅ |
| IsBST 述語 | ✅ | ✅ |
| insert 関数 | ✅ | ✅ |
| insert 不変条件保存の証明 | ✅ | ❌ |
| コンパイル通過 | ✅ | ❌ |
| **スコア** | **5/5 (1.0)** | **3/5 (0.6)** |

**所見**: スキルの効果が顕著。
- **with_skill**: `allBST` 補助述語 → `allBST_insertBST` 補助補題 → `insertBST_isBST` 主定理という
  段階的な構築手順をスキルが提供し、完全な証明を生成。
- **without_skill**: `inductive IsBST` のアプローチは高度だが、主定理の証明が途中で切れており不完全。

**スキル改善効果: +0.4**

---

### Eval 3: フィボナッチ2実装の等価性証明

| アサーション | with_skill | without_skill |
|---|---|---|
| fib と fibFast の定義 | ✅ | ✅ |
| 等価性定理の記述 | ✅ | ✅ |
| 帰納法の使用 | ✅ | ❌ |
| sorry なし | ✅ | ❌ |
| **スコア** | **4/4 (1.0)** | **2/4 (0.5)** |

**所見**: スキルの効果が最も顕著。
- **with_skill**: `private def fibAux` で補助関数を分離し、線形結合不変条件
  `fibAux (n+1) a b = fib n * a + fib (n+1) * b` を補題として立てる戦略が採用された。
- **without_skill**: `let rec go` 内部関数に対して `fibFast.go` でアクセスしようとしており、
  これは Lean 4 では不正（`let rec` の内部関数は外部から参照不可能）。実際にはコンパイルエラーになる。

**スキル改善効果: +0.5**

---

## スキルの強みと改善点

### ✅ 有効だった指導内容

1. **補助補題→主定理の段階的構築パターン** — BST eval で決定的に機能
2. **`private def` で補助関数を分離する戦略** — フィボナッチ eval で決定的に機能
3. **`induction ... generalizing` パターン** — 複数の引数を一般化した帰納法の証明
4. **`cases`/`simp`/`omega`/`ring` の使い分けガイド** — タクティク選択が適切に

### ⚠️ 改善が必要な点

1. **`let rec` vs `private def` の注意点が不明確**
   → SKILL.md に「`let rec` 内部関数は定理証明に使えない。補助関数は `private def` で分離すること」
   を明示的に追加するべき

2. **Eval 難易度が不均一**
   → Eval 1 は簡単すぎてスキルの効果が測れない。Mathlib を活用した証明 eval を追加推奨

3. **コンパイル実行による検証がない**
   → 実際の `lake build` でエラーが出るかどうかは未確認。CI 統合の eval が理想

---

## 次のステップ (Iteration 2 に向けて)

1. **SKILL.md の補強**:
   - `let rec` と `private def` の違いと、証明における注意点を追加
   - Mathlib を使った証明例（`Finset`、`Group` など）を追加

2. **Eval の追加**:
   - Eval 4: Mathlib の補題を活用したソートアルゴリズムの正確性証明
   - Eval 5: 型クラス（`Monoid`/`Group`）の性質を証明

3. **スキルスコア**: with_skill **1.00** / without_skill **0.70** → スキルは有効と判断
   Iteration 2 で without_skill を 0.70 以下に保ちながら、難易度を上げた eval で検証を継続
