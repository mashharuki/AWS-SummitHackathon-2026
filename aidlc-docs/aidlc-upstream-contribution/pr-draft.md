# PR ドラフト（公式リポジトリへ投稿する英語本文）

**Title**: `fix: add quality-target verification gate to Construction phase`

**Branch**: `fix/quality-target-gate`（fork 上）
**Base**: `awslabs/aidlc-workflows:main`

---

## Summary

Closes #<ISSUE_NUMBER>.

Adds a tool-agnostic quality-target verification gate to the Construction phase.
Measurable quality targets defined in NFR Requirements (test coverage thresholds,
performance budgets, etc.) currently have no downstream stage that verifies they
were met — an agent can silently miss, or even lower, its own defined target while
satisfying every rule. This PR closes that gap with three minimal changes.

## Changes

| File | Change |
|------|--------|
| `construction/code-generation.md` | Add `HONOR QUALITY TARGETS` to the "Generation Phase Rules" Critical Rules |
| `construction/build-and-test.md` | Add "Coverage Target" / "Target Met" fields to the summary template, and a comparison step |
| `common/overconfidence-prevention.md` | Add target-relaxation to the "Red Flags to Watch For" list |

## Rationale

This mirrors the gap PR #155 fixed for question/answer rigor: a property is
strengthened on one side of a stage boundary but left unenforced on the other.
Here, quality targets are *defined* (NFR Requirements) but never *verified*
(Code Generation / Build & Test). The change is consistent with
`common/overconfidence-prevention.md`'s principle of not proceeding past
unresolved gaps.

## Test Plan

- Ran a full Inception→Construction cycle on a real greenfield monorepo project
  (TypeScript / pnpm, 6 units) with a Claude-based agent.
- In the original run, the agent lowered a coverage threshold (90/85 → 70/65) to
  pass Code Generation; this was only caught by human review.
- With these rule changes applied, the agent is explicitly instructed to surface
  the coverage gap in the completion message instead of weakening the target, and
  Build & Test now records target-vs-actual.
- All affected markdown files pass `markdownlint-cli2`.

## Checklist

- [x] Reviewed the contributing guidelines
- [x] Performed a self-review
- [x] Changes tested (full Construction-phase run described above)
- [x] Changes documented (rule files are self-documenting; Issue #<N> has full context)

## Acknowledgment

By submitting this pull request, I confirm that you can use, modify, copy, and
redistribute this contribution, under the terms of the project license.

---

# 実際の修正差分（適用内容）

## 差分1: `construction/code-generation.md`

`### Generation Phase Rules` ブロックの末尾に追加。

変更前:
```markdown
### Generation Phase Rules
- **NO HARDCODED LOGIC**: Only execute what's written in the unit plan
- **FOLLOW PLAN EXACTLY**: Do not deviate from the step sequence
- **UPDATE CHECKBOXES**: Mark [x] immediately after completing each step
- **STORY TRACEABILITY**: Mark unit stories [x] when functionality is implemented
- **RESPECT DEPENDENCIES**: Only implement when unit dependencies are satisfied
```

変更後（最終行を追加）:
```markdown
### Generation Phase Rules
- **NO HARDCODED LOGIC**: Only execute what's written in the unit plan
- **FOLLOW PLAN EXACTLY**: Do not deviate from the step sequence
- **UPDATE CHECKBOXES**: Mark [x] immediately after completing each step
- **STORY TRACEABILITY**: Mark unit stories [x] when functionality is implemented
- **RESPECT DEPENDENCIES**: Only implement when unit dependencies are satisfied
- **HONOR QUALITY TARGETS**: Measurable quality targets defined in NFR Requirements
  or NFR Design (e.g. test coverage thresholds, performance budgets) are inputs to
  Code Generation, not suggestions. Generated tests and configuration MUST aim to
  meet them. NEVER relax, lower, or disable a previously defined quality target
  (including threshold settings in test or build configuration) to make a step
  "pass". If a target cannot be met, surface the gap explicitly in the completion
  message instead of silently weakening the target.
```

## 差分2: `construction/build-and-test.md`

### 2a: Step 7 の `build-and-test-summary.md` テンプレート内「Unit Tests」セクション

変更前:
```markdown
### Unit Tests
- **Total Tests**: [X]
- **Passed**: [X]
- **Failed**: [X]
- **Coverage**: [X]%
- **Status**: [Pass/Fail]
```

変更後:
```markdown
### Unit Tests
- **Total Tests**: [X]
- **Passed**: [X]
- **Failed**: [X]
- **Coverage**: [X]%
- **Coverage Target (from NFR Requirements)**: [X]% (or N/A if none defined)
- **Target Met**: [Yes/No/N/A]
- **Status**: [Pass/Fail]
```

### 2b: Step 1 の直後（"Analyze Testing Requirements" の末尾）に一文追加

変更前（末尾）:
```markdown
- **Security tests**: Vulnerability scanning, penetration testing
```

変更後:
```markdown
- **Security tests**: Vulnerability scanning, penetration testing

When NFR Requirements defined measurable quality targets for any unit (e.g. test
coverage thresholds, performance budgets), record those targets here. The summary
in Step 7 MUST compare actual results against them and state whether each target
was met. If a target was not met, the summary MUST say so explicitly and the
"Ready for Operations" field MUST reflect it.
```

## 差分3: `common/overconfidence-prevention.md`

`### Red Flags to Watch For` セクションに 1 行追加。

変更前:
```markdown
### Red Flags to Watch For
- Stages completing without asking any questions on complex projects
- Proceeding with vague or ambiguous user responses
- Skipping entire question categories without justification
- Making assumptions instead of asking for clarification
```

変更後:
```markdown
### Red Flags to Watch For
- Stages completing without asking any questions on complex projects
- Proceeding with vague or ambiguous user responses
- Skipping entire question categories without justification
- Making assumptions instead of asking for clarification
- Relaxing, lowering, or disabling a previously defined quality target
  (e.g. a test coverage threshold) instead of meeting it
```
