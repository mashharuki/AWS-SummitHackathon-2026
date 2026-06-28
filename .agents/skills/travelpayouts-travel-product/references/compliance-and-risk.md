# Compliance and Risk Guide

## Search API Rules

Treat these as blocking design constraints for Aviasales Flight Search API:

- Every search request must be initiated by a user action.
- Search results must be shown to the user in full.
- Each flight option must include a Book button.
- Agency/booking links may be generated only after the user clicks Book.
- Automatic generation or preloading of booking links is prohibited.
- Automatic collection or scraping of Search API data is prohibited.
- Do not combine the Search API with APIs from other flight metasearch services.
- API requests must be sent from the server.
- Client-side Ajax requests to the Search API are not supported.
- Requests from localhost IP ranges are not allowed.
- Search results pages must be hidden from search bots, for example by disallowing `/search/` in `robots.txt`.

If a requested feature conflicts with any item above, stop and redesign the feature before implementing.

## Data API vs Search API Boundary

Use this rule:

- Content, inspiration, trends, popular routes, cached prices, static pages: Data API, GraphQL, or feeds.
- User-initiated real-time result page and multi-city flight search: Search API.

Do not use Search API to populate static SEO pages, data warehouses, price monitors, or automated content farms.

## Credential Risk

Secrets and sensitive identifiers:

- Travelpayouts API token
- GetTransfer access token
- DiscoverCars username/password/token
- marker and trs/project IDs when combined with private campaign strategy
- customer contact details
- finance/balance/payment data

Controls:

- Store tokens in environment variables or managed secrets.
- Redact from logs and errors.
- Keep API clients server-side.
- Use least-privileged internal access for finance endpoints.
- Do not paste real secrets into tests, fixtures, docs, or issue comments.

## Affiliate Link Risk

Partner links can fail per item even when the top-level API response succeeds.

Handle:

- Invalid token: fail the batch and alert configuration owners.
- Invalid trs or marker: fail fast; configuration problem.
- Invalid URL or unsupported brand: mark individual link failed.
- Not subscribed to brand: show provider unavailable or route to onboarding/admin action.

Keep original brand links until conversion succeeds, but do not expose non-affiliate purchase CTAs if the product's revenue model requires partner attribution.

## Price and Availability Risk

Travel prices can be cached, stale, missing, or unavailable by market.

UI and data handling:

- Label cached/informational prices differently from real-time results.
- Carry `expires_at`, update timestamp, or feed timestamp where available.
- Avoid guaranteeing final price until provider booking page confirms it.
- Store currency and market with every price.
- Support empty results without treating them as system failure.

## Personal Data Risk

Some integrations collect or process personal data:

- IP-based whereami.
- Transfer passenger contact details.
- Search sessions and tracking IDs.
- Finance/action metadata.

Controls:

- Explain and minimize IP-based personalization.
- Collect passenger details only at booking step.
- Define retention for contact data and search sessions.
- Do not log raw phone/email.
- Avoid using tracking IDs as direct user identifiers unless the product has consent and policy coverage.

## Pre-Implementation Risk Review

Before implementing, answer:

- Which APIs are enabled and which are only planned?
- Which endpoints need server-side credentials?
- Is any Search API use truly user initiated?
- Will any generated page be indexed by search engines?
- When is a Book/affiliate link generated?
- What cache TTL applies to each data source?
- What happens on 429, 401, empty results, expired price, and partner-link failure?
- How are sub_id and campaign attribution designed?
- Who can access statistics and finance data?
