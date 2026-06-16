# Story Generation Plan - SABOROU v3 MCP Serverization

**作成日**: 2026-06-16
**対象**: SABOROU APIサーバーMCP化 / ElevenLabs AgentからのSABOROU機能呼び出し / `@Claude` Slack委譲
**参照要件**: `aidlc-docs/inception/v3/requirements/requirements.md`

---

## Planning Decision

User Storiesは実施する。追加質問は作成しない。理由は、Requirements AnalysisでMCP方式、ツール範囲、認証方式、デモ完了条件、Security Baseline、検証レベルがすでに回答済みであり、User Stories生成に必要な判断材料が揃っているため。

---

## Story Breakdown Approach

**採用方式**: Hybrid - User Journey-Based + Risk-Based

### 理由

- 音声Agentの価値は「ユーザーがどう話し、何を承認し、何がSlackに投稿されるか」で決まる。
- 実装リスクは「読み取りツール」と「副作用ツール」の境界に集中する。
- AgentCore/OpenAPI/認証の技術ギャップは、ユーザー体験の受け入れ基準に落とし込む必要がある。

### 使用しない方式

- Feature-Based only: インフラやAPI整理に寄りすぎ、音声UXと承認体験が薄くなる。
- Persona-Based only: 今回は主要ペルソナ数が少なく、実装単位の切り出しに弱い。
- Domain-Based only: Slack/Google/Task/MCPで分けるとデモの一連の流れが見えにくい。

---

## Generation Checklist

- [x] Step 1: Load v3 requirements and confirmed gaps.
- [x] Step 2: Generate personas in `aidlc-docs/inception/v3/user-stories/personas.md`.
- [x] Step 3: Generate journey-based user stories in `aidlc-docs/inception/v3/user-stories/stories.md`.
- [x] Step 4: Include acceptance criteria for read-only tools, side-effect tools, and `@Claude` delegation.
- [x] Step 5: Map stories to requirements FR-V3-01 through FR-V3-07 and gaps GAP-V3-01 through GAP-V3-08.
- [x] Step 6: Verify INVEST criteria and update this checklist.

---

## Mandatory Artifacts

- [x] `personas.md` with user archetypes and characteristics.
- [x] `stories.md` with user stories following INVEST criteria.
- [x] Acceptance criteria for each story.
- [x] Persona-to-story mapping.
- [x] Requirement and gap traceability.

---

## Story Quality Rules

- Each story must be independently testable.
- Side-effect actions must require explicit user approval.
- Read-only MCP tools and write/posting MCP tools must have separate acceptance criteria.
- `@Claude` delegation must define SABOROU responsibility separately from external Claude execution responsibility.
- Stories must be scoped to v3 MVP and avoid Chrome Web Store or long-term production observability beyond current requirements.

---

## Approval

This plan uses existing approved requirements and does not introduce new clarification questions.

[Answer]: Approved by user request to move to implementation.
