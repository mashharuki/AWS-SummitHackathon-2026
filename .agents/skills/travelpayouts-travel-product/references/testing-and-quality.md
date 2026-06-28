# Testing and Quality Guide

## Test Pyramid

Use four layers:

1. Unit tests for request builders, response normalization, signature/link helpers, and validation.
2. Contract tests with saved Travelpayouts-style fixtures for each API client.
3. Integration tests against a mock server that simulates errors, rate limits, and partial success.
4. Limited live smoke tests in a protected environment when credentials and API access are available.

CI should not depend on live Travelpayouts availability unless the user explicitly asks for live verification and provides safe credentials through the approved secret path.

## Fixtures to Keep

Create small sanitized fixtures for:

- Aviasales Data API success with `success: true`, `data`, prices, and link.
- Aviasales Data API error with `success: false`, empty data, and error message.
- GraphQL success and GraphQL errors array.
- Flight Search API 200 with `is_over: false` and then `is_over: true`.
- Flight Search API 304 no-new-results.
- Flight Search API 429 rate-limit response.
- Autocomplete response with city, airport, and country.
- Partner Links API full success.
- Partner Links API partial failure where top-level status is success but an individual link fails.
- Statistics API fields list.
- Statistics API query results with pagination and `total_rows`.
- Finance API balance and payment responses.
- Add-on feed entries for Airalo, Viator, Tiqets/WeGoTrip where used.

## Unit Test Targets

Request builders:

- Add token only server-side.
- Encode query params correctly.
- Preserve date formats.
- Include `market`, `currency`, `locale`, `types[]`, `directions`, `sub_id`, and `trs` where required.
- Reject Search API calls not marked as user initiated.

Response normalizers:

- Convert prices into decimal-safe money objects.
- Preserve original currency and source.
- Parse IATA codes, coordinates, local/UTC dates, and fare terms.
- Mark cached vs real-time data.
- Preserve `expires_at`, `last_update_timestamp`, `is_over`, pagination, and rate-limit headers.

Error mapping:

- 400, 401, 404, 429, 5xx.
- 304 as no update, not fatal error.
- Empty result as valid no-offer outcome.
- Partner-link per-item failure.

## Compliance Tests

For Aviasales Search API integrations, add tests or static checks for:

- Search endpoint exists only on server route/handler.
- Browser bundle does not include Travelpayouts token.
- Search request requires a user action/session marker.
- Results page includes full result rendering path.
- Book link generation is called only from explicit Book action.
- No preloading or bulk generation of booking links.
- Search result route is blocked from indexing, for example `robots.txt` disallow rule or equivalent metadata.
- No batch job or crawler calls Search API for data collection.
- No code path combines Search API output with another flight metasearch API.

## Rate Limit and Resilience Tests

Test:

- Reads `X-Rate-Limit`, `X-Rate-Limit-Remaining`, and `X-Rate-Limit-Reset` when present.
- Honors `Retry-After` for APIs that return it.
- Uses bounded exponential backoff for transient 5xx.
- Does not retry invalid 400 or invalid token 401.
- Degrades UI when a provider add-on feed is unavailable.
- Keeps successful partner-link conversions when other links in the same batch fail.

## Revenue Tracking Tests

Test:

- `sub_id` is generated consistently for campaign/channel/experiment/user-session strategy.
- Partner link rows store original URL, partner URL, marker, trs, brand, sub_id, status, and generated timestamp.
- Click and redirect events can join to booking statistics by `external_click_id` or `sub_id` where available.
- Statistics queries always include date filters and pagination.
- Finance API responses are restricted to admin/internal roles.

## Live Smoke Test Checklist

Run only with explicit permission and real credentials in a non-public environment:

- [ ] Autocomplete request for a common city returns expected IATA data.
- [ ] Data API or GraphQL route query returns JSON and handles currency/market.
- [ ] Partner links API converts one eligible long URL with a test `sub_id`.
- [ ] Statistics `get_fields_list` returns fields.
- [ ] Optional Search API smoke is triggered by a manual action and does not generate booking links until Book click.
- [ ] Logs redact token, marker-sensitive values, passenger info, and full finance details.

## Quality Gates

Before calling the implementation complete, verify:

- Build passes.
- Unit and contract tests pass.
- Browser bundle or static scan contains no API token.
- Search API compliance checks pass if Search API is present.
- Error cases are visible to support/ops with safe diagnostic codes.
- Documentation names the exact enabled APIs and credentials required.
