# U-V3-04 Functional Design Plan: elevenlabs-registration-fallback

**Created**: 2026-06-17
**Stage**: Construction / Functional Design
**Unit**: U-V3-04 elevenlabs-registration-fallback

## Context

U-V3-04 aligns the voice integration with the actual ElevenLabs Dashboard remote MCP registration surface. The primary path is a registered remote MCP server using `streamable_http`. An `sse` bridge is allowed only if real compatibility testing proves `streamable_http` is blocked. Browser `clientTools` remain fallback and UI support, not the primary MCP path.

## Plan Checklist

- [x] Step 1: Load U-V3-04 unit definition and story mapping.
- [x] Step 2: Load v3 requirements and application design decisions for ElevenLabs remote MCP registration.
- [x] Step 3: Verify Functional Design stage is required for fallback behavior and UI state decisions.
- [x] Step 4: Determine whether clarification questions are required.
- [x] Step 5: Define domain entities for remote MCP registration, transport decision, and fallback invocation.
- [x] Step 6: Define business rules for primary MCP registration, fallback eligibility, pseudo path neutralization, and secret-safe configuration.
- [x] Step 7: Define business logic flows for Dashboard registration, transport compatibility decision, extension fallback, and safe error handling.
- [x] Step 8: Define frontend/extension component state and interaction expectations.
- [x] Step 9: Validate generated markdown content before file creation.
- [x] Step 10: Update `aidlc-state.md` and append `audit.md`.

## Clarification Decision

No additional questions are required for Functional Design. The governing decisions are already explicit in v3 Requirements, Application Design, and U-V3-04 Unit of Work:

- ElevenLabs Dashboard remote MCP registration is the primary integration path.
- `streamable_http` is the first target.
- `sse` is conditional fallback only after real compatibility verification blocks `streamable_http`.
- Browser `clientTools` remain fallback/UI support.
- Direct Hono fallback remains for demo resilience.
- No ElevenLabs or SABOROU secrets may be exposed in browser logs or configuration output.

## Content Validation

- Mermaid diagrams: none.
- ASCII diagrams: none.
- Markdown tables: simple pipe tables only.
- Code blocks: none requiring parser execution.
- Special characters: MCP paths and tool names are enclosed in backticks.
