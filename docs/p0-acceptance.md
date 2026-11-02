# P0 acceptance verification — Issue #151

Verification date: 2026-10-20  
Branch baseline: `docs/release` at `5b7e563`  
Database: explicitly designated PostgreSQL test database `pricelens_test`  
Browser: Microsoft Edge against the built Vite application at `http://localhost:4173`

This is the focused acceptance record for US02, US03, US04, US05 and US09. The Milestone 1 Acceptance Criteria and BR1, BR2, BR4, BR5, BR6 and BR8 remain authoritative. Where the deterministic Sprint 3 fixture has replaced an older worked-example price, the test uses the current fixture value and verifies the same required exact-value behaviour across UI, API and PostgreSQL.

## Baseline and isolation

- Ran the official initializer through `backend/src/test-support/environment.js`; it selected `pricelens_test`, reported 9 tables, 4 update triggers and 10 demo tracked products.
- Baseline fixtures were 30/1/0 observations for the US02 products, exactly 20 ACTIVE alerts for `alert-boundary@pricelens.local`, 10 demo watchlist rows and two deterministic historical US05 notification fixtures.
- Signed out and signed back in through the browser with the local demo account before story testing.
- Reset with the official initializer between US03/US04, US04/US05 and US05/US09.
- Cleared the JSONL outbox before US05, recorded its two runtime messages, removed it afterward and confirmed it was absent after the final reset.
- All database inspection used read-only queries. No acceptance state was fabricated with manual INSERT, UPDATE or DELETE statements.

## Acceptance-Criteria checklist

| Story | AC | Scenario | Expected | Actual | Result | Evidence |
|---|---|---|---|---|---|---|
| US02 | AC1 | Open the MacBook Air M2 fixture from Watchlist | A line chart with exactly 30 daily points for the previous 30 complete UTC calendar days | Product Details showed a chart titled `Price history with 30 daily points`; DOM contained 30 markers dated 2026-09-20 through 2026-10-19, strictly increasing with no duplicate or missing day | PASS | Browser `/products/<runtime-id>`; API-02 returned `range.days=30`, UTC and 30 points; PostgreSQL contained 30 persisted observations |
| US02 | AC2 | Inspect the current deterministic 30-day fixture | UI, API and database show the fixture's exact low, high and current prices | All three agreed on 20,890,000 VND low, 23,990,000 VND high and 20,890,000 VND current | PASS | Browser summary; API-02 summary `20890000.00/23990000.00/20890000.00`; PostgreSQL MIN/MAX/latest |
| US02 | AC3 | Open Kindle Paperwhite with one valid observation | Exact text `Insufficient data for a 30-day chart`; no misleading chart | Exact text displayed; zero chart markers/images rendered; PostgreSQL count was 1 | PASS | Product Details UI and read-only count for the normalized Kindle URL |
| US02 | AC4 | Open Sony WH-1000XM5 with no valid observations | Exact text `No price history available`; no empty success chart | Exact text displayed; zero chart markers/images rendered; PostgreSQL count was 0 | PASS | Product Details UI and read-only count for the normalized Sony URL |
| US03 | AC1 | Create target 14,000,000 VND for Dell from Product Details | Alert saved ACTIVE and exact target displayed | UI displayed `Active` and `14,000,000 VND`; PostgreSQL had one ACTIVE owned row for the Dell natural-key fixture | PASS | Browser alert form and read-only `price_alerts` query |
| US03 | AC2 | Deliberately submit 36,000,000 VND while current fixture price is 34,990,000 VND | Exact BR2 rejection and no alert row | UI displayed `Target price must be lower than the current price`; the Dell active count remained 1 (only the earlier valid alert) | PASS | Normal Product Details UI and read-only alert count |
| US03 | AC3 | Submit target `0` | Exact rejection and no alert row | UI displayed `Target price must be greater than 0`; no additional row existed | PASS | Normal Product Details UI and read-only alert count |
| US03 | AC4 | Sign in as the fixture user with exactly 20 ACTIVE alerts and attempt a 21st | Exact limit message and count remains 20 | UI displayed `Maximum 20 active alerts reached`; PostgreSQL count remained exactly 20 | PASS | Boundary-user Product Details UI and read-only count |
| US04 | AC1 | Resolve Digital Hub iPhone 15 URL, select 128GB Black and add | One TRACKING row; watchlist grows by exactly one; success and details link visible | Watchlist grew 10→11; success showed `Tracking started` and `Product added to your watchlist`; details link opened the selected variant; database contained one exact Digital Hub row | PASS | Add Product UI, Product Details UI and read-only joined query |
| US04 | AC2 | Submit the already tracked TechMart URL with `?utm_source=qa` | Exact duplicate message; normalized duplicate not created; count unchanged | Resolver displayed the canonical URL without the tracking parameter; UI displayed `This product URL is already being tracked`; Watchlist stayed at 11 and the canonical URL count stayed 1 | PASS | Add Product UI and read-only normalized-URL count |
| US04 | AC3 | Resolve `not-a-url` and `https://unsupported.example/product` | Exact `Unsupported or invalid product URL`; no row created | Both attempts showed the exact message without raw response details; Watchlist stayed at 11 | PASS | Add Product UI and read-only watchlist count |
| US05 | AC1 | UI-created Dell alert, then process 13,900,000 VND and run BG-03 | One PENDING notification becomes SENT within five minutes and one JSONL email appears | BG-01/BG-02 reported `notificationCount: 1`; DB showed PENDING before delivery; BG-03 selected 1, sent it in 8,710 ms and wrote one ACCEPTED JSONL line | PASS | Product Details UI, real commands, `notifications` query and JSONL outbox |
| US05 | AC2 | Process 13,800,000 VND while still below target, then run BG-03 | Observation persists; no repeated notification/email | Processor reported `notificationCount: 0`; delivery selected 0; DB/outbox totals remained 1 | PASS | Real BG commands plus PostgreSQL/outbox counts |
| US05 | AC3 | Inspect delivered message for the actual Dell fixture | Exact subject `Price Drop Alert: Dell XPS 13 9340` | Both DB notification snapshots and JSONL messages used the exact, case-sensitive subject with no prefix or suffix | PASS | Read-only notification query and two parsed JSONL records |
| US05 | AC4 | Process 14,200,000 VND, then 14,000,000 VND and deliver | Above-target resets without email; later crossing creates exactly one new email within five minutes | Above step reported zero notifications; equal-target step reported one; BG-03 selected one and sent it in 1,810 ms; final totals were 2 SENT rows and 2 ACCEPTED JSONL lines | PASS | Real BG commands, final observation/notification query and outbox |
| US09 | AC1 | Open Compare for tracked iPhone 15 128GB Black | Matching eligible offers ordered by API semantics; lowest and exact difference visible | UI/API showed TechMart 19,900,000 VND first, Digital Hub 20,200,000 VND second and `Difference from lowest: 300,000 VND` | PASS | Compare UI, API-06 response and PostgreSQL latest-offer query |
| US09 | AC2 | Fixture also contains an in-stock 256GB offer at 18,500,000 VND | Mismatched variant excluded | UI contained no 18,500,000 VND offer; API returned only variant `128gb-black`; database proved the excluded row belongs to `256gb-black` | PASS | Compare UI, API-06 and joined variant query |
| US09 | AC3 | Open Compare for Dell with one eligible offer | Exact `No multi-source comparison is currently available`; intentional one-offer state | Exact message displayed with one TechMart row and no misleading multi-retailer result | PASS | Compare UI, API contract coverage and PostgreSQL eligible count 1 |

## Supporting BR8 regression

The iPhone 128GB fixture has a Gadget World observation at 18,200,000 VND marked `OUT_OF_STOCK`. PostgreSQL confirmed the row exists, while API-06 and the browser comparison excluded it from eligible offers and selected the in-stock TechMart offer at 19,900,000 VND as the lowest. This is supporting regression evidence, not a new US09 Acceptance Criterion.

## Deliberate Business Rule violation and error quality

BR2 was violated through the normal Product Details form by entering 36,000,000 VND against the fixture's current price of 34,990,000 VND. The visible alert was exactly `Target price must be lower than the current price`; no extra alert row was persisted. Tested rejection states exposed understandable text only—no raw HTTP status, JSON, stack trace, SQL or provider detail.

Error/state handoff for Issue #152:

| API code/state | Visible text verified |
|---|---|
| `TARGET_PRICE_NOT_BELOW_CURRENT` | `Target price must be lower than the current price` |
| `TARGET_PRICE_NOT_POSITIVE` | `Target price must be greater than 0` |
| `ACTIVE_ALERT_LIMIT_REACHED` | `Maximum 20 active alerts reached` |
| `DUPLICATE_TRACKED_URL` | `This product URL is already being tracked` |
| `INVALID_PRODUCT_URL` | `Unsupported or invalid product URL` |
| `INSUFFICIENT_DATA` | `Insufficient data for a 30-day chart` |
| `NO_HISTORY` | `No price history available` |
| `INSUFFICIENT_OFFERS` | `No multi-source comparison is currently available` |

## Final story status

| Story | Final status | AC passed | AC total | Notes |
|---|---|---:|---:|---|
| US02 | works | 4 | 4 | Browser, API and PostgreSQL agree for 30/1/0 history states |
| US03 | works | 4 | 4 | Valid create plus BR1/BR2 rejection paths verified through UI |
| US04 | works | 3 | 3 | Resolve/select/add, normalized duplicate and both invalid URL classes verified |
| US05 | works | 4 | 4 | Real UI alert + BG-01/BG-02 + BG-03 + JSONL delivery verified |
| US09 | works | 3 | 3 | Exact variant, order/difference and single-offer state verified; BR8 preserved |

## Supporting quality and regression results

- Browser console: zero warning/error entries across the acceptance session.
- Responsive: at a 390×844 viewport, comparison and Product Details had `scrollWidth == clientWidth` (375 CSS px after browser chrome), so no horizontal overflow was present.
- Keyboard: entering `0` in Target price and pressing Enter submitted the real form; the exact error appeared and focus moved to the `role=alert` feedback region.
- Backend: `npm test` — 61 tests, 61 passed, 0 failed.
- Frontend: `npm run build` — passed; 22 modules transformed.
- Syntax: `node --check` — passed for all 79 JavaScript files under `backend/src` and `frontend/src`.
- Final reset: `pricelens_test` returned to 10 demo tracked products, 20 boundary alerts, two deterministic seeded historical notification rows and zero runtime Dell alerts.
- Final outbox: `backend/.local/pricelens-email-outbox.jsonl` absent.

## Defects, changes and release scope

No genuine Issue #151 acceptance defect was discovered, so no product code or Acceptance Criterion was changed and no defect retest was necessary. The only Issue #151 repository change is this QA artifact. No screenshots, generated evidence files, new feature work, P1/P2 implementation, requirement rewrite or Issue #152 UI documentation were added.

All 18 required P0 Acceptance Criteria passed. This acceptance task is ready for PR. Parent Issue #149 remains open because its separate documentation, fresh-machine, Sprint records and final submission deliverables are outside Issue #151.
