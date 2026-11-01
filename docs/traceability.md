# Traceability

Every screen traces back to a feature and forward to the issue that built it.
This table is the single source of truth for Milestone 1 section 6 and for the
Milestone 4 report. Keep it current - a PR that adds a route and does not
update this file should not be approved.

| Route | Purpose | Access | Priority | Feature | Story issue | PR | Status |
|-------|---------|--------|----------|---------|-------------|-----|--------|
| `/` | Landing page, sign in and account registration | G | P0 | F1 | #3 | #14 | Done |
| `/watchlist` | Tracked products, freshness, search (US01) and removal with confirmation (US08) | U | P0 | F2 | US01, US06, US08 | — | Done; relative "Updated N hours ago" wording (US06) not started |
| `/products/add` | Resolve a URL, choose the exact variant and start tracking | U | P0 | F3 | US04, US11 | — | Done |
| `/products/:productId` | Current price, 30-day history, create, list, deactivate and reactivate alerts | U | P0 | F4 | US02, US03, US07 | — | Done; CSV export (US12) not started |
| `/products/:productId/compare` | Exact-variant offers, availability and lowest available offer | U | P0 | F5 | US09, US10 | — | Done |
| `/alerts` | All alerts across products | U | P1 | F6 | US07 | — | Not started; alerts are managed per product on `/products/:productId` |

**Access codes:** G = guest (not logged in) · U = authenticated user · A = admin

**Status:** Not started / In progress / Done

## Business rules

Numbered, so issues and tests can cite them.

| # | Rule | Enforced where | Tested by |
|---|------|----------------|-----------|
| BR1 | At most 20 active alerts per user | `price-alert.service.js` (`requireActiveAlertCapacity`, user row lock) on create and reactivate | `price-alert.integration.test.js` |
| BR2 | Target price above 0 and below the current price | `price-alert.service.js` with PostgreSQL `NUMERIC` comparisons | `price-alert.integration.test.js`, `price-alert.test.js` |
| BR3 | Prices 24 hours old or older are stale | `shared/freshness.js`, used by the watchlist, tracked-product and comparison responses | `freshness.test.js`, `offer-comparison.integration.test.js` |
| BR4 | One notification per crossing; none while below target | `price-observation.processor.js`, `uq_notifications_alert_observation`, `uq_price_alerts_active_target` | `price-observation.integration.test.js`, `us05-demo.integration.test.js` |
| BR5 | Prices and offers compared only for the exact variant | Variant-scoped queries in `price-history.repository.js` and `offer-comparison.repository.js` | `offer-comparison.integration.test.js` |
| BR6 | One watchlist record per normalized URL | `normalizeProductUrl`, `uq_tracked_products_user_source_url` | `product-source.test.js`, `product-source.integration.test.js` |
| BR7 | Deleting a product deletes its alerts, only after confirmation | Browser confirmation dialog on `/watchlist`; `ON DELETE CASCADE` from `tracked_products` | `price-alert.integration.test.js` |
| BR8 | Out-of-stock offers are never the lowest available offer | `offer-comparison.service.js` (`lowest_offer`, `ALL_OUT_OF_STOCK`) | `offer-comparison.test.js`, `offer-comparison.integration.test.js` |
