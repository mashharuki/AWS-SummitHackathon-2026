-- フィボナッチ数列の2つの実装の等価性証明

-- 素直な再帰実装
def fib : Nat → Nat
  | 0 => 0
  | 1 => 1
  | n + 2 => fib n + fib (n + 1)

-- 末尾再帰実装（高速版）
def fibFast (n : Nat) : Nat :=
  let rec go : Nat → Nat → Nat → Nat
    | 0, a, _ => a
    | n + 1, a, b => go n b (a + b)
  go n 0 1

-- 等価性の証明
-- 補題: go の一般的な性質
-- go n a b = fib n * a + fib (n+1) * b
private theorem fib_go_spec (n a b : Nat) :
    fibFast.go n a b = fib n * a + fib (n + 1) * b := by
  induction n generalizing a b with
  | zero => simp [fibFast.go, fib]
  | succ k ih =>
    simp only [fibFast.go]
    rw [ih]
    simp [fib]
    ring

-- メイン定理: fib n = fibFast n
theorem fib_eq_fibFast (n : Nat) : fib n = fibFast n := by
  simp [fibFast]
  rw [fib_go_spec]
  simp [fib]
