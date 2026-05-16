-- 配列の先頭要素を取り出す関数（空のとき None を返す）
def safeHead {α : Type*} (xs : List α) : Option α :=
  match xs with
  | [] => none
  | x :: _ => some x

/-- 補題1: safeHead が some x を返すならば、x はリストの先頭要素 -/
theorem safeHead_some_implies_head {α : Type*} {xs : List α} {x : α}
    (h : safeHead xs = some x) : ∃ tail, xs = x :: tail := by
  cases xs with
  | nil => simp [safeHead] at h
  | cons hd tl =>
    simp [safeHead] at h
    subst h
    exact ⟨tl, rfl⟩

/-- 補題2: safeHead が none を返す ⟺ リストが空 -/
theorem safeHead_none_iff_empty {α : Type*} (xs : List α) :
    safeHead xs = none ↔ xs = [] := by
  constructor
  · intro h
    cases xs with
    | nil => rfl
    | cons hd tl => simp [safeHead] at h
  · intro h
    subst h
    rfl

/-- 補題3: safeHead が some x を返す ⟺ リストが空でない
    （より精密に：safeHead xs = some x ↔ xs の先頭が x である） -/
theorem safeHead_some_iff_nonempty {α : Type*} {x : α} (xs : List α) :
    safeHead xs = some x ↔ ∃ tail, xs = x :: tail := by
  constructor
  · intro h
    cases xs with
    | nil => simp [safeHead] at h
    | cons hd tl =>
      simp [safeHead] at h
      subst h
      exact ⟨tl, rfl⟩
  · intro ⟨tail, h⟩
    subst h
    simp [safeHead]
