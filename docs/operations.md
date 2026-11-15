# PriceLens Operations Runbook

## 1. Deployment

PriceLens runs as a full-stack Node.js 22 and Express 5 service on Render paired with managed PostgreSQL 16 (`render.yaml`).

| Component | Platform | Runtime / Command | Public Endpoint |
| :--- | :--- | :--- | :--- |
| Web Application & API | Render Web Service | `npm run build` / `npm run db:init && npm start` | `<PUBLIC_URL>` |
| Production Database | Render PostgreSQL | PostgreSQL 16 (`001` & `002` migrations + `001-demo-data.js`) | Internal TLS (`DB_SSL=true`) |
| Health Probe | Render Health Check | `GET /health` (`SELECT 1 AS healthy`) | `<PUBLIC_URL>/health` |

## 2. CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) enforces quality gates on every push and Pull Request targeting `main`.

| Job | Trigger | Steps | Gate |
| :--- | :--- | :--- | :--- |
| `Install, Build & Test` | `push` & `pull_request` to `main` | `npm ci` (backend & frontend), `npm run build`, `npm --prefix frontend test` (8 tests), `npm test` (72 tests) | Required status check on `main` |
| `Deploy to Production` | `push` to `main` only | Triggers `RENDER_DEPLOY_HOOK_URL` (or Render auto-deploy) | `needs: test` (runs only after green CI) |

Branch protection on `main` requires a Pull Request, at least 1 approving review, and a passing `Install, Build & Test` check before merging.

## 3. Environment Configuration

All production secrets are injected via platform environment variables and never committed to Git (`.env.example` documents safe placeholders).

| Variable | Required | Production Value / Source | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables secure cookies, HSTS, and stack-trace suppression |
| `PORT` | Auto | Injected by Render (`10000`) | HTTP listener port bound on `0.0.0.0` |
| `DATABASE_URL` | Yes | Render PostgreSQL connection URI | Configures `pg.Pool` connection parameters |
| `DB_SSL` | Yes | `true` | Enables TLS with `rejectUnauthorized: false` for managed Postgres |
| `FRONTEND_ORIGIN` | Optional | Public `https://` origin(s) | Configures CORS allow-list |
| `RENDER_DEPLOY_HOOK_URL` | Optional | GitHub Actions Secret | Triggers production deploy after green CI on `main` |

## 4. Monitoring & Logging

Operational visibility combines platform health probes, request metrics (`backend/src/middleware/request-logger.js`), and safe structured error logging (`backend/src/middleware/error-handler.js`).

| Signal | Source / Mechanism | Target / Threshold | Investigation Trigger |
| :--- | :--- | :--- | :--- |
| Availability | `GET /health` & `GET /api/health` | HTTP `200` (`database: "up"`) | Any HTTP `503` response or failed Render health probe |
| Error Rate | `operationalMonitor` & Render HTTP logs | `5xx` server error rate `< 1%` | Any `HTTP 5xx server error response` log entry |
| API Response Time | `createRequestLogger` (`duration_ms`) | `< 1000 ms` per API request | `Slow HTTP response detected` warning (`duration_ms >= 1000`) |

### Log Access & Safe Logging Policy

1. Open the Render Dashboard, select the `pricelens` web service, and open the **Logs** tab to stream or search live application stdout/stderr logs.
2. `sanitizeLogPath`, `sanitizeLogText`, and `redactSensitiveFields` automatically strip query strings and redact passwords, session tokens, cookies, `Authorization` headers, `postgres://` database URIs, and user email addresses (`[REDACTED]`).
3. When `NODE_ENV=production`, stack traces and raw persistence details are suppressed from both HTTP responses and logs.

## 5. Common Issues & Troubleshooting

| Symptom / Failure Scenario | Primary Cause | Diagnosis & Resolution Steps |
| :--- | :--- | :--- |
| `GET /health` returns HTTP `503` (`database: "down"`) | PostgreSQL unreachable, invalid `DATABASE_URL`, or missing SSL | Check Render **Logs** for `Unexpected PostgreSQL pool error`; verify `DATABASE_URL` and `DB_SSL=true` in **Environment** settings; confirm PostgreSQL instance status is **Available**. |
| `POST /api/auth/login` fails across domains or refreshes | Missing `trust proxy` or mismatched `FRONTEND_ORIGIN` | Confirm `NODE_ENV=production`, access via `https://`, and ensure the public frontend origin is listed in `FRONTEND_ORIGIN`. |
| Empty watchlist or missing P0 demo fixtures | Seed script not executed after database reset | Run `npm run db:init` in the Render Shell (or redeploy) and verify with `node scripts/verify-p0-production.js`. |
| Deployment build fails in CI or Render | Dependency mismatch or broken test/build | Inspect the failed step in GitHub Actions `Install, Build & Test`, reproduce locally with `npm run build && npm test`, and open a fix PR. |

## 6. Rollback Procedure

If a production deployment introduces critical regressions or fails `/health` checks after merge:

1. **Immediate Platform Rollback (Render Dashboard):**
   - Open the `pricelens` service in Render Dashboard $\rightarrow$ **Events** / **Deploys**.
   - Locate the last known healthy deployment commit (prior to the faulty release) and click **Rollback to this deploy**.
2. **Git Repository Rollback (Permanent Fix on `main`):**
   - Identify the faulty merge commit with `git log --oneline -n 5 main`.
   - Create a revert branch and open an emergency PR:
     ```bash
     git checkout -b fix/rollback-release main
     git revert -m 1 <faulty-merge-commit-sha> --no-edit
     git push origin fix/rollback-release
     ```
   - Merge the revert PR after `Install, Build & Test` passes so `main` and production stay synchronized.
3. **Post-Rollback Verification:**
   - Check `GET <PUBLIC_URL>/health` returns HTTP `200` (`status: "ok"`, `database: "up"`).
   - Run `VERIFY_BASE_URL=<PUBLIC_URL> node scripts/verify-p0-production.js` to confirm all 5 P0 stories pass.
