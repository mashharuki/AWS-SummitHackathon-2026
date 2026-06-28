# Travelpayouts API Capability Map

Use this map to choose the smallest API surface that satisfies the product requirement.

## Source Notes

Based on Travelpayouts Help Center pages checked on 2026-06-20:

- API and data category: https://support.travelpayouts.com/hc/en-us/categories/200358578-API-and-data
- Aviasales Data API: https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API
- Aviasales Flight Search API: https://support.travelpayouts.com/hc/en-us/articles/30565016140434-Aviasales-Flight-Search-API-real-time-and-multi-city-search
- Search API usage rules: https://support.travelpayouts.com/hc/en-us/articles/34788165535250-Search-API-usage-rules
- API rate limits: https://support.travelpayouts.com/hc/en-us/articles/4402565416594-API-rate-limits
- Partner links API: https://support.travelpayouts.com/hc/en-us/articles/25289759198226-API-for-Travelpayouts-partner-links

## Flight Data Choices

### Aviasales Data API

Use for:

- Price trends, popular destinations, cheapest cached tickets, static/semistatic content pages.
- Destination discovery before the user commits to an exact itinerary.
- SEO-friendly content that does not expose live Search API results.

Key constraints:

- Token via `X-Access-Token` header or `token` parameter.
- JSON response shape generally includes `success`, `data`, and `error`.
- Dates use `YYYY-MM` or `YYYY-MM-DD`; date/time values are UTC/ISO 8601.
- Prices may be cached and should carry freshness/expiration metadata in the product model.
- Prefer gzip response handling.

Important endpoints and concepts:

- `/aviasales/v3/prices_for_dates`: cheapest tickets for specific dates, current replacement for several older v1/v2 methods.
- `/aviasales/v3/get_latest_prices`: prices over a period.
- `market`: choose regional market deliberately; default market may not match the user's locale.

### Aviasales GraphQL

Use for:

- Fetching only selected fields from Flight Data API insights.
- Reducing request count when REST would require several calls.
- Building typed query modules for flight insight pages.

Key constraints:

- Endpoint: `https://api.travelpayouts.com/graphql/v1/query`.
- Token must be sent in `X-Access-Token`.
- Rate limit documented for `/graphql/v1/`.
- Use the playground/docs only with a valid token when exploring schema details.

### Aviasales Flight Search API

Use only when:

- The user explicitly initiates a real search.
- Real-time results or multi-city/open-jaw routes are required.
- The product can comply with booking flow and SEO restrictions.

Capabilities:

- One-way, round-trip, and multi-city routes through the `directions` array.
- Results include `terms`, `agents`, `airlines`, filter `boundaries`, `flight_legs`, `tickets`, proposals, baggage/fare terms, and `is_over`.
- Status codes include 200, 304, 400, 404, 429, and 5xx.

Hard boundaries:

- Send requests from the server, not browser Ajax.
- Do not use localhost IP ranges for API requests.
- Display search results in full.
- Generate booking/agency links only after a user clicks Book.
- Do not scrape, bulk collect, or combine with other flight metasearch APIs.

## Location and Autocomplete

### Autocomplete API

Use for city/airport/country input search.

Endpoint pattern:

```text
https://autocomplete.travelpayouts.com/places2?locale=en&types[]=airport&types[]=city&term=lond
```

Inputs:

- `term`: search text.
- `locale`: output language.
- `types[]`: `city`, `airport`, `country`.

Outputs:

- IATA `code`, `city_code`, `country_code`, names, coordinates, type, and search weighting fields.

### Whereami

Use for default departure city or localized onboarding.

Endpoint pattern:

```text
https://www.travelpayouts.com/whereami?locale=en&ip=95.90.254.107
```

Return values include nearest city IATA, name, country, country code, and coordinates. Treat IP-based location as a hint, not a verified travel preference.

### Static Flight Data Files

Use for local lookup tables:

- Countries: `/data/{locale}/countries.json`
- Cities: `/data/{locale}/cities.json`
- Airports: `/data/{locale}/airports.json`
- Airlines: `/data/{locale}/airlines.json`
- Alliances: `/data/{locale}/alliances.json`
- Planes and routes exist but may be marked as not updated.

Cache these files locally with a refresh job; do not call them per keystroke.

## Affiliate and Revenue APIs

### Partner Links API

Use to convert eligible direct brand URLs into partner links.

Endpoint:

```text
POST https://api.travelpayouts.com/links/v1/create
```

Request fields:

- `trs`: project/traffic source ID subscribed to the brand program.
- `marker`: Travelpayouts partner ID.
- `shorten`: whether to return short links.
- `links[]`: up to 10 full-length URLs, optional `sub_id`.

Limits and caveats:

- Maximum 100 requests per minute per marker.
- No more than 10 links per request.
- Use full-length brand links, not short brand links.
- Some brands are unsupported by this API; handle per-link failure results.

### Booking Statistics API

Use for dashboards, campaign performance, CVR, revenue, cancellation, and cohort reports.

Authentication:

- Token in `X-Access-Token`.

Main flow:

1. `GET /statistics/v1/get_fields_list` to discover fields, types, allowed filters, and program-specific fields.
2. `POST /statistics/v1/execute_query` with `fields`, mandatory date filter, optional campaign/type/state filters, `sort`, `offset`, `limit`, and optional `group`.

Design notes:

- Date filters materially affect speed; keep windows narrow.
- `limit` defaults to 100 and maxes at 10,000.
- Use `campaign_id`, `type`, and `state` filters when known.

### Balance and Payment API

Use for internal partner finance tooling, not traveler-facing flows.

Capabilities:

- Current balance: `/finance/v2/get_user_balance`
- Actions affecting balance: `/finance/v2/get_user_actions_affecting_balance`
- Next payout: `/finance/v2/get_user_next_payout`
- Payments: `/finance/v2/get_user_payments`
- Payout action details and action detail endpoints.

Security:

- Treat finance data as sensitive.
- Keep access server-side and restrict by role.

## Trip Planning Add-ons

### DiscoverCars

Use for car rental search if the partner has access. Access is by request and requires username, password, and token. Documented requirements include a travel-related website and significant monthly visitors. Model this as optional integration until credentials/access are confirmed.

### GetTransfer

Use for airport/city transfer planning and booking flow.

Key points:

- Access token from support; send `X-ACCESS-TOKEN`.
- Test and production environments differ.
- Route price checks require coordinates, local date/time, passenger count, and `with_prices=true`.
- Booking can proceed only when `book_now` offers are present.
- Transfer creation includes passenger emergency contact details, so apply privacy controls.

### Kiwi.com

Use only after checking the current partner program API details and access terms. It may overlap with flight search use cases, so avoid combining it with Aviasales Search API in ways that violate Search API data restrictions.

### Omio

Use as a static/popular destination or multimodal travel data source when the product needs inspiration or landing content rather than live booking. Verify current feed format before implementation.

### Tiqets

Use for attraction widgets and city/product ID mapping. Product IDs may be found from files or product URLs. This is usually a widget/feed integration, not a universal live tours API.

### WeGoTrip

Use for audio tours, attractions, city/product catalogs, reviews, languages, currencies, and partial-name search. Links generated by API must be converted into partner links through the program page or equivalent partner-link workflow.

### Viator

Use for discounted tours/deals feed. Access is provided by support and the downloaded gzip archive contains JSON entries with title, image, description, price, discount, category, and Viator page link.

### Airalo

Use for eSIM catalogs, country/region package discovery, and chatbot/channel price publishing.

Important:

- Partner must be connected to Airalo.
- Feed links are not affiliate links by default; convert them through Travelpayouts tooling or the documented template.
- Prefer the newer feed when available because it carries more fields.
