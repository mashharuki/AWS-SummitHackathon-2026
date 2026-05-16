/-!
# Binary Search Tree (BST) — Formal Invariant Verification in Lean 4

This file contains:
1. `BST`          — inductive type for binary search trees over `Nat`
2. `allBST`       — predicate: all values in a tree satisfy some property
3. `IsBST`        — BST ordering invariant
4. `insertBST`    — insertion function that preserves BST structure
5. `allBST_insertBST` — auxiliary lemma: insertion preserves the `allBST` predicate
6. `insertBST_isBST`  — main theorem: insertion preserves the BST invariant

No Mathlib is used; only the Lean 4 standard library (`Init`).
-/

-- ============================================================
-- Section 1: BST Type Definition
-- ============================================================

/-- A binary search tree whose values are natural numbers.

    `leaf`        — the empty tree
    `node v l r`  — a node with value `v`, left subtree `l`, right subtree `r`  -/
inductive BST where
  | leaf : BST
  | node : Nat → BST → BST → BST
  deriving Repr

-- ============================================================
-- Section 2: Auxiliary Predicate and BST Invariant
-- ============================================================

/-- `allBST p t` holds when **every** value stored in `t` satisfies predicate `p`. -/
def allBST (p : Nat → Prop) : BST → Prop
  | .leaf        => True
  | .node x l r  => p x ∧ allBST p l ∧ allBST p r

/-- The BST invariant:
    - Every value in the left  subtree is **strictly less than** the node value.
    - Every value in the right subtree is **strictly greater than** the node value.
    - Both subtrees satisfy the invariant recursively.

    This is a *strong* (global) BST property; a single node-level comparison is
    not enough—we require the property to hold for the *entire* subtree. -/
def IsBST : BST → Prop
  | .leaf        => True
  | .node x l r  =>
    allBST (· < x) l ∧   -- all left values  < x
    allBST (x < ·) r ∧   -- all right values > x
    IsBST l              ∧   -- left  subtree is a BST
    IsBST r                  -- right subtree is a BST

-- ============================================================
-- Section 3: Insert Function
-- ============================================================

/-- Insert a natural number `n` into BST `t`, maintaining the BST ordering.
    - `n < x` → recurse into the left  subtree
    - `n > x` → recurse into the right subtree
    - `n = x` → `n` is already present; return the tree unchanged -/
def insertBST (n : Nat) : BST → BST
  | .leaf        => .node n .leaf .leaf
  | .node x l r  =>
    if n < x      then .node x (insertBST n l) r
    else if x < n then .node x l (insertBST n r)
    else               .node x l r       -- n = x, duplicate: no-op

-- ============================================================
-- Section 4: Proofs
-- ============================================================

/-- **Auxiliary lemma**: if `p n` holds and every element of `t` satisfies `p`,
    then every element of `insertBST n t` also satisfies `p`.

    This is the core ingredient for the main theorem: it lets us discharge the
    `allBST` side-conditions that arise after an insertion step. -/
theorem allBST_insertBST (p : Nat → Prop) (n : Nat) (t : BST)
    (hn : p n) (ht : allBST p t) : allBST p (insertBST n t) := by
  induction t with
  | leaf =>
    -- insertBST n .leaf = .node n .leaf .leaf
    -- Need: p n ∧ True ∧ True
    simp only [insertBST, allBST]
    exact ⟨hn, trivial, trivial⟩
  | node x l r ihl ihr =>
    simp only [insertBST]
    by_cases h1 : n < x
    · -- n < x branch: insert into left subtree
      simp only [if_pos h1, allBST]
      simp only [allBST] at ht
      -- ht : p x ∧ allBST p l ∧ allBST p r
      -- goal: p x ∧ allBST p (insertBST n l) ∧ allBST p r
      exact ⟨ht.1, ihl ht.2.1, ht.2.2⟩
    · simp only [if_neg h1]
      by_cases h2 : x < n
      · -- x < n branch: insert into right subtree
        simp only [if_pos h2, allBST]
        simp only [allBST] at ht
        -- ht : p x ∧ allBST p l ∧ allBST p r
        -- goal: p x ∧ allBST p l ∧ allBST p (insertBST n r)
        exact ⟨ht.1, ht.2.1, ihr ht.2.2⟩
      · -- n = x branch: no change
        simp only [if_neg h2]
        exact ht

/-- **Main theorem**: `insertBST` preserves the `IsBST` invariant.

    For every natural number `n` and BST `t`, if `t` satisfies the BST invariant
    then `insertBST n t` also satisfies the BST invariant. -/
theorem insertBST_isBST (n : Nat) (t : BST) (h : IsBST t) :
    IsBST (insertBST n t) := by
  induction t with
  | leaf =>
    -- insertBST n .leaf = .node n .leaf .leaf
    -- IsBST (.node n .leaf .leaf) = True ∧ True ∧ True ∧ True
    simp [insertBST, IsBST, allBST]
  | node x l r ihl ihr =>
    simp only [insertBST]
    by_cases h1 : n < x
    · -- n < x: insert into left subtree, right subtree unchanged
      simp only [if_pos h1, IsBST]
      simp only [IsBST] at h
      -- h    : allBST (· < x) l ∧ allBST (x < ·) r ∧ IsBST l ∧ IsBST r
      -- goal : allBST (· < x) (insertBST n l) ∧ allBST (x < ·) r
      --         ∧ IsBST (insertBST n l) ∧ IsBST r
      obtain ⟨hal, har, hbl, hbr⟩ := h
      exact ⟨allBST_insertBST (· < x) n l h1 hal, har, ihl hbl, hbr⟩
    · simp only [if_neg h1]
      by_cases h2 : x < n
      · -- x < n: insert into right subtree, left subtree unchanged
        simp only [if_pos h2, IsBST]
        simp only [IsBST] at h
        -- h    : allBST (· < x) l ∧ allBST (x < ·) r ∧ IsBST l ∧ IsBST r
        -- goal : allBST (· < x) l ∧ allBST (x < ·) (insertBST n r)
        --         ∧ IsBST l ∧ IsBST (insertBST n r)
        obtain ⟨hal, har, hbl, hbr⟩ := h
        exact ⟨hal, allBST_insertBST (x < ·) n r h2 har, hbl, ihr hbr⟩
      · -- n = x: no insertion, return original tree (invariant trivially preserved)
        simp only [if_neg h2]
        exact h

-- ============================================================
-- Section 5: Sanity Checks
-- ============================================================

-- Build a small BST: insert 5, 1, 3 in order
#eval insertBST 3 (insertBST 1 (insertBST 5 .leaf))
-- BST.node 5 (BST.node 1 BST.leaf (BST.node 3 BST.leaf BST.leaf)) BST.leaf

-- The empty tree is a BST
example : IsBST .leaf := trivial

-- A manually constructed BST with three nodes satisfies the invariant
--   5
--  / \
-- 3   7
-- Proof by explicit term construction; IsBST (.node 5 ...) unfolds to:
--   allBST (·<5) (.node 3 .leaf .leaf)   =  (3<5 ∧ True ∧ True)
--   allBST (5<·) (.node 7 .leaf .leaf)   =  (5<7 ∧ True ∧ True)
--   IsBST (.node 3 .leaf .leaf)          =  (True ∧ True ∧ True ∧ True)
--   IsBST (.node 7 .leaf .leaf)          =  (True ∧ True ∧ True ∧ True)
example : IsBST (.node 5 (.node 3 .leaf .leaf) (.node 7 .leaf .leaf)) :=
  ⟨⟨by omega, trivial, trivial⟩,
   ⟨by omega, trivial, trivial⟩,
   ⟨trivial, trivial, trivial, trivial⟩,
   ⟨trivial, trivial, trivial, trivial⟩⟩
