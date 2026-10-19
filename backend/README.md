# PriceLens backend structure

Where backend code belongs. Setup and run instructions are in `docs/SETUP.md`; API contracts are in `docs/design.md` Section 3.

```text
backend/src/
├── server.js        process startup, listen, graceful shutdown
├── app.js           Express composition: middleware, then mount each module under /api/...
├── config.js        environment variables are read and validated here
├── middleware/      cross-feature request handling (authenticate, error-handler)
├── db/              the one shared PostgreSQL pool (pool.js)
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

- **Identity:** `authenticate` sets `request.user` from the signed session cookie. `user_id` is never read from the request body, query or path.
- **Ownership:** pass `request.user.user_id` down to the repository and enforce it in the SQL predicate (for example `WHERE tp.user_id = $1`), as `watchlist.repository.js` does. A missing and an unowned resource return the same 404. Shared ownership helpers and transaction conventions are planned in #133; do not invent a different approach per feature.
- **Database:** import `pool` from `db/pool.js`. Never `new Pool()`.
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
