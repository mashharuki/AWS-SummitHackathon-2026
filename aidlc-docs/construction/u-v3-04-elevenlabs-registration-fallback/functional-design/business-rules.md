# U-V3-04 Business Rules: elevenlabs-registration-fallback

## BR-U-V3-04-01: Dashboard Remote MCP Is Primary

The primary ElevenLabs integration path is the remote MCP server registered in the ElevenLabs Dashboard.

Browser `clientTools` must not be documented, named, or implemented as the primary MCP path.

## BR-U-V3-04-02: `streamable_http` Is The First Transport

The first registration target is `streamable_http`.

The system must not implement or prefer `sse` unless real compatibility testing documents that `streamable_http` cannot support the demo path.

## BR-U-V3-04-03: `sse` Is Conditional Fallback Only

If `sse` is selected, the reason must be explicit and traceable to verification evidence.

The `sse` fallback must front the same MCP Tool Adapter and Tool Registry semantics as the primary path. It must not create a separate tool contract or bypass U-V3-01 authorization.

## BR-U-V3-04-04: Pseudo `/mcp/tools/...` Paths Are Not Remote MCP

Extension assumptions that `/mcp/tools/saborou_*` represents AgentCore remote MCP are invalid.

Code Generation must remove, rename, or neutralize this assumption. Any direct Hono fallback route must be clearly labeled as fallback API behavior, not remote MCP registration.

## BR-U-V3-04-05: Browser `clientTools` Remain Fallback And UI Support

The extension may continue registering `clientTools` so the local browser experience and demo fallback remain usable.

Those callbacks must be treated as browser-side fallback that forwards to authenticated SABOROU API calls. They must not be required for ElevenLabs Dashboard remote MCP registration.

## BR-U-V3-04-06: Direct Hono Fallback Remains Usable

The existing direct Hono fallback must remain available for demo resilience unless later verification proves it is harmful.

Fallback behavior must preserve existing Cognito token use, route authorization, safe error mapping, and side-effect approval requirements.

## BR-U-V3-04-07: Secrets Must Not Be Exposed In Browser Config Or Logs

No setup view, log line, browser state, or generated guide may expose:
- ElevenLabs API key
- SABOROU Cognito JWT
- Slack token
- Google OAuth token
- raw Authorization header
- signed AgentCore or AWS request material

## BR-U-V3-04-08: Setup State Must Be Operator-Readable

The setup state must clearly distinguish:
- primary remote MCP configured
- primary remote MCP unverified
- fallback clientTools enabled
- fallback direct Hono API enabled
- transport fallback required
- missing configuration

Messages must be actionable without leaking secrets.

## BR-U-V3-04-09: Tool Contracts Come From U-V3-02 Registry

U-V3-04 must not redefine MCP tool schemas.

The registered remote MCP surface must use the U-V3-02 allowlist, schema catalog, approval metadata, and drift checks.

## BR-U-V3-04-10: Authorization Stays Server-Side

The extension must not use browser state or ElevenLabs conversation state as authority for user resource access.

Task, Slack, and Google resource authorization must still flow through authenticated SABOROU API/MCP behavior from U-V3-01 and U-V3-02.

## BR-U-V3-04-11: Safe Error Mapping Is Required For Fallback

Fallback failures must return bounded, non-secret messages. The UI may surface a diagnostic code, but not raw transport errors, stack traces, or full response bodies.

## BR-U-V3-04-12: Verification Owns Final Transport Confirmation

Functional Design selects `streamable_http` as primary, but U-V3-05 owns real AWS/AgentCore/ElevenLabs verification evidence.

If U-V3-05 finds incompatibility, U-V3-04 implementation may be revisited for an `sse` bridge.

## Security Baseline Mapping

| Rule | Applicability | U-V3-04 Compliance Direction |
|---|---|---|
| SECURITY-01 Encryption | N/A for Functional Design | No new persistence store or transport implementation is created in this stage. |
| SECURITY-02 Access Logging | Applicable Later | Real remote MCP and any fallback bridge must preserve access/audit logging requirements in NFR/Infrastructure stages. |
| SECURITY-03 Application Logging | Applicable | Fallback and setup diagnostics must be structured and secret-safe. |
| SECURITY-04 HTTP Security Headers | N/A | No HTML-serving endpoint is designed in this stage. |
| SECURITY-05 Input Validation | Applicable Later | Tool inputs remain governed by U-V3-02 schemas; no new tool schema is introduced here. |
| SECURITY-06 Least Privilege | Applicable Later | Any new bridge or endpoint in Infrastructure Design must preserve least privilege. |
| SECURITY-07 Network Configuration | N/A | No VPC or security group change is designed in Functional Design. |
| SECURITY-08 Access Control | Applicable | Browser fallback must not bypass server-side user authorization. |
| SECURITY-09 Hardening | Applicable | Errors and setup state must hide internals and secrets. |
| SECURITY-10 Supply Chain | Applicable Later | Code Generation must verify dependency changes if extension or MCP packages change. |
| SECURITY-11 Secure Design | Applicable | Primary/fallback separation prevents insecure reliance on browser callbacks as MCP authority. |
| SECURITY-12 Credential Management | Applicable | Browser-visible configuration must never expose ElevenLabs, Cognito, Slack, or Google secrets. |
| SECURITY-13 Integrity | Applicable Later | Registration artifacts must remain traceable to registry-backed schema outputs. |
| SECURITY-14 Monitoring | Applicable Later | Real verification and NFR stages must define observable setup/transport failures. |
| SECURITY-15 Fail-Safe Defaults | Applicable | Missing or invalid primary configuration must fall back safely or report unconfigured state without unsafe side effects. |

## Compliance Summary

Security Baseline is enabled for v3. Applicable Functional Design rules are satisfied by the business rules above. Later-stage rules are explicitly deferred to NFR Requirements, NFR Design, Infrastructure Design, or Code Generation where they become implementable. No blocking finding remains in this Functional Design artifact.
