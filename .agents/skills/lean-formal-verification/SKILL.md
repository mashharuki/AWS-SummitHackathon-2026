---
name: lean-formal-verification
description: >
  Lean 4 を使った形式検証（Formal Verification）を支援するスキルです。
  設計・実装フェーズにて、コードの正しさを数学的に証明するための Lean ファイルを作成し、
  既存実装の不変条件・事後条件・アルゴリズムの正当性を形式的に検証します。
  次のような状況で使ってください：
  - 「このアルゴリズムが正しいことを証明したい」
  - 「Lean で仕様を書いて形式検証したい」
  - 「関数の事前条件・事後条件を証明したい」
  - 「データ構造の不変条件を Lean で確認したい」
  - 「型クラスを使った汎用的な性質を証明したい」
  - 「帰納法・計算量・整合性などを形式的に示したい」
  ユーザーが「証明」「検証」「invariant」「Lean」「仕様」「正当性」「形式的」等のキーワードを
  使う場合は積極的にこのスキルを活用してください。
---

# Lean 形式検証スキル

このスキルは、設計・実装フェーズにおける形式検証を Lean 4 で行うためのガイドです。
Lean 4 は依存型を持つ関数型プログラミング言語であり、同時に対話的定理証明支援系(ITP)でもあります。
このスキルを使うことで、ユーザーのプロジェクトに対して数学的に厳密な正確性の証明を提供できます。

---

## サブエージェントの自動判断ルール

タスクの複雑さを判断し、**以下の条件に該当する場合は必ず対応するサブエージェントファイルを読み込んで、そのプロセスに従って作業を進めてください**。条件に該当しない場合はこのスキルだけで処理します。

---

### 🔍 Spec Formalizer を使う条件

**以下のいずれかに該当する場合、作業を始める前に `agents/spec-formalizer.md` を読み込み、そのプロセスに従って仕様を形式化してください:**

- ユーザーが自然言語・疑似コード・Python/Rust/TypeScript などの他言語で仕様を説明している
- 「この関数が正しいことを証明したい」と言っているが、Lean の命題がまだ書かれていない
- 証明対象が3つ以上の性質・命題を含む
- データ構造の不変条件を複数定義する必要がある

**Spec Formalizer の呼び出し方:**
```
read_file("agents/spec-formalizer.md") を読み込み、
そのプロセスに従って Spec.lean (sorry 付き骨格) を生成してから次のステップへ進む。
```

---

### 📐 Proof Planner を使う条件

**以下のいずれかに該当する場合、証明を書き始める前に `agents/proof-planner.md` を読み込み、そのプロセスに従って証明戦略を立案してください:**

- 証明する命題が3つ以上ある
- 帰納法・再帰的補助関数・複数の補題分解が必要になりそうな場合
- どのタクティクを使えばよいか不明な場合
- `sorry` 付きの仕様ファイルを受け取って証明を完成させる場合
- BST・ソート・グラフなど非自明なアルゴリズムの正確性を証明する場合

**Proof Planner の呼び出し方:**
```
read_file("agents/proof-planner.md") を読み込み、
そのプロセスに従って証明順序・タクティク選択・補題分解を設計してから実装へ進む。
```

---

### ✅ Proof Reviewer を使う条件

**以下のいずれかに該当する場合、証明を提出する前に `agents/proof-reviewer.md` を読み込み、そのプロセスに従ってレビューを実施してください:**

- 証明が完成した（`sorry` がゼロになった）と判断したとき
- `lake build` が成功したが仕様との整合性を確認したいとき
- ユーザーが「レビューして」「品質を確認して」と依頼したとき
- 複雑な証明（補題3個以上・帰納法含む）が完成したとき

**Proof Reviewer の呼び出し方:**
```
read_file("agents/proof-reviewer.md") を読み込み、
そのプロセスに従ってビルド確認・sorry 検出・仕様整合性・品質スコアを出力する。
```

---

### 全フェーズを通すワークフロー（複雑なタスク向け）

命題が3つ以上ある場合や、非自明なアルゴリズムの場合は、以下のフローを自律的に実行してください:

```
① agents/spec-formalizer.md を読む → 仕様形式化 → Spec.lean
         ↓
② agents/proof-planner.md を読む → 証明戦略 → 骨格コード
         ↓
③ このスキルの以降のセクションに従って sorry を埋める
         ↓
④ agents/proof-reviewer.md を読む → レビュー → review.json
         ↓
⑤ verdict が NEEDS_WORK / REJECTED なら ③〜④ を繰り返す
```

**シンプルなタスク（命題1〜2個、自明な証明）はサブエージェントを使わずこのスキルだけで処理してください。**

---

## 前提知識の確認

まずユーザーに次の情報を確認してください（会話の流れから読み取れる場合はスキップ）:

1. **検証したい対象**: 関数・アルゴリズム・データ構造・プロトコル・etc.
2. **証明したい性質**: 停止性、不変条件、事後条件、整合性、etc.
3. **既存コードの有無**: 検証対象の実装が存在するか（Lean / 他言語）
4. **ゴールの形式化レベル**: ざっくりな確認 or 完全な数学的証明

---

## Lean 4 セットアップの確認

```bash
# バージョン確認（このプロジェクト: leanprover/lean4:v4.30.0-rc2）
cat lean-toolchain

# ビルド確認
lake build
```

`lakefile.lean` に以下の依存関係があることを確認してください：

```lean
require mathlib from git
  "https://github.com/leanprover-community/mathlib4.git" @ "master"
```

Mathlib は形式検証に必要な数多くの補題・タクティクを提供します。

---

## 形式検証の基本ワークフロー

### ステップ 1: 仕様の形式化

まず「証明したいこと」を Lean の型として表現します。

```lean
-- 関数の型と実装
def mySort (xs : List Nat) : List Nat := xs.mergeSort

-- 仕様: ソート結果は順序付けられている
theorem mySort_sorted (xs : List Nat) : (mySort xs).Sorted (· ≤ ·) := by
  simp [mySort, List.sorted_mergeSort]

-- 仕様: ソート結果は元のリストと同じ要素を持つ
theorem mySort_perm (xs : List Nat) : mySort xs ~ xs := by
  simp [mySort, List.mergeSort_perm]
```

### ステップ 2: 証明戦略の選択

| 証明したい性質 | 推奨タクティク |
|---|---|
| 整数・自然数の線形不等式 | `omega` |
| 有理数・実数の線形不等式 | `linarith` |
| 環の等式・不等式 | `ring`, `ring_nf` |
| 決定可能な命題の自動証明 | `decide`, `native_decide` |
| 帰納的構造の証明 | `induction` |
| 場合分け | `cases`, `rcases`, `obtain` |
| ゴールを仮定から自動証明 | `simp`, `aesop`, `tauto` |
| 存在証明 | `exact ⟨witness, proof⟩`, `use`, `exists` |
| 汎用自動証明 | `grind` |

### ステップ 3: 証明の構築

#### パターン A: 自動証明（単純なケース）

```lean
theorem add_comm' (n m : Nat) : n + m = m + n := by omega
theorem list_length_pos (xs : List α) (h : xs ≠ []) : 0 < xs.length := by
  cases xs with
  | nil => contradiction
  | cons _ _ => simp
```

#### パターン B: 帰納法（再帰的構造）

```lean
/-- リストの長さは自然数 -/
theorem length_non_neg (xs : List α) : 0 ≤ xs.length := Nat.zero_le _

/-- append の長さ -/
theorem length_append (xs ys : List α) : (xs ++ ys).length = xs.length + ys.length := by
  induction xs with
  | nil => simp
  | cons x xs ih => simp [List.length_cons, ih, Nat.add_assoc]
```

#### パターン C: 不変条件の証明

```lean
structure Stack (α : Type) where
  items : List α
  size : Nat
  inv : size = items.length  -- 不変条件

def Stack.push (s : Stack α) (x : α) : Stack α where
  items := x :: s.items
  size := s.size + 1
  inv := by simp [s.inv]  -- 不変条件の維持を証明

def Stack.pop (s : Stack α) (h : s.size > 0) : α × Stack α :=
  match s.items, s.inv with
  | x :: xs, inv => (x, ⟨xs, s.size - 1, by omega⟩)
  | [], inv => absurd (by omega : s.size = 0) (Nat.not_eq_zero_of_lt h)
```

#### パターン D: 型クラスによる汎用証明

```lean
-- Monoid の結合律を持つことを証明
theorem fold_append [Monoid M] (xs ys : List M) :
    (xs ++ ys).foldl (· * ·) 1 = xs.foldl (· * ·) 1 * ys.foldl (· * ·) 1 := by
  induction xs with
  | nil => simp
  | cons x xs ih => simp [List.foldl_cons, mul_assoc, ih]
```

---

## よく使う証明パターン集

### 等式の証明

```lean
-- `rfl`: 定義から明らか
example : 1 + 1 = 2 := rfl

-- `simp`: 簡約ルールの適用
example (n : Nat) : n + 0 = n := by simp

-- `ring`: 環の公理から
example (x y : ℤ) : (x + y) ^ 2 = x ^ 2 + 2 * x * y + y ^ 2 := by ring

-- `norm_num`: 数値計算
example : (2 : ℝ) ^ 10 = 1024 := by norm_num
```

### 不等式の証明

```lean
import Mathlib.Tactic.Linarith
import Mathlib.Tactic.Positivity

-- 整数・自然数: omega
example (n : Nat) (h : n > 5) : n ≥ 6 := by omega

-- 実数の線形: linarith
example (x y : ℝ) (h1 : x > 0) (h2 : y > 0) : x + y > 0 := by linarith

-- 非負性: positivity
example (x : ℝ) : x ^ 2 ≥ 0 := by positivity
```

### 存在証明・一意存在

```lean
-- 存在を示す: 具体的な witness を与える
example : ∃ n : Nat, n > 100 := ⟨101, by omega⟩

-- 一意存在
example : ∃! n : Nat, n + 3 = 5 := by
  exact ⟨2, by omega, fun n h => by omega⟩
```

### 否定・矛盾

```lean
-- 矛盾から証明: exfalso + contradiction
example (h1 : n = 0) (h2 : n ≠ 0) : False := h2 h1

-- by_contra: 背理法
example (h : ¬¬P) : P := by
  by_contra hP
  exact h hP
```

---

## 形式検証のベストプラクティス

### 1. 小さく始める
証明したい定理を複数の補題に分割して、各補題を順番に証明します。
`sorry` プレースホルダーを使って証明の骨格を先に作り、後から埋めていく方法が効果的です。

```lean
-- まず骨格を作る
theorem main_theorem (xs : List Nat) : complicated_property xs := by
  have step1 : intermediate_property1 xs := by sorry
  have step2 : intermediate_property2 xs step1 := by sorry
  exact final_step step1 step2
```

### 2. `#check` と `#eval` で仕様を確認

```lean
-- 型を確認する
#check List.Sorted
#check Nat.rec

-- 計算で確認する
#eval [3, 1, 4, 1, 5].mergeSort  -- [1, 1, 3, 4, 5]
```

### 3. `example` で実験する

```lean
-- スコープを汚さずに試す
example : 2 + 2 = 4 := by decide
example (n : Nat) : n ≤ n + 1 := by omega
```

### 4. タクティクの組み合わせ

```lean
-- simp + omega の組み合わせ
theorem useful_lemma (n : Nat) : n + 1 > 0 := by
  simp
  omega
```

### 5. Mathlib の活用

Mathlib には膨大な補題が含まれています。`#check`、`exact?`、`apply?`、`simp?` で探せます。

```lean
-- 自動で補題を探す
example (n : Nat) : n ≤ n := by
  exact?  -- → exact Nat.le_refl n
```

### 6. ⚠️ 重要: `let rec` 内部関数は定理証明に使えない

**`let rec` で定義した内部関数は、外部の定理から直接参照できません。**
補助関数を証明に使いたい場合は、必ず `private def` でトップレベルに定義してください。

```lean
-- ❌ 悪い例: let rec 内部関数は証明できない
def fibFast (n : Nat) : Nat :=
  let rec go : Nat → Nat → Nat → Nat
    | 0, a, _ => a
    | n + 1, a, b => go n b (a + b)
  go n 0 1

-- fibFast.go という参照は無効！コンパイルエラーになる
theorem go_spec (n a b : Nat) : fibFast.go n a b = ... := by  -- ❌

-- ✅ 良い例: private def でトップレベルに定義する
private def fibAux : Nat → Nat → Nat → Nat
  | 0,     a, _ => a
  | n + 1, a, b => fibAux n b (a + b)

def fibFast' (n : Nat) : Nat := fibAux n 0 1

-- fibAux はトップレベルなので証明可能
theorem fibAux_spec (n a b : Nat) : fibAux (n + 1) a b = fib n * a + fib (n + 1) * b := by
  induction n generalizing a b with  -- `generalizing` で仮定を一般化
  | zero => simp [fibAux, fib]
  | succ k ih => rw [fibAux, ih]; ring
```

### 7. `induction ... generalizing` で複数引数を一般化する

再帰的補助関数の証明で複数の引数を持つ場合、`generalizing` を使って帰納法の仮定を強化します。

```lean
-- n で帰納するが、a と b は固定せず一般化する
theorem aux_lemma (n : Nat) : ∀ (a b : Nat), aux n a b = ... := by
  induction n with
  | zero => intro a b; simp [aux]
  | succ k ih =>
    -- ih : ∀ (a b : Nat), aux k a b = ...  ← a, b が自由変数として使える
    intro a b
    ...

-- または induction n generalizing a b を使う
theorem aux_lemma' (n a b : Nat) : aux n a b = ... := by
  induction n generalizing a b with
  | zero => simp [aux]
  | succ k ih =>
    -- ih : ∀ (a b : Nat), aux k a b = ...
    rw [aux]; exact ih ...
```

---

## 汎用プロジェクトへの適用手順

ユーザーの実際のプロジェクトに形式検証を適用する場合:

1. **検証対象の特定**: 最も重要なコア関数・不変条件を選ぶ
2. **Lean ファイルの作成**: `Verification/` ディレクトリに `ProjectName.lean` を作成
3. **仕様の形式化**: 自然言語の仕様を Lean の命題として書き下す
4. **証明の実装**: 段階的に証明を完成させる（sorry → 完全証明）
5. **ビルドの確認**: `lake build` でエラーがないことを確認

### ファイル構成の例

```
Verification/
├── Spec.lean        -- 仕様・型・インターフェース定義
├── Impl.lean        -- 実装（証明対象）
├── Proofs.lean      -- 主要な定理・補題
└── Properties.lean  -- 性質・不変条件のまとめ
```

---

## トラブルシューティング

| 症状 | 対処法 |
|---|---|
| `unknown identifier 'xxx'` | `import Mathlib` または該当モジュールを追加 |
| タクティクが終わらない | `set_option maxHeartbeats 400000` でタイムアウトを延ばす |
| `sorry` を使いたい | `sorry` は一時的に可（最終的には削除すること） |
| 型エラーが出る | `#check` でゴールの型を確認し、型強制 `(x : T)` を明示する |
| `simp` が遅い | `simp only [lemma1, lemma2]` で使うルールを絞る |
| 証明が見つからない | `exact?`, `apply?`, `simp?` を使って Mathlib を検索 |
| `let rec` 内部関数を証明に使いたい | `private def` でトップレベルに分離する（上記「重要」参照） |
| `induction` の仮定が弱すぎる | `induction n generalizing a b` で変数を一般化する |
| `cases` で分岐したら型が合わない | `omega` / `contradiction` / `simp at *` で矛盾を消す |
| `ring` が動かない | `ring_nf` で正規化して残りを手動で処理 |

---

## 参考リソース

- **lean-by-example**: このリポジトリの `LeanByExample/Tactic/` 以下に各タクティクの解説
- **Lean 公式ドキュメント**: https://lean-lang.org/lean4/doc/
- **Mathlib ドキュメント**: https://leanprover-community.github.io/mathlib4_docs/
- **Lean by Example (日本語)**: https://lean-ja.github.io/lean-by-example/
- **awesome-formal-verification**: https://github.com/ElNiak/awesome-formal-verification
