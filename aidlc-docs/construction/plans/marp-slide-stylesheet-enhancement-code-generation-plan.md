# Marp Slide Stylesheet Enhancement Code Generation Plan

## Unit Context

- **Unit name**: `marp-slide-stylesheet-enhancement`
- **Workspace root**: `/Users/harukikondo/git/AWS-SummitHackathon-2026`
- **Project type**: Brownfield TypeScript monorepo.
- **Primary application code**: `pkgs/backend/src/marp/MarpSlideService.ts`
- **Primary tests**: `pkgs/backend/src/__tests__/marp/MarpSlideService.test.ts`
- **Documentation output**: `aidlc-docs/construction/marp-slide-stylesheet-enhancement/code/`

## Dependencies and Boundaries

- Uses existing `@marp-team/marp-core` dependency.
- No new runtime dependency.
- No request or response schema change.
- No Slack posting behavior change.
- No S3 bucket, IAM, or infrastructure change.
- Existing authentication and approval boundaries remain unchanged.

## Story / Requirement Traceability

- Requirement: More polished generated Marp visual design.
- Requirement: Keep generated HTML self-contained.
- Requirement: Keep fallback/no-Bedrock output visually representative.
- Requirement: Preserve existing API, MCP, S3, and Slack behavior.

## Code Generation Steps

1. [x] Update Marp generation prompt in `MarpSlideService`.
   - Require custom `style: |` theme in generated Marp frontmatter.
   - Instruct Bedrock to use slide classes such as `title`, `section`, `lead`, `dark`, and `ending`.
   - Encourage varied layouts using `.columns`, `.card`, `.highlight`, `.number`, and `.tag`.

2. [x] Add reusable embedded Marp theme CSS in `MarpSlideService`.
   - Keep CSS local to the generated markdown.
   - Use a polished, restrained theme based on the local Marp skill guidance.
   - Avoid external fonts, scripts, or remote assets.

3. [x] Update fallback fixture deck generation.
   - Use `theme: saborou-premium`.
   - Embed the reusable theme CSS in frontmatter.
   - Add representative title, section, cards, highlight, summary, CTA, and ending slides.

4. [x] Improve rendered HTML preview wrapper.
   - Replace the minimal dark page background with a higher-quality preview shell.
   - Preserve full responsiveness for rendered Marp SVG output.
   - Keep the uploaded HTML document self-contained.

5. [x] Add focused backend tests.
   - Verify `createSlides` succeeds without Bedrock and returns expected metadata.
   - Verify uploaded HTML, when S3 is stubbed, contains the custom theme marker and preview wrapper marker.
   - Verify title HTML escaping remains effective.

6. [x] Generate code summary and run verification.
   - Create `aidlc-docs/construction/marp-slide-stylesheet-enhancement/code/code-generation-summary.md`.
   - Run targeted backend tests.
   - Run backend typecheck.
   - Run backend build.

## Security Baseline Compliance

| Rule | Status | Rationale |
|---|---|---|
| SECURITY-01 | N/A | No storage resource changes. |
| SECURITY-02 | N/A | No network intermediary changes. |
| SECURITY-03 | Compliant | No new sensitive logging. |
| SECURITY-04 | N/A | Static generated HTML styling only; no new endpoint/header path. |
| SECURITY-05 | Compliant | Existing Zod input validation remains unchanged. |
| SECURITY-06 | N/A | No IAM changes. |
| SECURITY-07 | N/A | No network configuration changes. |
| SECURITY-08 | Compliant | Existing auth middleware and Slack approval checks remain unchanged. |
| SECURITY-09 | Compliant | No default credentials or public access changes. |
| SECURITY-10 | Compliant | No dependency changes. |
| SECURITY-11 | Compliant | Change remains inside existing Marp service boundary. |
| SECURITY-12 | N/A | No authentication or credential changes. |

## Approval Status

- [x] Code Generation Part 1 approved.
