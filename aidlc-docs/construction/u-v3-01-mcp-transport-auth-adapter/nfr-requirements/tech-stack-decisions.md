# Tech Stack Decisions - U-V3-01 mcp-transport-auth-adapter

**作成日**: 2026-06-17 JST
**Unit**: U-V3-01 mcp-transport-auth-adapter

---

## Decision Summary

| Area | Decision | Rationale |
|------|----------|-----------|
| Runtime | Existing `pkgs/backend` Hono on AWS Lambda / Node.js 22 | Preserve brownfield architecture and avoid new deployable service in U-V3-01. |
| API Framework | Hono | Existing backend framework; supports focused middleware/route composition. |
| Auth Source | Cognito JWT remains source of user identity | Matches existing browser/extension direct API and AgentCore Custom JWT design. |
| MCP Adapter Location | Existing backend package by default | Keeps security boundary close to domain services and avoids premature `pkgs/mcpserver`. |
| Validation | Zod/OpenAPI-compatible schemas | Existing project pattern and U-V3-02 schema expansion dependency. |
| Logging | Structured JSON logs to CloudWatch | Existing Lambda log path; Security Baseline requires centralized logs. |
| IaC | AWS CDK TypeScript | Existing AgentCore/API stacks already use CDK. |
| Formal Verification | Lean 4.31.0 for security invariant model | Already verified U-V3-01 abstract model with no `sorry`. |
| Testing | Vitest/Jest as existing package conventions plus CDK assertions | Avoid adding new test framework. |

---

## Backend Decisions

### TSD-U3-01-01: Keep Existing Hono API Boundary

Use `pkgs/backend` for adapter and identity resolver code unless Infrastructure Design proves a separate Lambda or route is required.

**Reason**:

- Existing domain repositories and services are already user-scoped.
- Existing direct API fallback must remain intact.
- U-V3-01 should minimize package churn.

### TSD-U3-01-02: Separate Adapter From Existing `authMiddleware`

Do not overload the existing `authMiddleware` to accept IAM-only events as user identity.

**Reason**:

- Existing middleware correctly represents direct API Gateway JWT behavior.
- MCP path has different trust boundaries.
- A dedicated resolver makes SECURITY-08 easier to test and maintain.

---

## Authentication Decisions

### TSD-U3-01-03: Cognito Subject Is The User Boundary

The canonical user identity remains Cognito `sub`.

**Reason**:

- Existing repositories use `userId` from Cognito.
- Slack and Google token storage is per-user.
- Lean proof assumes Cognito-backed evidence as the only resolver to `userId`.

### TSD-U3-01-04: IAM Role Does Not Become User Identity

AgentCore IAM role credentials are accepted only as service-hop evidence where needed by infrastructure.

**Reason**:

- IAM role proves the caller is AgentCore, not which SABOROU user owns the request.
- Mapping IAM role directly to user identity would create an IDOR risk.

---

## Observability Decisions

### TSD-U3-01-05: Audit Events Are Safe By Construction

Audit event type must not include raw secrets or raw tool args.

**Reason**:

- SECURITY-02 and SECURITY-03 require logging.
- SECURITY-03 and SECURITY-15 prohibit sensitive leakage.
- Lean proof verifies the abstract audit event is independent of `secret` and `rawArgs`.

---

## Infrastructure Decisions

### TSD-U3-01-06: Final Route/Target Shape Deferred To Infrastructure Design

NFR Requirements does not choose the exact API Gateway / AgentCore target shape.

**Allowed options for Infrastructure Design**:

- MCP-specific adapter route with appropriate Gateway/IAM/JWT handling.
- Internal Lambda adapter target if AgentCore supports it in the deployed target model.
- Existing OpenAPI Target only if it can carry trusted user identity without weakening JWT routes.

**Rejected by NFR**:

- Making all `/{proxy+}` routes unauthenticated.
- Treating `GATEWAY_IAM_ROLE` as user authorization.
- Logging raw request bodies to compensate for missing observability.

---

## Tooling Decisions

### TSD-U3-01-07: Keep Lean Proof As Design Evidence

Do not require TypeScript-to-Lean extraction in this unit.

**Reason**:

- Current proof models the Functional Design invariants.
- Code Generation must preserve the model through implementation and tests.
- Full extraction would be disproportionate for the hackathon scope.

---

## Consequences

Positive:

- Avoids weakening existing browser/extension JWT security.
- Gives a clear implementation target for NFR Design and Code Generation.
- Keeps security-critical logic testable and formally modeled.

Tradeoffs:

- Infrastructure Design still must resolve the exact AgentCore-to-adapter invocation path.
- Code Generation must carefully align TypeScript implementation with the Lean model.
- U-V3-02 must still expand the concrete tool registry and schemas.
