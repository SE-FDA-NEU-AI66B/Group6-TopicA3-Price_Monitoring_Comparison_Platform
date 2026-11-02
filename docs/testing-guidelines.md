# Testing Guidelines

Shared conventions for the PriceLens automated test suite. Every team member
follows these rules when writing tests for a P0 story.

Read this document fully before writing your first test. If a rule does not
fit your story, raise it with the team before changing it. Do not work around
it silently.

## 1. Toolchain

| Item | Decision |
|---|---|
| Test runner | Node.js built-in test runner (`node:test`) with `node:assert/strict` |
| Extra libraries | None. Do not add Jest, Mocha, Sinon or any mocking library. |
| Node version | `>=22`, as declared in `backend/package.json` |

## 2. Running the tests

From the repository root:

```bash
npm test
```

That single command runs every file in `tests/`. Its only prerequisite is
`npm --prefix backend ci` (see `docs/SETUP.md`).

It does **not** need a `.env` file, a running backend, a running frontend, a
PostgreSQL server, network access or a seeded database. Before any test file
loads, `tests/helpers/environment.js` sets every configuration value the
backend requires, ignoring any local `.env`. Its database host is
unresolvable on purpose, so a query that escapes the fake database fails
instead of reaching a real server.

Useful variations:

```bash
npm test -- --test-name-pattern="TC-US02"      # one story
npm test -- --test-name-pattern="TC-US03-04"   # one test case
npm test -- us02-price-history.test.js         # one file
```

The script runs from inside `tests/` and lets Node discover every
`*.test.js` file there, so extra options passed after `--` reach the test
runner. File names in the last example are relative to `tests/`.

The suite uses the `spec` reporter, so every test name (and therefore every
test case ID) is printed. The submission needs a screenshot of this full
output.

## 3. Directory layout

```
package.json                    # root scripts only, no dependencies
tests/
  helpers/
    environment.js              # test configuration, loaded before every test file
    fake-database.js            # shared fake database client (Section 7)
  us02-price-history.test.js
  us03-price-alert.test.js
  us04-add-product.test.js
  us05-notification.test.js
  us09-comparison.test.js
```

Rules:

- One file per story, named `usNN-<story-slug>.test.js`.
- Import production code by relative path, for example
  `../backend/src/modules/tracked-products/price-history.service.js`.
- A helper goes into `tests/helpers/` only if at least two story files use
  it. Otherwise, keep it local to your file. The answers a fake database
  gives are specific to one story, so they stay in that story's file. Helper file names must not end
  in `.test.js`, or the runner will treat them as test files.
- Do not create fixtures on disk (JSON, SQL). Build test data inline so the
  reader sees the input next to the assertion.

## 4. Test case IDs

Format: `TC-USNN-XX`

- `NN` is the story number with two digits: `US02`, `US03`, `US04`, `US05` or `US09`.
- `XX` is a two-digit sequence starting at `01`. Never reuse or renumber an
  ID once it is merged. If a case is removed, its number stays retired.

The ID must appear at the very start of the test name, so it is visible in
the runner output and searchable with `--test-name-pattern`:

```js
test('TC-US02-03 [boundary, just below] one daily point is insufficient for a chart', () => { ... });
```

## 5. Test kinds and minimum coverage

Each test case has exactly one kind:

| Kind | Meaning |
|---|---|
| `normal` | The input is accepted and the expected successful result is produced |
| `error` | A business rule refuses the input, with the exact rejection message or code |
| `boundary, just below` | The value immediately below a numeric limit |
| `boundary, on the limit` | The value exactly at the limit |
| `boundary, just above` | The value immediately above a numeric limit |

Minimum per story:

- at least **3** test cases;
- at least **1** `normal` case that succeeds and at least **1** `error` case
  where a business rule refuses the input;
- if the story's rule contains a number (a limit, a time or an amount),
  boundary cases on **both sides** of that number. Use `on the limit` plus
  the side that behaves differently; add the third point when it is cheap.

Numeric limits we already know about:

| Story | Rule | Inside the limit | Outside the limit |
|---|---|---|---|
| US02 | A chart needs at least 2 daily points | 2 points → `AVAILABLE` | 1 point → `INSUFFICIENT_DATA` |
| US02 | Window is the previous 30 complete UTC days | day 30 back is included | day 31 back and today are excluded |
| US03 | BR1: at most 20 active alerts | 19 active → creation allowed | 20 active → `Maximum 20 active alerts reached` |
| US03 | BR2: target strictly below current price | current − 1 VND → accepted | target = current → rejected |
| US03 | BR2: target above 0 | smallest positive amount → accepted | `0` → `Target price must be greater than 0` |
| US05 | BR4: notify when price reaches the target | price = target → one notification | price = target + 1 VND → no notification |
| US09 | A multi-source comparison needs at least 2 in-stock offers | 2 in-stock offers → `AVAILABLE` | 1 in-stock offer → `No multi-source comparison is currently available` |

US04 (BR6) has no numeric limit in its acceptance criteria, so boundary
cases are optional for it.

Use the exact user-facing messages from `docs/requirements.md` and
`docs/p0-acceptance.md`. Import the message constant from the service when
one exists (for example `NO_HISTORY_MESSAGE`). Never retype a message that
is already exported.

## 6. What to test at each layer

PriceLens has four layers. The suite targets the two layers that hold the
business rules.

| Layer | Where | How we test it in this suite |
|---|---|---|
| Services | `backend/src/modules/**/*.service.js`, `backend/src/background/**` | **Primary target.** Call the exported function directly with plain arguments. Assert on the returned object or the thrown `HttpError` (`status`, `code`, `detail`), for example with `await assert.rejects(promise, { status: 409, code: 'ACTIVE_ALERT_LIMIT_REACHED' })`. |
| Repository | `backend/src/modules/**/*.repository.js` | Exercised through the service under test, with the fake database client from Section 7 answering each query. Assert on the parameters sent and on how returned rows are mapped. Do not assert on full SQL text; assert only on the value that enforces the rule (for example the variant id). |
| Routes | `backend/src/modules/**/*.routes.js` | Not covered in this suite: routes hold no business rules and only map service results to HTTP responses. |
| Interface | `frontend/src/**` | Not covered in this suite: verified by hand in `docs/p0-acceptance.md`. |

Prefer **pure functions** first (for example `historyStatus`,
`assemblePriceHistory`, `createUtcHistoryRange`). Then call the real service
function with the fake database client from Section 7. **Do not change
production code just to make it testable** in a test PR. If a behaviour
only happens inside PostgreSQL (SQL sorting, constraints, `NUMERIC`
arithmetic), record it under "Known gaps" in `docs/testing.md`.

## 7. The fake database client

Services reach PostgreSQL through the shared pool, either with `pool.query`
or inside a transaction opened with `pool.connect`. `tests/helpers/fake-database.js`
replaces both for one test:

```js
import { createFakeDatabaseClient, useFakeDatabase } from './helpers/fake-database.js';

function createComparisonDatabase() {
  return createFakeDatabaseClient((sql, parameters) => {
    if (/SELECT po\.currency_code/.test(sql)) return [{ currency_code: 'VND' }];
    return undefined;   // any other statement fails the test
  });
}

test('TC-US09-02 ...', async (t) => {
  const client = useFakeDatabase(t, createComparisonDatabase());

  // call the real service function, then assert on its result
  // and on client.statements
});
```

- The answer function receives the trimmed SQL and its parameters and
  returns the rows. Recognise a statement by a short, distinctive fragment
  (a table alias or column name), not by its full text.
- `BEGIN`, `COMMIT` and `ROLLBACK` are answered by the helper. Any statement
  the answer function does not recognise throws, so a test fails loudly when
  the code sends a query the test did not expect.
- `client.statements` records `{ sql, parameters }` for every statement, for
  example to check that nothing was inserted or that a transaction ended in
  `ROLLBACK`.
- `useFakeDatabase(t, client)` mocks the pool through `t.mock`, so the
  original pool is restored automatically after each test.
- When a rule is a comparison written in SQL, read the operator from the SQL
  text and evaluate it with `COMPARISONS`, so changing `<` to `<=` in the
  query turns a test red.
- Return values exactly as PostgreSQL would return them through our queries:
  ids and money as **strings** (`'20890000.00'`).

## 8. Isolation rules

Each test must pass when run alone, in any order, on any day.

1. **No real database, server or network.** If a behaviour can only be
   checked against PostgreSQL, do not test it here; record it under "Known
   gaps" in `docs/testing.md`.
2. **No real clock.** Pass a fixed `referenceTime` (or the equivalent
   parameter) such as `new Date('2026-10-20T12:00:00Z')`. Never rely on
   `new Date()` or `Date.now()` inside an assertion.
3. **No shared mutable state.** Build inputs and fakes inside each test.
   Module-level constants are allowed only if they are frozen or never
   mutated.
4. **No randomness.** Use fixed values. Do not use `Math.random()` or generated ids.
5. **One behaviour per test.** One test case ID tests one row of the
   `docs/testing.md` table. Several `assert` calls are fine if they check
   the same behaviour.
6. **Deterministic data that matches the seed where possible.** Reuse the
   product names and prices from `docs/p0-acceptance.md` (for example the
   MacBook Air M2 at 20,890,000 VND) so that the tests read like the
   acceptance evidence.

## 9. Test file template

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  historyStatus,
  NO_HISTORY_MESSAGE,
} from '../backend/src/modules/tracked-products/price-history.service.js';

const REFERENCE_TIME = new Date('2026-10-20T12:00:00Z');

test('TC-US02-02 [error] zero daily points reports no price history', () => {
  const result = historyStatus(0);

  assert.deepEqual(result, {
    status: 'NO_HISTORY',
    message: NO_HISTORY_MESSAGE,
  });
});
```

Structure each test as **arrange, act, assert**, separated by blank lines.
Name the test after the behaviour, not the function: write
`... is insufficient for a chart` rather than `historyStatus returns ...`.

## 10. Contributing to `docs/testing.md`

`docs/testing.md` has four sections in this fixed order:

1. What we test, and why
2. Test cases for every P0 story
3. Automated tests
4. What the tests found

Each member edits **only the subsection of their own story under Section 2**
(`### US02 — View product price history`, and so on), plus the matching row
in the Section 3 table. Do not reorder or reformat other members'
subsections. If a story has a layer gap (see Section 6), add one line under
"Known gaps" in Section 1. Sections 3 (run results) and 4 are completed once
all stories are merged.

Each story subsection uses this table, and every row must match a test in
the code with the same ID:

```markdown
| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|
| TC-US02-01 | US02 View price history | 30 daily IN_STOCK prices, current 20,890,000 VND | `AVAILABLE`; 30 points; min 20,890,000, max 23,990,000, current 20,890,000 | normal |
```

- **Story** is the story ID followed by its short name.
- **Input** is concrete: real values, not "valid data".
- **Expected** is concrete: the exact status, message or value.
- Cite the business rule in Expected when one applies, for example `(BR1)`.

## 11. Workflow

1. Branch from `main`: `test/usNN-<slug>`, for example
   `test/us03-price-alert`.
2. Write the table rows in `docs/testing.md` first, then the tests.
3. Run `npm test` from the repository root. The full suite must be green,
   not only your file.
4. **Prove each test can fail.** Break the rule on purpose in the production
   code (for example change `<=` to `<`, or `20` to `21`), run `npm test`
   and confirm your test turns red. Restore the code and confirm it is green
   again. A test that cannot fail is not a test. Keep one red output: it
   may be used for Section 4 of `docs/testing.md`.
5. Open a PR titled `[Test] USNN ...` that links the story's test issue.
6. A teammate reviews it with the **Review changes** button (a plain
   comment does not count as a review) before merging.

### Review checklist

- [ ] At least 3 cases: at least 1 normal, at least 1 error, and boundary cases on both sides where the rule has a number
- [ ] Every table row has a test with the same ID, and every test has a table row
- [ ] The ID is at the start of every test name
- [ ] The author broke the rule on purpose and saw each test turn red
- [ ] No database, server, network, real clock or randomness
- [ ] No production code changed
- [ ] Messages are imported from the service or match the requirements exactly
- [ ] `npm test` passes from a clean clone with only `docs/SETUP.md` steps
