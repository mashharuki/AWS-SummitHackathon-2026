# U-V3-04 Tech Stack Decisions: elevenlabs-registration-fallback

## Decision Summary

U-V3-04 should use the existing extension, backend, CDK, and documentation stack. No new runtime dependency is required for NFR Requirements.

| Decision | Choice | Rationale |
|---|---|---|
| Primary ElevenLabs transport | `streamable_http` | Matches v3 Application Design and avoids implementing an unnecessary bridge before verification. |
| Conditional transport fallback | `sse` only after real compatibility failure | Keeps scope small and avoids maintaining two transport paths without evidence. |
| Browser local tool support | ElevenLabs SDK `clientTools` | Existing extension behavior remains useful for fallback/UI support. |
| Fallback API path | Existing Hono API with Cognito auth | Preserves server-side authorization and demo resilience. |
| Tool schema source | U-V3-02 registry-backed schema | Prevents duplicate or drifting tool contracts. |
| Secret handling | Existing auth/token boundaries plus explicit redaction checks | Avoids introducing browser-visible secrets. |
| Testing | Existing package test runners and targeted extension tests | Keeps verification aligned with repository conventions. |

## Accepted Decisions

### TD-U-V3-04-01: Use `streamable_http` As The First Dashboard Registration Type

`streamable_http` remains the first implementation and setup target.

Reason:
- ElevenLabs Dashboard supports it as a remote MCP server type.
- v3 Application Design selected it as primary.
- It avoids a custom bridge unless compatibility evidence requires one.

Implication:
- Setup docs and generated configuration must present `streamable_http` first.
- U-V3-05 must verify this path with real AWS/AgentCore/ElevenLabs.

### TD-U-V3-04-02: Defer `sse` Bridge Until Compatibility Evidence Exists

`sse` is not implemented by default.

Reason:
- Unit scope explicitly excludes implementing both transports if `streamable_http` passes.
- Maintaining two transports increases verification and security surface.
- The same MCP Tool Adapter and Tool Registry must be preserved if `sse` becomes necessary.

Implication:
- NFR Design should define a clean fallback pattern.
- Infrastructure Design should execute only if a new endpoint, bridge, or CDK output is actually needed.

### TD-U-V3-04-03: Keep Browser `clientTools` As Fallback/UI Support

The existing ElevenLabs SDK `clientTools` mechanism remains useful but is not the primary remote MCP path.

Reason:
- It preserves local demo resilience.
- It avoids breaking the extension voice UI.
- It gives operators a fallback when Dashboard registration is not yet verified.

Implication:
- Naming, comments, tests, and setup docs must not call `clientTools` the AgentCore remote MCP path.
- Fallback results must be visibly distinct from primary remote MCP verification.

### TD-U-V3-04-04: Use Existing Hono API For Direct Fallback

Direct fallback should continue through existing authenticated SABOROU routes.

Reason:
- Existing routes already carry Cognito authentication, validation, and side-effect approval behavior.
- This avoids adding a second authorization model in the browser.

Implication:
- Code Generation should reframe any pseudo MCP client implementation as fallback API behavior.
- Fallback must fail closed on auth/approval failure.

### TD-U-V3-04-05: Do Not Add New Dependencies For Redaction Unless Required

Use simple allowlisted display fields and existing test utilities first.

Reason:
- The requirement is primarily boundary clarity and redaction, not complex parsing.
- Avoiding dependencies reduces supply-chain risk.

Implication:
- If a new dependency is proposed during Code Generation, it must be justified, lockfile-backed, and reviewed under SECURITY-10.

## Rejected Alternatives

| Alternative | Reason Rejected |
|---|---|
| Make browser `clientTools` the primary integration | It is not ElevenLabs Dashboard remote MCP registration and does not prove AgentCore/remote MCP behavior. |
| Implement `sse` and `streamable_http` immediately | Adds surface area and test burden before evidence requires it. |
| Keep pseudo `/mcp/tools/saborou_*` as AgentCore MCP wording | This preserves GAP-V3-05 and misleads verification. |
| Store ElevenLabs or SABOROU secrets in extension config for convenience | Violates credential management and browser secret-safety requirements. |
| Duplicate tool schemas in extension setup code | Creates schema drift against the U-V3-02 registry. |

## Technology Risk Notes

- Actual ElevenLabs Dashboard compatibility must be proven in U-V3-05 with real services.
- If AgentCore Gateway cannot be registered as `streamable_http`, U-V3-04 must re-enter Infrastructure Design for an `sse` bridge.
- Extension fallback success is not a substitute for remote MCP success.
- Any new bridge must preserve U-V3-01 authorization and U-V3-02 schema/registry behavior.

## Security Baseline Impact

| Rule | Impact |
|---|---|
| SECURITY-03 | Structured, secret-safe diagnostic behavior is required. |
| SECURITY-05 | Existing schema validation remains authoritative for fallback calls. |
| SECURITY-08 | Existing server-side authorization remains mandatory. |
| SECURITY-09 | Browser-visible errors must not expose internals. |
| SECURITY-10 | No new dependencies by default; lockfile-backed review if changed. |
| SECURITY-11 | Primary/fallback separation is a secure design requirement. |
| SECURITY-12 | No secrets in extension config or logs. |
| SECURITY-13 | Registration setup traces to registry-backed artifacts. |
| SECURITY-14 | Diagnostic categories must support verification troubleshooting. |
| SECURITY-15 | Missing config and auth failures must fail closed or safe fallback. |
