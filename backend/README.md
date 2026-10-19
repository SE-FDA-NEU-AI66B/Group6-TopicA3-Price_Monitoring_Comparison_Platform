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
