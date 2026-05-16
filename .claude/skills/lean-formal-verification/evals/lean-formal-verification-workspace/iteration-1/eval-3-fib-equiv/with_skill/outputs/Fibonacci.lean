/-
  Fibonacci.lean

  Proof that the naive recursive Fibonacci implementation and the tail-recursive
  implementation are equivalent.

  Main theorem: ∀ n, fib n = fibFast n

  Strategy:
    Key insight: the accumulators (a, b) of fibAux satisfy a linear-combination
    invariant with consecutive Fibonacci numbers:

        fibAux (n + 1) a b = fib n · a + fib (n + 1) · b

    This is proved by induction on n, then specialised at (a, b) = (0, 1)
    to give fibFast n = fib n.
-/

-- ============================================================================
-- Implementations
-- ============================================================================

/-- Naive recursive Fibonacci.
    fib 0 = 0, fib 1 = 1, fib (n+2) = fib n + fib (n+1) -/
def fib : Nat → Nat
  | 0     => 0
  | 1     => 1
  | n + 2 => fib n + fib (n + 1)

/-- Tail-recursive accumulator helper for fibFast.
    `fibAux n a b` runs `n` more accumulation steps starting from (a, b). -/
private def fibAux : Nat → Nat → Nat → Nat
  | 0,     a, _ => a
  | n + 1, a, b => fibAux n b (a + b)

/-- Fast tail-recursive Fibonacci.
    Seeds fibAux with the initial pair (fib 0, fib 1) = (0, 1). -/
def fibFast (n : Nat) : Nat := fibAux n 0 1

-- ============================================================================
-- Basic unfolding lemmas (all by rfl)
-- ============================================================================

theorem fib_zero : fib 0 = 0 := rfl
theorem fib_one  : fib 1 = 1 := rfl

/-- Fibonacci recurrence. -/
theorem fib_add_two (n : Nat) : fib (n + 2) = fib n + fib (n + 1) := rfl

/-- fibAux base-case unfolding. -/
theorem fibAux_zero (a b : Nat) : fibAux 0 a b = a := rfl

/-- fibAux step unfolding. -/
theorem fibAux_succ (n a b : Nat) : fibAux (n + 1) a b = fibAux n b (a + b) := rfl

-- ============================================================================
-- Key lemma: fibAux as a linear combination of Fibonacci numbers
-- ============================================================================

/--
  The core algebraic invariant of the tail-recursive helper:

      fibAux (n + 1) a b = fib n · a + fib (n + 1) · b

  Proof by simple induction on n, using:
  - Base (n = 0):
      fibAux 1 a b = b = 0·a + 1·b = fib 0 · a + fib 1 · b  ✓
  - Step (n = k + 1, IH: ∀ a b, fibAux (k+1) a b = fib k · a + fib (k+1) · b):
      fibAux (k+2) a b
        = fibAux (k+1) b (a+b)              [by definition]
        = fib k · b + fib (k+1) · (a+b)    [by IH with (a,b) ↦ (b, a+b)]
        = fib (k+1) · a + fib (k+2) · b    [by algebra + fib (k+2)=fib k+fib (k+1)] ✓
-/
theorem fibAux_spec (n a b : Nat) : fibAux (n + 1) a b = fib n * a + fib (n + 1) * b := by
  induction n generalizing a b with
  | zero =>
    -- Goal: fibAux 1 a b = fib 0 * a + fib 1 * b
    -- Reduce to: b = 0 * a + 1 * b
    simp [fibAux_succ, fibAux_zero, fib_zero, fib_one]
  | succ k ih =>
    -- IH:  ∀ a b, fibAux (k + 1) a b = fib k * a + fib (k + 1) * b
    -- Goal: fibAux (k + 1 + 1) a b = fib (k + 1) * a + fib (k + 1 + 1) * b
    --
    -- Unfold one step of fibAux (definitional equality → rfl).
    have step1 : fibAux (k + 1 + 1) a b = fibAux (k + 1) b (a + b) := rfl
    -- Apply IH at (b, a + b).
    have step2 : fibAux (k + 1) b (a + b) = fib k * b + fib (k + 1) * (a + b) :=
      ih b (a + b)
    -- Fibonacci recurrence (definitional equality → rfl).
    have step3 : fib (k + 1 + 1) = fib k + fib (k + 1) := rfl
    rw [step1, step2, step3]
    ring

-- ============================================================================
-- Main equivalence theorem
-- ============================================================================

/--
  The naive recursive and the tail-recursive Fibonacci implementations are equal
  for every natural number n.

  Proof:
  - n = 0 : fib 0 = 0 = fibAux 0 0 1 = fibFast 0                          ✓
  - n = k + 1 :
        fibFast (k+1) = fibAux (k+1) 0 1
                      = fib k * 0 + fib (k+1) * 1   [fibAux_spec k 0 1]
                      = fib (k+1)                    [ring]                ✓
-/
theorem fib_eq_fibFast (n : Nat) : fib n = fibFast n := by
  unfold fibFast
  cases n with
  | zero =>
    -- fib 0 = 0 = fibAux 0 0 1
    rfl
  | succ k =>
    -- fib (k+1) = fibAux (k+1) 0 1 = fib k * 0 + fib (k+1) * 1 = fib (k+1)
    rw [fibAux_spec k 0 1]
    ring

-- ============================================================================
-- Sanity checks
-- ============================================================================

-- Compute a few values to confirm both functions agree.
#eval fib 0      -- 0
#eval fib 1      -- 1
#eval fib 10     -- 55
#eval fib 20     -- 6765

#eval fibFast 0  -- 0
#eval fibFast 1  -- 1
#eval fibFast 10 -- 55
#eval fibFast 20 -- 6765

-- Spot-check the main theorem at concrete values.
example : fib 0  = fibFast 0  := fib_eq_fibFast 0
example : fib 1  = fibFast 1  := fib_eq_fibFast 1
example : fib 10 = fibFast 10 := fib_eq_fibFast 10
example : fib 20 = fibFast 20 := fib_eq_fibFast 20
