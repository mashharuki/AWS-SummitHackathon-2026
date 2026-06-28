# Architecture and Implementation Guide

## Reference Architecture

Use this baseline for most Travelpayouts travel-planning products:

```text
Client UI
  -> Backend-for-Frontend
      -> Travelpayouts API clients
      -> Cache/store
      -> Affiliate link service
      -> Analytics ingestion
  -> Search results UI / itinerary UI / booking CTA
```

Keep all token-bearing API calls behind the backend. The client may call your backend, but must not call Aviasales Search API or token-protected Travelpayouts APIs directly.

## Modules

### `TravelpayoutsConfig`

Hold:

- `apiToken`
- `marker`
- `trsByBrand`
- `defaultCurrency`
- `defaultLocale`
- `defaultMarket`
- enabled brand integrations
- API base URLs for test/prod where applicable

Validate configuration at startup. Redact all secrets in logs.

### `FlightInsightClient`

Wrap Aviasales Data API and/or GraphQL.

Responsibilities:

- Normalize cached flight insight responses.
- Attach `source = "aviasales-data-api" | "aviasales-graphql"`.
- Preserve `expires_at` or freshness metadata where returned.
- Convert Travelpayouts errors into domain errors.
- Use gzip and conditional caching where framework support exists.

### `FlightSearchClient`

Wrap real-time Aviasales Flight Search API only after access is confirmed.

Responsibilities:

- Accept only user-initiated search commands.
- Support one-way, round-trip, and multi-city `directions`.
- Poll or refresh according to the API response model, handling 304 as no-new-data.
- Store search/session metadata server-side.
- Expose Book actions that generate booking links only after user click.

### `PlacesClient`

Wrap:

- Autocomplete places.
- Static city/airport/country/airline JSON files.
- `whereami` for default city hints.

Responsibilities:

- Cache static files locally.
- Normalize IATA codes and coordinates.
- Mark IP-derived locations as inferred.

### `PartnerLinkService`

Wrap partner links API and brand-specific link templates.

Responsibilities:

- Convert only eligible full-length URLs.
- Include `sub_id` for attribution.
- Persist original URL, partner URL, brand, marker, trs, sub_id, status, and error.
- Handle partial success; one failed link must not fail the whole batch unless the use case requires atomic behavior.

### `TravelMerchandisingService`

Compose add-on products:

- airport transfers
- car rentals
- day tours
- eSIM
- audio guides
- attraction widgets

Responsibilities:

- Keep each provider adapter optional and capability-flagged.
- Store provider-specific IDs separately from normalized product IDs.
- Preserve feed timestamps and source URL/version.

### `AffiliateAnalyticsService`

Wrap statistics and finance APIs.

Responsibilities:

- Pull fields list before building queries.
- Enforce mandatory date filters.
- Use narrow date ranges and incremental sync.
- Store raw rows separately from aggregated KPI tables.
- Restrict finance endpoints to admin/internal roles.

## Data Model Hints

### Itinerary

Include:

- origin/destination city and airport IATA codes
- date range and timezone
- traveler counts
- trip class
- budget and currency
- user locale and market
- recommendation source

### Offer

Include:

- provider and API source
- offer type: flight, car, transfer, tour, eSIM, attraction
- price amount/currency
- price freshness and expiry
- cancellation/refund/baggage/fare terms when available
- original provider URL
- affiliate URL, generated lazily where required
- tracking `sub_id`

### Search Session

Include:

- user action timestamp
- request parameters
- API response status
- result count
- rate-limit headers
- `is_over` or equivalent completion state
- user-visible filters

## Caching

Use different cache policies by API type:

- Static data files: refresh by scheduled job; serve from local cache.
- Autocomplete: short TTL by `term`, `locale`, and `types`.
- Data API/GraphQL: cache by route, dates, currency, market, and passengers when applicable; respect freshness/expiry fields.
- Search API: do not use as a data collection source. Cache only per user/session to support the active UI flow.
- Partner links: cache successful conversion by original URL, `marker`, `trs`, `sub_id`, and shortening mode.
- Statistics: use incremental sync by date window and updated timestamp when available.

## Error Handling

Map external errors into product-level outcomes:

- 401: invalid/missing token, misconfigured credentials.
- 400: invalid parameters or unsupported route/date.
- 404: wrong domain or endpoint.
- 429: rate limit; back off using response headers or `Retry-After`.
- 304: no new search results; keep current UI state.
- 5xx: transient provider issue; retry with bounded backoff.
- Empty data: valid no-offer state, not always an error.
- Per-link partner API failure: show/report conversion failure while preserving successful links.

## Security

- Never expose `X-Access-Token`, GetTransfer token, DiscoverCars credentials, marker-secret combinations, or finance API responses to public clients.
- Prefer server-side environment variables or managed secrets.
- Do not log full URLs if they include sensitive sub IDs or user data; log stable hashes and safe metadata.
- Passenger emergency contacts for transfers are personal data; collect only when needed and define retention.

## Implementation Checklist

- [ ] Confirm Travelpayouts account, API token, marker, project/trs IDs.
- [ ] Confirm brand program connections before building provider adapters.
- [ ] Choose Data API/GraphQL/Search API based on freshness and compliance needs.
- [ ] Implement typed clients with retry, timeout, rate-limit parsing, and redacted logs.
- [ ] Add cache layer with API-specific TTL and source metadata.
- [ ] Implement partner-link generation with per-link status and sub_id tracking.
- [ ] Add Search API compliance gates before real-time flight search is enabled.
- [ ] Add analytics ingestion with mandatory date filters and pagination.
- [ ] Add operational metrics for latency, 429 count, 401 count, empty-result rate, link failure rate, and conversion KPIs.
