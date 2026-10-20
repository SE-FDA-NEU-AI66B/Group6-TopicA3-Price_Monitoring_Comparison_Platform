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

Install all four tools for your operating system. If a supported version is already installed, keep it and continue with the next tool.

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

4. Replace only these values:

   - Set `JWT_SECRET` to the generated value.
   - Set `DB_PASSWORD` to the PostgreSQL password created in Section 1.

   If the password contains `#` or leading or trailing spaces, enclose the complete value in double quotes.

5. Keep these local values unchanged:

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

Keep `.env` in the PriceLens project directory and do not share its secret values. Restart the backend after changing `.env`. Rebuild the frontend after changing `VITE_API_BASE_URL`.

## 5. Create and Seed the Database

Run one command:

```text
npm --prefix backend run db:init
```

This creates the `pricelens` database and schema, then adds the demonstration user with exactly 10 tracked products. A complete initialization contains 9 application tables and 4 update triggers. The command can be rerun without duplicating the demonstration products when the schema is complete.

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

## Reproduce BG-03 Notification Delivery

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

For the complete Story #40 demonstration beginning with alert creation in the real Product Details UI and ending with two observable JSONL messages, follow [`docs/us05-demo.md`](./us05-demo.md). That guide keeps the long transition sequence and evidence queries separate from this installation checklist.

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

## Independent Test Record

- **Tested by:** Pham Ba Viet
- **Machine/operating system:** Window
- **Test date:** 4/10/2026
- **Total setup time:** 15 minutes
- **Result:** Success
- **Problems encountered:** No problem

The tester must not be the author of this guide and must follow it on another machine without undocumented instructions.
