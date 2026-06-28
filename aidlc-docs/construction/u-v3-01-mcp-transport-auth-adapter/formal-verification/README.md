# Lean Formal Verification - U-V3-01

**作成日**: 2026-06-17
**対象**: `mcp-transport-auth-adapter`

---

## Scope

This directory contains a Lean 4 formal model for the U-V3-01 security-critical logic.

The proof verifies these design invariants:

1. `GATEWAY_IAM_ROLE` evidence alone never resolves to a SABOROU `userId`.
2. Tool precheck rejects requests before identity resolution.
3. Cross-user resource access returns `false`.
4. Write and external-post tools require explicit human approval.
5. Safe audit events are independent of raw secrets and raw tool arguments.

---

## Files

- `McpTransportAuthAdapter.lean`: complete Lean 4 model and proofs.

---

## Verification Command

```bash
lean aidlc-docs/construction/u-v3-01-mcp-transport-auth-adapter/formal-verification/McpTransportAuthAdapter.lean
```

Verified on 2026-06-16T15:16:47Z with Lean 4.31.0.

Result:

- Build status: success
- `sorry`: 0
- `axiom`: 0
- `admit`: 0
- `unsafe`: 0

Reviewer output: `review.json`

---

## Limitations

This proves the abstract specification used by Functional Design. It does not prove every TypeScript implementation line is bug-free. Code Generation must preserve this model with tests and implementation review.
