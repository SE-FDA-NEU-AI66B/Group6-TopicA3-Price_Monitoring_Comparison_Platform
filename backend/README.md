# PriceLens backend structure

Where backend code belongs. Setup and run instructions are in `docs/SETUP.md`; API contracts are in `docs/design.md` Section 3.

```text
backend/src/
├── server.js        process startup, listen, graceful shutdown
├── app.js           Express composition: middleware, then mount each module under /api/...
├── config.js        environment variables are read and validated here
├── middleware/      cross-feature request handling (authenticate, error-handler)
├── db/              the one shared PostgreSQL pool, query and transaction helpers (pool.js)
├── database/        db:init tooling only: migrations/, seeds/, init-database.js
├── background/      internal processors with no public HTTP routes
├── shared/          cross-feature problem definitions and request-validation helpers
└── modules/<feature>/
```

## Feature modules

One folder per feature under `modules/`, files named `<feature>.<layer>.js`. Add only the layers a feature needs.

| File | Responsibility | Must not |
|---|---|---|
| `<feature>.routes.js` | HTTP method and path, attach middleware, read validated input, call the service or repository, send the `data`/`meta` response, `next(error)` on failure. | Contain SQL, business rules, transactions, password or JWT handling. |
| `<feature>.validation.js` | Request shape, parameter and query syntax checks. Throws through the shared error handling. | Touch the database. |
| `<feature>.service.js` | Business rules, multi-step logic, coordinating repositories, transactions. Needed only when a feature has real rules. | Use Express `request`/`response`. |
| `<feature>.repository.js` | Parameterized SQL through the shared pool. Takes plain values, returns rows. | Create a pool, read `process.env`, read cookies, use Express objects. |
| `<feature>.test.js` | Tests for that module, next to it (shared test setup: #135). | |

A simple read-only feature is just routes + repository (`modules/watchlist/`). A feature with rules uses all four layers (`modules/auth/`). A background job has a service and repository but no routes.

A module is mounted once, in `app.js`. Modules never call `listen`.

## Request flow

```text
request -> route -> authenticate (if protected) -> validation -> service (if needed)
        -> repository -> db/pool.js -> PostgreSQL -> route sends { data, meta? }
any layer throws -> error-handler -> application/problem+json
```

## Rules that apply to every module

- **Identity:** `authenticate` verifies the signed `pricelens_session`, resolves an active database user and sets the public `request.user` context (`user_id`, `email`, `display_name`). `user_id` is never read from the request body, query, path or headers for ownership decisions.
- **Ownership:** pass `request.user.user_id` to `requireOwnedTrackedProduct` in `modules/tracked-products/tracked-product.service.js`. Its repository query predicates on both `tracked_product_id` and `user_id`, so missing and unowned records produce the same `TRACKED_PRODUCT_NOT_FOUND` response without an existence-revealing global lookup.
- **Database:** import `query` or `withTransaction` from `db/pool.js`. Never create another `Pool`. `query` translates persistence failures through the shared problem layer. `withTransaction` acquires one client, runs `BEGIN`/callback/`COMMIT`, attempts `ROLLBACK` on failure, always releases the client and preserves application errors while safely translating persistence errors.
- **Errors:** use a factory from `shared/problems.js`; the central `error-handler` is the only place that formats `application/problem+json`. Do not send ad-hoc error bodies from a route.
- **Validation:** feature validation modules compose the small helpers in `shared/validation.js`. Malformed request values use `400 INVALID_REQUEST`; feature services decide documented `409` and `422` outcomes.
- **Persistence failures:** translate only known PostgreSQL constraints with `translatePersistenceError`. Unknown database failures remain a safe `500 INTERNAL_SERVER_ERROR`; raw PostgreSQL fields never enter the response.
- **Config:** import `config` from `config.js`. New code does not read `process.env` directly.
- **Reference modules:** `modules/watchlist/` (routes + repository) and `modules/auth/` (routes + validation + service + repository).

## Problem responses

`shared/problems.js` owns the stable status, `type`, title, code and default detail tuples from `docs/design.md`. An optional field-level `errors` array uses this shape:

```json
[{ "field": "url", "reason": "unsupported_or_invalid" }]
```

Throw or pass the shared `HttpError` to `next(error)`. Internal `cause` and stack information are available only to server-side logging and are never serialized for the client. Missing and unowned tracked products both use `trackedProductNotFound()`; #133 owns the shared ownership lookup itself.

## Deterministic P0 seed fixtures

Run `npm run db:init` to create or restore the fixture state. The primary M2 account remains `demo@pricelens.local` with its documented password and exactly 10 Watchlist records. The isolated BR1 account is `alert-boundary@pricelens.local` and uses the same local-only demo password.

Generated BIGINT IDs are not fixture contracts. PostgreSQL sequences may advance during re-initialization, and seed-owned observations, alerts and notifications may receive new IDs when rebuilt. Downstream tests must locate fixtures by stable values such as email, `canonical_key`, `variant_key`, normalized URL and fixed timestamp rather than asserting numeric IDs.

| Scenario | User | Stable product / variant or URL | Fixture purpose |
|---|---|---|---|
| US02-A | demo | `apple-macbook-air-m2` / `8gb-256gb-midnight` | Exactly 30 daily VND observations, 2026-09-20 through 2026-10-19. |
| US02-B | demo | `amazon-kindle-paperwhite` / `16gb-black` | Exactly one observation. |
| US02-C | demo | `sony-wh-1000xm5` / `black` | Owned tracked product with zero observations. |
| US03-A/B | demo | `dell-xps-13-9340` / `16gb-512gb-silver` | Current price `34990000.00` VND; supports valid-below, zero, equal and above-current target submissions. |
| US03-C | alert-boundary | `apple-iphone-15` / `512gb-black` | Exactly 20 active alerts; targets `10500000.00`–`20000000.00` VND against current price `29900000.00`. |
| US04-A/C | demo | `https://techmart.example/apple-iphone-15-128gb-black` | Active supported source plus canonical tracked URL for BR6 duplicate-normalization tests. |
| US04-B | — | `apple-iphone-15` variants `128gb-black`, `256gb-black`, `512gb-black` | Three unambiguous exact variants for resolver selection. |
| US05 | demo | `https://gadget-world.example/nintendo-switch-oled-white` | Target `8000000.00` VND; ordered prices `8500000`, `7900000`, `7800000`, `8200000`, `7950000`; two pre-seeded historical notification records for the expected crossings. |
| US09-A/C | demo | `apple-iphone-15` / `128gb-black` | TechMart and Digital Hub in stock; Gadget World exact match out of stock. |
| US09-B | — | `apple-iphone-15` / `256gb-black` | Similar Gadget World offer attached to a different variant and therefore excluded. |
| US09-D | demo | `dell-xps-13-9340` / `16gb-512gb-silver` | Exactly one available offer. |
| US09-E | demo | `xiaomi-robot-vacuum-s10` / `white` | Tracked product exists, but its only offer is out of stock. |

The seed uses fixed timestamps and VND `NUMERIC(14,2)` values. Its SQL validation block rejects drift in the 30/1/0 history counts, 20-alert boundary, threshold sequence, exact-variant offer counts, stock states and M2 Watchlist count.

The US05 rows describe deterministic historical fixture state only. The seed does not evaluate transitions or generate runtime notifications; the downstream US05 service/background processor remains responsible for detecting price crossings and persisting notifications during application execution.

## US02 price-history API

`GET /api/tracked-products/:tracked_product_id/price-history` requires the existing session cookie and derives ownership from `request.user.user_id`. Missing and unowned IDs both return `404 TRACKED_PRODUCT_NOT_FOUND`; malformed IDs use the shared `400 INVALID_REQUEST` response.

The response reads real `price_observations` for the tracked source's currency and exact `product_variant_id`. It covers the previous 30 complete UTC calendar days (`from_date` and `to_date` are inclusive display dates), groups by UTC date, selects the lowest `IN_STOCK` amount for each day, and orders points chronologically. No missing date is synthesized. The summary minimum and maximum come from those daily values; current uses the existing M2 definition: the lowest price among each matching offer's latest `IN_STOCK` observation in the tracked currency.

```json
{
  "data": {
    "tracked_product_id": "<runtime string ID>",
    "range": {
      "days": 30,
      "from_date": "2026-09-20",
      "to_date": "2026-10-19",
      "timezone": "UTC"
    },
    "status": "AVAILABLE",
    "message": null,
    "points": [
      { "date": "2026-09-20", "amount": "23990000.00" },
      { "date": "2026-10-19", "amount": "20890000.00" }
    ],
    "summary": {
      "minimum": "20890000.00",
      "maximum": "23990000.00",
      "current": "20890000.00",
      "currency_code": "VND"
    }
  }
}
```

Exactly one point returns `INSUFFICIENT_DATA` with `"Insufficient data for a 30-day chart"` and keeps its point and summary. Zero points returns `NO_HISTORY` with `"No price history available"`, `points: []` and `summary: null`. At least two points returns `AVAILABLE` with `message: null`.

## US03 price-alert creation API

`POST /api/tracked-products/:tracked_product_id/alerts` requires the existing session cookie and accepts only `{ "target_price": "decimal string" }`. The tracked product must belong to `request.user.user_id`. The backend derives the tracked source currency, then selects the lowest latest `IN_STOCK` observation for the same exact variant and currency. The client does not supply the current price, currency, status or threshold state.

A successful request returns `201` with the public `PriceAlert` representation:

```json
{
  "data": {
    "price_alert_id": "<runtime string ID>",
    "tracked_product_id": "<runtime string ID>",
    "target_price": "30000000.10",
    "currency_code": "VND",
    "status": "ACTIVE",
    "current_price": "34990000.00",
    "created_at": "<ISO 8601 UTC timestamp>"
  }
}
```

The insert stores `ACTIVE`, `ABOVE_TARGET`, the derived currency and the exact supporting `price_observation_id`; it does not create a notification. PostgreSQL `NUMERIC` performs the authoritative positive/below-current comparisons. The same transaction locks the authenticated user's `users` row with `FOR UPDATE`, counts that user's `ACTIVE` alerts and inserts only when the count is below 20. Concurrent alert creations for one user therefore serialize around the BR1 count and insert.

Stable failures for the #145 frontend are:

- `400 INVALID_REQUEST` for a malformed identifier, body, type or decimal string.
- `401 AUTHENTICATION_REQUIRED` when no valid session exists.
- `404 TRACKED_PRODUCT_NOT_FOUND` for both missing and unowned tracked products.
- `409 CURRENT_PRICE_UNAVAILABLE` — `No valid in-stock current price exists, so BR2 cannot be evaluated.`
- `409 ACTIVE_ALERT_LIMIT_REACHED` — `Maximum 20 active alerts reached`
- `422 TARGET_PRICE_NOT_POSITIVE` — `Target price must be greater than 0`
- `422 TARGET_PRICE_NOT_BELOW_CURRENT` — `Target price must be lower than the current price`

Each newly created alert begins with `status = ACTIVE`, `last_threshold_state = ABOVE_TARGET`, the accepted decimal `target_price`, the derived `currency_code`, and the supporting `price_observation_id`. Threshold-transition evaluation and notification creation remain outside API-05 and are owned by the internal price-observation processor below.

## US05 price-observation processor

`background/price-observation/price-observation.processor.js` exports the internal `processPriceObservation(acquisitionResult)` entry point. It is called by a trusted acquisition source or a test/command harness; there is deliberately no shopper-facing trigger endpoint and no scraper, queue, scheduler or email provider in this issue.

A successful acquisition uses this shape:

```js
import { processPriceObservation } from './src/background/price-observation/price-observation.processor.js';

const result = await processPriceObservation({
  retailerOfferId: '<runtime retailer_offer_id>',
  acquisitionStatus: 'SUCCEEDED',
  priceAmount: '13900000.00',
  currencyCode: 'VND',
  availabilityStatus: 'IN_STOCK',
  observedAt: '2026-10-20T08:00:00.000Z',
});
```

Use a runtime offer ID resolved from a normalized URL; generated IDs are never fixture contracts. A failed acquisition supplies `retailerOfferId`, `acquisitionStatus: 'FAILED'`, `observedAt` and `failureReason`; it may advance refresh metadata but never inserts price history or evaluates alerts.

For a valid success, one transaction locks the offer's exact variant, derives the previous current price, inserts the immutable observation, derives the new current price, locks matching `ACTIVE` alert rows and applies BR4. Current price reuses API-02/API-05 semantics: the lowest of each exact-variant, same-currency offer's latest `IN_STOCK` observation. Numeric comparison remains in PostgreSQL. An exact retry returns `DUPLICATE`; an older inserted event returns `OUT_OF_ORDER` and is retained as history without regressing alert state. If the new current price is unavailable, no crossing is invented: the threshold state is preserved and its evaluation reference advances to the valid incoming observation.

An above-to-at-or-below crossing inserts one row in `notifications` with `delivery_status = 'PENDING'`, the alert and triggering observation IDs, a recipient email snapshot, subject `Price Drop Alert: <product name>`, and `qualified_at`. It does not set `sent_at`, `provider_message_id` or `failure_reason`. Remaining below creates no event; returning above resets the alert so a later downward crossing can create a new pending row. The database uniqueness constraint on `(price_alert_id, price_observation_id)` is the final duplicate guard.

### #147 delivery handoff

The delivery worker should claim/read pending rows from `notifications` and may join `price_alerts`, `price_observations`, `retailer_offers`, `retailers`, `tracked_products`, `product_variants` and `products` by the stored IDs. Every pending row already contains `notification_id`, `price_alert_id`, the triggering `price_observation_id`, `recipient_email`, `subject`, `delivery_status = PENDING` and `qualified_at`; the joins provide target price, currency, triggering amount/time, retailer and product context if the delivery template needs them. #147 owns provider delivery and the transition to `SENT` with `sent_at`/`provider_message_id`, or `FAILED` with `failure_reason`. It must not re-evaluate BR4.

### #148 demonstration handoff

Resolve an offer by stable normalized URL, invoke `processPriceObservation(...)` with the successful shape above, then inspect its `observation`, `previousCurrentPrice`, `newCurrentPrice`, `evaluatedAlertCount` and `notificationCount`. Confirm the pending event directly with a parameterized query such as `SELECT * FROM notifications WHERE price_alert_id = $1 AND price_observation_id = $2`. The deterministic PostgreSQL integration test in `background/price-observation/price-observation.integration.test.js` is the reproducible reference flow. US05 and parent #143 remain open until #147 delivery and #148 end-to-end proof are complete.

## US09 retailer-comparison API

`GET /api/tracked-products/:tracked_product_id/offers` requires the existing session cookie and derives ownership only from `request.user.user_id`. Missing and unowned IDs both return `404 TRACKED_PRODUCT_NOT_FOUND`; malformed IDs use the shared `400 INVALID_REQUEST` response.

The tracked product supplies the exact `product_variant_id`, and the latest valid observation on its source offer supplies the comparison currency. For every offer of that exact variant, API-06 considers only the offer's latest persisted observation. Only latest `IN_STOCK` observations in the source currency enter `offers`; an older in-stock observation cannot replace a newer out-of-stock state. PostgreSQL orders eligible offers by amount ascending and then retailer name ascending, and calculates every decimal `difference_from_lowest` without JavaScript floating-point arithmetic.

An available multi-source result has this shape (IDs are runtime strings, not fixture contracts):

```json
{
  "data": {
    "tracked_product_id": "<runtime string ID>",
    "product": {
      "product_id": "<runtime string ID>",
      "brand": "Apple",
      "model": "iPhone 15",
      "display_name": "Apple iPhone 15",
      "variant": {
        "product_variant_id": "<runtime string ID>",
        "display_name": "iPhone 15 128GB Black",
        "attributes": { "storage": "128GB", "color": "Black" }
      }
    },
    "status": "AVAILABLE",
    "message": null,
    "offers": [
      {
        "retailer_offer_id": "<runtime string ID>",
        "retailer": {
          "retailer_id": "<runtime string ID>",
          "source_code": "TECHMART",
          "name": "TechMart"
        },
        "amount": "19900000.00",
        "currency_code": "VND",
        "availability_status": "IN_STOCK",
        "observed_at": "2026-10-10T08:00:00.000Z",
        "url": "https://techmart.example/apple-iphone-15-128gb-black",
        "difference_from_lowest": "0.00"
      },
      {
        "retailer_offer_id": "<runtime string ID>",
        "retailer": {
          "retailer_id": "<runtime string ID>",
          "source_code": "DIGITAL_HUB",
          "name": "Digital Hub"
        },
        "amount": "20200000.00",
        "currency_code": "VND",
        "availability_status": "IN_STOCK",
        "observed_at": "2026-10-10T08:00:00.000Z",
        "url": "https://digital-hub.example/apple-iphone-15-128gb-black",
        "difference_from_lowest": "300000.00"
      }
    ],
    "lowest_offer": {
      "retailer_offer_id": "<same runtime ID as the first offer>",
      "retailer": {
        "retailer_id": "<runtime string ID>",
        "source_code": "TECHMART",
        "name": "TechMart"
      },
      "amount": "19900000.00",
      "currency_code": "VND",
      "availability_status": "IN_STOCK",
      "observed_at": "2026-10-10T08:00:00.000Z",
      "url": "https://techmart.example/apple-iphone-15-128gb-black",
      "difference_from_lowest": "0.00"
    }
  }
}
```

Exactly one eligible offer returns `SINGLE_OFFER`, keeps that offer as `lowest_offer`, gives it `difference_from_lowest: "0.00"`, and returns the exact message `"No multi-source comparison is currently available"`. No eligible in-stock offer returns `NO_AVAILABLE_OFFERS`, `message: null`, `offers: []` and `lowest_offer: null`. Out-of-stock observations remain stored for BR8 but are not exposed as eligible API-06 offers; full US10 presentation remains outside this endpoint's scope.

## US04 product registration API

Both US04 endpoints require the existing `pricelens_session` cookie and derive ownership only from `request.user`.

- `POST /api/product-sources/resolve` accepts `{ "url": "string" }`. It parses the URL without fetching it, removes only the documented `utm_source` tracking parameter, and resolves the normalized URL against active PostgreSQL retailer offers. Success returns `{ data }` with `normalized_url`, retailer and product identity, plus exact selectable variants containing string `product_variant_id` and `retailer_offer_id` values, display labels and attributes. Malformed or unsupported URLs return `422 INVALID_PRODUCT_URL` with `Unsupported or invalid product URL`.
- `POST /api/tracked-products` accepts `{ "retailer_offer_id": "string" }`. The backend derives the exact product, variant, retailer and normalized URL from that active offer, creates one authenticated-user row with `TRACKING`, and returns `201` plus a `Location` header. Missing selections return `404 RETAILER_OFFER_NOT_FOUND`; the per-user database uniqueness constraint remains the race-safe source for `409 DUPLICATE_TRACKED_URL` and `This product URL is already being tracked`.

Resolution uses the deterministic catalogue only: it performs no retailer HTTP request, scraping or arbitrary URL fetch. One untracked demo URL suitable for the #138 frontend flow after `db:init` is `https://digital-hub.example/apple-iphone-15-128gb-black`. Frontend code must submit the runtime `retailer_offer_id` returned by API-03 rather than hard-coding a generated ID.

## Automated testing convention

PriceLens uses Node's built-in `node:test`, `node:assert` and `fetch`; no second test framework or in-memory persistence layer is used. Run the complete suite from `backend/` with:

```bash
npm test
```

The normal command first loads `test-support/environment.js`, requires an explicit `TEST_DB_NAME`, verifies that it differs from the normal `DB_NAME`, and then runs test files serially with `--test-concurrency=1`. This prevents the seed reset from touching the development database and prevents PostgreSQL integration groups from racing with each other. Tests must still establish their own prerequisites and must not rely on execution order.

- Colocate focused unit tests with the production module as `<feature>.test.js`. Pure validation, service decisions and transaction mechanics may use small controlled doubles.
- Name PostgreSQL/HTTP tests `*.integration.test.js`. They use the real exported Express `app`, real authentication, the shared `db/pool.js` pool and real PostgreSQL fixtures.
- Keep all reusable test-only utilities in `src/test-support/`; do not add test routes, authentication bypasses, reset endpoints or feature-specific helper directories.
- Route tests arrange a seeded baseline and login, issue a real HTTP request, then assert status, content type, response/problem body and any relevant persisted effect. Restore the baseline after state-changing scenarios.
- Service tests cover decisions, orchestration and shared `HttpError` outcomes. A focused service double does not replace route/repository integration coverage.
- Repository integration tests cover parameter binding, ownership predicates, row shapes and PostgreSQL constraints; they do not duplicate the complete business rule.

### Shared test support

| Module | Reusable contract |
|---|---|
| `test-support/environment.js` | npm preload that selects the explicit `TEST_DB_NAME`, rejects a missing designation and rejects reuse of the normal `DB_NAME`. |
| `test-support/server.js` | `withTestServer(app, operation)` listens on an ephemeral port and always closes the server. |
| `test-support/request.js` | `requestJson`, `loginAs` and `authenticatedRequest`; `loginAs` calls the real login endpoint and captures only the real `pricelens_session` cookie. |
| `test-support/database.js` | `prepareSeededDatabase({ confirmedDatabaseName })` explicitly runs the existing `db:init` path. It requires `NODE_ENV=test`, requires configured `DB_NAME` to equal the explicit `TEST_DB_NAME`, requires that test name to differ from the normal application database, and requires an exact confirmation. Importing it never resets data. |
| `test-support/fixtures.js` | Natural-key resolvers, P0 scenario keys, local demo users and reusable owned/unowned tracked-product relationships. Missing or ambiguous singular fixtures fail clearly. |
| `test-support/assertions.js` | `assertProblemResponse` validates the real `application/problem+json` shape; `assertProblemCode` adds a concise stable-code assertion. Optional fields are checked only when relevant. |

HTTP tests do not claim isolation through a transaction opened on a different client: application requests may use any pool connection. The shared convention restores the #134 baseline in the separately designated `TEST_DB_NAME` before a DB-mutating integration group, uses targeted cleanup or another explicit restore after test-created state, and closes the shared pool in the test file's `after` hook. `prepareSeededDatabase` reuses the existing initializer and seed; it does not create a second migration, seed system, pool or dataset.

All fixture lookups start from stable keys. Use `userByEmail`, `variantByNaturalKey`, `offerByNormalizedUrl`, `observationByOfferAndTime`, `trackedProductByOwnerAndUrl`, or the collection resolvers in `fixtures.js`; use returned BIGINT IDs as strings only for the current test. Never encode a generated numeric ID as a fixture contract. `ownedAndUnownedTrackedProducts()` supplies a demo-owned record and a boundary-user record without changing ownership.

### Downstream P0 test recipe

1. In a `*.integration.test.js`, call `prepareSeededDatabase({ confirmedDatabaseName: config.database.name })` explicitly.
2. Resolve the required scenario through `P0_FIXTURE_KEYS` plus the natural-key resolver: US02 history observations, US03 current-price/boundary alerts, US04 normalized URL/variant, US05 fixed observations and historical notification rows, or US09 exact-variant offers.
3. Use `withTestServer(app, ...)`, then `loginAs(baseUrl, TEST_USERS.demo)` and `authenticatedRequest(session, path, options)`. Never use a submitted `user_id` as identity.
4. Assert JSON success directly, or call `assertProblemResponse`/`assertProblemCode` for a production problem. Exact `detail` remains available where a requirement fixes its wording.
5. For ownership, pass IDs returned by `ownedAndUnownedTrackedProducts()` to the production ownership service/repository. Missing and unowned resources must retain the same not-found outcome.
6. If the test writes state, clean it deterministically or restore the seeded baseline; close the shared pool in `after(() => closePool())`.

`test-support/reference.integration.test.js` is the compact working example. The two US05 notifications it resolves are historical seed state only; downstream US05 tests must still verify runtime threshold evaluation and notification generation in the eventual feature implementation.
