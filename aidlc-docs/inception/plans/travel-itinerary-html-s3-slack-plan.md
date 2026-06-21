# Travel Itinerary HTML S3 Slack Plan

## Request

旅行プラン生成後、SlackにMarkdown本文を直接投稿するのではなく、スタイル付きHTMLの「旅のしおり」を生成してS3へ格納し、Slackには公開URLを投稿する。

## Current Implementation

- `TravelPlanSlackPostService` calls `TravelPlanningService.plan()`.
- `slackMarkdown.ts` converts the generated plan to Slack mrkdwn.
- Slack receives the full formatted travel plan text.
- Existing Marp flow already has a related S3 upload pattern, but it returns a pre-signed URL from a private bucket.

## Recommended Architecture

Use a private S3 bucket plus CloudFront Origin Access Control.

- S3 bucket: private, encrypted, SSL enforced, public access blocked.
- CloudFront: public HTTPS URL for itinerary HTML, OAC access to S3, response security headers, access logging.
- Backend: generate escaped HTML and upload it as `text/html; charset=utf-8`.
- Slack: post a short message with the CloudFront URL, not the full itinerary body.

Avoid S3 public-read objects. It conflicts with the active Security Baseline and is harder to control or audit.

## Affected Components

- Backend travel service:
  - `pkgs/backend/src/travel/TravelPlanSlackPostService.ts`
  - Replace or deprecate `pkgs/backend/src/travel/slackMarkdown.ts`
  - Add `pkgs/backend/src/travel/travelItineraryHtml.ts`
  - Add `pkgs/backend/src/travel/TravelItineraryPublisher.ts`
- Backend schema/config/wiring:
  - `pkgs/backend/src/travel/schemas.ts`
  - `pkgs/backend/src/config/env.ts`
  - `pkgs/backend/src/index.ts`
- MCP/OpenAPI surface:
  - `pkgs/backend/src/mcp/registry.ts`
  - `pkgs/backend/src/mcp/schemas.ts`
  - `pkgs/backend/src/routes/mcp.ts`
  - `pkgs/backend/src/routes/mcp-jsonrpc.ts`
  - `pkgs/cdk/schemas/saborou-openapi.yaml`
- Infrastructure:
  - `pkgs/cdk/lib/stacks/data-stack.ts`
  - `pkgs/cdk/lib/stacks/api-stack.ts`
  - CDK tests for S3, CloudFront, IAM, and environment variables.
- Tests:
  - `pkgs/backend/src/__tests__/travel/TravelPlanSlackPostService.test.ts`
  - New renderer/publisher tests.
  - Existing route and MCP tests.

## Implementation Plan

- [x] Create `travelItineraryHtml.ts`
  - Render summary, flights, hotels, activities, assumptions, and booking links into a complete HTML document.
  - Apply inline or embedded stylesheet for a travel-guide look.
  - Escape all text with `escapeHtml`.
  - Sanitize outbound URLs and disallow non-HTTP(S) links.
  - Redact credential-like markers before rendering.

- [x] Create `TravelItineraryPublisher`
  - Accept HTML and upload to S3 with `PutObjectCommand`.
  - Use key format like `travel-itineraries/YYYY/MM/DD/<uuid>.html`.
  - Set `ContentType: text/html; charset=utf-8`, `ContentDisposition: inline`, and reasonable `CacheControl`.
  - Return `${TRAVEL_ITINERARY_PUBLIC_BASE_URL}/${key}`.

- [x] Update `TravelPlanSlackPostService`
  - Keep `approved === true` gate.
  - Keep clarification behavior: do not upload or post when required trip fields are missing.
  - Generate HTML after successful planning.
  - Upload HTML and obtain public URL.
  - Post only a concise Slack message with the URL and basic title/summary.
  - Preserve User Token first, Bot Token fallback.
  - Map upload failures to a safe `502 TRAVEL_ITINERARY_PUBLISH_ERROR`.
  - Keep Slack failures as safe `502 SLACK_API_ERROR`.

- [x] Update response schemas
  - Add `itinerary: { url: string, objectKey?: string }`.
  - Replace or supplement `slack.textPreview` with a URL-focused preview.
  - Keep existing response shape backward-compatible where practical.

- [x] Update infrastructure
  - Add a dedicated private itinerary bucket.
  - Add CloudFront distribution with OAC to the itinerary bucket.
  - Add CloudFront response headers policy:
    - CSP allowing only required static HTML/CSS behavior.
    - HSTS, nosniff, frame denial, referrer policy.
  - Add CloudFront access logging bucket or equivalent logging configuration.
  - Inject `TRAVEL_ITINERARY_BUCKET_NAME` and `TRAVEL_ITINERARY_PUBLIC_BASE_URL` into the API Lambda.
  - Grant Lambda only `s3:PutObject` to `travel-itineraries/*`.

- [x] Update MCP/OpenAPI metadata
  - Change tool description from "posts formatted plan to Slack" to "publishes an HTML itinerary and posts its URL to Slack".
  - Keep side-effect and approval metadata unchanged.
  - Update JSON schema examples and OpenAPI route schema.

- [x] Update tests
  - HTML renderer escapes text and links.
  - HTML renderer redacts secrets and credential-like markers.
  - Publisher uploads correct content type, key prefix, and cache headers.
  - Slack post body contains the public URL and does not contain full itinerary Markdown.
  - User-token fallback behavior remains unchanged.
  - Clarification path performs no S3 upload and no Slack post.
  - S3 and Slack error mapping is safe.
  - CDK asserts bucket encryption, block public access, SSL enforcement, CloudFront OAC, response headers, logging, and least-privilege IAM.

## Security Baseline Compliance

- SECURITY-01: Applicable. S3 encryption and HTTPS-only access required.
- SECURITY-02: Applicable. CloudFront access logging required.
- SECURITY-03: Applicable. Do not log generated itinerary contents or credentials.
- SECURITY-04: Applicable. CloudFront response security headers required for HTML.
- SECURITY-05: Applicable. Existing Zod validation remains; HTML/link sanitization added.
- SECURITY-06: Applicable. Lambda IAM scoped to itinerary object prefix only.
- SECURITY-08: Applicable. Existing auth and approval gate remain required.
- SECURITY-09: Applicable. S3 public access stays blocked; public exposure is via CloudFront only.
- SECURITY-11: Applicable. Abuse case: accidental public sharing of sensitive trip details must be documented.
- SECURITY-12: Applicable only for existing token handling. No new hardcoded credentials.
- SECURITY-14: Applicable. CloudFront and Lambda error metrics should be observable.

## Open Decisions

- URL lifetime: permanent CloudFront URL vs expiring pre-signed URL. Recommended: CloudFront public URL because the user asked for a public URL.
- Deletion/retention: keep generated itineraries indefinitely vs lifecycle expiration. Recommended: lifecycle expiration after 30-90 days for privacy.
- Styling scope: single embedded stylesheet vs separate CSS object. Recommended: embedded stylesheet for atomic, portable itineraries.

## Verification Commands

- `pnpm --filter backend test`
- `pnpm --filter backend typecheck`
- `pnpm --filter backend build`
- `pnpm --filter cdk test`
- `pnpm --filter cdk build`

## Recommended Execution

This is a moderate cross-package enhancement.

- Execute Application Design: new renderer/publisher boundary and public URL delivery design are needed.
- Execute Infrastructure Design: new S3/CloudFront/logging/IAM resources are needed.
- Execute Code Generation: backend, schema, MCP/OpenAPI, tests, and CDK updates are needed.
- Execute Build and Test: backend and CDK verification are required.
- Skip User Stories unless stakeholder acceptance criteria need formalization.
- Skip Units Generation unless this is split into separate infra and backend workstreams.
