# PriceLens Setup Guide

This guide takes a computer with nothing installed to a running PriceLens in
four steps. A setup script installs the tools for you.

- **Time:** about 15 minutes, most of it downloads
- **Works on:** Windows 10/11, macOS, Ubuntu
- **Result:** PriceLens open at `http://localhost:4173` with 10 demo products

## 1. Download PriceLens

You need Git to download the project.

**Windows** — open **PowerShell** (Start menu → type `PowerShell`) and run:

```powershell
winget install --id Git.Git --exact
```

Close PowerShell and open it again so it finds Git.

**macOS** — open **Terminal** and run `git --version`. If macOS offers to
install the command line developer tools, accept and wait for it to finish.

**Ubuntu** — open **Terminal** and run:

```bash
sudo apt update && sudo apt install -y git
```

Then download PriceLens and go into its folder (all operating systems):

```bash
git clone https://github.com/SE-FDA-NEU-AI66B/Group6-TopicA3-Price_Monitoring_Comparison_Platform.git
cd Group6-TopicA3-Price_Monitoring_Comparison_Platform
```

Run every command in the rest of this guide from this folder.

## 2. Run the setup script

**Windows** (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

**macOS / Ubuntu** (Terminal):

```bash
bash scripts/setup.sh
```

The script:

1. installs **Node.js** (22 or newer) and **PostgreSQL 17** if they are missing;
2. asks for a database password — **choose one and remember it** (use letters
   and digits only). If PostgreSQL is already installed, enter its existing
   password for the `postgres` user instead;
3. creates the configuration file `.env` with that password;
4. installs the project packages, creates the `pricelens` database with demo
   data and builds the website.

Windows or macOS may ask for permission or your computer password while
tools are installed; allow it. The script is finished when it prints:

```text
PriceLens is ready. Continue with step 3 of docs/SETUP.md to start it.
```

If it stops with `Setup stopped: ...`, see [Common problems](#common-problems)
and run the same command again. Running it again is safe.

## 3. Start PriceLens

PriceLens needs two terminal windows, both opened in the project folder.
Leave both running.

**Terminal 1 — server:**

```bash
npm --prefix backend start
```

Wait for `PriceLens API listening on port 3000`.

**Terminal 2 — website:**

```bash
npm --prefix frontend run preview -- --host localhost --port 4173
```

Wait for `http://localhost:4173/`.

## 4. Check that it works

1. Open `http://localhost:4173/` in Chrome, Edge or Firefox.
2. Sign in with email `demo@pricelens.local` and password `PriceLensDemo2026!`.
3. The Watchlist page opens and shows **10 items**.

If you see the 10 products, setup is complete. Press `Ctrl+C` in each
terminal to stop PriceLens.

## Run the automated tests

```bash
npm test
```

The tests need only step 2 (the installed packages). They do not need the
server, the database or `.env`. The output lists every test by its ID, for
example `✔ TC-US03-05 ...`, and ends with the number passed and failed.
See [testing.md](testing.md) for what each test checks.

## Start PriceLens again later

Make sure PostgreSQL is running (it starts automatically with the computer
after installation), then repeat step 3.

To reset the demo data to its original state, run:

```bash
npm --prefix backend run db:init
```

## Try the P0 stories

Start from the Watchlist after signing in.

| Story | What to do |
|---|---|
| US02 Price history | **View** MacBook Air M2 → price chart for the last 30 days |
| US03 Price alert | **View** Dell XPS 13 9340 → enter a target below the current price → **Create price alert** |
| US04 Add product | **Add product** → paste `https://digital-hub.example/apple-iphone-15-128gb-black` → choose the variant → add |
| US05 Notification | Create an alert, then follow [us05-demo.md](us05-demo.md) to process a price drop and see the email |
| US09 Compare offers | **View** Apple iPhone 15 → **Compare offers** |

## Common problems

| Problem | Fix |
|---|---|
| `winget` is not recognized (Windows) | Install **App Installer** from the Microsoft Store, then run the command again. |
| `running scripts is disabled` (Windows) | Use the exact command from step 2; it starts with `powershell -ExecutionPolicy Bypass`. |
| `node`, `npm` or `git` is not recognized right after installing | Close the terminal, open a new one in the project folder and run the same command again. |
| `password authentication failed for user "postgres"` | The password in `.env` is wrong. Open `.env` in a text editor, correct the `DB_PASSWORD="..."` line, save, and run `npm --prefix backend run db:init`. |
| `connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL is not running. Windows: restart the computer, or run `net start postgresql-x64-17` in an Administrator PowerShell. macOS: `brew services start postgresql@17`. Ubuntu: `sudo service postgresql start`. |
| `npm ci` fails with `ECONNRESET` or a timeout | Check the internet connection, VPN or proxy, then run the setup script again. |
| `Port 3000` or `4173` is already in use | Close the other program using that port, or the PriceLens terminal you left open earlier. |
| Sign-in fails or the page shows a network error | Make sure Terminal 1 is still running and that you opened exactly `http://localhost:4173/`. |
| Watchlist does not show 10 items | Run `npm --prefix backend run db:init`, restart Terminal 1 and reload the page. |

## Manual setup

Use this only if the setup script cannot run on your computer.

1. Install [Node.js 22 or newer](https://nodejs.org/) and
   [PostgreSQL 17](https://www.postgresql.org/download/). In the PostgreSQL
   installer keep port `5432` and user `postgres`, and choose a password.
2. Copy `.env.example` to `.env` and set `DB_PASSWORD` to that password.
   Leave the other values as they are.
3. Run:

   ```bash
   npm --prefix backend ci
   npm --prefix frontend ci
   npm --prefix backend run db:init
   npm --prefix frontend run build
   ```

   `db:init` must end with `PriceLens database initialized successfully.`
4. Continue with step 3.

## Remove the demo database (optional)

Stop PriceLens first. This deletes the `pricelens` database and its data; it
does not uninstall any tool.

Windows (PowerShell):

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d postgres -c "DROP DATABASE IF EXISTS pricelens WITH (FORCE);"
```

macOS:

```bash
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS pricelens WITH (FORCE);"
```

Ubuntu:

```bash
sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS pricelens WITH (FORCE);"
```

## Verification record

| Date | Tester | Machine | Result |
|---|---|---|---|
| 4/10/2026 | Pham Ba Viet | Windows | Success in 15 minutes, no problems (Milestone 2 guide) |
