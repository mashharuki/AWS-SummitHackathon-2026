-- ============================================================
-- BST.lean
-- バイナリサーチ木（BST）の実装と不変条件の証明（Lean 4）
-- 標準ライブラリのみ使用
-- ============================================================

-- ============================================================
-- 1. BST 帰納型（leaf と node）
-- ============================================================

/-- バイナリサーチ木（自然数キー） -/
inductive BST where
  | leaf : BST
  | node (left : BST) (val : Nat) (right : BST) : BST
  deriving Repr

-- ============================================================
-- 2. IsBST 述語
-- ============================================================

/-- 木の全てのノード値が述語 p を満たすことを表す補助定義 -/
def All (p : Nat → Prop) : BST → Prop
  | .leaf       => True
  | .node l v r => All p l ∧ p v ∧ All p r

/-- BST 不変条件:
    - 左部分木の全値がノード値より小さい（All (· < v) l）
    - 右部分木の全値がノード値より大きい（All (v < ·) r）
    - 左右の部分木も再帰的に IsBST を満たす -/
inductive IsBST : BST → Prop where
  | leaf : IsBST .leaf
  | node {l v r} :
      IsBST l → IsBST r →
      All (· < v) l →
      All (v < ·) r →
      IsBST (.node l v r)

-- ============================================================
-- 3. insert 関数
-- ============================================================

/-- BST に値 x を挿入する。
    - x < ノード値 → 左部分木へ再帰
    - x > ノード値 → 右部分木へ再帰
    - x = ノード値 → 変更なし（重複を許さない） -/
def insert (x : Nat) : BST → BST
  | .leaf       => .node .leaf x .leaf
  | .node l v r =>
    if x < v then .node (insert x l) v r
    else if v < x then .node l v (insert x r)
    else .node l v r

-- ============================================================
-- 補助補題: insert は All 述語を保存する
-- ============================================================

/-- 述語 p を全ノードが満たす木に p x を持つ x を insert しても
    依然として全ノードが p を満たす -/
private theorem insert_preserves_All
    (x : Nat) (p : Nat → Prop) (hpx : p x)
    : ∀ (t : BST), All p t → All p (insert x t) := by
  intro t
  induction t with
  | leaf =>
    intro _
    -- insert x .leaf = .node .leaf x .leaf
    -- All p (.node .leaf x .leaf) = True ∧ p x ∧ True
    exact ⟨trivial, hpx, trivial⟩
  | node l v r ihl ihr =>
    -- ihl : All p l → All p (insert x l)
    -- ihr : All p r → All p (insert x r)
    intro ⟨hl, hv, hr⟩
    simp only [insert]
    split_ifs with h1 h2
    · -- x < v: 左部分木に挿入、右は変化なし
      exact ⟨ihl hl, hv, hr⟩
    · -- v < x: 右部分木に挿入、左は変化なし
      exact ⟨hl, hv, ihr hr⟩
    · -- x = v: 変更なし（元の All p (.node l v r) をそのまま返す）
      exact ⟨hl, hv, hr⟩

-- ============================================================
-- 4. insert_preserves_IsBST 定理
-- ============================================================

/-- insert は BST 不変条件（IsBST）を保存する -/
theorem insert_preserves_IsBST (x : Nat) (t : BST) (h : IsBST t) :
    IsBST (insert x t) := by
  induction h with
  | leaf =>
    -- insert x .leaf = .node .leaf x .leaf
    -- IsBST (.node .leaf x .leaf) は leaf × leaf で自明
    exact IsBST.node IsBST.leaf IsBST.leaf trivial trivial
  | node hl hr hall_lt hall_gt ihl ihr =>
    -- hl   : IsBST l
    -- hr   : IsBST r
    -- hall_lt : All (· < v) l
    -- hall_gt : All (v < ·) r
    -- ihl  : IsBST (insert x l)  ← 帰納法の仮定（左）
    -- ihr  : IsBST (insert x r)  ← 帰納法の仮定（右）
    simp only [insert]
    split_ifs with h1 h2
    · -- x < v: 左部分木に挿入
      -- 必要: IsBST (insert x l)  → ihl
      -- 必要: All (· < v) (insert x l)
      --       → insert_preserves_All で h1 : x < v を使って導出
      exact IsBST.node
        ihl
        hr
        (insert_preserves_All x (· < v) h1 _ hall_lt)
        hall_gt
    · -- v < x: 右部分木に挿入
      -- 必要: All (v < ·) (insert x r)
      --       → insert_preserves_All で h2 : v < x を使って導出
      exact IsBST.node
        hl
        ihr
        hall_lt
        (insert_preserves_All x (v < ·) h2 _ hall_gt)
    · -- x = v: 変更なし（元の IsBST をそのまま適用）
      exact IsBST.node hl hr hall_lt hall_gt

-- ============================================================
-- 簡単な動作確認（#eval）
-- ============================================================

-- 例: 5 を根として 3 と 7 を挿入
#eval
  let t0 : BST := .leaf
  let t1 := insert 5 t0   -- .node leaf 5 leaf
  let t2 := insert 3 t1   -- .node (.node leaf 3 leaf) 5 leaf
  let t3 := insert 7 t2   -- .node (.node leaf 3 leaf) 5 (.node leaf 7 leaf)
  t3
