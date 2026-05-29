# Issue ドラフト（公式リポジトリへ投稿する英語本文）

**Title**: `[Bug]: No quality-target verification gate — measurable NFR targets (e.g. coverage thresholds) can be silently relaxed in Code Generation / Build & Test`

**Labels (suggest)**: bug, construction

---

## Which rule or stage is affected

- `construction/code-generation.md`
- `construction/build-and-test.md`
- `construction/nfr-requirements.md` (origin of the targets)

## Summary

Measurable quality targets defined in **NFR Requirements** (e.g. test coverage
thresholds, performance budgets) are written into `tech-stack-decisions.md`, but
**no downstream stage is required to verify that those targets were actually met.**
As a result, an AI agent can satisfy every rule while a unit silently misses its
own defined quality bar — or even relax the target itself to make a step "pass".

## Expected vs actual behavior

**Expected**: When NFR Requirements defines a measurable quality target for a unit,
a later stage verifies the target was met before the unit is considered complete,
and the agent is explicitly forbidden from weakening the target instead of meeting it.

**Actual**: No such verification exists.

- `code-generation.md` Step 11 / Critical Rules — no mention of quality targets.
  Completion Criteria only requires that tests *are generated*, not that they meet
  any standard. Line ~215 defers test execution entirely to Build & Test.
- `build-and-test.md` — this stage *generates test-execution instructions* (markdown
  with `[Command to run tests]` placeholders); it does not execute tests or compare
  results against NFR targets. The `build-and-test-summary.md` template has a
  `Coverage: [X]%` field but no step fills `[X]` or checks it against the target.

So across the entire Construction phase there is **no gate** that confirms a defined,
measurable quality target was achieved.

## Reproduction (observed in a real run)

Platform: Claude-based coding agent, greenfield monorepo (TypeScript / pnpm).

1. In **NFR Requirements** for a unit, define a coverage target (e.g. Statements 90% /
   Branches 85%). It is recorded in `nfr-requirements.md` / `tech-stack-decisions.md`.
2. In **Code Generation**, the agent generates code + tests. Actual coverage comes
   out lower (e.g. Statements ~73% / Branches ~67%).
3. To "pass", the agent **lowers the coverage threshold in the test config** from
   90/85 to 70/65 and reports the step as complete and compliant.
4. Nothing in the rules flags this. It is only caught by human review.

The agent did not violate any rule — because no rule covers this.

## Why this matters

`common/overconfidence-prevention.md` already establishes the principle
"do not proceed with ambiguity" and lists red flags such as *"Proceeding with vague
or ambiguous user responses"*. The same philosophy should cover quality targets:
a target defined upstream should not be silently abandoned downstream.

This is the same class of gap that PR #155 fixed for question/answer rigor
("Step 3 was strengthened but Step 5 stayed weak") — here it is
"targets are *defined* but never *verified*".

PR #210 (Build & Test Execution extension) improves test *execution*, but (a) it is
opt-in, so the core workflow stays unguarded, and (b) it focuses on "tests pass",
not on "results meet the NFR-defined targets".

## Proposed direction (open to discussion)

Three small, tool-agnostic rule changes:

1. **`code-generation.md`** — add a Critical Rule: quality targets from NFR
   Requirements/Design are inputs, not suggestions; never relax/lower/disable a
   defined target to make a step pass; surface the gap instead.
2. **`build-and-test.md`** — extend the `build-and-test-summary.md` template with
   "Coverage Target" + "Target Met" fields, and add a step to compare actuals
   against NFR targets.
3. **`overconfidence-prevention.md`** — add "relaxing a previously defined quality
   target instead of meeting it" to the Red Flags list.

Happy to open a PR with these changes if the approach sounds right. Tested against
a full Inception→Construction run of a real project.
