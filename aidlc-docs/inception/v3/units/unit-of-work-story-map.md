# SABOROU v3 Unit of Work Story Map

**作成日**: 2026-06-16
**対象**: SABOROU MCP Serverization

---

## Story To Unit Map

| Story | Primary Unit | Supporting Units | Rationale |
|-------|--------------|------------------|-----------|
| US-V3-01 音声でタスク一覧を確認する | U-V3-01 | U-V3-02, U-V3-04, U-V3-05 | Requires identity-safe tool calls, task schema, ElevenLabs registration, and real verification. |
| US-V3-02 音声でSlack返信案を生成する | U-V3-02 | U-V3-01, U-V3-04, U-V3-05 | Requires stable `saborou_judge_sabori` schema and safe output semantics. |
| US-V3-03 音声承認後にSlackへ返信する | U-V3-01 | U-V3-02, U-V3-04, U-V3-05 | Approval enforcement and user identity are foundational; schema and verification complete the path. |
| US-V3-04 音声でGoogle/Slack文脈を取り込む | U-V3-02 | U-V3-01, U-V3-05 | Requires tool allowlist expansion and side-effect approval classification. |
| US-V3-05 音声で選んだタスクをSlack上のClaudeへ委譲する | U-V3-03 | U-V3-01, U-V3-02, U-V3-05 | Dedicated delegation behavior with approval and Slack posting. |
| US-V3-06 AgentCore経由でもユーザー認可を維持する | U-V3-01 | U-V3-05 | Core authorization gap; real verification proves it. |
| US-V3-07 OpenAPIとMCPツール公開範囲を同期する | U-V3-02 | U-V3-05 | Schema/tool registry and sync tests are primary. |
| US-V3-08 ElevenLabs Agentから実MCP経路で呼び出す | U-V3-04 | U-V3-01, U-V3-02, U-V3-05 | Dashboard registration depends on stable transport/auth/schema. |
| US-V3-09 実接続検証を完了する | U-V3-05 | U-V3-01, U-V3-02, U-V3-03, U-V3-04 | End-to-end verification depends on all units. |

---

## Requirement To Unit Map

| Requirement | Units |
|-------------|-------|
| FR-V3-01 AgentCore Gateway本命のMCPサーバー化 | U-V3-01, U-V3-04, U-V3-05 |
| FR-V3-02 既存APIの音声呼び出し可能ツール化 | U-V3-02, U-V3-05 |
| FR-V3-03 ElevenLabs AgentからのMCPツール呼び出し | U-V3-04, U-V3-01, U-V3-02, U-V3-05 |
| FR-V3-04 `@Claude` タスク実行依頼フロー | U-V3-03, U-V3-05 |
| FR-V3-05 OpenAPIスキーマ品質強化 | U-V3-02 |
| FR-V3-06 AgentCore GatewayからHono APIへの認証経路整備 | U-V3-01 |
| FR-V3-07 返信ドラフト生成とサボり判定の意味整理 | U-V3-02, U-V3-05 |

---

## Gap To Unit Map

| Gap | Units | Resolution Path |
|-----|-------|-----------------|
| GAP-V3-01 limited AgentCore OpenAPI operations | U-V3-02 | Expand allowlist and schema tests. |
| GAP-V3-02 duplicated OpenAPI sources | U-V3-02 | Add sync/generation or drift-detection tests. |
| GAP-V3-03 AgentCore IAM target vs API Gateway JWT mismatch | U-V3-01 | Add adapter/identity path without weakening existing JWT routes. |
| GAP-V3-04 Hono auth reads JWT claims only | U-V3-01 | Add trusted identity resolver for MCP adapter context. |
| GAP-V3-05 pseudo `/mcp/tools/...` path | U-V3-04 | Use ElevenLabs Dashboard remote MCP registration with `streamable_http` primary or `sse` fallback. |
| GAP-V3-06 missing `@Claude` delegation API | U-V3-03 | Add explicit delegation tool/API and Slack post behavior. |
| GAP-V3-07 fixed `saboriScore` value | U-V3-02 | Align tool semantics or implement meaningful score logic. |
| GAP-V3-08 missing real connection test | U-V3-05 | Create and execute real AWS/AgentCore/ElevenLabs/Slack verification. |

---

## NFR To Unit Map

| NFR | Units | Notes |
|-----|-------|-------|
| NFR-V3-S1 認証・認可 | U-V3-01, U-V3-03, U-V3-05 | Foundation auth plus side-effect approval verification. |
| NFR-V3-S2 入力検証 | U-V3-02, U-V3-03 | Tool schemas and Slack/task input validation. |
| NFR-V3-S3 秘密情報管理 | U-V3-01, U-V3-03, U-V3-04 | JWT, Slack, Google, and ElevenLabs secret boundaries. |
| NFR-V3-P1 レイテンシ | U-V3-01, U-V3-02, U-V3-05 | Adapter/tool response targets and real measurement. |
| NFR-V3-R1 デモ可用性 | U-V3-04, U-V3-05 | Fallback configuration and end-to-end demo proof. |
| NFR-V3-T1 テスト | U-V3-01, U-V3-02, U-V3-03, U-V3-04, U-V3-05 | Unit, schema, CDK, extension, and real verification coverage. |

---

## Coverage Validation

| Coverage Check | Result |
|----------------|--------|
| US-V3-01 assigned | Pass |
| US-V3-02 assigned | Pass |
| US-V3-03 assigned | Pass |
| US-V3-04 assigned | Pass |
| US-V3-05 assigned | Pass |
| US-V3-06 assigned | Pass |
| US-V3-07 assigned | Pass |
| US-V3-08 assigned | Pass |
| US-V3-09 assigned | Pass |
| All FR-V3 items assigned | Pass |
| All GAP-V3 items assigned | Pass |
| All NFR-V3 items assigned | Pass |

---

## Construction Stage Entry Order

1. Start Construction with U-V3-01 because it closes SECURITY-08 at implementation level.
2. Continue with U-V3-02 because every downstream tool depends on stable schema and registry definitions.
3. Implement U-V3-03 and U-V3-04 after U-V3-02. They may be worked in parallel if needed.
4. Finish with U-V3-05 and Build/Test because real verification depends on every implementation unit.
