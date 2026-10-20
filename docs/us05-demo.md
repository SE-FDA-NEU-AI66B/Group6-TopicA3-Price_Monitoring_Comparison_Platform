# US05 reproducible price-drop notification demo

This procedure demonstrates Story #40 from the real Product Details UI through BG-01, BG-02 and BG-03. It uses the credential-free JSONL email adapter, requires no Postman and exposes no background HTTP endpoint.

## Demo fixture and expected sequence

| Item | Stable value |
|---|---|
| User | `demo@pricelens.local` |
| Product | `dell-xps-13-9340` — Dell XPS 13 9340 |
| Variant | `16gb-512gb-silver` |
| Offer URL | `https://techmart.example/dell-xps-13-9340-16-512-silver` |
| Seed current price | `34990000.00 VND` |
| UI target | `14000000.00 VND` |
| New prices | `13900000.00 → 13800000.00 → 14200000.00 → 14000000.00` |

The initial price is above target. The expected threshold sequence is `ABOVE_TARGET → AT_OR_BELOW_TARGET → AT_OR_BELOW_TARGET → ABOVE_TARGET → AT_OR_BELOW_TARGET`; exactly two notification rows and two JSONL messages must result. Generated IDs are evidence only and must never be copied into commands.

## 1. Prepare a clean test/demo environment

Complete the normal dependency and `.env` steps in `docs/SETUP.md`. Keep these credential-free email values:

```dotenv
TEST_DB_NAME=pricelens_test
EMAIL_TRANSPORT=jsonl
EMAIL_OUTBOX_PATH=.local/pricelens-email-outbox.jsonl
```

The commands below intentionally use `pricelens_test`; they do not reset the normal `pricelens` development database.

PowerShell, from the repository root:

```powershell
$env:TEST_DB_NAME='pricelens_test'
node --import ./backend/src/test-support/environment.js ./backend/src/database/init-database.js
Remove-Item -LiteralPath ./backend/.local/pricelens-email-outbox.jsonl -Force -ErrorAction SilentlyContinue
npm --prefix frontend run build
```

macOS/Linux:

```bash
TEST_DB_NAME=pricelens_test node --import ./backend/src/test-support/environment.js ./backend/src/database/init-database.js
rm -f ./backend/.local/pricelens-email-outbox.jsonl
npm --prefix frontend run build
```

Expected initializer evidence includes `Database: pricelens_test`, `Tables: 9` and `Demo tracked products: 10`. Rerun this section, including outbox removal, before every demonstration.

## 2. Start the application

Open three terminals at the repository root.

Terminal 1 — backend on the designated test/demo database.

PowerShell:

```powershell
$env:NODE_ENV='test'
$env:PRICELENS_APPLICATION_DB_NAME='pricelens'
$env:DB_NAME='pricelens_test'
$env:TEST_DB_NAME='pricelens_test'
npm --prefix backend start
```

macOS/Linux:

```bash
NODE_ENV=test PRICELENS_APPLICATION_DB_NAME=pricelens DB_NAME=pricelens_test TEST_DB_NAME=pricelens_test npm --prefix backend start
```

Terminal 2 — frontend:

```text
npm --prefix frontend run preview -- --host localhost --port 4173
```

Terminal 3 — background commands. Set the same database environment first.

PowerShell:

```powershell
$env:NODE_ENV='test'
$env:PRICELENS_APPLICATION_DB_NAME='pricelens'
$env:DB_NAME='pricelens_test'
$env:TEST_DB_NAME='pricelens_test'
Set-Location backend
```

macOS/Linux:

```bash
cd backend
export NODE_ENV=test
export PRICELENS_APPLICATION_DB_NAME=pricelens
export DB_NAME=pricelens_test
export TEST_DB_NAME=pricelens_test
```

## 3. Create the alert through Product Details

1. Open `http://localhost:4173/`.
2. Sign in as `demo@pricelens.local` with the local-only demo password `PriceLensDemo2026!`.
3. On Watchlist, select **View Dell XPS 13 9340**. Do not type a generated tracked-product ID into the URL.
4. Confirm Product Details shows Dell XPS 13 9340, variant `XPS 13 16GB/512GB Silver`, and current price `34,990,000 VND`.
5. Enter `14000000.00` in **Target price** and select **Create price alert**.
6. Confirm the result shows **Active** and `14,000,000 VND`.

This is the only alert-creation path in the demo. Do not use Postman, curl, browser developer tools or a hidden API.

## 4. Process and deliver the first crossing

From Terminal 3:

```text
npm run prices:process -- --url=https://techmart.example/dell-xps-13-9340-16-512-silver --amount=13900000.00 --currency=VND --availability=IN_STOCK --observed-at=now
```

`prices:process` resolves the offer by normalized URL and calls the existing `processPriceObservation()` contract. `--observed-at=now` produces a unique ISO 8601 UTC value and keeps the delivery timing measurable. Expected output contains:

```json
{
  "status": "PROCESSED",
  "notificationCount": 1
}
```

Run the read-only evidence queries in Section 8. They must show one new observation, alert state `AT_OR_BELOW_TARGET` and one `PENDING` notification with subject `Price Drop Alert: Dell XPS 13 9340`.

Deliver it:

```text
npm run notifications:deliver -- --limit=10
```

Expected output contains `selectedCount: 1`, `status: "SENT"` and `withinFiveMinutes: true`.

## 5. Prove remaining-below suppression

```text
npm run prices:process -- --url=https://techmart.example/dell-xps-13-9340-16-512-silver --amount=13800000.00 --currency=VND --availability=IN_STOCK --observed-at=now
npm run notifications:deliver -- --limit=10
```

The price processor must report `notificationCount: 0`. Delivery must report `selectedCount: 0`; the notification and outbox counts remain one.

## 6. Reset above target

```text
npm run prices:process -- --url=https://techmart.example/dell-xps-13-9340-16-512-silver --amount=14200000.00 --currency=VND --availability=IN_STOCK --observed-at=now
```

Expected: `status: "PROCESSED"`, `notificationCount: 0`, threshold `ABOVE_TARGET`, one notification and one outbox record.

## 7. Process and deliver the second crossing

```text
npm run prices:process -- --url=https://techmart.example/dell-xps-13-9340-16-512-silver --amount=14000000.00 --currency=VND --availability=IN_STOCK --observed-at=now
npm run notifications:deliver -- --limit=10
```

The price processor must report `notificationCount: 1`. Delivery must select one row, return `SENT`, and report `withinFiveMinutes: true`. The final state is an ACTIVE alert in `AT_OR_BELOW_TARGET`, exactly two SENT notifications and exactly two ACCEPTED JSONL records.

## 8. Read-only PostgreSQL evidence

These queries identify the fixture through email, normalized URL and target. They never mutate state and do not depend on generated IDs.

Alert and notification evidence:

```sql
SELECT
    pa.status,
    pa.last_threshold_state,
    pa.target_price,
    n.notification_id,
    n.price_observation_id,
    n.recipient_email,
    n.subject,
    n.delivery_status,
    n.qualified_at,
    n.sent_at,
    n.provider_message_id,
    ROUND(EXTRACT(EPOCH FROM (n.sent_at - n.qualified_at)) * 1000) AS latency_ms
FROM price_alerts AS pa
JOIN tracked_products AS tp ON tp.tracked_product_id = pa.tracked_product_id
JOIN users AS u ON u.user_id = tp.user_id
LEFT JOIN notifications AS n ON n.price_alert_id = pa.price_alert_id
WHERE u.email = 'demo@pricelens.local'
  AND tp.normalized_source_url = 'https://techmart.example/dell-xps-13-9340-16-512-silver'
  AND pa.target_price = 14000000.00
ORDER BY n.qualified_at, n.notification_id;
```

Observation evidence:

```sql
SELECT po.price_amount, po.currency_code, po.availability_status, po.observed_at
FROM price_observations AS po
JOIN retailer_offers AS ro ON ro.retailer_offer_id = po.retailer_offer_id
WHERE ro.normalized_url = 'https://techmart.example/dell-xps-13-9340-16-512-silver'
ORDER BY po.observed_at DESC
LIMIT 5;
```

Run either query through `psql -h localhost -p 5432 -U postgres -d pricelens_test -W`, then paste the SQL at the prompt. Database inspection is evidence-only; never update alert, observation or notification rows manually.

## 9. Inspect the JSONL outbox

PowerShell from the repository root:

```powershell
Get-Content ./backend/.local/pricelens-email-outbox.jsonl
```

macOS/Linux:

```bash
cat ./backend/.local/pricelens-email-outbox.jsonl
```

There must be exactly two lines. Each line must contain a different runtime `notification_id`, `status: "ACCEPTED"`, recipient `demo@pricelens.local`, exact subject `Price Drop Alert: Dell XPS 13 9340`, body, `requested_at` and a stable `jsonl:<runtime notification ID>` provider ID.

## 10. Timing evidence template

Record values returned by the delivery command or the Section 8 query:

| Crossing | `qualified_at` | `sent_at` | Latency ms | Within five minutes |
|---|---|---|---:|:---:|
| First | runtime value | runtime value | `sent_at - qualified_at` | Yes |
| Second | runtime value | runtime value | `sent_at - qualified_at` | Yes |

This proves the invoked development workflow. It does not claim a continuous production scheduler SLA.

## 11. Demo checklist

- [ ] Alert created through Product Details UI
- [ ] Initial price is above target
- [ ] First crossing processed by BG-01/BG-02
- [ ] Exactly one PENDING notification
- [ ] First notification delivered as SENT
- [ ] First JSONL email visible with exact subject
- [ ] First latency is at most five minutes
- [ ] Repeated-below price creates no notification or email
- [ ] Above-target price resets threshold without an email
- [ ] Second crossing creates a distinct PENDING notification
- [ ] Second notification delivered as SENT
- [ ] Exactly two SENT rows and two ACCEPTED JSONL records

## 12. Common failures

| Symptom | Resolution |
|---|---|
| Database/schema missing | Repeat Section 1 and confirm `Database: pricelens_test`. |
| Browser cannot load data | Confirm backend is running on port 3000 with `DB_NAME=pricelens_test`. |
| Old outbox lines appear | Stop the demo, reset the DB, remove only `backend/.local/pricelens-email-outbox.jsonl`, then restart. |
| Processor returns `DUPLICATE` | The same `observed_at` was reused; use `--observed-at=now` for each sequential step. |
| Processor returns `OUT_OF_ORDER` | Reset the baseline and run the four commands in the documented order. |
| Delivery reports `selectedCount: 0` after a crossing | Check that the UI alert is ACTIVE and the processor reported `notificationCount: 1`. |
| Outbox path does not exist | It is created only after the first accepted JSONL delivery. |

## 13. Automated verification

The real-PostgreSQL integration test repeats the backend portion with the same natural-key fixture, real #146/#147 processors and a temporary JSONL outbox.

PowerShell:

```powershell
$env:TEST_DB_NAME='pricelens_test'
npm --prefix backend test
```

macOS/Linux:

```bash
TEST_DB_NAME=pricelens_test npm --prefix backend test
```

It restores the seeded database and deletes its temporary outbox afterward. The browser step remains an explicit Product Details verification because the alert must be visibly created through the real UI.
