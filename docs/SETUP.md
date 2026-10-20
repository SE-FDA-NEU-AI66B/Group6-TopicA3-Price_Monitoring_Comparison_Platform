# PriceLens Setup Guide

Follow Sections 1–7 in order to install and test PriceLens on a new machine.

- **Estimated time:** 20–40 minutes
- **Final URL:** `http://localhost:4173/watchlist`
- **Expected result:** 10 tracked products loaded from PostgreSQL
- **While running:** Keep one backend terminal and one frontend terminal open

## 1. Install the Required Software

| Software | Required version |
|---|---|
| Git | 2.34 or newer |
| Node.js | 22.12 or newer; Node.js 24 LTS recommended |
| npm | 10 or newer |
| PostgreSQL | 17.x |
| Browser | Current Chrome, Edge or Firefox release |

Install Git, Node.js, npm and PostgreSQL for your operating system. Use a current browser to run the P0 flows.

### Windows

Use Command Prompt (`cmd.exe`) for the Windows instructions.

1. Download and install Git from the [official Git for Windows page](https://git-scm.com/install/windows).

2. Install Node.js and npm:

   ```cmd
   winget install OpenJS.NodeJS.LTS --source winget --accept-source-agreements --accept-package-agreements
   ```

3. Download PostgreSQL 17 from the [official PostgreSQL Windows page](https://www.postgresql.org/download/windows/). In the installer:

   - Install PostgreSQL Server and Command Line Tools.
   - Keep port `5432`.
   - Keep the administrator user `postgres`.
   - Create and remember a local password for `postgres`.

4. Close and reopen Command Prompt. If `psql` is not recognized, add its default location to the current window:

   ```cmd
   set "PATH=%PATH%;C:\Program Files\PostgreSQL\17\bin"
   ```

### macOS

1. Download and install Git using the macOS option on the [official Git installation page](https://git-scm.com/install/mac).

2. If Homebrew is unavailable, install it and follow its final `PATH` instruction:

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. Install Node.js and npm:

   ```bash
   brew install node@24 && brew link --overwrite --force node@24
   ```

4. Download PostgreSQL 17 from the [official PostgreSQL macOS page](https://www.postgresql.org/download/macosx/). In the graphical installer:

   - Install PostgreSQL Server and Command Line Tools.
   - Keep port `5432`.
   - Keep the administrator user `postgres`.
   - Create and remember a local password for `postgres`.

5. Close and reopen Terminal. If `psql` is not recognized, add its default location to the current terminal:

   ```bash
   export PATH="/Library/PostgreSQL/17/bin:$PATH"
   ```

### Ubuntu

1. Install Git, Snap and the PostgreSQL package helper:

   ```bash
   sudo apt update
   sudo apt install -y git snapd postgresql-common
   ```

2. Install Node.js and npm:

   ```bash
   sudo snap install node --classic --channel=24/stable
   ```

3. Add the official PostgreSQL source, install PostgreSQL 17 and start it:

   ```bash
   sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
   sudo apt install -y postgresql-17
   sudo systemctl enable --now postgresql
   ```

4. Open PostgreSQL to set a local password:

   ```bash
   sudo -u postgres psql
   ```

5. At the `postgres=#` prompt, run `\password postgres`, enter the new password twice, then exit:

   ```text
   \password postgres
   \q
   ```

### Verify the Installed Versions

Run the following in the terminal prepared for your operating system above:

```text
git --version
node --version
npm --version
psql --version
```

Continue only when all four commands meet the versions in the table above.

## 2. Download PriceLens

Choose a directory for PriceLens and run:

```text
git clone https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform.git
cd Group6-TopicA3-Price_Monitoring_Comparison_Platform
```

The resulting directory is the PriceLens project directory. Run all remaining commands from this directory.

## 3. Install Project Dependencies

Install the backend first, followed by the frontend:

```text
npm --prefix backend ci
npm --prefix frontend ci
```

Continue when both commands finish without `npm ERR!`.

## 4. Configure PriceLens

1. Copy `.env.example` to `.env` in the PriceLens project directory.

   Windows Command Prompt:

   ```cmd
   copy .env.example .env
   ```

   PowerShell alternative:

   ```powershell
   Copy-Item .env.example .env
   ```

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

2. Generate a local JWT secret:

   ```text
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Open `.env`.

   Windows Command Prompt:

   ```cmd
   notepad .env
   ```

   macOS/Linux:

   ```bash
   nano .env
   ```

   In `nano`, press `Ctrl+O`, then `Enter` to save, and press `Ctrl+X` to exit.

4. Replace these placeholders:

   - Set `JWT_SECRET` to the generated value.
   - Set `DB_PASSWORD` to the PostgreSQL password created in Section 1.

   If the password contains `#` or leading or trailing spaces, enclose the complete value in double quotes.

5. Keep these local defaults unless the ports or database names conflict with another local service:

   ```dotenv
   NODE_ENV=development
   API_PORT=3000
   FRONTEND_ORIGIN=http://localhost:4173
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=pricelens
   TEST_DB_NAME=pricelens_test
   DB_USER=postgres
   EMAIL_TRANSPORT=jsonl
   EMAIL_OUTBOX_PATH=.local/pricelens-email-outbox.jsonl
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

   | Setting | Use |
   |---|---|
   | `NODE_ENV`, `API_PORT`, `FRONTEND_ORIGIN`, `JWT_SECRET` | Required by the backend. |
   | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Required PostgreSQL connection and initializer settings. |
   | `TEST_DB_NAME` | Required only when running `npm --prefix backend test`; it must differ from `DB_NAME`. |
   | `EMAIL_TRANSPORT`, `EMAIL_OUTBOX_PATH` | Optional development email settings. The backend defaults to the JSONL values shown above. |
   | `VITE_API_BASE_URL` | Optional browser API override. The local frontend fallback is `http://localhost:3000/api`. |

Keep `.env` in the PriceLens project directory and do not share its secret values. Restart the backend after changing `.env`. Rebuild the frontend after changing `VITE_API_BASE_URL`.

## 5. Create and Seed the Database

Run one command:

```text
npm --prefix backend run db:init
```

This creates the `pricelens` database and schema, then loads the deterministic Sprint 3 fixtures. A complete initialization contains 9 application tables, 4 update triggers and 10 tracked products for the demonstration user. The fixtures also include price-history states, the 20-alert BR1 boundary, exact-variant comparison data and two historical US05 notifications.

The initializer creates a missing database and applies the schema only when the public schema is empty. It rejects a partially initialized schema. On later runs, it restores the managed fixture users, tracked products, observations, alerts and notifications by stable natural keys. It does not target unrelated user accounts.

Backend automated tests use `TEST_DB_NAME=pricelens_test`, never the normal `DB_NAME=pricelens`. `npm --prefix backend test` creates or restores that explicitly designated test database and refuses to run its reset helper if both names are the same.

The final output must include:

```text
PriceLens database initialized successfully.
Database: pricelens
Demo tracked products: 10
```

## 6. Start PriceLens

Open two terminals in the PriceLens project directory.

### Terminal 1 — Backend

```text
npm --prefix backend start
```

Keep this terminal open.

### Terminal 2 — Frontend

```text
npm --prefix frontend run build
npm --prefix frontend run preview -- --host localhost --port 4173
```

Keep this terminal open.

- The backend must report `PriceLens API listening on port 3000`.
- The frontend must report `http://localhost:4173/`.

## 7. Check That PriceLens Works

1. Open `http://localhost:4173/`.
2. Sign in with email `demo@pricelens.local` and password `PriceLensDemo2026!`.
3. Confirm that the browser opens `http://localhost:4173/watchlist`.
4. Confirm that the page displays `10 items` and ten product cards.
5. Confirm that every card displays retailer and freshness information.
6. Confirm that Sony WH-1000XM5 and Xiaomi Robot Vacuum S10 display `Price unavailable`.

If every result above appears, PriceLens is set up correctly.

## P0 Demo Paths

Start every browser story from Watchlist. Do not type generated tracked-product IDs into the address bar.

| Story | Navigation |
|---|---|
| US02 | Watchlist → **View** a product → review Product Details history |
| US03 | Watchlist → **View** Dell XPS 13 9340 → create a price alert |
| US04 | Watchlist → **Add product** → resolve URL → choose variant → add |
| US05 | Watchlist → Product Details → create alert → run the optional background demo below |
| US09 | Watchlist → **View** Apple iPhone 15 → **Compare offers** |

### Complete US03 and check BR2

1. On Watchlist, select **View** for Dell XPS 13 9340.
2. Confirm the current price is `34,990,000 VND` after a fresh initialization.
3. Enter `33000000.00` as the target and select **Create price alert**.
4. Confirm the new alert shows **Active**.
5. Enter `36000000.00` and submit again.
6. Confirm the page shows `Target price must be lower than the current price`. The message must not contain raw JSON, SQL, a stack trace or an HTTP-status-only error.

Run `npm --prefix backend run db:init` when you want to restore the fixture baseline after the demo.

## Optional US05 Notification Demo

US02, US03, US04 and US09 need only the backend and frontend processes from Section 6. US05 also needs two manually invoked background commands. PriceLens does not run a scheduler or a continuous worker in Sprint 3.

Keep these values in the root `.env`:

```dotenv
EMAIL_TRANSPORT=jsonl
EMAIL_OUTBOX_PATH=.local/pricelens-email-outbox.jsonl
```

After creating the demo alert through Product Details, the price processor records an observation and evaluates the threshold crossing:

```text
npm --prefix backend run prices:process -- --url=https://techmart.example/dell-xps-13-9340-16-512-silver --amount=13900000.00 --currency=VND --availability=IN_STOCK --observed-at=now
```

BG-03 then delivers pending notifications through the JSONL development adapter:

```text
npm --prefix backend run notifications:deliver -- --limit=10
```

The outbox is `backend/.local/pricelens-email-outbox.jsonl`. Inspect it with PowerShell:

```powershell
Get-Content backend/.local/pricelens-email-outbox.jsonl
```

On macOS/Linux:

```bash
cat backend/.local/pricelens-email-outbox.jsonl
```

The full [US05 demo](./us05-demo.md) prepares an isolated test database and covers both legitimate threshold crossings, remaining-below suppression and persisted delivery evidence.

### BG-03 details

BG-03 consumes notification rows that BG-01/BG-02 have already created with `delivery_status = 'PENDING'`; it does not create notifications or reevaluate prices. The development transport requires no email account, API key or SMTP password.

1. Confirm a pending notification exists. Generated IDs are runtime values, so obtain the ID rather than hard-coding it:

   ```text
   psql -h localhost -p 5432 -U postgres -d pricelens -W -c "SELECT notification_id, recipient_email, subject, qualified_at FROM notifications WHERE delivery_status = 'PENDING' ORDER BY qualified_at, notification_id;"
   ```

   The #146 processor creates this row after a qualifying crossing. The seed contains historical `SENT` evidence only; it deliberately does not pretend that a new delivery is pending.

2. Process up to ten pending notifications:

   ```text
   npm --prefix backend run notifications:deliver -- --limit=10
   ```

   The command prints structured results. A successful row has `status: "SENT"`, its database timestamp and the measured interval from `qualified_at`.

3. Inspect the captured email evidence.

   Windows Command Prompt:

   ```cmd
   type backend\.local\pricelens-email-outbox.jsonl
   ```

   PowerShell:

   ```powershell
   Get-Content backend/.local/pricelens-email-outbox.jsonl
   ```

   macOS/Linux:

   ```bash
   cat backend/.local/pricelens-email-outbox.jsonl
   ```

   Each accepted JSON line contains the notification ID, recipient snapshot, exact subject, body, request time and stable development message ID. The directory is ignored by Git.

4. Confirm persisted delivery state, replacing `<id>` with the runtime notification ID:

   ```text
   psql -h localhost -p 5432 -U postgres -d pricelens -W -c "SELECT notification_id, delivery_status, qualified_at, sent_at, provider_message_id, failure_reason FROM notifications WHERE notification_id = <id>;"
   ```

5. To reproduce failure, use a different pending notification and its runtime ID:

   ```text
   npm --prefix backend run notifications:deliver -- --limit=10 --fail-notification-id=<id>
   ```

   The adapter records deterministic rejected evidence and BG-03 persists `FAILED`, a null `sent_at` and a safe `failure_reason`. `FAILED` is terminal in this milestone because the approved design does not define a retry transition. Rerunning the command never resends `SENT` or `FAILED` rows.

Automated reproduction uses only the explicitly designated `pricelens_test` database:

```text
set TEST_DB_NAME=pricelens_test
npm --prefix backend test
```

On PowerShell, use `$env:TEST_DB_NAME='pricelens_test'` before the npm command. On macOS/Linux, use `TEST_DB_NAME=pricelens_test npm --prefix backend test`. These tests create their own temporary PENDING fixtures by natural keys, exercise success, failure and concurrent claims with an in-memory adapter, restore the seed and send no real email.

BG-03 does not include a scheduler. It proves that an invoked delivery is requested and persisted within five minutes for the reproducible workflow; #148 owns the complete observation-to-email demonstration. A production provider would also need idempotency keyed by `notification_id` because a database cannot by itself guarantee exactly-once effects after external delivery succeeds.

For the complete Story #40 demonstration beginning with alert creation in Product Details and ending with two JSONL messages, follow [`docs/us05-demo.md`](./us05-demo.md).

## Start PriceLens Again Later

Confirm that PostgreSQL is running, then open two terminals in the PriceLens project directory.

Terminal 1:

```text
npm --prefix backend start
```

Terminal 2:

```text
npm --prefix frontend run preview -- --host localhost --port 4173
```

Dependencies and database initialization do not normally need to be repeated. Rebuild the frontend first if its source or configuration changed. Press `Ctrl+C` in each terminal to stop PriceLens.

## Common Problems

| Problem | Fix |
|---|---|
| `git`, `node`, `npm` or `psql` is not recognized | Close and reopen the terminal. Reinstall the missing tool if necessary. For PostgreSQL, repeat the temporary `PATH` command from Section 1. |
| `npm ci` reports `ECONNRESET` or a timeout | Check the network, VPN and proxy; run `npm cache verify`; then repeat both dependency commands. |
| PostgreSQL reports password authentication failure | Correct `DB_PASSWORD` in the root `.env`, then run `npm --prefix backend run db:init` again. |
| PostgreSQL refuses port `5432` | Start the service and confirm `DB_HOST=localhost` and `DB_PORT=5432` in `.env`. Windows Administrator Command Prompt: `net start postgresql-x64-17`. macOS: `sudo -u postgres /Library/PostgreSQL/17/bin/pg_ctl -D /Library/PostgreSQL/17/data start`. Ubuntu: `sudo systemctl start postgresql`. |
| Port `3000` or `4173` is already in use | Stop the other application using the port, then restart the affected PriceLens process. |
| Login or CORS fails | Confirm the backend is running, open exactly `http://localhost:4173/`, set `FRONTEND_ORIGIN=http://localhost:4173` in `.env`, then restart the backend. |
| The watchlist does not show 10 items | Run `npm --prefix backend run db:init`, restart the backend and reload the page. |

## Remove the Test Database (Optional)

Press `Ctrl+C` in the backend terminal before continuing. The following command permanently removes the `pricelens` database, all of its schema objects and all seeded PriceLens data.

Windows Command Prompt and macOS:

```text
psql -h localhost -p 5432 -U postgres -d postgres -W -c "DROP DATABASE IF EXISTS pricelens WITH (FORCE);"
```

Ubuntu:

```bash
sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS pricelens WITH (FORCE);"
```

The Windows/macOS command asks for the PostgreSQL administrator password. Success reports `DROP DATABASE`.

This removes only the PriceLens database and its seeded data. It does not uninstall PostgreSQL, Node.js, npm or Git, and it does not delete the downloaded project files, `.env` or installed packages.

The command targets the default database name `pricelens`. If `DB_NAME` was changed, do not run it until the exact intended database has been verified.

## Verification Records

### Milestone 2 independent test

- **Tested by:** Pham Ba Viet
- **Machine/operating system:** Windows
- **Test date:** 4/10/2026
- **Total setup time:** 15 minutes
- **Result:** Success
- **Problems encountered:** No problem

The tester must not be the author of this guide and must follow it on another machine without undocumented instructions.

### Sprint 3 fresh-clone test

- **Verified by:** OpenAI Codex release-verification run; independent team-member PR review is still required
- **Operating system:** Windows, PowerShell 7.6.7, Node.js 24.19.0, npm 11.17.0, PostgreSQL 17.7
- **Test date:** 21 October 2026
- **Source commit:** `ef6b5c8` application source with the Issue #153 documentation candidate
- **Fresh dependency install:** Pass; `npm ci` installed 89 backend packages and 15 frontend packages with no reused `node_modules`
- **Dedicated verification database:** Pass; `pricelens_fresh_verify_153_ef679e86` initialized with 9 tables, 4 update triggers and 10 demo tracked products
- **Backend/frontend start:** Pass using the documented commands on ports 3000 and 4173
- **Login and P0 story:** Pass; the demo account opened Watchlist with 10 items, then US03 created an Active 33,000,000 VND alert from the Dell Product Details page
- **BR2 error check:** Pass; a 36,000,000 VND target displayed `Target price must be lower than the current price`
- **Frontend build/backend tests:** Pass; Vite built 22 modules and all 61 backend tests passed
- **Undocumented workarounds:** None
