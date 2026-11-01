# Testing

Automated test suite for the five P0 stories of PriceLens. Conventions for
writing tests and editing this document are in
[testing-guidelines.md](testing-guidelines.md).

## 1. What we test, and why

| Layer | Where | How we test it | Why |
|---|---|---|---|
| Services | `backend/src/modules/**/*.service.js`, `backend/src/background/**` | Unit tests that call exported functions directly with plain arguments | _TBD_ |
| Repository | `backend/src/modules/**/*.repository.js` | Unit tests with a fake `executeQuery`; no PostgreSQL | _TBD_ |
| Routes | `backend/src/modules/**/*.routes.js` | Not tested in this suite | _TBD_ |
| Interface | `frontend/src/**` | Not tested in this suite | _TBD_ |

### Where the risk is

_TBD: two or three sentences on which parts we tested most, and why those._

### Known gaps

- **US02:** the date and `IN_STOCK` filtering of price history runs in SQL
  (`price-history.repository.js`). Because the suite runs without a
  database, it checks that the 30-day UTC window is computed correctly and
  how rows are assembled, but not the SQL query itself.

## 2. Test cases for every P0 story

Each story has at least one `normal` case that succeeds, at least one `error`
case where a business rule refuses the input and, when its rule contains a
number, boundary cases on both sides of that number. Every ID below matches
a test with the same ID in `tests/`.

### US02 — View product price history

US02 has no numbered business rule. Its numeric limit is the chart
threshold: a chart needs at least 2 valid daily prices.

| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|
| TC-US02-01 | US02 View price history | 30 valid daily prices, viewed at 2026-10-20 12:00 UTC (AC1) | `AVAILABLE`; exactly 30 points; window 2026-09-20 → 2026-10-19 UTC | normal |
| TC-US02-02 | US02 View price history | Lowest 18,500,000 VND, highest 20,000,000 VND, current 18,900,000 VND (AC2) | Summary shows exactly 18,500,000 / 20,000,000 / 18,900,000 VND | normal |
| TC-US02-03 | US02 View price history | No valid price records (AC4) | `NO_HISTORY`; "No price history available"; no points, no summary | error |
| TC-US02-04 | US02 View price history | Request the history of a product the user does not own | Refused: 404 `TRACKED_PRODUCT_NOT_FOUND`, "Tracked product not found" | error |
| TC-US02-05 | US02 View price history | 1 valid price record (AC3) | `INSUFFICIENT_DATA`; "Insufficient data for a 30-day chart" | boundary, just below |
| TC-US02-06 | US02 View price history | 2 valid price records | `AVAILABLE`; 2 points | boundary, on the limit |

### US03 — Create a price alert

| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|

### US04 — Add a product using its URL

| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|

### US05 — Receive a price-drop notification

| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|

### US09 — Compare prices across retailers

| ID | Story | Input | Expected | Kind |
|---|---|---|---|---|

## 3. Automated tests

Run the whole suite from the repository root:

```bash
npm test
```

No running server and no real database are needed. See
[SETUP.md](SETUP.md) for the one-time install and `.env` configuration.

| Story | Test file | Test case IDs |
|---|---|---|
| US02 | `tests/us02-price-history.test.js` | TC-US02-01 – TC-US02-06 |
| US03 | `tests/us03-price-alert.test.js` | _TBD_ |
| US04 | `tests/us04-add-product.test.js` | _TBD_ |
| US05 | `tests/us05-notification.test.js` | _TBD_ |
| US09 | `tests/us09-comparison.test.js` | _TBD_ |

### Latest run

_TBD: date, commit, pass/fail totals and a screenshot of the full `npm test`
output with every test name visible._

## 4. What the tests found

_TBD: one real bug found by a test (issue, fix and the test that now guards
it), or, if none was found, one deliberate rule violation showing the
failing test, followed by the restored code and the passing run._
