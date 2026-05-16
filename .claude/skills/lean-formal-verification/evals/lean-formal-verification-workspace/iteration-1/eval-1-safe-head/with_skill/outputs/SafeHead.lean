-- SafeHead.lean
-- `safeHead` 関数の正しさを形式的に証明する

-- 配列の先頭要素を取り出す関数（空のとき None を返す）
def safeHead {α : Type _} (xs : List α) : Option α :=
  match xs with
  | [] => none
  | x :: _ => some x

-- -------------------------------------------------------
-- 性質 1: safeHead が some x を返すならば、x はリストの先頭要素
-- -------------------------------------------------------
theorem safeHead_some_is_head {α : Type _} {xs : List α} {x : α}
    (h : safeHead xs = some x) : ∃ tl : List α, xs = x :: tl := by
  cases xs with
  | nil =>
    -- [] の場合: safeHead [] = none ≠ some x なので矛盾
    simp [safeHead] at h
  | cons hd tl =>
    -- hd :: tl の場合: safeHead (hd :: tl) = some hd なので h : hd = x
    simp [safeHead] at h
    -- xs = hd :: tl = x :: tl を示す
    exact ⟨tl, by rw [h]⟩

-- -------------------------------------------------------
-- 性質 2: safeHead が none を返す ⟺ リストが空
-- -------------------------------------------------------
theorem safeHead_none_iff_empty {α : Type _} (xs : List α) :
    safeHead xs = none ↔ xs = [] := by
  constructor
  · -- 前向き: safeHead xs = none → xs = []
    intro h
    cases xs with
    | nil => rfl
    | cons hd tl =>
      -- safeHead (hd :: tl) = some hd ≠ none なので矛盾
      simp [safeHead] at h
  · -- 後ろ向き: xs = [] → safeHead xs = none
    intro h
    subst h
    rfl

-- -------------------------------------------------------
-- 性質 3: safeHead が some x を返す ⟺ リストが空でない
-- -------------------------------------------------------
theorem safeHead_some_iff_nonempty {α : Type _} (xs : List α) :
    (∃ x, safeHead xs = some x) ↔ xs ≠ [] := by
  constructor
  · -- 前向き: (∃ x, safeHead xs = some x) → xs ≠ []
    intro ⟨x, h⟩ heq
    -- xs = [] と仮定すると safeHead [] = none ≠ some x で矛盾
    subst heq
    simp [safeHead] at h
  · -- 後ろ向き: xs ≠ [] → ∃ x, safeHead xs = some x
    intro h
    cases xs with
    | nil =>
      -- xs = [] は h : [] ≠ [] と矛盾
      exact absurd rfl h
    | cons hd tl =>
      -- hd :: tl の先頭 hd を witness として与える
      exact ⟨hd, by simp [safeHead]⟩
