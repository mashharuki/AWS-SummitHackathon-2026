# NFR Requirements Plan - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**対象Unit**: U-V3-01 mcp-transport-auth-adapter
**ステータス**: Complete

---

## Context

U-V3-01 は MCP transport/auth adapter の基盤Unitであり、最重要NFRは認証・認可、アクセスログ、機密情報非露出、fail-closed、既存Hono JWTルート非破壊である。

Functional Design と Lean Formal Verification で次の不変条件を確認済み:

- IAM-only evidence は `userId` に解決されない。
- identity未解決requestはprecheckを通過しない。
- cross-user resource access は拒否される。
- side-effect tool は明示承認を要求する。
- audit event は raw secret / raw args に依存しない。

---

## Checklist

- [x] Step 1: Analyze Functional Design artifacts.
- [x] Step 2: Analyze Lean formal verification results.
- [x] Step 3: Load and apply enabled Security Baseline extension rules.
- [x] Step 4: Define security, reliability, performance, availability, maintainability, and testability NFRs.
- [x] Step 5: Define tech stack decisions and constraints.
- [x] Step 6: Generate NFR Requirements artifacts.
- [x] Step 7: Update AI-DLC state and audit log.

---

## Clarification Questions

No additional clarification questions are required.

Reason:

- Security Baseline is already enabled.
- U-V3-01 scope is already constrained by approved Functional Design.
- `streamable_http` versus `sse` registration is handled in U-V3-04, not this unit.
- U-V3-01 must preserve existing JWT routes and deny IAM-only user authorization regardless of user preference.

[Answer]: Fast-track NFR Requirements using approved Functional Design and Lean proof results.
